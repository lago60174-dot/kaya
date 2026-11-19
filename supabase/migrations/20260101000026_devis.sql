-- 21 : devis, proformas et bons de livraison (section 9.10, plans Pro et Business).
--
-- Cycle d'un devis : brouillon -> envoye -> accepte | refuse ; accepte -> converti (vente) | refuse.
-- Un brouillon se modifie et n'a pas de numéro. Le numéro (D-2026-000001, PF-2026-000001) est attribué à l'envoi,
-- dans la même transaction : la numérotation reste continue et sans trou, même si un brouillon est abandonné.
-- Un devis envoyé ne se modifie plus : on le duplique en brouillon pour le corriger.

-- 1. Numérotation par boutique, par année et par type de document.
create table compteurs_documents (
  boutique_id uuid not null references boutiques(id),
  annee int not null,
  type text not null check (type in ('devis', 'proforma', 'bon_livraison')),
  organisation_id uuid not null references organisations(id),
  dernier int not null default 0,
  primary key (boutique_id, annee, type)
);

create function prochain_numero_document(p_org uuid, p_boutique uuid, p_type text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_annee int := extract(year from (now() at time zone 'Africa/Douala'))::int;
  v_n int;
  v_prefixe text := case p_type when 'devis' then 'D' when 'proforma' then 'PF' when 'bon_livraison' then 'BL' end;
begin
  if v_prefixe is null then raise exception 'Type de document invalide.'; end if;
  insert into compteurs_documents (boutique_id, annee, type, organisation_id, dernier)
  values (p_boutique, v_annee, p_type, p_org, 1)
  on conflict (boutique_id, annee, type) do update set dernier = compteurs_documents.dernier + 1
  returning dernier into v_n;
  return format('%s-%s-%s', v_prefixe, v_annee, lpad(v_n::text, 6, '0'));
end $$;

-- 2. Tables.
create table devis (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  type text not null default 'devis' check (type in ('devis', 'proforma')),
  numero text,
  client_id uuid references clients(id),
  auteur_id uuid not null,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'envoye', 'accepte', 'refuse', 'converti')),
  sous_total bigint not null default 0 check (sous_total >= 0),
  remise bigint not null default 0 check (remise >= 0),
  total bigint not null default 0 check (total >= 0),
  valide_jusqu date not null,
  conditions text check (char_length(conditions) <= 500),
  note text check (char_length(note) <= 300),
  vente_id uuid unique references ventes(id),
  cle_idempotence uuid not null,
  envoye_le timestamptz,
  decide_le timestamptz,
  converti_le timestamptz,
  archive_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  unique (boutique_id, numero),
  unique (boutique_id, cle_idempotence),
  check ((statut = 'brouillon') = (numero is null)),
  check ((statut = 'converti') = (vente_id is not null))
);

-- Les prix sont figés à l'enregistrement : un devis est une promesse de prix.
create table devis_lignes (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  devis_id uuid not null references devis(id),
  produit_id uuid not null references produits(id),
  unite_id uuid not null references produit_unites(id),
  nom_produit text not null,
  nom_unite text not null,
  quantite numeric(12,3) not null check (quantite > 0),
  facteur numeric(12,3) not null,
  prix_unitaire bigint not null check (prix_unitaire >= 0),
  total_ligne bigint not null check (total_ligne >= 0),
  ordre int not null default 0,
  cree_le timestamptz not null default now()
);

