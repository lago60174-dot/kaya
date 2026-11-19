-- Test SQL des devis (migration 21). À lancer sur une base neuve où toutes les migrations sont appliquées, avec les rôles et auth.uid() de Supabase.
-- Chaque contrôle lève une erreur « ECHEC / ATTENDU » en cas de problème ; aucune sortie d erreur = tout passe.
-- Il crée des organisations de test : ne pas lancer sur une base de production.
\set ON_ERROR_STOP on
\set QUIET on
drop schema if exists tt cascade; create schema tt;
grant usage on schema tt to authenticated;
create function tt.moi(p uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false); end $$;
create function tt.erreur(p_sql text, p_fragment text) returns void language plpgsql as $$
declare v_msg text;
begin
  begin execute p_sql; exception when others then v_msg := sqlerrm; end;
  if v_msg is null then raise exception 'ATTENDU une erreur contenant « % » pour : %', p_fragment, p_sql; end if;
  if position(p_fragment in v_msg) = 0 then raise exception 'ERREUR INATTENDUE pour : % -> % (attendu : %)', p_sql, v_msg, p_fragment; end if;
end $$;
create function tt.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin if p_cond is not true then raise exception 'ECHEC : %', p_msg; end if; end $$;
create table tt.ids (cle text primary key, id uuid);
create function tt.i(c text) returns uuid language sql as $$ select id from tt.ids where cle = c $$;
grant select on tt.ids to authenticated; grant execute on function tt.i(text) to authenticated;

do $$
declare o uuid; b uuid; u uuid; v uuid; p uuid; un uuid; pl text; nom text;
begin
  foreach nom in array array['A','B','E'] loop
    pl := case nom when 'E' then 'essentiel' else 'pro' end;
    insert into organisations (nom, plan_code) values ('Org ' || nom, pl) returning id into o;
    insert into boutiques (organisation_id, nom) values (o, 'Boutique ' || nom) returning id into b;
    insert into parametres_boutique (boutique_id, organisation_id) values (b, o);
    insert into auth.users (email) values ('prop' || nom || '@t.cm') returning id into u;
    insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees, nom) values (u, o, 'proprietaire', '{}', 'Patron ' || nom);
    insert into auth.users (email) values ('vend' || nom || '@t.cm') returning id into v;
    insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees, nom) values (v, o, 'vendeur', array[b], 'Vendeur ' || nom);
    insert into abonnements (organisation_id, plan_code, statut) values (o, pl, 'actif');
    insert into tt.ids values ('org' || nom, o), ('bout' || nom, b), ('prop' || nom, u), ('vend' || nom, v);
    insert into produits (organisation_id, nom, unite_base, seuil_alerte) values (o, 'Ciment', 'kg', 0) returning id into p;
    insert into tt.ids values ('ciment' || nom, p);
    insert into produit_couts (produit_id, organisation_id, prix_achat) values (p, o, 90);
    insert into produit_unites (organisation_id, produit_id, nom, facteur, prix_vente) values (o, p, 'sac de 50 kg', 50, 5500) returning id into un;
    insert into tt.ids values ('sac' || nom, un);
    insert into produit_unites (organisation_id, produit_id, nom, facteur, prix_vente) values (o, p, 'kg', 1, 120) returning id into un;
    insert into tt.ids values ('kg' || nom, un);
    insert into clients (organisation_id, nom, telephone) values (o, 'Client ' || nom, '699123456') returning id into un;
    insert into tt.ids values ('client' || nom, un);
    insert into stock_courant (produit_id, boutique_id, organisation_id, quantite) values (p, b, o, 500);
  end loop;
end $$;

-- 1. Plan Essentiel : refusé côté base, même pour le propriétaire.
select tt.moi(tt.i('propE'));
select tt.erreur($q$select enregistrer_devis(tt.i('boutE'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentE'), 'unite_id', tt.i('sacE'), 'quantite', 1)), 0, current_date + 10, null, null, false)$q$,
  'ne sont pas inclus dans votre abonnement');

-- 2. Un vendeur (même d'un plan Pro) ne peut pas.
select tt.moi(tt.i('vendA'));
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1)), 0, current_date + 10, null, null, false)$q$,
  'Seul le propriétaire');

