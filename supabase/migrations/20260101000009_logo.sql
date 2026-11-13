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
