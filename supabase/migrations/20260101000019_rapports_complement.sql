-- Rapports : bénéfice estimé (ventes moins coûts figés à la vente) et encaissements par mode de paiement.
-- Réservé au propriétaire, ventes annulées exclues, journée en heure de Douala.
create function rapport_complement(p_boutique uuid, p_jours int default 7) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres;
  v_jour date := (now() at time zone 'Africa/Douala')::date;
  v_n int := least(greatest(coalesce(p_jours, 7), 1), 90);
  v_benefice bigint; v_modes jsonb;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Les rapports sont réservés au propriétaire.'; end if;

  select coalesce(sum(vl.total_ligne - c.cout_total), 0) into v_benefice
    from vente_lignes vl
    join ventes v on v.id = vl.vente_id
    join vente_lignes_couts c on c.vente_ligne_id = vl.id
   where v.boutique_id = p_boutique and v.statut = 'valide'
     and (v.date at time zone 'Africa/Douala')::date between v_jour - (v_n - 1) and v_jour;

  select coalesce(jsonb_agg(jsonb_build_object('mode', t.mode, 'montant', t.montant) order by t.montant desc), '[]') into v_modes
    from (
      select p.mode, sum(p.montant) as montant
        from paiements p join ventes v on v.id = p.vente_id
       where p.boutique_id = p_boutique and p.type = 'vente' and v.statut = 'valide'
         and (p.date at time zone 'Africa/Douala')::date between v_jour - (v_n - 1) and v_jour
       group by p.mode
    ) t;

  return jsonb_build_object('benefice', v_benefice, 'modes', v_modes);
end $$;

revoke execute on function rapport_complement(uuid, int) from public, anon, authenticated;
grant execute on function rapport_complement(uuid, int) to authenticated;
