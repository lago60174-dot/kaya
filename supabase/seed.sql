-- Kaya : données de démonstration (quincaillerie fictive). Prix fictifs et modifiables.
-- Comptes : proprietaire@kaya.demo et vendeur@kaya.demo, mot de passe Demo1234!
-- Réinitialiser : npm run demo:reset

create temp table seed_produits as select * from (values
  ('Ciment CPJ 42,5 (sac 50 kg)', 'Ciment et fer', 'kg', 95, 500, 3000, 'sac:50:5500|kg:1:130'),
  ('Fer à béton 8 mm', 'Ciment et fer', 'barre', 2800, 30, 200, 'barre:1:3500'),
  ('Fer à béton 10 mm', 'Ciment et fer', 'barre', 4300, 30, 200, 'barre:1:5200'),
  ('Fer à béton 12 mm', 'Ciment et fer', 'barre', 6200, 30, 200, 'barre:1:7400'),
  ('Tôle ondulée 3 m', 'Tôles', 'pièce', 4500, 20, 150, 'pièce:1:5500'),
  ('Tôle bac alu 3 m', 'Tôles', 'pièce', 7500, 20, 150, 'pièce:1:9000'),
  ('Clous 2 pouces', 'Quincaillerie', 'kg', 900, 10, 400, 'kg:1:1200|boîte:25:27000'),
  ('Clous 3 pouces', 'Quincaillerie', 'kg', 900, 10, 400, 'kg:1:1200|boîte:25:27000'),
  ('Clous 4 pouces', 'Quincaillerie', 'kg', 900, 10, 400, 'kg:1:1200|boîte:25:27000'),
  ('Câble électrique 1,5 mm', 'Électricité', 'mètre', 250, 100, 2000, 'mètre:1:330|rouleau:100:30000'),
  ('Câble électrique 2,5 mm', 'Électricité', 'mètre', 350, 100, 2000, 'mètre:1:450|rouleau:100:42000'),
  ('Câble électrique 4 mm', 'Électricité', 'mètre', 550, 100, 2000, 'mètre:1:700|rouleau:100:66000'),
  ('Peinture murale blanche 5 L', 'Peinture', 'pot', 6500, 10, 300, 'pot:1:8500|seau:4:32000'),
  ('Peinture à huile 1 L', 'Peinture', 'pot', 3500, 10, 300, 'pot:1:4500'),
  ('Peinture émail rouge 1 L', 'Peinture', 'pot', 4000, 10, 300, 'pot:1:5200'),
  ('Tuyau PVC 32 mm', 'Plomberie', 'barre', 2500, 15, 200, 'barre:1:3200'),
  ('Tuyau PVC 50 mm', 'Plomberie', 'barre', 4200, 15, 200, 'barre:1:5200'),
  ('Tuyau PVC 110 mm', 'Plomberie', 'barre', 9000, 15, 200, 'barre:1:11000'),
  ('Colle PVC', 'Plomberie', 'pot', 1800, 6, 100, 'pot:1:2500'),
  ('Cadenas 40 mm', 'Quincaillerie', 'pièce', 1500, 10, 100, 'pièce:1:2200'),
  ('Cadenas 60 mm', 'Quincaillerie', 'pièce', 2800, 5, 100, 'pièce:1:3800'),
  ('Ampoule LED 9 W', 'Électricité', 'pièce', 600, 30, 500, 'pièce:1:900|boîte:10:8500'),
  ('Ampoule LED 15 W', 'Électricité', 'pièce', 900, 30, 500, 'pièce:1:1300|boîte:12:12000'),
  ('Cuvette plastique', 'Quincaillerie', 'pièce', 900, 15, 200, 'pièce:1:1500'),
  ('Serrure de porte à clé', 'Quincaillerie', 'pièce', 3500, 8, 100, 'pièce:1:5000'),
  ('Serrure de porte intérieure', 'Quincaillerie', 'pièce', 5000, 8, 100, 'pièce:1:7000'),
  ('Brouette', 'Quincaillerie', 'pièce', 25000, 3, 20, 'pièce:1:32000'),
  ('Marteau', 'Quincaillerie', 'pièce', 2000, 5, 60, 'pièce:1:3000'),
  ('Interrupteur simple', 'Électricité', 'pièce', 700, 20, 200, 'pièce:1:1200'),
  ('Disjoncteur 16 A', 'Électricité', 'pièce', 2500, 10, 100, 'pièce:1:3800')
) as t(nom, cat, base, achat, seuil, stock, unites);

