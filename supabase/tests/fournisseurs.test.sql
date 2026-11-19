-- Test SQL des fournisseurs (migration 22). Base neuve avec toutes les migrations ; crée des organisations de test : jamais en production.
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

-- 1. Plan Essentiel et vendeur refusés.
select tt.moi(tt.i('propE'));
select tt.erreur($q$select enregistrer_fournisseur(tt.i('boutE'), null, 'Cimencam', null, null, null)$q$, 'ne sont pas inclus');
select tt.moi(tt.i('vendA'));
select tt.erreur($q$select enregistrer_fournisseur(tt.i('boutA'), null, 'Cimencam', null, null, null)$q$, 'Seul le propriétaire');

-- 2. Fournisseur : création, doublon, validation.
select tt.moi(tt.i('propA'));
insert into tt.ids values ('f1', enregistrer_fournisseur(tt.i('boutA'), null, 'Cimencam', '699000111', 'Douala', null));
select tt.erreur($q$select enregistrer_fournisseur(tt.i('boutA'), null, ' CIMENCAM ', null, null, null)$q$, 'porte déjà ce nom');
select tt.erreur($q$select enregistrer_fournisseur(tt.i('boutA'), null, 'X', null, null, null)$q$, 'nom du fournisseur');
select tt.ok(enregistrer_fournisseur(tt.i('boutA'), tt.i('f1'), 'Cimencam SA', '699000111', 'Douala', 'Livre en 3 jours') = tt.i('f1'), 'modification');

