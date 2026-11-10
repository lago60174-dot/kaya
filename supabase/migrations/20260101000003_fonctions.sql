-- Fonctions métier atomiques (RPC). Chacune : tout réussit ou rien n'est écrit.

create function exiger_acces(p_boutique uuid) returns membres language plpgsql security definer set search_path = public as $$
declare m membres;
begin
  select * into m from membres where utilisateur_id = auth.uid() and actif;
  if not found then raise exception 'Vous devez être connecté.'; end if;
  if not exists (select 1 from boutiques b where b.id = p_boutique and b.organisation_id = m.organisation_id) then
    raise exception 'Boutique introuvable.';
  end if;
  if m.role <> 'proprietaire' and not (p_boutique = any (m.boutiques_autorisees)) then
    raise exception 'Accès refusé à cette boutique.';
  end if;
  return m;
end $$;

-- Numérotation sans trou : le compteur est verrouillé dans la transaction de la vente.
create function prochain_numero(p_org uuid, p_boutique uuid, p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_annee int := extract(year from (now() at time zone 'Africa/Douala'))::int;
  v_n int;
  v_prefixe text := case p_type when 'recu' then 'R' when 'paiement' then 'P' else 'A' end;
begin
  insert into compteurs_recus (boutique_id, annee, type, organisation_id, dernier)
  values (p_boutique, v_annee, p_type, p_org, 1)
  on conflict (boutique_id, annee, type) do update set dernier = compteurs_recus.dernier + 1
  returning dernier into v_n;
  return format('%s-%s-%s', v_prefixe, v_annee, lpad(v_n::text, 6, '0'));
end $$;

create function creer_organisation(p_nom text, p_nom_boutique text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_boutique uuid;
begin
  if auth.uid() is null then raise exception 'Vous devez être connecté.'; end if;
  if exists (select 1 from membres where utilisateur_id = auth.uid()) then
    raise exception 'Ce compte appartient déjà à une boutique.';
  end if;
  if length(trim(coalesce(p_nom, ''))) = 0 or length(trim(coalesce(p_nom_boutique, ''))) = 0 then
    raise exception 'Le nom de l''entreprise et de la boutique est obligatoire.';
  end if;
  insert into organisations (nom) values (trim(p_nom)) returning id into v_org;
  insert into boutiques (organisation_id, nom) values (v_org, trim(p_nom_boutique)) returning id into v_boutique;
  insert into parametres_boutique (boutique_id, organisation_id) values (v_boutique, v_org);
  insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees)
  values (auth.uid(), v_org, 'proprietaire', array[v_boutique]);
  perform ecrire_journal(v_org, v_boutique, 'organisation_creee', 'organisation', v_org::text, '{}');
  return jsonb_build_object('organisation_id', v_org, 'boutique_id', v_boutique);
end $$;

-- Vente. Lignes : [{produit_id, unite_id, quantite, remise_ligne?}]. Paiements : [{mode, montant?}]
-- (un seul montant peut être omis = reste à payer). Ce qui n'est pas payé devient un crédit.
create function creer_vente(
  p_boutique uuid, p_cle uuid, p_lignes jsonb, p_paiements jsonb default '[]',
  p_client uuid default null, p_remise bigint default 0, p_forcer boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres; v_param parametres_boutique; v_vente ventes;
  v_nb int; v_brut bigint; v_remise_lignes bigint; v_remise bigint; v_total bigint; v_pct numeric;
  v_paye bigint; v_nulls int; v_reste bigint; v_credit bigint;
  v_plafond bigint; v_dette bigint; r record; e jsonb;
  v_brut_ligne bigint; v_base numeric; v_stock numeric; v_ligne uuid; v_numero text;
begin
  m := exiger_acces(p_boutique);
  if p_forcer and m.role <> 'proprietaire' then
    raise exception 'Seul le propriétaire peut forcer cette opération.';
  end if;

  select * into v_vente from ventes where boutique_id = p_boutique and cle_idempotence = p_cle;
  if found then
    return jsonb_build_object('vente_id', v_vente.id, 'numero_recu', v_vente.numero_recu,
      'jeton_public', v_vente.jeton_public, 'total', v_vente.total, 'deja_enregistree', true);
  end if;

  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Ajoutez au moins un article.';
  end if;
  v_remise := coalesce(p_remise, 0);
  if v_remise < 0 then raise exception 'Remise invalide.'; end if;
  select * into v_param from parametres_boutique where boutique_id = p_boutique;
  if p_client is not null and not exists (select 1 from clients where id = p_client and organisation_id = m.organisation_id) then
    raise exception 'Client introuvable.';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_lignes) as l(quantite numeric, remise_ligne bigint)
    where l.quantite is null or l.quantite <= 0 or l.quantite <> round(l.quantite, 3) or coalesce(l.remise_ligne, 0) < 0
  ) then raise exception 'Quantité ou remise invalide.'; end if;

  -- Les prix viennent de la base, jamais du client.
  select count(*), coalesce(sum(round(l.quantite * u.prix_vente)), 0), coalesce(sum(coalesce(l.remise_ligne, 0)), 0)
    into v_nb, v_brut, v_remise_lignes
  from jsonb_to_recordset(p_lignes) as l(produit_id uuid, unite_id uuid, quantite numeric, remise_ligne bigint)
  join produit_unites u on u.id = l.unite_id and u.produit_id = l.produit_id
       and u.organisation_id = m.organisation_id and u.archive_le is null
  join produits p on p.id = l.produit_id and p.organisation_id = m.organisation_id and p.actif and p.archive_le is null;
  if v_nb <> jsonb_array_length(p_lignes) then
    raise exception 'Un article ou une unité est introuvable ou n''est plus en vente.';
  end if;

  v_remise := v_remise + v_remise_lignes;
  v_total := v_brut - v_remise;
  if v_total <= 0 then raise exception 'Le total doit être supérieur à zéro.'; end if;
  v_pct := v_remise * 100.0 / v_brut;
  if m.role = 'vendeur' and v_pct > v_param.seuil_remise_vendeur then
    raise exception 'Remise trop élevée : le maximum pour un vendeur est de % %. Demandez au propriétaire.', v_param.seuil_remise_vendeur, '%';
  end if;

  if exists (select 1 from jsonb_array_elements(coalesce(p_paiements, '[]')) x
             where x->>'mode' not in ('especes', 'mtn_momo', 'orange_money')
                or (x->>'montant' is not null and (x->>'montant')::bigint <= 0)) then
    raise exception 'Mode ou montant de paiement invalide.';
  end if;
  select coalesce(sum((x->>'montant')::bigint), 0), count(*) filter (where x->>'montant' is null)
    into v_paye, v_nulls from jsonb_array_elements(coalesce(p_paiements, '[]')) x;
  if v_nulls > 1 then raise exception 'Un seul paiement peut être sans montant.'; end if;
  v_reste := v_total - v_paye;
  if v_nulls = 1 then
    if v_reste <= 0 then raise exception 'Montant de paiement invalide.'; end if;
    v_paye := v_total;
  end if;
  if v_paye > v_total then raise exception 'Le montant payé dépasse le total.'; end if;
  v_credit := v_total - v_paye;

  if v_credit > 0 then
    if p_client is null then raise exception 'Choisissez un client pour vendre à crédit.'; end if;
    select coalesce(c.plafond_credit, v_param.plafond_credit_defaut) into v_plafond from clients c where c.id = p_client;
    select coalesce(sum(solde), 0) into v_dette from creances where client_id = p_client and statut = 'ouverte';
    if v_dette + v_credit > v_plafond then
      if not p_forcer then
        raise exception 'Plafond de crédit dépassé pour ce client (dette % + % > plafond %).', v_dette, v_credit, v_plafond;
      end if;
      perform ecrire_journal(m.organisation_id, p_boutique, 'credit_force', 'client', p_client::text,
        jsonb_build_object('dette', v_dette, 'credit', v_credit, 'plafond', v_plafond), true);
    end if;
  end if;

  v_numero := prochain_numero(m.organisation_id, p_boutique, 'recu');
  insert into ventes (organisation_id, boutique_id, numero_recu, jeton_public, client_id, vendeur_id, sous_total, remise, total, cle_idempotence)
  values (m.organisation_id, p_boutique, v_numero,
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          p_client, auth.uid(), v_brut, v_remise, v_total, p_cle)
  returning * into v_vente;

  for r in
    select l.produit_id, l.unite_id, l.quantite, coalesce(l.remise_ligne, 0) as remise_ligne,
           u.nom as nom_unite, u.facteur, u.prix_vente, p.nom as nom_produit, coalesce(c.prix_achat, 0) as prix_achat
    from jsonb_to_recordset(p_lignes) as l(produit_id uuid, unite_id uuid, quantite numeric, remise_ligne bigint)
    join produit_unites u on u.id = l.unite_id
    join produits p on p.id = l.produit_id
    left join produit_couts c on c.produit_id = p.id
    order by l.produit_id
  loop
    v_brut_ligne := round(r.quantite * r.prix_vente);
    if r.remise_ligne > v_brut_ligne then raise exception 'La remise dépasse le prix de la ligne.'; end if;
    v_base := r.quantite * r.facteur;

    insert into stock_courant (produit_id, boutique_id, organisation_id, quantite)
    values (r.produit_id, p_boutique, m.organisation_id, 0) on conflict do nothing;
    select quantite into v_stock from stock_courant
      where produit_id = r.produit_id and boutique_id = p_boutique for update;
    if v_stock < v_base then
      if not v_param.stock_negatif_autorise then
        raise exception 'Stock insuffisant pour « % » : % disponible(s) en unité de base.', r.nom_produit, v_stock;
      end if;
      perform ecrire_journal(m.organisation_id, p_boutique, 'stock_negatif', 'produit', r.produit_id::text,
        jsonb_build_object('produit', r.nom_produit, 'stock_avant', v_stock, 'vendu', v_base), true);
    end if;

    insert into vente_lignes (organisation_id, vente_id, produit_id, unite_id, nom_produit, nom_unite, quantite, facteur, prix_unitaire, remise_ligne, total_ligne)
    values (m.organisation_id, v_vente.id, r.produit_id, r.unite_id, r.nom_produit, r.nom_unite, r.quantite, r.facteur, r.prix_vente, r.remise_ligne, v_brut_ligne - r.remise_ligne)
    returning id into v_ligne;
    insert into vente_lignes_couts (vente_ligne_id, organisation_id, cout_total)
    values (v_ligne, m.organisation_id, round(v_base * r.prix_achat));
    insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite, reference, auteur_id)
    values (m.organisation_id, p_boutique, r.produit_id, 'vente', -v_base, v_vente.id::text, auth.uid());
  end loop;

  for e in select * from jsonb_array_elements(coalesce(p_paiements, '[]')) loop
    insert into paiements (organisation_id, boutique_id, type, vente_id, client_id, mode, montant, auteur_id)
    values (m.organisation_id, p_boutique, 'vente', v_vente.id, p_client, e->>'mode',
            coalesce((e->>'montant')::bigint, v_reste), auth.uid());
  end loop;

  if v_credit > 0 then
    insert into creances (organisation_id, boutique_id, client_id, vente_id, montant_du)
    values (m.organisation_id, p_boutique, p_client, v_vente.id, v_credit);
  end if;

  if v_remise > 0 and v_pct * 2 > v_param.seuil_remise_vendeur then
    perform ecrire_journal(m.organisation_id, p_boutique, 'remise_elevee', 'vente', v_vente.id::text,
      jsonb_build_object('numero_recu', v_numero, 'remise', v_remise, 'pourcentage', round(v_pct, 2)), true);
  end if;
  perform ecrire_journal(m.organisation_id, p_boutique, 'vente_creee', 'vente', v_vente.id::text,
    jsonb_build_object('numero_recu', v_numero, 'total', v_total, 'credit', v_credit));

  return jsonb_build_object('vente_id', v_vente.id, 'numero_recu', v_numero,
    'jeton_public', v_vente.jeton_public, 'total', v_total, 'credit', v_credit, 'deja_enregistree', false);