-- Un bon de livraison ne touche pas au stock (la vente l'a déjà fait). Une seule source : une vente OU un devis accepté.
create table bons_livraison (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  boutique_id uuid not null references boutiques(id),
  numero text not null,
  vente_id uuid unique references ventes(id),
  devis_id uuid unique references devis(id),
  adresse_livraison text check (char_length(adresse_livraison) <= 200),
  note text check (char_length(note) <= 300),
  auteur_id uuid not null,
  date timestamptz not null default now(),
  cree_le timestamptz not null default now(),
  unique (boutique_id, numero),
  check ((vente_id is null) <> (devis_id is null))
);

create index on devis (boutique_id, cree_le desc, id desc) where archive_le is null;
create index on devis (client_id);
create index on devis_lignes (devis_id);
create index on bons_livraison (boutique_id, date desc, id desc);

-- 3. Règles d'immuabilité.
create trigger trg_modifie_le before update on devis for each row execute function maj_modifie_le();
create trigger trg_pas_de_suppression before delete on devis for each row execute function interdire_suppression();
create trigger trg_immuable before update or delete on bons_livraison for each row execute function interdire_modification();

create function verifier_devis_modifiable() returns trigger language plpgsql as $$
declare
  v_libres text[] := array['statut', 'vente_id', 'modifie_le', 'decide_le', 'converti_le'];
begin
  if old.statut = 'brouillon' then
    if new.statut not in ('brouillon', 'envoye') then
      raise exception 'Un brouillon doit d''abord être envoyé.';
    end if;
    return new;
  end if;
  if new.archive_le is distinct from old.archive_le then
    raise exception 'Seul un brouillon peut être supprimé.';
  end if;
  if (to_jsonb(new) - v_libres) is distinct from (to_jsonb(old) - v_libres) then
    raise exception 'Un devis envoyé ne peut plus être modifié. Dupliquez-le pour le corriger.';
  end if;
  if not (new.statut = old.statut
          or (old.statut = 'envoye' and new.statut in ('accepte', 'refuse'))
          or (old.statut = 'accepte' and new.statut in ('refuse', 'converti'))) then
    raise exception 'Ce devis ne peut pas passer de « % » à « % ».', old.statut, new.statut;
  end if;
  return new;
end $$;
create trigger trg_devis_modifiable before update on devis for each row execute function verifier_devis_modifiable();

-- Les lignes ne changent que tant que le devis est un brouillon.
create function verifier_devis_ligne_modifiable() returns trigger language plpgsql as $$
declare v_statut text;
begin
  select statut into v_statut from devis where id = coalesce(new.devis_id, old.devis_id);
  if v_statut is distinct from 'brouillon' then
    raise exception 'Les lignes d''un devis envoyé ne se modifient jamais.';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_devis_ligne_modifiable before insert or update or delete on devis_lignes
  for each row execute function verifier_devis_ligne_modifiable();

-- 4. Droits et lecture. Écriture uniquement par les fonctions ci-dessous. Propriétaire seulement, comme le menu.
alter table compteurs_documents enable row level security;
alter table devis enable row level security;
alter table devis_lignes enable row level security;
alter table bons_livraison enable row level security;
revoke all on compteurs_documents, devis, devis_lignes, bons_livraison from anon, authenticated;
grant select on devis, devis_lignes, bons_livraison to authenticated;

create policy lecture on devis for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire' and app_acces_boutique(boutique_id));
create policy lecture on devis_lignes for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire'
         and exists (select 1 from devis d where d.id = devis_id and app_acces_boutique(d.boutique_id)));
create policy lecture on bons_livraison for select to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire' and app_acces_boutique(boutique_id));

-- 5. Fonctions.
-- Garde commune : connecté, boutique permise, compte pas en lecture seule, propriétaire, plan avec devis.
create function exiger_acces_devis(p_boutique uuid) returns membres language plpgsql security definer set search_path = public as $$
declare m membres;
begin
  m := exiger_acces(p_boutique);
  perform verifier_ecriture(m.organisation_id);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut gérer les devis.'; end if;
  if not plan_permet(m.organisation_id, 'devis') then
    raise exception 'Les devis ne sont pas inclus dans votre abonnement.';
  end if;
  return m;
end $$;