-- 3. Commande : prix par unité de commande, total calculé, numéro CF.
create temp table c1 as select creer_commande(tt.i('boutA'), '11111111-1111-1111-1111-111111111111', tt.i('f1'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 20, 'prix_achat', 4750)), 'Urgent') as j;
select tt.ok((select (j->>'total')::bigint from c1) = 95000, 'total 95 000');
select tt.ok((select j->>'numero' from c1) like 'CF-%-000001', 'numéro CF');
select tt.ok((select (creer_commande(tt.i('boutA'), '11111111-1111-1111-1111-111111111111', tt.i('f1'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1, 'prix_achat', 1)), null)->>'deja_enregistree')::boolean), 'idempotence');
select tt.erreur($q$select creer_commande(tt.i('boutA'), gen_random_uuid(), tt.i('f1'), '[]', null)$q$, 'au moins un article');
select tt.erreur($q$select creer_commande(tt.i('boutA'), gen_random_uuid(), tt.i('f1'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentB'), 'unite_id', tt.i('sacB'), 'quantite', 1, 'prix_achat', 100)), null)$q$, 'introuvable');
select tt.erreur($q$select creer_commande(tt.i('boutA'), gen_random_uuid(), tt.i('f1'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('sacA'), 'quantite', 1, 'prix_achat', -5)), null)$q$, 'invalide');
-- Une commande ne change pas de contenu.
select tt.erreur($q$update commandes_fournisseurs set total = 1$q$, 'ne se modifie pas');
select tt.erreur($q$update commande_lignes set prix_achat = 1$q$, 'ne se modifie pas');
select tt.erreur($q$delete from commande_lignes$q$, 'Suppression interdite');
-- Rien n'entre en stock avant la réception.
select tt.ok((select quantite from stock_courant where produit_id = tt.i('cimentA')) = 500, 'stock inchangé à la commande');

-- 4. Réception partielle : 8 sacs sur 20. Stock +400 kg, prix d'achat 95/kg (avant : 90), dette 38 000.
insert into tt.ids select 'ligne1', id from commande_lignes where commande_id = (select (j->>'commande_id')::uuid from c1);
create temp table r1 as select receptionner_commande((select (j->>'commande_id')::uuid from c1), '22222222-2222-2222-2222-222222222222',
  jsonb_build_array(jsonb_build_object('commande_ligne_id', tt.i('ligne1'), 'quantite', 8)), 10000, 'especes') as j;
select tt.ok((select quantite from stock_courant where produit_id = tt.i('cimentA')) = 900, 'stock 500 + 400');
select tt.ok((select prix_achat from produit_couts where produit_id = tt.i('cimentA')) = 95, 'prix d''achat mis à jour (95 par kg)');
select tt.ok((select count(*) from prix_achat_historique where produit_id = tt.i('cimentA') and ancien_prix = 90 and prix_achat = 95) = 1, 'historique 90 -> 95');
select tt.ok((select (j->>'montant')::bigint from r1) = 38000 and (select j->>'statut' from r1) = 'recue_partiellement', 'montant 38 000, partielle');
select tt.ok((select solde from dettes_fournisseurs) = 28000 and (select paye from dettes_fournisseurs) = 10000, 'dette 38 000, payé 10 000, solde 28 000');
select tt.ok((select count(*) from paiements_fournisseurs) = 1, 'paiement comptant enregistré');
-- Rejeu même clé : rien de plus.
select tt.ok((select (receptionner_commande((select (j->>'commande_id')::uuid from c1), '22222222-2222-2222-2222-222222222222',
  jsonb_build_array(jsonb_build_object('commande_ligne_id', tt.i('ligne1'), 'quantite', 8)))->>'deja_enregistree')::boolean), 'rejeu idempotent');
select tt.ok((select quantite from stock_courant where produit_id = tt.i('cimentA')) = 900, 'stock inchangé après rejeu');
-- Trop reçu, ligne étrangère, payé > valeur : refusés, rien d'écrit.
select tt.erreur($q$select receptionner_commande((select (j->>'commande_id')::uuid from c1), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('commande_ligne_id', tt.i('ligne1'), 'quantite', 13)))$q$, 'Trop reçu');
select tt.erreur($q$select receptionner_commande((select (j->>'commande_id')::uuid from c1), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('commande_ligne_id', gen_random_uuid(), 'quantite', 1)))$q$, 'ne fait pas partie');
select tt.erreur($q$select receptionner_commande((select (j->>'commande_id')::uuid from c1), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('commande_ligne_id', tt.i('ligne1'), 'quantite', 1)), 999999)$q$, 'dépasse la valeur reçue');
select tt.ok((select quantite from stock_courant where produit_id = tt.i('cimentA')) = 900 and (select count(*) from receptions) = 1, 'refus = rien d''écrit');
-- Une commande partiellement reçue ne s'annule plus.
select tt.erreur($q$select annuler_commande((select (j->>'commande_id')::uuid from c1), 'erreur')$q$, 'déjà reçue');
-- Réception du reste (même prix : aucun nouvel historique).
create temp table r2 as select receptionner_commande((select (j->>'commande_id')::uuid from c1), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('commande_ligne_id', tt.i('ligne1'), 'quantite', 12))) as j;
select tt.ok((select statut from commandes_fournisseurs) = 'recue', 'commande reçue en entier');
select tt.ok((select quantite from stock_courant where produit_id = tt.i('cimentA')) = 1500, 'stock 500 + 1000');
select tt.erreur($q$select receptionner_commande((select (j->>'commande_id')::uuid from c1), gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('commande_ligne_id', tt.i('ligne1'), 'quantite', 1)))$q$, 'déjà reçue');
select tt.erreur($q$update commandes_fournisseurs set statut = 'commandee'$q$, 'terminée');
select tt.erreur($q$update receptions set montant = 1$q$, 'ne peut jamais être modifié');
select tt.erreur($q$update prix_achat_historique set prix_achat = 1$q$, 'ne peut jamais être modifié');
select tt.erreur($q$update commande_lignes set quantite_recue = 0$q$, 'ne diminue jamais');

-- 5. Dettes : paiement partiel, total, trop payé, rejeu.
select tt.ok((select sum(solde) from dettes_fournisseurs) = 28000 + 57000, 'dettes ouvertes 85 000');
create temp table pd as select id from dettes_fournisseurs order by cree_le limit 1;
select tt.erreur($q$select payer_dette_fournisseur((select id from pd), gen_random_uuid(), 99999999, 'especes')$q$, 'dépasse ce que vous devez');
select tt.erreur($q$select payer_dette_fournisseur((select id from pd), gen_random_uuid(), 0, 'especes')$q$, 'supérieur à zéro');
select tt.erreur($q$select payer_dette_fournisseur((select id from pd), gen_random_uuid(), 100, 'cheque')$q$, 'Mode de paiement');
select payer_dette_fournisseur((select id from pd), '33333333-3333-3333-3333-333333333333', 20000, 'mtn_momo');
select tt.ok((select (payer_dette_fournisseur((select id from pd), '33333333-3333-3333-3333-333333333333', 20000, 'mtn_momo')->>'deja_enregistre')::boolean), 'rejeu paiement');
select tt.ok((select solde from dettes_fournisseurs where id = (select id from pd)) = 8000, 'solde 8 000 après 20 000');
select payer_dette_fournisseur((select id from pd), gen_random_uuid(), 8000, 'especes');
select tt.ok((select statut from dettes_fournisseurs where id = (select id from pd)) = 'soldee', 'dette soldée');
select tt.erreur($q$select payer_dette_fournisseur((select id from pd), gen_random_uuid(), 1, 'especes')$q$, 'déjà soldée');
select tt.erreur($q$update paiements_fournisseurs set montant = 1$q$, 'ne peut jamais être modifié');