-- 3. Propriétaire Pro : brouillon sans numéro, prix venus de la base (le client ne fournit aucun prix).
select tt.moi(tt.i('propA'));
create temp table r1 as select enregistrer_devis(tt.i('boutA'), '11111111-1111-1111-1111-111111111111', null, 'devis', tt.i('clientA'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 2),
                    jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('kgA'), 'quantite', 2.5)),
  500, current_date + 10, 'Paiement à la livraison', null, false) as j;
select tt.ok((select j->>'statut' from r1) = 'brouillon' and (select j->>'numero' from r1) is null, 'brouillon sans numéro');
select tt.ok((select (j->>'total')::bigint from r1) = 2*5500 + 300 - 500, 'total = 11000 + 300 - 500 = 10800');
select tt.ok((select count(*) from devis_lignes where devis_id = (select (j->>'devis_id')::uuid from r1)) = 2, '2 lignes');

-- 4. Idempotence : même clé, même devis.
select tt.ok((select (enregistrer_devis(tt.i('boutA'), '11111111-1111-1111-1111-111111111111', null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 9)), 0, current_date + 10, null, null, false)->>'deja_enregistre')::boolean),
  'idempotence');
select tt.ok((select count(*) from devis where boutique_id = tt.i('boutA')) = 1, 'un seul devis malgré le second appel');

-- 5. Validations.
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null, '[]', 0, current_date + 10, null, null, false)$q$, 'Ajoutez au moins un article');
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1)), 0, current_date - 1, null, null, false)$q$, 'déjà passée');
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1)), 99999, current_date + 5, null, null, false)$q$, 'Le total doit être supérieur à zéro');
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 0.0001)), 0, current_date + 5, null, null, false)$q$, 'Quantité invalide');
-- Un article d'une autre organisation est refusé.
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentB'), 'unite_id', tt.i('sacB'), 'quantite', 1)), 0, current_date + 5, null, null, false)$q$, 'introuvable');
-- Une autre boutique que la sienne est refusée.
select tt.erreur($q$select enregistrer_devis(tt.i('boutB'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentB'), 'unite_id', tt.i('sacB'), 'quantite', 1)), 0, current_date + 5, null, null, false)$q$, 'Boutique introuvable');

-- 6. Modification du brouillon (on le remplace) puis envoi : numéro attribué.
create temp table r2 as select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), (select (j->>'devis_id')::uuid from r1), 'devis', tt.i('clientA'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 3)),
  0, current_date + 10, 'Paiement à la livraison', 'Livraison mardi', true) as j;
select tt.ok((select j->>'statut' from r2) = 'envoye', 'envoyé');
select tt.ok((select j->>'numero' from r2) = 'D-' || extract(year from now() at time zone 'Africa/Douala')::int || '-000001', 'premier numéro D-AAAA-000001 : ' || (select j->>'numero' from r2));
select tt.ok((select count(*) from devis_lignes where devis_id = (select (j->>'devis_id')::uuid from r2)) = 1, 'lignes remplacées, pas ajoutées');
select tt.ok((select total from devis where id = (select (j->>'devis_id')::uuid from r2)) = 16500, 'total 16 500');

