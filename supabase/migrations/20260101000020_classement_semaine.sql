-- Meilleurs vendeurs (employés) et meilleurs produits d'une semaine (lundi → dimanche, heure de Douala).
-- p_decalage = 0 : semaine en cours, 1 : semaine précédente, etc. (jusqu'à 52). Réservé au propriétaire ; ventes annulées exclues.
create function classement_semaine(p_boutique uuid, p_decalage int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres;
  v_aujourdhui date := (now() at time zone 'Africa/Douala')::date;
  v_lundi date;
  v_dimanche date;
  v_vendeurs jsonb; v_produits jsonb;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Les rapports sont réservés au propriétaire.'; end if;
  v_lundi := date_trunc('week', v_aujourdhui::timestamp)::date - 7 * least(greatest(coalesce(p_decalage, 0), 0), 52);
  v_dimanche := v_lundi + 6;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc, t.nom), '[]') into v_vendeurs from (
    select v.vendeur_id, coalesce(mb.nom, 'Vendeur') as nom, count(*) as nb_ventes, sum(v.total) as total
      from ventes v left join membres mb on mb.utilisateur_id = v.vendeur_id
     where v.boutique_id = p_boutique and v.statut = 'valide'
       and (v.date at time zone 'Africa/Douala')::date between v_lundi and v_dimanche
     group by v.vendeur_id, mb.nom
     order by sum(v.total) desc limit 10
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.montant desc, t.nom), '[]') into v_produits from (
    select vl.produit_id, max(vl.nom_produit) as nom, sum(vl.quantite * vl.facteur) as quantite_base,
           max(p.unite_base) as unite_base, sum(vl.total_ligne) as montant
      from vente_lignes vl join ventes v on v.id = vl.vente_id join produits p on p.id = vl.produit_id
     where v.boutique_id = p_boutique and v.statut = 'valide'
       and (v.date at time zone 'Africa/Douala')::date between v_lundi and v_dimanche
     group by vl.produit_id
     order by sum(vl.total_ligne) desc, max(vl.nom_produit) limit 10
  ) t;

  return jsonb_build_object('debut', v_lundi, 'fin', v_dimanche, 'vendeurs', v_vendeurs, 'produits', v_produits);
end $$;

revoke execute on function classement_semaine(uuid, int) from public, anon, authenticated;
grant execute on function classement_semaine(uuid, int) to authenticated;
