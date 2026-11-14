-- Étape 9 : tableau de bord du propriétaire (section 9.7) et journal d'activité (section 9.8).

-- Une seule requête serveur pour tout le tableau de bord : le navigateur n'enchaîne pas six appels.
-- Réservé au propriétaire. Journée en heure de Douala. Aucune donnée de marge ni de prix d'achat.
create function tableau_de_bord(p_boutique uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m membres;
  v_jour date := (now() at time zone 'Africa/Douala')::date;
  v_caisse jsonb; v_hier bigint; v_top jsonb; v_bas jsonb; v_nb_bas int;
  v_dettes bigint; v_nb_debiteurs int; v_vendeurs jsonb; v_a_valider int;
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Le tableau de bord est réservé au propriétaire.'; end if;

  v_caisse := calculer_caisse(p_boutique, v_jour);

  select coalesce(sum(total), 0) into v_hier from ventes
   where boutique_id = p_boutique and statut = 'valide' and (date at time zone 'Africa/Douala')::date = v_jour - 1;

  -- Produits les plus vendus sur 7 jours (aujourd'hui compris), par chiffre d'affaires, ventes annulées exclues.
  select coalesce(jsonb_agg(to_jsonb(t) order by t.montant desc, t.nom), '[]') into v_top from (
    select vl.produit_id, max(vl.nom_produit) as nom, sum(vl.quantite * vl.facteur) as quantite_base,
           max(p.unite_base) as unite_base, sum(vl.total_ligne) as montant
      from vente_lignes vl join ventes v on v.id = vl.vente_id join produits p on p.id = vl.produit_id
     where v.boutique_id = p_boutique and v.statut = 'valide'
       and (v.date at time zone 'Africa/Douala')::date between v_jour - 6 and v_jour
     group by vl.produit_id
     order by sum(vl.total_ligne) desc, max(vl.nom_produit) limit 5
  ) t;

  -- Stock bas : même règle que l'alerte (stock < seuil, seuil > 0), les plus bas d'abord.
  select count(*) into v_nb_bas from produits p
    left join stock_courant s on s.produit_id = p.id and s.boutique_id = p_boutique
   where p.organisation_id = m.organisation_id and p.archive_le is null and p.actif
     and p.seuil_alerte > 0 and coalesce(s.quantite, 0) < p.seuil_alerte;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.rapport, t.nom), '[]') into v_bas from (
    select p.id as produit_id, p.nom_affiche as nom, p.unite_base, coalesce(s.quantite, 0) as stock, p.seuil_alerte as seuil,
           coalesce(s.quantite, 0) / p.seuil_alerte as rapport
      from produits p left join stock_courant s on s.produit_id = p.id and s.boutique_id = p_boutique
     where p.organisation_id = m.organisation_id and p.archive_le is null and p.actif
       and p.seuil_alerte > 0 and coalesce(s.quantite, 0) < p.seuil_alerte
     order by coalesce(s.quantite, 0) / p.seuil_alerte, p.nom_affiche limit 5
  ) t;

  select coalesce(sum(solde), 0), count(distinct client_id) into v_dettes, v_nb_debiteurs from creances
   where boutique_id = p_boutique and statut = 'ouverte' and solde > 0;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc, t.nom), '[]') into v_vendeurs from (
    select v.vendeur_id, coalesce(mb.nom, 'Vendeur') as nom, count(*) as nb_ventes, sum(v.total) as total
      from ventes v left join membres mb on mb.utilisateur_id = v.vendeur_id
     where v.boutique_id = p_boutique and v.statut = 'valide' and (v.date at time zone 'Africa/Douala')::date = v_jour
     group by v.vendeur_id, mb.nom
  ) t;

  select count(*) into v_a_valider from clotures_caisse where boutique_id = p_boutique and validee_le is null;

  return jsonb_build_object(
    'jour', v_jour, 'caisse', v_caisse, 'ventes_hier', v_hier,
    'produits_vendus', v_top, 'stock_bas', jsonb_build_object('nombre', v_nb_bas, 'produits', v_bas),
    'dettes', jsonb_build_object('total', v_dettes, 'nb_clients', v_nb_debiteurs),
    'vendeurs', v_vendeurs, 'clotures_a_valider', v_a_valider
  );
end $$;

revoke execute on function tableau_de_bord(uuid) from public, anon, authenticated;
grant execute on function tableau_de_bord(uuid) to authenticated;

-- Alertes récentes : lecture rapide (le journal est déjà filtré selon le plan par la RLS).
create index journal_alertes on journal_activite (organisation_id, cree_le desc) where alerte;
create index journal_boutique on journal_activite (boutique_id, cree_le desc, id desc);

-- Temps réel : seules les tables utiles au tableau de bord sont publiées. La RLS filtre ce que chacun reçoit.
-- (Sans effet hors Supabase : la publication n'existe pas dans la base de test.)
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['ventes', 'paiements', 'depenses', 'clotures_caisse'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- Journal paginé par curseur (date + identifiant), filtres typés. Exécuté avec les droits de l'appelant :
-- la RLS limite déjà au propriétaire, à son organisation et au journal de base ou complet selon le plan.
create function lister_journal(
  p_boutique uuid default null, p_actions text[] default null, p_alertes boolean default false,
  p_du date default null, p_au date default null, p_limite int default 30,
  p_apres timestamptz default null, p_apres_id bigint default null
) returns jsonb language plpgsql stable set search_path = public as $$
declare v_limite int := least(greatest(coalesce(p_limite, 30), 1), 100); v_entrees jsonb; v_suivant jsonb; v_n int;
begin
  if (p_apres is null) <> (p_apres_id is null) then raise exception 'Curseur invalide.'; end if;
  with r as (
    select j.id, j.cree_le, j.auteur_id, j.boutique_id, j.action, j.entite, j.entite_id, j.details, j.alerte
      from journal_activite j
     where (p_boutique is null or j.boutique_id = p_boutique)
       and (p_actions is null or j.action = any (p_actions))
       and (not coalesce(p_alertes, false) or j.alerte)
       and (p_du is null or j.cree_le >= (p_du::timestamp at time zone 'Africa/Douala'))
       and (p_au is null or j.cree_le < ((p_au + 1)::timestamp at time zone 'Africa/Douala'))
       and (p_apres is null or (j.cree_le, j.id) < (p_apres, p_apres_id))
     order by j.cree_le desc, j.id desc
     limit v_limite + 1
  ), num as (select r.*, row_number() over (order by r.cree_le desc, r.id desc) as rang from r)
  select coalesce(jsonb_agg(to_jsonb(num) - 'rang' order by rang) filter (where rang <= v_limite), '[]'),
         count(*),
         max(jsonb_build_object('date', cree_le, 'id', id)::text) filter (where rang = v_limite)
    into v_entrees, v_n, v_suivant from num;
  return jsonb_build_object('entrees', v_entrees,
    'suivant', case when v_n > v_limite then v_suivant::jsonb else null end);
end $$;

revoke execute on function lister_journal(uuid, text[], boolean, date, date, int, timestamptz, bigint) from public, anon, authenticated;
grant execute on function lister_journal(uuid, text[], boolean, date, date, int, timestamptz, bigint) to authenticated;