-- 7. Un devis envoyé ne se modifie plus : ni par la fonction, ni en SQL direct (même superutilisateur), ni ses lignes.
select tt.erreur($q$select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), (select (j->>'devis_id')::uuid from r2), 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1)), 0, current_date + 10, null, null, false)$q$, 'Seul un brouillon peut être modifié');
select tt.erreur($q$update devis set total = 1 where id = (select (j->>'devis_id')::uuid from r2)$q$, 'ne peut plus être modifié');
select tt.erreur($q$update devis set numero = 'D-9' where id = (select (j->>'devis_id')::uuid from r2)$q$, 'ne peut plus être modifié');
select tt.erreur($q$update devis_lignes set quantite = 99 where devis_id = (select (j->>'devis_id')::uuid from r2)$q$, 'ne se modifient jamais');
select tt.erreur($q$delete from devis_lignes where devis_id = (select (j->>'devis_id')::uuid from r2)$q$, 'ne se modifient jamais');
select tt.erreur($q$delete from devis where id = (select (j->>'devis_id')::uuid from r2)$q$, 'Suppression interdite');
select tt.erreur($q$select archiver_devis_brouillon((select (j->>'devis_id')::uuid from r2))$q$, 'Seul un brouillon');

-- 8. Un brouillon abandonné ne crée pas de trou : le numéro suivant est D-...-000002.
create temp table r3 as select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', null,
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('kgA'), 'quantite', 10)), 0, current_date + 5, null, null, false) as j;
select archiver_devis_brouillon((select (j->>'devis_id')::uuid from r3));
select tt.ok((select archive_le is not null from devis where id = (select (j->>'devis_id')::uuid from r3)), 'brouillon archivé');
create temp table r4 as select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', tt.i('clientA'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('kgA'), 'quantite', 100)), 0, current_date + 5, null, null, true) as j;
select tt.ok((select j->>'numero' from r4) like '%-000002', 'numéro continu : ' || (select j->>'numero' from r4));
-- Une proforma a sa propre suite.
create temp table r5 as select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'proforma', tt.i('clientA'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('kgA'), 'quantite', 10)), 0, current_date + 5, null, null, true) as j;
select tt.ok((select j->>'numero' from r5) like 'PF-%-000001', 'proforma PF-...-000001 : ' || (select j->>'numero' from r5));

-- 9. Statuts : conversion impossible avant acceptation ; refus définitif.
select tt.erreur($q$select convertir_devis((select (j->>'devis_id')::uuid from r2), gen_random_uuid(), '[{"mode":"especes"}]')$q$, 'doit d''abord avoir accepté');
select tt.erreur($q$select marquer_devis((select (j->>'devis_id')::uuid from r3), 'accepte')$q$, 'Envoyez d''abord');
select marquer_devis((select (j->>'devis_id')::uuid from r5), 'refuse');
select tt.erreur($q$select marquer_devis((select (j->>'devis_id')::uuid from r5), 'accepte')$q$, 'a été refusé');
select tt.erreur($q$update devis set statut = 'accepte' where id = (select (j->>'devis_id')::uuid from r5)$q$, 'ne peut pas passer');
select tt.erreur($q$select marquer_devis((select (j->>'devis_id')::uuid from r2), 'converti')$q$, 'Statut invalide');

-- 10. Bon de livraison d'un devis non accepté : refusé.
select tt.erreur($q$select creer_bon_livraison(tt.i('boutA'), null, (select (j->>'devis_id')::uuid from r2), null, null)$q$, 'doit d''abord avoir accepté');