end $$;

create function annuler_vente(p_vente uuid, p_motif text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v ventes; m membres; r record; v_esp bigint; v_numero text;
begin
  select * into v from ventes where id = p_vente for update;
  if not found then raise exception 'Vente introuvable.'; end if;
  m := exiger_acces(v.boutique_id);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut annuler une vente.'; end if;
  if length(trim(coalesce(p_motif, ''))) = 0 then raise exception 'Un motif est obligatoire pour annuler une vente.'; end if;
  if v.statut <> 'valide' then raise exception 'Cette vente est déjà annulée.'; end if;

  for r in select produit_id, sum(quantite * facteur) as base from vente_lignes where vente_id = p_vente group by produit_id order by produit_id loop
    insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite, reference, motif, auteur_id)
    values (v.organisation_id, v.boutique_id, r.produit_id, 'retour', r.base, p_vente::text, p_motif, auth.uid());
  end loop;

  update creances set statut = 'annulee' where vente_id = p_vente;
  select coalesce(sum(montant), 0) into v_esp from paiements where vente_id = p_vente and mode = 'especes';
  v_numero := prochain_numero(v.organisation_id, v.boutique_id, 'avoir');
  insert into avoirs (organisation_id, boutique_id, vente_id, numero, motif, montant, rembourse_especes, auteur_id)
  values (v.organisation_id, v.boutique_id, p_vente, v_numero, trim(p_motif), v.total, v_esp, auth.uid());
  update ventes set statut = 'annulee' where id = p_vente;
  perform ecrire_journal(v.organisation_id, v.boutique_id, 'vente_annulee', 'vente', p_vente::text,
    jsonb_build_object('numero_recu', v.numero_recu, 'avoir', v_numero, 'motif', trim(p_motif), 'montant', v.total), true);
  return jsonb_build_object('avoir', v_numero, 'montant', v.total, 'rembourse_especes', v_esp);
