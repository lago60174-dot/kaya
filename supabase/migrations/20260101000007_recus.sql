-- Historique des reçus (la souche) et page publique d'un reçu.

alter table vente_lignes add column ordre int not null default 0;

-- Liste paginée (curseur date + id, du plus récent au plus ancien). Exécutée avec les droits de l'appelant : la RLS s'applique.
-- Recherche : numéro de reçu, nom ou téléphone du client, ou montant exact du total.
create function lister_recus(
  p_boutique uuid, p_recherche text default null, p_statut text default null, p_vendeur uuid default null,
  p_du date default null, p_au date default null, p_limite int default 30,
  p_apres_date timestamptz default null, p_apres_id uuid default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100);
  v_brut text := nullif(trim(p_recherche), '');
  v_nom text;
  v_chiffres text;
  v_montant bigint;
  v_lignes jsonb;
  v_suivant jsonb;
begin
  if not app_acces_boutique(p_boutique) then raise exception 'Accès refusé à cette boutique.'; end if;
  if p_statut is not null and p_statut not in ('valide', 'annulee') then raise exception 'Statut invalide.'; end if;
  if v_brut is not null then
    v_nom := replace(replace(replace(normaliser_texte(v_brut), '\', '\\'), '%', '\%'), '_', '\_');
    -- Saisie purement numérique (montant ou téléphone, avec espaces, points ou + tolérés) : sinon c'est un nom ou un numéro de reçu.
    v_chiffres := regexp_replace(v_brut, '[\s.+-]', '', 'g');
    if v_chiffres !~ '^\d+$' then
      v_chiffres := null;
    elsif length(v_chiffres) <= 12 then
      v_montant := v_chiffres::bigint;
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.date desc, b.id desc), '[]') into v_lignes from (
    select v.id, v.numero_recu, v.date, v.statut, v.total, v.vendeur_id, c.nom as client_nom, m.nom as vendeur_nom,
           (select coalesce(sum(cr.solde), 0) from creances cr where cr.vente_id = v.id and cr.statut = 'ouverte') as credit
      from ventes v
      left join clients c on c.id = v.client_id
      left join membres m on m.utilisateur_id = v.vendeur_id
     where v.boutique_id = p_boutique
       and (p_statut is null or v.statut = p_statut)
       and (p_vendeur is null or v.vendeur_id = p_vendeur)
       and (p_du is null or (v.date at time zone 'Africa/Douala')::date >= p_du)
       and (p_au is null or (v.date at time zone 'Africa/Douala')::date <= p_au)
       and (v_brut is null
            or lower(v.numero_recu) like '%' || lower(v_nom) || '%' escape '\'
            or normaliser_texte(c.nom) like '%' || v_nom || '%' escape '\'
            or (length(v_chiffres) >= 3 and regexp_replace(coalesce(c.telephone, ''), '[\s+]', '', 'g') like '%' || v_chiffres || '%')
            or (v_montant is not null and v.total = v_montant))
       and (p_apres_date is null or (v.date, v.id) < (p_apres_date, p_apres_id))
     order by v.date desc, v.id desc
     limit v_limite + 1
  ) b;

  if jsonb_array_length(v_lignes) > v_limite then
    v_suivant := jsonb_build_object('date', v_lignes -> (v_limite - 1) ->> 'date', 'id', v_lignes -> (v_limite - 1) ->> 'id');
  end if;
  select coalesce(jsonb_agg(e order by i), '[]') into v_lignes
    from jsonb_array_elements(v_lignes) with ordinality t(e, i) where i <= v_limite;
  return jsonb_build_object('recus', v_lignes, 'suivant', v_suivant);
end $$;

-- Reçu public : accessible sans connexion avec le jeton (64 caractères hexadécimaux, non devinable).
-- Ne contient ni marge, ni prix d'achat, ni téléphone du client, ni identifiants internes.
create function recu_public(p_jeton text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v ventes; b boutiques;
begin
  if p_jeton is null or p_jeton !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into v from ventes where jeton_public = p_jeton;
  if not found then return null; end if;
  select * into b from boutiques where id = v.boutique_id;
  return jsonb_build_object(
    'numero_recu', v.numero_recu, 'date', v.date, 'annule', v.statut = 'annulee', 'remise', v.remise, 'total', v.total,
    'boutique', jsonb_build_object('nom', b.nom, 'adresse', b.adresse, 'telephone', b.telephone, 'mention_legale', b.mention_legale),
    'client_nom', (select nom from clients where id = v.client_id),
    'lignes', (select coalesce(jsonb_agg(jsonb_build_object('nom', l.nom_produit, 'unite', l.nom_unite, 'quantite', l.quantite,
                 'prix_unitaire', l.prix_unitaire, 'remise_ligne', l.remise_ligne, 'total', l.total_ligne) order by l.ordre, l.id), '[]')
                 from vente_lignes l where l.vente_id = v.id),
    'paiements', (select coalesce(jsonb_agg(jsonb_build_object('mode', p.mode, 'montant', p.montant) order by p.date, p.id), '[]')
                    from paiements p where p.vente_id = v.id and p.type = 'vente'),
    'credit', (select coalesce(sum(cr.solde), 0) from creances cr where cr.vente_id = v.id and cr.statut = 'ouverte')
  );
end $$;

revoke execute on function lister_recus(uuid, text, text, uuid, date, date, int, timestamptz, uuid), recu_public(text) from public, anon, authenticated;
grant execute on function lister_recus(uuid, text, text, uuid, date, date, int, timestamptz, uuid) to authenticated;
grant execute on function recu_public(text) to anon, authenticated;