-- 11. Acceptation, puis conversion en vente avec un prix qui a changé entre-temps.
select marquer_devis((select (j->>'devis_id')::uuid from r2), 'accepte');
update produit_unites set prix_vente = 5600 where id = tt.i('sacA');
create temp table v1 as select convertir_devis((select (j->>'devis_id')::uuid from r2), '22222222-2222-2222-2222-222222222222', '[{"mode":"especes"}]') as j;
select tt.ok((select (j->>'total')::bigint from v1) = 16800 and (select (j->>'total_devis')::bigint from v1) = 16500, 'total vente 16 800 (prix du jour), total devis 16 500');
select tt.ok((select statut from devis where id = (select (j->>'devis_id')::uuid from r2)) = 'converti', 'devis converti');
select tt.ok((select vente_id from devis where id = (select (j->>'devis_id')::uuid from r2)) = (select (j->>'vente_id')::uuid from v1), 'lien vers la vente');
select tt.ok((select quantite from stock_courant where produit_id = tt.i('cimentA') and boutique_id = tt.i('boutA')) = 350, 'stock : 500 - 3 sacs de 50 kg = 350');
select tt.ok((select sum(montant) from paiements where vente_id = (select (j->>'vente_id')::uuid from v1)) = 16800, 'paiement espèces enregistré');
select tt.ok((select numero_recu from ventes where id = (select (j->>'vente_id')::uuid from v1)) like 'R-%-000001', 'numéro de reçu normal');
-- Rejeu avec la même clé : même vente ; autre clé : refusé.
select tt.ok((select (convertir_devis((select (j->>'devis_id')::uuid from r2), '22222222-2222-2222-2222-222222222222', '[{"mode":"especes"}]')->>'deja_convertie')::boolean), 'rejeu idempotent');
select tt.ok((select count(*) from ventes where boutique_id = tt.i('boutA')) = 1, 'une seule vente');
select tt.erreur($q$select convertir_devis((select (j->>'devis_id')::uuid from r2), gen_random_uuid(), '[{"mode":"especes"}]')$q$, 'déjà converti en vente');
select tt.erreur($q$select marquer_devis((select (j->>'devis_id')::uuid from r2), 'refuse')$q$, 'déjà converti');
update produit_unites set prix_vente = 5500 where id = tt.i('sacA');

-- 12. Conversion atomique : stock insuffisant => rien n'est écrit, le devis reste « accepté ».
select marquer_devis((select (j->>'devis_id')::uuid from r4), 'accepte');   -- 100 kg : possible
update stock_courant set quantite = 10 where produit_id = tt.i('cimentA');
select tt.erreur($q$select convertir_devis((select (j->>'devis_id')::uuid from r4), gen_random_uuid(), '[{"mode":"especes"}]')$q$, 'Stock insuffisant');
select tt.ok((select statut from devis where id = (select (j->>'devis_id')::uuid from r4)) = 'accepte', 'devis resté accepté');
select tt.ok((select count(*) from ventes where boutique_id = tt.i('boutA')) = 1, 'aucune vente créée');
-- Crédit : sans client refusé, avec client accepté. Le devis r4 a un client : tout à crédit.
update stock_courant set quantite = 500 where produit_id = tt.i('cimentA');
create temp table v2 as select convertir_devis((select (j->>'devis_id')::uuid from r4), gen_random_uuid(), '[]') as j;
select tt.ok((select (j->>'credit')::bigint from v2) = 12000, 'crédit 12 000 pour 100 kg à 120');
select tt.ok((select count(*) from creances where vente_id = (select (j->>'vente_id')::uuid from v2)) = 1, 'créance créée');

-- 13. Bon de livraison : depuis une vente, une seule fois ; immuable ; numérotation propre.
create temp table b1 as select creer_bon_livraison(tt.i('boutA'), (select (j->>'vente_id')::uuid from v1), null, 'Bastos, rue 1.234', 'Fragile') as j;
select tt.ok((select j->>'numero' from b1) like 'BL-%-000001', 'BL-...-000001');
select tt.ok((select (creer_bon_livraison(tt.i('boutA'), (select (j->>'vente_id')::uuid from v1), null, 'autre', null)->>'deja_cree')::boolean), 'un seul bon par vente');
select tt.ok((select count(*) from bons_livraison) = 1, 'un seul bon');
select tt.erreur($q$update bons_livraison set adresse_livraison = 'x'$q$, 'ne peut jamais être modifié');
select tt.erreur($q$delete from bons_livraison$q$, 'ne peut jamais être modifié');
select tt.erreur($q$select creer_bon_livraison(tt.i('boutA'), null, null, null, null)$q$, 'Choisissez une vente ou un devis');
select tt.erreur($q$select creer_bon_livraison(tt.i('boutA'), (select (j->>'vente_id')::uuid from v1), (select (j->>'devis_id')::uuid from r2), null, null)$q$, 'Choisissez une vente ou un devis');
select tt.erreur($q$select creer_bon_livraison(tt.i('boutA'), null, (select (j->>'devis_id')::uuid from r2), null, null)$q$, 'devenu une vente');
-- Bon depuis un devis accepté (nouveau devis).
create temp table r6 as select enregistrer_devis(tt.i('boutA'), gen_random_uuid(), null, 'devis', tt.i('clientA'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1)), 0, current_date + 5, null, null, true) as j;
select marquer_devis((select (j->>'devis_id')::uuid from r6), 'accepte');
create temp table b2 as select creer_bon_livraison(tt.i('boutA'), null, (select (j->>'devis_id')::uuid from r6), null, null) as j;
select tt.ok((select j->>'numero' from b2) like 'BL-%-000002', 'BL-...-000002');
-- Vente annulée : pas de bon.
select annuler_vente((select (j->>'vente_id')::uuid from v2), 'erreur de saisie');
select tt.erreur($q$select creer_bon_livraison(tt.i('boutA'), (select (j->>'vente_id')::uuid from v2), null, null, null)$q$, 'annulée');