do $seed$
declare
  v_patron uuid := '11111111-1111-4111-8111-111111111111';
  v_vendeur uuid := '22222222-2222-4222-8222-222222222222';
  r jsonb; v_org uuid; v_b uuid; v_cat uuid; v_p uuid; rec record; u text;
  v_prods uuid[]; v_clients uuid[]; n int; i int; a int; b int; v_lignes jsonb; v_pay jsonb; v_client uuid; v_remise bigint;
  v_unite uuid; v_cr record; j int;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
    raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change, created_at, updated_at)
  select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email,
    extensions.crypt('Demo1234!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}',
    '', '', '', '', now(), now()
  from (values (v_patron, 'proprietaire@kaya.demo'), (v_vendeur, 'vendeur@kaya.demo')) as x(id, email);
  insert into auth.identities (user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  select id, jsonb_build_object('sub', id::text, 'email', email), 'email', id::text, now(), now(), now()
  from auth.users where id in (v_patron, v_vendeur);

  perform set_config('request.jwt.claim.sub', v_patron::text, true);
  r := creer_organisation('Quincaillerie Démo', 'Quincaillerie du Centre');
  v_org := (r->>'organisation_id')::uuid; v_b := (r->>'boutique_id')::uuid;
  update boutiques set adresse = 'Marché Mfoundi, Yaoundé', telephone = '699000000',
    mention_legale = 'Merci de votre confiance. Marchandise vendue, ni reprise ni échangée.' where id = v_b;
  update membres set nom = 'Patron démo' where utilisateur_id = v_patron;
  insert into membres (utilisateur_id, organisation_id, role, boutiques_autorisees, nom)
  values (v_vendeur, v_org, 'vendeur', array[v_b], 'Vendeur démo');

  for rec in select * from seed_produits loop
    select id into v_cat from categories where organisation_id = v_org and nom = rec.cat;
    if v_cat is null then
      insert into categories (organisation_id, nom) values (v_org, rec.cat) returning id into v_cat;
    end if;
    insert into produits (organisation_id, categorie_id, nom, unite_base, seuil_alerte)
    values (v_org, v_cat, rec.nom, rec.base, rec.seuil) returning id into v_p;
    insert into produit_couts (produit_id, organisation_id, prix_achat) values (v_p, v_org, rec.achat);
    foreach u in array string_to_array(rec.unites, '|') loop
      insert into produit_unites (organisation_id, produit_id, nom, facteur, prix_vente)
      values (v_org, v_p, split_part(u, ':', 1), split_part(u, ':', 2)::numeric, split_part(u, ':', 3)::bigint);
    end loop;
    perform enregistrer_mouvement_stock(v_b, v_p, 'entree', rec.stock);
  end loop;

  insert into clients (organisation_id, nom, telephone, plafond_credit)
  select v_org, c.nom, c.tel, 500000 from (values
    ('Jean Mbarga', '699111111'), ('Aïcha Ngono', '677222222'), ('Entreprise Tchoumi BTP', '655333333'),
    ('Paul Essomba', '699444444'), ('Marie Fotso', '677555555'), ('Samuel Ateba', '655666666'),
    ('Chantal Nkolo', '699777777'), ('Boubakari Issa', '677888888')) as c(nom, tel);
  select array_agg(id order by nom) into v_clients from clients where organisation_id = v_org;
  select array_agg(id order by nom) into v_prods from produits where organisation_id = v_org;
  n := array_length(v_prods, 1);

  for i in 1..20 loop
    a := (i * 7) % n + 1; b := (i * 11 + 3) % n + 1;
    if a = b then b := b % n + 1; end if;
    v_lignes := '[]'::jsonb;
    foreach j in array array[a, b] loop
      select id into v_unite from produit_unites where produit_id = v_prods[j]
        order by case when i % 2 = 0 then -facteur else facteur end limit 1;
      v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
        'produit_id', v_prods[j], 'unite_id', v_unite, 'quantite', 1 + (i + j) % 3));
    end loop;
    v_client := null; v_remise := 0;
    if i in (3, 8, 14) then
      v_client := v_clients[case i when 3 then 1 when 8 then 2 else 3 end];
      v_pay := '[{"mode":"especes","montant":300}]';
    elsif i % 4 = 0 then v_pay := '[{"mode":"mtn_momo"}]';
    elsif i % 4 = 1 then v_pay := '[{"mode":"orange_money"}]';
    elsif i % 4 = 2 then v_pay := '[{"mode":"especes"}]';
    else v_pay := '[{"mode":"especes","montant":300},{"mode":"mtn_momo"}]'; end if;
    if i in (5, 17) then v_remise := 500; end if;
    perform set_config('request.jwt.claim.sub', (case when i % 2 = 0 and v_remise = 0 then v_vendeur else v_patron end)::text, true);
    perform creer_vente(v_b, gen_random_uuid(), v_lignes, v_pay, v_client, v_remise);
  end loop;

  perform set_config('request.jwt.claim.sub', v_vendeur::text, true);
  for v_cr in select id from creances where statut = 'ouverte' order by cree_le, id limit 2 loop
    perform enregistrer_remboursement(v_cr.id, 2000, 'especes');
  end loop;

  -- Quelques stocks sous le seuil, une perte
  perform set_config('request.jwt.claim.sub', v_patron::text, true);
  for rec in select * from (values ('Fer à béton 12 mm', 12), ('Cadenas 60 mm', 3), ('Colle PVC', 4), ('Peinture émail rouge 1 L', 2)) as x(nom, q) loop
    perform enregistrer_mouvement_stock(v_b, (select id from produits where organisation_id = v_org and nom = rec.nom), 'inventaire', rec.q);
  end loop;
  perform enregistrer_mouvement_stock(v_b, (select id from produits where nom = 'Cuvette plastique'), 'perte', 2, null, 'Casse au déchargement');

  insert into depenses (organisation_id, boutique_id, categorie, montant, note, auteur_id, date)
  values (v_org, v_b, 'transport', 5000, 'Livraison ciment', v_vendeur, now() - interval '5 days'),
         (v_org, v_b, 'electricite', 15000, 'Facture ENEO', v_patron, now() - interval '3 days'),
         (v_org, v_b, 'transport', 2500, 'Taxi fournisseur', v_vendeur, now() - interval '1 day'),
         (v_org, v_b, 'autre', 1000, 'Eau et café', v_vendeur, now());

  -- Étale les ventes sur les 7 derniers jours (le seed est la seule exception à l'immutabilité).
  perform set_config('session_replication_role', 'replica', true);
  with o as (select id, row_number() over (order by numero_recu) k from ventes where organisation_id = v_org)
  update ventes v set date = date_trunc('day', now()) - ((20 - o.k) / 3) * interval '1 day' + (8 + o.k % 10) * interval '1 hour'
  from o where v.id = o.id;
  update ventes set cree_le = date where organisation_id = v_org;
  update paiements p set date = v.date, cree_le = v.date from ventes v where p.vente_id = v.id;
  update mouvements_stock m set cree_le = v.date from ventes v where m.reference = v.id::text;
  update creances c set cree_le = v.date from ventes v where c.vente_id = v.id;
  update journal_activite j set cree_le = v.date from ventes v where j.entite_id = v.id::text;
  perform set_config('session_replication_role', 'origin', true);
end $seed$;

drop table seed_produits;
