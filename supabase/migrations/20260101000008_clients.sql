-- Clients et crédits : liste, dettes, remboursement réparti sur les plus anciennes dettes, archivage protégé.

-- Un paiement peut régler plusieurs ventes : une ligne par vente, un seul numéro de reçu, une seule clé d'idempotence.
alter table paiements add column cle_idempotence uuid;
create unique index on paiements (boutique_id, cle_idempotence, creance_id) where cle_idempotence is not null;

-- Un client qui doit encore de l'argent ne s'archive pas.
create function verifier_archivage_client() returns trigger language plpgsql security definer set search_path = public as $$
declare v_dette bigint;
begin
  if new.archive_le is not null and old.archive_le is null then
    select coalesce(sum(solde), 0) into v_dette from creances where client_id = new.id and statut = 'ouverte';
    if v_dette > 0 then
      raise exception 'Ce client doit encore % FCFA : impossible de l''archiver.', v_dette;
    end if;
  end if;
  return new;
end $$;
create trigger trg_archivage_client before update of archive_le on clients for each row execute function verifier_archivage_client();

-- Liste paginée des clients (curseur nom sans accents + id) avec leur dette dans la boutique. Droits de l'appelant : la RLS s'applique.
create function lister_clients(
  p_boutique uuid, p_recherche text default null, p_limite int default 30, p_apres_nom text default null, p_apres_id uuid default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_nom text := nullif(trim(normaliser_texte(p_recherche)), '');
  v_chiffres text := regexp_replace(coalesce(p_recherche, ''), '[\s+.-]', '', 'g');
  v_lignes jsonb; v_suivant jsonb;
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  if v_nom is not null then v_nom := replace(replace(replace(v_nom, '\', '\\'), '%', '\%'), '_', '\_'); end if;
  if v_chiffres !~ '^\d{3,}$' then v_chiffres := null; end if;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.cle, b.id), '[]') into v_lignes from (
    select c.id, c.nom, c.telephone, c.plafond_credit, c.notes, normaliser_texte(c.nom) as cle,
           (select coalesce(sum(cr.solde), 0) from creances cr where cr.client_id = c.id and cr.boutique_id = p_boutique and cr.statut = 'ouverte') as dette
      from clients c
     where c.archive_le is null
       and (v_nom is null or normaliser_texte(c.nom) like '%' || v_nom || '%' escape '\'
            or (v_chiffres is not null and regexp_replace(coalesce(c.telephone, ''), '[\s+]', '', 'g') like '%' || v_chiffres || '%'))
       and (p_apres_nom is null or (normaliser_texte(c.nom), c.id) > (p_apres_nom, p_apres_id))
     order by normaliser_texte(c.nom), c.id
     limit v_limite + 1
  ) b;
  if jsonb_array_length(v_lignes) > v_limite then
    v_suivant := jsonb_build_object('nom', v_lignes -> (v_limite - 1) ->> 'cle', 'id', v_lignes -> (v_limite - 1) ->> 'id');
  end if;
  select coalesce(jsonb_agg(e - 'cle' order by i), '[]') into v_lignes
    from jsonb_array_elements(v_lignes) with ordinality t(e, i) where i <= v_limite;
  return jsonb_build_object('clients', v_lignes, 'suivant', v_suivant);
end $$;

-- « Qui me doit de l'argent » : un client par ligne, tri par montant ou par ancienneté de la plus vieille dette.
create function lister_dettes(
  p_boutique uuid, p_tri text default 'montant', p_limite int default 30, p_decalage int default 0
) returns jsonb language plpgsql stable set search_path = public as $$
declare v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100); v_lignes jsonb; v_total bigint; v_nb int;
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  if p_tri not in ('montant', 'anciennete') then raise exception 'Tri invalide.'; end if;
  select coalesce(sum(solde), 0), count(distinct client_id) into v_total, v_nb
    from creances where boutique_id = p_boutique and statut = 'ouverte' and solde > 0;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.rang), '[]') into v_lignes from (
    select row_number() over (order by case when p_tri = 'montant' then -d.dette end, d.plus_ancienne, d.nom, d.client_id) as rang, d.*
      from (
        select cr.client_id, c.nom, c.telephone, sum(cr.solde) as dette, min(cr.cree_le) as plus_ancienne, count(*) as nb_ventes
          from creances cr join clients c on c.id = cr.client_id
         where cr.boutique_id = p_boutique and cr.statut = 'ouverte' and cr.solde > 0
         group by cr.client_id, c.nom, c.telephone
      ) d
     order by rang
     offset greatest(coalesce(p_decalage, 0), 0) limit v_limite
  ) b;
  return jsonb_build_object('clients', v_lignes, 'total_dettes', v_total, 'total_clients', v_nb);
end $$;