-- 6. Archivage : refusé tant qu'on doit de l'argent ; une commande jamais reçue s'annule.
select tt.erreur($q$select archiver_fournisseur(tt.i('boutA'), tt.i('f1'))$q$, 'Vous devez encore');
create temp table c2 as select creer_commande(tt.i('boutA'), gen_random_uuid(), tt.i('f1'),
  jsonb_build_array(jsonb_build_object('produit_id', tt.i('cimentA'), 'unite_id', tt.i('kgA'), 'quantite', 100, 'prix_achat', 100)), null) as j;
select tt.erreur($q$select annuler_commande((select (j->>'commande_id')::uuid from c2), ' ')$q$, 'motif');
select annuler_commande((select (j->>'commande_id')::uuid from c2), 'Fournisseur en rupture');
select tt.ok((select statut from commandes_fournisseurs where id = (select (j->>'commande_id')::uuid from c2)) = 'annulee', 'commande annulée');
select tt.erreur($q$select receptionner_commande((select (j->>'commande_id')::uuid from c2), gen_random_uuid(), '[]')$q$, 'annulée');

-- 7. Journal.
select tt.ok((select count(*) from journal_activite where action = 'commande_creee') = 2, 'commandes journalisées');
select tt.ok((select count(*) from journal_activite where action = 'commande_recue') = 2, 'réceptions journalisées');
select tt.ok((select count(*) from journal_activite where action = 'paiement_fournisseur') = 2, 'paiements journalisés');
select tt.ok((select count(*) from journal_activite where action = 'commande_annulee') = 1, 'annulation journalisée');

-- 8. RLS : B ne voit rien de A ; un vendeur non plus ; A voit tout.
set role authenticated;
select tt.moi(tt.i('propB'));
select tt.ok((select count(*) from fournisseurs) = 0 and (select count(*) from commandes_fournisseurs) = 0 and (select count(*) from dettes_fournisseurs) = 0
  and (select count(*) from prix_achat_historique) = 0 and (select count(*) from receptions) = 0 and (select count(*) from paiements_fournisseurs) = 0, 'B ne voit rien');
select tt.erreur($q$select lister_commandes(tt.i('boutA'))$q$, 'Accès refusé');
select tt.erreur($q$select payer_dette_fournisseur((select id from dettes_fournisseurs limit 1), gen_random_uuid(), 1, 'especes')$q$, 'Dette introuvable');
select tt.erreur($q$insert into fournisseurs (organisation_id, nom) values (tt.i('orgB'), 'Pirate')$q$, 'permission denied');
select tt.moi(tt.i('vendA'));
select tt.ok((select count(*) from fournisseurs) = 0 and (select count(*) from dettes_fournisseurs) = 0 and (select count(*) from prix_achat_historique) = 0, 'le vendeur ne voit ni fournisseurs ni dettes ni prix d''achat');
select tt.moi(tt.i('propA'));
select tt.ok((select count(*) from fournisseurs) = 1 and (select count(*) from dettes_fournisseurs) = 2 and (select count(*) from prix_achat_historique) = 1, 'A voit ses données');
select tt.ok((lister_fournisseurs(tt.i('boutA'))->0->>'du')::bigint = 57000, 'dû 57 000 (seconde réception impayée) : ' || (lister_fournisseurs(tt.i('boutA'))->0->>'du'));
select tt.ok(jsonb_array_length(lister_commandes(tt.i('boutA'))->'commandes') = 2, 'liste des commandes');
reset role;