end $$;

create function enregistrer_remboursement(p_creance uuid, p_montant bigint, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c creances; m membres; v_numero text;
begin
  select * into c from creances where id = p_creance for update;
  if not found then raise exception 'Crédit introuvable.'; end if;
  m := exiger_acces(c.boutique_id);
  if p_mode not in ('especes', 'mtn_momo', 'orange_money') then raise exception 'Mode de paiement invalide.'; end if;
  if c.statut <> 'ouverte' then raise exception 'Ce crédit n''est plus à rembourser.'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant doit être supérieur à zéro.'; end if;
  if p_montant > c.solde then raise exception 'Le montant dépasse ce que le client doit encore (% FCFA).', c.solde; end if;

  v_numero := prochain_numero(c.organisation_id, c.boutique_id, 'paiement');
  insert into paiements (organisation_id, boutique_id, type, vente_id, creance_id, client_id, mode, montant, numero_recu, auteur_id)
  values (c.organisation_id, c.boutique_id, 'remboursement_credit', c.vente_id, c.id, c.client_id, p_mode, p_montant, v_numero, auth.uid());
  update creances set montant_paye = montant_paye + p_montant,
    statut = case when montant_paye + p_montant = montant_du then 'soldee' else 'ouverte' end
  where id = c.id;
  perform ecrire_journal(c.organisation_id, c.boutique_id, 'remboursement_credit', 'creance', c.id::text,
    jsonb_build_object('numero', v_numero, 'montant', p_montant, 'mode', p_mode));
  return jsonb_build_object('numero_recu', v_numero, 'solde', c.solde - p_montant);
end $$;

-- Mouvements de stock manuels (propriétaire). p_quantite est dans l'unité p_unite (ou l'unité de base).
-- inventaire : p_quantite = quantité comptée ; correction : quantité signée.
create function enregistrer_mouvement_stock(
  p_boutique uuid, p_produit uuid, p_type text, p_quantite numeric,
  p_unite uuid default null, p_motif text default null, p_prix_achat bigint default null
) returns numeric language plpgsql security definer set search_path = public as $$
declare
  m membres; v_param parametres_boutique; v_facteur numeric := 1; v_base numeric; v_stock numeric; v_delta numeric;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut modifier le stock.'; end if;
  if p_type not in ('entree', 'perte', 'inventaire', 'correction') then raise exception 'Type de mouvement invalide.'; end if;
  if not exists (select 1 from produits where id = p_produit and organisation_id = m.organisation_id) then
    raise exception 'Produit introuvable.';
  end if;
  if p_unite is not null then
    select facteur into v_facteur from produit_unites where id = p_unite and produit_id = p_produit;
    if not found then raise exception 'Unité introuvable pour ce produit.'; end if;
  end if;
  if p_quantite is null or p_quantite <> round(p_quantite, 3) then raise exception 'Quantité invalide.'; end if;
  if p_type in ('perte', 'correction') and length(trim(coalesce(p_motif, ''))) = 0 then
    raise exception 'Un motif est obligatoire.';
  end if;
  v_base := p_quantite * v_facteur;

  select * into v_param from parametres_boutique where boutique_id = p_boutique;
  insert into stock_courant (produit_id, boutique_id, organisation_id, quantite)
  values (p_produit, p_boutique, m.organisation_id, 0) on conflict do nothing;
  select quantite into v_stock from stock_courant where produit_id = p_produit and boutique_id = p_boutique for update;

  v_delta := case p_type
    when 'entree' then v_base
    when 'perte' then -v_base
    when 'inventaire' then v_base - v_stock
    else v_base end;
  if p_type in ('entree', 'perte') and p_quantite <= 0 then raise exception 'La quantité doit être supérieure à zéro.'; end if;
  if p_type = 'inventaire' and p_quantite < 0 then raise exception 'La quantité comptée ne peut pas être négative.'; end if;
  if v_stock + v_delta < 0 and not v_param.stock_negatif_autorise then
    raise exception 'Cette opération ferait passer le stock sous zéro (stock actuel : %).', v_stock;
  end if;

  if v_delta <> 0 then
    insert into mouvements_stock (organisation_id, boutique_id, produit_id, type, quantite, motif, auteur_id)
    values (m.organisation_id, p_boutique, p_produit, p_type, v_delta, p_motif, auth.uid());
    perform ecrire_journal(m.organisation_id, p_boutique, 'stock_' || p_type, 'produit', p_produit::text,
      jsonb_build_object('quantite_base', v_delta, 'motif', p_motif));
  end if;
  if p_type = 'entree' and p_prix_achat is not null then
    if p_prix_achat < 0 then raise exception 'Prix d''achat invalide.'; end if;
    insert into produit_couts (produit_id, organisation_id, prix_achat) values (p_produit, m.organisation_id, p_prix_achat)
    on conflict (produit_id) do update set prix_achat = excluded.prix_achat;
  end if;
  return v_stock + v_delta;