-- Résultat d'un paiement de crédit (réparti par vente), relu en base : sert au retour de la fonction et à l'idempotence.
create function json_paiement_credit(p_boutique uuid, p_numero text) returns jsonb language sql stable security definer set search_path = public as $$
  with lp as (
    select p.montant, p.mode, p.date, p.client_id, v.numero_recu as numero_vente, v.date as date_vente, v.id as id_vente, cr.solde as solde_apres
      from paiements p join ventes v on v.id = p.vente_id join creances cr on cr.id = p.creance_id
     where p.boutique_id = p_boutique and p.numero_recu = p_numero and p.type = 'remboursement_credit'
  ), cli as (select client_id from lp limit 1)
  select jsonb_build_object(
    'numero_recu', p_numero,
    'montant', coalesce(sum(lp.montant), 0),
    'mode', min(lp.mode),
    'date', min(lp.date),
    'client_id', (select client_id from cli),
    'repartition', coalesce(jsonb_agg(jsonb_build_object('numero_recu_vente', lp.numero_vente, 'montant', lp.montant, 'solde_apres', lp.solde_apres)
                                      order by lp.date_vente, lp.id_vente), '[]'),
    'dette_restante', (select coalesce(sum(c2.solde), 0) from creances c2 join cli on cli.client_id = c2.client_id
                        where c2.boutique_id = p_boutique and c2.statut = 'ouverte')
  )
  from lp
$$;

-- Paiement d'un client : réparti sur ses plus anciennes dettes d'abord (FIFO), un seul reçu de paiement.
-- La clé garantit qu'un double clic ou un nouvel essai ne crédite jamais deux fois.
create function rembourser_client(p_boutique uuid, p_client uuid, p_montant bigint, p_mode text, p_cle uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres; c record; v_reste bigint; v_part bigint; v_numero text; v_dette bigint;
begin
  m := exiger_acces(p_boutique);
  perform verifier_ecriture(m.organisation_id);
  if p_cle is null then raise exception 'Clé d''opération manquante.'; end if;
  if p_mode not in ('especes', 'mtn_momo', 'orange_money') then raise exception 'Mode de paiement invalide.'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Le montant doit être supérieur à zéro.'; end if;
  if not exists (select 1 from clients where id = p_client and organisation_id = m.organisation_id) then
    raise exception 'Client introuvable.';
  end if;

  select numero_recu into v_numero from paiements where boutique_id = p_boutique and cle_idempotence = p_cle limit 1;
  if found then
    return json_paiement_credit(p_boutique, v_numero) || jsonb_build_object('deja_enregistre', true);
  end if;

  -- Verrou d'abord, calcul ensuite : deux paiements simultanés du même client se suivent au lieu de se chevaucher.
  perform 1 from creances where client_id = p_client and boutique_id = p_boutique and statut = 'ouverte' order by cree_le, id for update;
  select coalesce(sum(solde), 0) into v_dette from creances where client_id = p_client and boutique_id = p_boutique and statut = 'ouverte';
  if v_dette = 0 then raise exception 'Ce client ne doit rien.'; end if;
  if p_montant > v_dette then raise exception 'Le montant dépasse ce que le client doit (% FCFA).', v_dette; end if;

  v_numero := prochain_numero(m.organisation_id, p_boutique, 'paiement');
  v_reste := p_montant;
  for c in select id, vente_id, solde from creances
            where client_id = p_client and boutique_id = p_boutique and statut = 'ouverte' order by cree_le, id loop
    exit when v_reste = 0;
    v_part := least(c.solde, v_reste);
    insert into paiements (organisation_id, boutique_id, type, vente_id, creance_id, client_id, mode, montant, numero_recu, auteur_id, cle_idempotence)
    values (m.organisation_id, p_boutique, 'remboursement_credit', c.vente_id, c.id, p_client, p_mode, v_part, v_numero, auth.uid(), p_cle);
    update creances set montant_paye = montant_paye + v_part,
      statut = case when montant_paye + v_part = montant_du then 'soldee' else 'ouverte' end where id = c.id;
    v_reste := v_reste - v_part;
  end loop;
  perform ecrire_journal(m.organisation_id, p_boutique, 'remboursement_credit', 'client', p_client::text,
    jsonb_build_object('numero', v_numero, 'montant', p_montant, 'mode', p_mode));
  return json_paiement_credit(p_boutique, v_numero) || jsonb_build_object('deja_enregistre', false);
end $$;

revoke execute on function verifier_archivage_client(), json_paiement_credit(uuid, text), lister_clients(uuid, text, int, text, uuid),
  lister_dettes(uuid, text, int, int), rembourser_client(uuid, uuid, bigint, text, uuid) from public, anon, authenticated;
grant execute on function lister_clients(uuid, text, int, text, uuid), lister_dettes(uuid, text, int, int),
  rembourser_client(uuid, uuid, bigint, text, uuid) to authenticated;