-- 14. Duplication : nouveau brouillon, prix du jour, validité 15 jours.
create temp table d1 as select dupliquer_devis((select (j->>'devis_id')::uuid from r2), gen_random_uuid()) as j;
select tt.ok((select statut from devis where id = (select (j->>'devis_id')::uuid from d1)) = 'brouillon', 'copie en brouillon');
select tt.ok((select valide_jusqu from devis where id = (select (j->>'devis_id')::uuid from d1)) = (now() at time zone 'Africa/Douala')::date + 15, 'validité 15 jours');
select tt.ok((select quantite from devis_lignes where devis_id = (select (j->>'devis_id')::uuid from d1)) = 3, 'mêmes quantités');

-- 15. Journal.
select tt.ok((select count(*) from journal_activite where action = 'devis_envoye') = 4, '4 envois journalisés (r2, r4, r5, r6)');
select tt.ok((select count(*) from journal_activite where action = 'devis_accepte') = 3, 'acceptations journalisées');
select tt.ok((select count(*) from journal_activite where action = 'devis_refuse') = 1, 'refus journalisé');
select tt.ok((select (details->>'total_vente')::bigint - (details->>'total_devis')::bigint from journal_activite where action = 'devis_converti' order by id limit 1) = 300, 'journal : écart de prix 300');
select tt.ok((select count(*) from journal_activite where action = 'bon_livraison_cree') = 2, 'bons journalisés');

-- 16. RLS : B ne voit rien de A ; un vendeur ne voit aucun devis ; A voit les siens.
reset role; set role authenticated;
select tt.moi(tt.i('propB'));
select tt.ok((select count(*) from devis) = 0, 'B ne voit aucun devis de A');
select tt.ok((select count(*) from devis_lignes) = 0, 'B ne voit aucune ligne');
select tt.ok((select count(*) from bons_livraison) = 0, 'B ne voit aucun bon');
select tt.erreur($q$select lister_devis(tt.i('boutA'))$q$, 'Accès refusé');
select tt.erreur($q$select marquer_devis((select id from devis limit 1), 'refuse')$q$, 'Devis introuvable');
select tt.erreur($q$insert into devis (organisation_id, boutique_id, auteur_id, valide_jusqu, cle_idempotence) values (tt.i('orgB'), tt.i('boutB'), tt.i('propB'), current_date, gen_random_uuid())$q$, 'permission denied');
select tt.moi(tt.i('vendA'));
select tt.ok((select count(*) from devis) = 0, 'le vendeur ne voit aucun devis');
select tt.ok((lister_devis(tt.i('boutA'))->'devis') = '[]'::jsonb, 'le vendeur : liste vide');
select tt.moi(tt.i('propA'));
select tt.ok((select count(*) from devis) = 6, 'A voit ses 6 devis (dont brouillon archivé et copie) : ' || (select count(*) from devis));
select tt.erreur($q$select count(*) from compteurs_documents$q$, 'permission denied');
reset role;