-- Enregistre un brouillon (créé ou remplacé) et, si p_envoyer, l'envoie (numéro attribué, plus modifiable).
-- Lignes : [{produit_id, unite_id, quantite}]. Les prix viennent de la base, jamais du client.
-- p_id null = nouveau brouillon (p_cle rend l'envoi répétable sans doublon).
create function enregistrer_devis(
  p_boutique uuid, p_cle uuid, p_id uuid, p_type text, p_client uuid, p_lignes jsonb, p_remise bigint,
  p_valide_jusqu date, p_conditions text, p_note text, p_envoyer boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres; d devis; v_nb int; v_brut bigint; v_remise bigint := coalesce(p_remise, 0); v_total bigint;
  v_conditions text := nullif(trim(coalesce(p_conditions, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_aujourdhui date := (now() at time zone 'Africa/Douala')::date;
  v_numero text;
begin
  m := exiger_acces_devis(p_boutique);

  if p_id is null then
    select * into d from devis where boutique_id = p_boutique and cle_idempotence = p_cle;
    if found then
      return jsonb_build_object('devis_id', d.id, 'numero', d.numero, 'statut', d.statut, 'total', d.total, 'deja_enregistre', true);
    end if;
  end if;

  if p_type not in ('devis', 'proforma') then raise exception 'Type de document invalide.'; end if;
  if jsonb_typeof(p_lignes) is distinct from 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Ajoutez au moins un article.';
  end if;
  if jsonb_array_length(p_lignes) > 100 then raise exception 'Trop d''articles dans un même devis.'; end if;
  if v_remise < 0 then raise exception 'Remise invalide.'; end if;
  if p_valide_jusqu is null then raise exception 'Indiquez la date de validité.'; end if;
  if p_valide_jusqu < v_aujourdhui then raise exception 'La date de validité est déjà passée.'; end if;
  if p_valide_jusqu > v_aujourdhui + 365 then raise exception 'La validité ne peut pas dépasser un an.'; end if;
  if char_length(v_conditions) > 500 then raise exception 'Les conditions sont trop longues (500 caractères maximum).'; end if;
  if char_length(v_note) > 300 then raise exception 'La note est trop longue (300 caractères maximum).'; end if;
  if p_client is not null and not exists (select 1 from clients where id = p_client and organisation_id = m.organisation_id) then
    raise exception 'Client introuvable.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lignes) as l(quantite numeric)
    where l.quantite is null or l.quantite <= 0 or l.quantite <> round(l.quantite, 3)
  ) then raise exception 'Quantité invalide.'; end if;

  select count(*), coalesce(sum(round(l.quantite * u.prix_vente)), 0)
    into v_nb, v_brut
  from jsonb_to_recordset(p_lignes) as l(produit_id uuid, unite_id uuid, quantite numeric)
  join produit_unites u on u.id = l.unite_id and u.produit_id = l.produit_id
       and u.organisation_id = m.organisation_id and u.archive_le is null
  join produits p on p.id = l.produit_id and p.organisation_id = m.organisation_id and p.actif and p.archive_le is null;
  if v_nb <> jsonb_array_length(p_lignes) then
    raise exception 'Un article ou une unité est introuvable ou n''est plus en vente.';
  end if;
  v_total := v_brut - v_remise;
  if v_total <= 0 then raise exception 'Le total doit être supérieur à zéro.'; end if;

  if p_id is null then
    insert into devis (organisation_id, boutique_id, type, client_id, auteur_id, sous_total, remise, total,
                       valide_jusqu, conditions, note, cle_idempotence)
    values (m.organisation_id, p_boutique, p_type, p_client, auth.uid(), v_brut, v_remise, v_total,
            p_valide_jusqu, v_conditions, v_note, p_cle)
    returning * into d;
  else
    select * into d from devis where id = p_id and boutique_id = p_boutique and organisation_id = m.organisation_id for update;
    if not found then raise exception 'Devis introuvable.'; end if;
    if d.archive_le is not null then raise exception 'Ce brouillon a été supprimé.'; end if;
    if d.statut <> 'brouillon' then raise exception 'Seul un brouillon peut être modifié. Dupliquez ce devis pour le corriger.'; end if;
    delete from devis_lignes where devis_id = d.id;
    update devis set type = p_type, client_id = p_client, sous_total = v_brut, remise = v_remise, total = v_total,
      valide_jusqu = p_valide_jusqu, conditions = v_conditions, note = v_note
    where id = d.id returning * into d;
  end if;

  insert into devis_lignes (organisation_id, devis_id, produit_id, unite_id, nom_produit, nom_unite, quantite, facteur,
                            prix_unitaire, total_ligne, ordre)
  select m.organisation_id, d.id, l.produit_id, l.unite_id, p.nom_affiche, u.nom, l.quantite, u.facteur,
         u.prix_vente, round(l.quantite * u.prix_vente), t.i::int
  from jsonb_array_elements(p_lignes) with ordinality t(e, i)
  cross join lateral jsonb_to_record(t.e) as l(produit_id uuid, unite_id uuid, quantite numeric)
  join produit_unites u on u.id = l.unite_id and u.produit_id = l.produit_id
  join produits p on p.id = l.produit_id;

  if p_envoyer then
    v_numero := prochain_numero_document(m.organisation_id, p_boutique, d.type);
    update devis set statut = 'envoye', numero = v_numero, envoye_le = now() where id = d.id returning * into d;
    perform ecrire_journal(m.organisation_id, p_boutique, 'devis_envoye', 'devis', d.id::text,
      jsonb_build_object('numero', d.numero, 'type', d.type, 'total', d.total));
  end if;

  return jsonb_build_object('devis_id', d.id, 'numero', d.numero, 'statut', d.statut, 'total', d.total, 'deja_enregistre', false);
end $$;

-- Le client a accepté ou refusé. Le propriétaire le note ; rien d'autre ne change.
create function marquer_devis(p_devis uuid, p_statut text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d devis; m membres;
begin
  if p_statut not in ('accepte', 'refuse') then raise exception 'Statut invalide.'; end if;
  select * into d from devis where id = p_devis for update;
  if not found then raise exception 'Devis introuvable.'; end if;
  m := exiger_acces_devis(d.boutique_id);
  if d.statut = p_statut then return jsonb_build_object('statut', d.statut); end if;
  if d.statut = 'brouillon' then raise exception 'Envoyez d''abord ce devis.'; end if;
  if d.statut = 'converti' then raise exception 'Ce devis est déjà converti en vente.'; end if;
  if d.statut = 'refuse' then raise exception 'Ce devis a été refusé. Dupliquez-le pour en refaire un.'; end if;
  if p_statut = 'accepte' and d.statut <> 'envoye' then raise exception 'Seul un devis envoyé peut être accepté.'; end if;
  update devis set statut = p_statut, decide_le = now() where id = d.id;
  perform ecrire_journal(m.organisation_id, d.boutique_id, case p_statut when 'accepte' then 'devis_accepte' else 'devis_refuse' end,
    'devis', d.id::text, jsonb_build_object('numero', d.numero, 'type', d.type, 'total', d.total));
  return jsonb_build_object('statut', p_statut);
end $$;

-- Un brouillon abandonné n'est jamais effacé : il est archivé (pas de trou dans les numéros, il n'en a pas).
create function archiver_devis_brouillon(p_devis uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d devis;
begin
  select * into d from devis where id = p_devis for update;
  if not found then raise exception 'Devis introuvable.'; end if;
  perform exiger_acces_devis(d.boutique_id);
  if d.statut <> 'brouillon' then raise exception 'Seul un brouillon peut être supprimé.'; end if;
  if d.archive_le is null then update devis set archive_le = now() where id = d.id; end if;
end $$;

-- Nouveau brouillon à partir d'un devis existant : sert à corriger un devis envoyé ou à en refaire un refusé.
-- Les prix sont relus dans le catalogue du jour. Validité : 15 jours.
create function dupliquer_devis(p_devis uuid, p_cle uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d devis; v_lignes jsonb;
begin
  select * into d from devis where id = p_devis;
  if not found then raise exception 'Devis introuvable.'; end if;
  perform exiger_acces_devis(d.boutique_id);
  select coalesce(jsonb_agg(jsonb_build_object('produit_id', produit_id, 'unite_id', unite_id, 'quantite', quantite) order by ordre, id), '[]')
    into v_lignes from devis_lignes where devis_id = d.id;
  return enregistrer_devis(d.boutique_id, p_cle, null, d.type, d.client_id, v_lignes, d.remise,
    (now() at time zone 'Africa/Douala')::date + 15, d.conditions, d.note, false);
end $$;

-- Transforme un devis accepté en vente, sans ressaisie. La vente passe par creer_vente : stock, plafond de crédit,
-- numéro de reçu, caisse et journal suivent exactement les règles d'une vente normale, dans la même transaction.
-- Les prix sont ceux du jour (la base recalcule tout) : le résultat dit si le total a changé depuis le devis.
create function convertir_devis(p_devis uuid, p_cle uuid, p_paiements jsonb default '[]', p_forcer boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d devis; m membres; v_lignes jsonb; v_res jsonb; v_vente ventes;
begin
  select * into d from devis where id = p_devis for update;
  if not found then raise exception 'Devis introuvable.'; end if;
  m := exiger_acces_devis(d.boutique_id);

  if d.statut = 'converti' then
    select * into v_vente from ventes where id = d.vente_id;
    if v_vente.cle_idempotence = p_cle then
      return jsonb_build_object('vente_id', v_vente.id, 'numero_recu', v_vente.numero_recu, 'total', v_vente.total,
        'total_devis', d.total, 'deja_convertie', true);
    end if;
    raise exception 'Ce devis est déjà converti en vente %.', v_vente.numero_recu;
  end if;
  if d.statut <> 'accepte' then raise exception 'Le client doit d''abord avoir accepté ce devis.'; end if;

  select jsonb_agg(jsonb_build_object('produit_id', produit_id, 'unite_id', unite_id, 'quantite', quantite) order by ordre, id)
    into v_lignes from devis_lignes where devis_id = d.id;

  v_res := creer_vente(d.boutique_id, p_cle, v_lignes, p_paiements, d.client_id, d.remise, p_forcer);

  update devis set statut = 'converti', vente_id = (v_res ->> 'vente_id')::uuid, converti_le = now() where id = d.id;
  perform ecrire_journal(m.organisation_id, d.boutique_id, 'devis_converti', 'devis', d.id::text,
    jsonb_build_object('numero', d.numero, 'numero_recu', v_res ->> 'numero_recu',
                       'total_devis', d.total, 'total_vente', (v_res ->> 'total')::bigint));
  return v_res || jsonb_build_object('total_devis', d.total, 'deja_convertie', false);
end $$;

-- Bon de livraison d'une vente valide OU d'un devis accepté (un seul par source : un second appel renvoie le premier).
create function creer_bon_livraison(p_boutique uuid, p_vente uuid, p_devis uuid, p_adresse text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres; b bons_livraison; v ventes; d devis;
  v_adresse text := nullif(trim(coalesce(p_adresse, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_numero text;
begin
  m := exiger_acces_devis(p_boutique);
  if (p_vente is null) = (p_devis is null) then raise exception 'Choisissez une vente ou un devis.'; end if;
  if char_length(v_adresse) > 200 then raise exception 'L''adresse de livraison est trop longue (200 caractères maximum).'; end if;
  if char_length(v_note) > 300 then raise exception 'La note est trop longue (300 caractères maximum).'; end if;

  if p_vente is not null then
    select * into v from ventes where id = p_vente and boutique_id = p_boutique and organisation_id = m.organisation_id for update;
    if not found then raise exception 'Vente introuvable.'; end if;
    if v.statut <> 'valide' then raise exception 'Cette vente est annulée : pas de bon de livraison.'; end if;
    select * into b from bons_livraison where vente_id = p_vente;
  else
    select * into d from devis where id = p_devis and boutique_id = p_boutique and organisation_id = m.organisation_id for update;
    if not found then raise exception 'Devis introuvable.'; end if;
    if d.statut = 'converti' then raise exception 'Ce devis est devenu une vente : faites le bon de livraison depuis le reçu.'; end if;
    if d.statut <> 'accepte' then raise exception 'Le client doit d''abord avoir accepté ce devis.'; end if;
    select * into b from bons_livraison where devis_id = p_devis;
  end if;
  if found then
    return jsonb_build_object('bon_id', b.id, 'numero', b.numero, 'deja_cree', true);
  end if;

  v_numero := prochain_numero_document(m.organisation_id, p_boutique, 'bon_livraison');
  insert into bons_livraison (organisation_id, boutique_id, numero, vente_id, devis_id, adresse_livraison, note, auteur_id)
  values (m.organisation_id, p_boutique, v_numero, p_vente, p_devis, v_adresse, v_note, auth.uid())
  returning * into b;
  perform ecrire_journal(m.organisation_id, p_boutique, 'bon_livraison_cree', 'bon_livraison', b.id::text,
    jsonb_build_object('numero', v_numero, 'source', case when p_vente is not null then v.numero_recu else d.numero end));
  return jsonb_build_object('bon_id', b.id, 'numero', v_numero, 'deja_cree', false);
end $$;

-- Liste paginée (curseur date + id), droits de l'appelant : la RLS s'applique.
-- Recherche : numéro ou nom du client. Filtre : statut (brouillon, envoye, accepte, refuse, converti) et type.
create function lister_devis(
  p_boutique uuid, p_recherche text default null, p_statut text default null, p_type text default null,
  p_limite int default 30, p_apres_date timestamptz default null, p_apres_id uuid default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_brut text := nullif(trim(p_recherche), '');
  v_nom text;
  v_lignes jsonb; v_suivant jsonb;
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  if p_statut is not null and p_statut not in ('brouillon', 'envoye', 'accepte', 'refuse', 'converti') then
    raise exception 'Statut invalide.';
  end if;
  if p_type is not null and p_type not in ('devis', 'proforma') then raise exception 'Type invalide.'; end if;
  if v_brut is not null then
    v_nom := replace(replace(replace(normaliser_texte(v_brut), '\', '\\'), '%', '\%'), '_', '\_');
  end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.cree_le desc, b.id desc), '[]') into v_lignes from (
    select d.id, d.type, d.numero, d.statut, d.total, d.valide_jusqu, d.cree_le, c.nom as client_nom
      from devis d
      left join clients c on c.id = d.client_id
     where d.boutique_id = p_boutique and d.archive_le is null
       and (p_statut is null or d.statut = p_statut)
       and (p_type is null or d.type = p_type)
       and (v_brut is null
            or lower(coalesce(d.numero, '')) like '%' || lower(v_nom) || '%' escape '\'
            or normaliser_texte(c.nom) like '%' || v_nom || '%' escape '\')
       and (p_apres_date is null or (d.cree_le, d.id) < (p_apres_date, p_apres_id))
     order by d.cree_le desc, d.id desc
     limit v_limite + 1
  ) b;

  if jsonb_array_length(v_lignes) > v_limite then
    v_suivant := jsonb_build_object('date', v_lignes -> (v_limite - 1) ->> 'cree_le', 'id', v_lignes -> (v_limite - 1) ->> 'id');
  end if;
  select coalesce(jsonb_agg(e order by i), '[]') into v_lignes
    from jsonb_array_elements(v_lignes) with ordinality t(e, i) where i <= v_limite;
  return jsonb_build_object('devis', v_lignes, 'suivant', v_suivant);
end $$;

-- Fonctions : fermées par défaut, ouvertes aux utilisateurs connectés seulement quand c'est voulu.
revoke execute on function
  prochain_numero_document(uuid, uuid, text), verifier_devis_modifiable(), verifier_devis_ligne_modifiable(),
  exiger_acces_devis(uuid),
  enregistrer_devis(uuid, uuid, uuid, text, uuid, jsonb, bigint, date, text, text, boolean),
  marquer_devis(uuid, text), archiver_devis_brouillon(uuid), dupliquer_devis(uuid, uuid),
  convertir_devis(uuid, uuid, jsonb, boolean), creer_bon_livraison(uuid, uuid, uuid, text, text),
  lister_devis(uuid, text, text, text, int, timestamptz, uuid)
from public, anon, authenticated;
grant execute on function
  enregistrer_devis(uuid, uuid, uuid, text, uuid, jsonb, bigint, date, text, text, boolean),
  marquer_devis(uuid, text), archiver_devis_brouillon(uuid), dupliquer_devis(uuid, uuid),
  convertir_devis(uuid, uuid, jsonb, boolean), creer_bon_livraison(uuid, uuid, uuid, text, text),
  lister_devis(uuid, text, text, text, int, timestamptz, uuid)
to authenticated;
