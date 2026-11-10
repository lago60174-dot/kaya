-- RLS partout. Les écritures sensibles passent uniquement par les fonctions (RPC).

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert, update on categories, produits, produit_unites, produit_couts, parametres_boutique, boutiques, clients to authenticated;
grant insert on depenses to authenticated;

-- Lecture
create policy lecture on organisations for select to authenticated using (id = app_org_id());
create policy lecture on membres for select to authenticated
  using (organisation_id = app_org_id() and (app_role() = 'proprietaire' or utilisateur_id = auth.uid()));
create policy lecture on boutiques for select to authenticated using (app_acces_boutique(id));
create policy lecture on parametres_boutique for select to authenticated using (app_acces_boutique(boutique_id));
create policy lecture on vente_lignes for select to authenticated
  using (exists (select 1 from ventes v where v.id = vente_id and app_acces_boutique(v.boutique_id)));

do $$
declare t text;
begin
  foreach t in array array['categories', 'produits', 'produit_unites', 'clients'] loop
    execute format('create policy lecture on %I for select to authenticated using (organisation_id = app_org_id())', t);
  end loop;
  foreach t in array array['ventes', 'paiements', 'creances', 'avoirs', 'depenses', 'clotures_caisse', 'mouvements_stock', 'stock_courant'] loop
    execute format('create policy lecture on %I for select to authenticated using (app_acces_boutique(boutique_id))', t);
  end loop;
  -- Prix d'achat, coûts, journal : propriétaire uniquement.
  foreach t in array array['produit_couts', 'vente_lignes_couts', 'journal_activite'] loop
    execute format('create policy lecture on %I for select to authenticated using (organisation_id = app_org_id() and app_role() = ''proprietaire'')', t);
  end loop;
end $$;

-- Écriture directe (le reste est interdit : pas de politique = refusé)
do $$
declare t text;
begin
  foreach t in array array['categories', 'produits'] loop
    execute format('create policy ecriture_ajout on %I for insert to authenticated with check (organisation_id = app_org_id() and app_role() = ''proprietaire'')', t);
    execute format('create policy ecriture_modif on %I for update to authenticated using (organisation_id = app_org_id() and app_role() = ''proprietaire'') with check (organisation_id = app_org_id() and app_role() = ''proprietaire'')', t);
  end loop;
  foreach t in array array['produit_unites', 'produit_couts'] loop
    execute format('create policy ecriture_ajout on %I for insert to authenticated with check (organisation_id = app_org_id() and app_role() = ''proprietaire'' and exists (select 1 from produits p where p.id = produit_id and p.organisation_id = app_org_id()))', t);
    execute format('create policy ecriture_modif on %I for update to authenticated using (organisation_id = app_org_id() and app_role() = ''proprietaire'') with check (organisation_id = app_org_id() and app_role() = ''proprietaire'')', t);
  end loop;
end $$;

create policy ecriture_modif on boutiques for update to authenticated
  using (app_role() = 'proprietaire' and app_acces_boutique(id)) with check (app_role() = 'proprietaire' and app_acces_boutique(id));
create policy ecriture_modif on parametres_boutique for update to authenticated
  using (app_role() = 'proprietaire' and app_acces_boutique(boutique_id)) with check (app_role() = 'proprietaire' and app_acces_boutique(boutique_id));
create policy ecriture_ajout on clients for insert to authenticated
  with check (organisation_id = app_org_id() and (app_role() = 'proprietaire' or plafond_credit is null));
create policy ecriture_modif on clients for update to authenticated
  using (organisation_id = app_org_id() and app_role() = 'proprietaire') with check (organisation_id = app_org_id() and app_role() = 'proprietaire');
create policy ecriture_ajout on depenses for insert to authenticated
  with check (app_acces_boutique(boutique_id) and organisation_id = app_org_id() and auteur_id = auth.uid());
