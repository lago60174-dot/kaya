-- Logo de la boutique : clé du fichier PNG dans R2 (le PDF ne lit pas le WebP). Jamais de fichier en base.
alter table boutiques
  add column logo_cle text
  check (logo_cle is null or logo_cle ~ '^[0-9a-f-]{36}/[0-9a-f]{64}-l\.png$');

-- Même fonction qu'avant, avec le logo en plus dans la boutique (rien de sensible : c'est déjà sur le reçu papier).
create or replace function recu_public(p_jeton text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v ventes; b boutiques;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into v from ventes where jeton_public = p_jeton;
  if not found then return null; end if;
  select * into b from boutiques where id = v.boutique_id;
  return jsonb_build_object(
    'numero_recu', v.numero_recu, 'date', v.date, 'annule', v.statut = 'annulee', 'remise', v.remise, 'total', v.total,
    'boutique', jsonb_build_object('nom', b.nom, 'adresse', b.adresse, 'telephone', b.telephone, 'mention_legale', b.mention_legale, 'logo_cle', b.logo_cle),
    'client_nom', (select nom from clients where id = v.client_id),
    'lignes', (select coalesce(jsonb_agg(jsonb_build_object('nom', l.nom_produit, 'unite', l.nom_unite, 'quantite', l.quantite,
                 'prix_unitaire', l.prix_unitaire, 'remise_ligne', l.remise_ligne, 'total', l.total_ligne) order by l.ordre, l.id), '[]')
                 from vente_lignes l where l.vente_id = v.id),
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object('mode', p.mode, 'montant', p.montant) order by p.date, p.id), '[]')
                    from paiements p where p.vente_id = v.id and p.type = 'vente'),
    'credit', (select coalesce(sum(cr.solde), 0) from creances cr where cr.vente_id = v.id and cr.statut = 'ouverte')
  );
end $$;

-- Le logo s'écrit par une fonction atomique (comme les autres réglages de la migration 11) : l'UPDATE direct sur
-- boutiques est retiré aux utilisateurs. Propriétaire seul, compte en lecture seule refusé, clé de sa propre
-- organisation, et trace dans le journal (action existante « parametres_modifies », champ « logo »).
create function definir_logo_boutique(p_boutique uuid, p_cle text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m membres; b boutiques;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut modifier le logo.'; end if;
  perform verifier_ecriture(m.organisation_id);
  if p_cle is not null and (p_cle !~ '^[0-9a-f-]{36}/[0-9a-f]{64}-l\.png$' or split_part(p_cle, '/', 1) <> m.organisation_id::text) then
    raise exception 'Logo invalide. Choisissez une autre image.';
  end if;
  select * into b from boutiques where id = p_boutique for update;
  if b.logo_cle is not distinct from p_cle then return jsonb_build_object('modifie', false); end if;
  update boutiques set logo_cle = p_cle where id = p_boutique;
  perform ecrire_journal(m.organisation_id, p_boutique, 'parametres_modifies', 'boutique', p_boutique::text,
    jsonb_build_object('champs', jsonb_build_array('logo'), 'avant', '{}'::jsonb, 'apres', '{}'::jsonb));
  return jsonb_build_object('modifie', true);
end $$;

revoke execute on function definir_logo_boutique(uuid, text) from public, anon, authenticated;
grant execute on function definir_logo_boutique(uuid, text) to authenticated;