end $$;

-- Résumé de caisse d'un jour (fuseau Africa/Douala).
create function calculer_caisse(p_boutique uuid, p_date date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres; v_ventes bigint; v_ev bigint; v_er bigint; v_momo bigint; v_om bigint; v_de bigint; v_dt bigint; v_av bigint;
begin
  m := exiger_acces(p_boutique);
  select coalesce(sum(total), 0) into v_ventes from ventes
    where boutique_id = p_boutique and statut = 'valide' and (date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(montant) filter (where type = 'vente' and mode = 'especes'), 0),
         coalesce(sum(montant) filter (where type = 'remboursement_credit' and mode = 'especes'), 0),
         coalesce(sum(montant) filter (where mode = 'mtn_momo'), 0),
         coalesce(sum(montant) filter (where mode = 'orange_money'), 0)
    into v_ev, v_er, v_momo, v_om from paiements
    where boutique_id = p_boutique and (date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(montant) filter (where mode = 'especes'), 0), coalesce(sum(montant), 0) into v_de, v_dt from depenses
    where boutique_id = p_boutique and (date at time zone 'Africa/Douala')::date = p_date;
  select coalesce(sum(rembourse_especes), 0) into v_av from avoirs
    where boutique_id = p_boutique and (date at time zone 'Africa/Douala')::date = p_date;
  return jsonb_build_object('ventes_total', v_ventes, 'encaissements_especes', v_ev, 'remboursements_credit_especes', v_er,
    'mtn_momo', v_momo, 'orange_money', v_om, 'depenses_total', v_dt, 'depenses_especes', v_de,
    'avoirs_especes', v_av, 'especes_attendues', v_ev + v_er - v_de - v_av);
end $$;

create function cloturer_caisse(p_boutique uuid, p_date date, p_especes_comptees bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m membres; v_caisse jsonb; v_attendu bigint; v_ecart bigint; v_tol bigint; v_id uuid;
begin
  m := exiger_acces(p_boutique);
  if p_especes_comptees is null or p_especes_comptees < 0 then raise exception 'Montant compté invalide.'; end if;
  if exists (select 1 from clotures_caisse where boutique_id = p_boutique and date = p_date) then
    raise exception 'La caisse de cette date est déjà clôturée.';
  end if;
  v_caisse := calculer_caisse(p_boutique, p_date);
  v_attendu := (v_caisse->>'especes_attendues')::bigint;
  v_ecart := p_especes_comptees - v_attendu;
  select ecart_caisse_tolere into v_tol from parametres_boutique where boutique_id = p_boutique;
  insert into clotures_caisse (organisation_id, boutique_id, date, especes_attendues, especes_comptees, ecart, auteur_id)
  values (m.organisation_id, p_boutique, p_date, v_attendu, p_especes_comptees, v_ecart, auth.uid()) returning id into v_id;
  perform ecrire_journal(m.organisation_id, p_boutique, 'caisse_cloturee', 'cloture', v_id::text,
    jsonb_build_object('attendu', v_attendu, 'compte', p_especes_comptees, 'ecart', v_ecart), abs(v_ecart) > v_tol);
  return jsonb_build_object('cloture_id', v_id, 'especes_attendues', v_attendu, 'ecart', v_ecart);
end $$;

create function valider_cloture(p_cloture uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c clotures_caisse; m membres;
begin
  select * into c from clotures_caisse where id = p_cloture for update;
  if not found then raise exception 'Clôture introuvable.'; end if;
  m := exiger_acces(c.boutique_id);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut valider la caisse.'; end if;
  if c.validee_le is not null then raise exception 'Cette caisse est déjà validée.'; end if;
  update clotures_caisse set validee_par = auth.uid(), validee_le = now() where id = p_cloture;
  perform ecrire_journal(c.organisation_id, c.boutique_id, 'caisse_validee', 'cloture', p_cloture::text, '{}');
end $$;
