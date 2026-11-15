-- Rapports du propriétaire : ventes jour par jour, produits et vendeurs sur une période (7, 30 ou 90 jours).
-- Journée en heure de Douala, ventes annulées exclues, aucune donnée de marge ni de prix d'achat.
create function rapport_ventes(p_boutique uuid, p_jours int default 7) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres;
  v_jour date := (now() at time zone 'Africa/Douala')::date;
  v_n int := least(greatest(coalesce(p_jours, 7), 1), 90);
  v_serie jsonb; v_top jsonb; v_vendeurs jsonb; v_total bigint; v_nb int;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Les rapports sont réservés au propriétaire.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('jour', d.jour, 'total', coalesce(t.total, 0), 'nb', coalesce(t.nb, 0)) order by d.jour), '[]')
    into v_serie
    from (select (v_jour - g)::date as jour from generate_series(0, v_n - 1) g) d
    left join (
      select (date at time zone 'Africa/Douala')::date as jour, sum(total) as total, count(*) as nb
        from ventes
       where boutique_id = p_boutique and statut = 'valide'
         and (date at time zone 'Africa/Douala')::date between v_jour - (v_n - 1) and v_jour
       group by 1
    ) t on t.jour = d.jour;

  select coalesce(sum(total), 0), count(*) into v_total, v_nb from ventes
   where boutique_id = p_boutique and statut = 'valide'
     and (date at time zone 'Africa/Douala')::date between v_jour - (v_n - 1) and v_jour;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.montant desc, t.nom), '[]') into v_top from (
    select vl.produit_id, max(vl.nom_produit) as nom, sum(vl.quantite * vl.facteur) as quantite_base,
           max(p.unite_base) as unite_base, sum(vl.total_ligne) as montant
      from vente_lignes vl join ventes v on v.id = vl.vente_id join produits p on p.id = vl.produit_id
     where v.boutique_id = p_boutique and v.statut = 'valide'
       and (v.date at time zone 'Africa/Douala')::date between v_jour - (v_n - 1) and v_jour
     group by vl.produit_id
     order by sum(vl.total_ligne) desc, max(vl.nom_produit) limit 5
  ) t;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc, t.nom), '[]') into v_vendeurs from (
    select v.vendeur_id, coalesce(mb.nom, 'Vendeur') as nom, count(*) as nb_ventes, sum(v.total) as total
      from ventes v left join membres mb on mb.utilisateur_id = v.vendeur_id
     where v.boutique_id = p_boutique and v.statut = 'valide'
       and (v.date at time zone 'Africa/Douala')::date between v_jour - (v_n - 1) and v_jour
     group by v.vendeur_id, mb.nom
  ) t;

  return jsonb_build_object('jours', v_n, 'total', v_total, 'nb_ventes', v_nb,
    'serie', v_serie, 'produits', v_top, 'vendeurs', v_vendeurs);
end $$;

revoke execute on function rapport_ventes(uuid, int) from public, anon, authenticated;
grant execute on function rapport_ventes(uuid, int) to authenticated;
