-- Immutabilité, archivage et aides pour la RLS.

create function interdire_modification() returns trigger language plpgsql as $$
begin
  raise exception 'Cet enregistrement ne peut jamais être modifié ni supprimé (%).', tg_table_name;
end $$;

create function interdire_suppression() returns trigger language plpgsql as $$
begin
  raise exception 'Suppression interdite (%). Utilisez l''archivage ou une annulation.', tg_table_name;
end $$;

-- Une vente ne change qu'une fois : valide -> annulee. Rien d'autre.
create function verifier_vente_modifiable() returns trigger language plpgsql as $$
begin
  if old.statut = 'valide' and new.statut = 'annulee'
     and (to_jsonb(new) - 'statut') = (to_jsonb(old) - 'statut') then
    return new;
  end if;
  raise exception 'Une vente ne peut pas être modifiée. Utilisez une annulation avec avoir.';
end $$;

do $$
declare t text;
begin
  foreach t in array array['mouvements_stock', 'paiements', 'journal_activite', 'avoirs', 'vente_lignes', 'vente_lignes_couts'] loop
    execute format('create trigger trg_immuable before update or delete on %I for each row execute function interdire_modification()', t);
  end loop;
  foreach t in array array['boutiques', 'categories', 'produits', 'produit_couts', 'produit_unites', 'clients', 'creances', 'depenses', 'clotures_caisse', 'ventes'] loop
    execute format('create trigger trg_pas_de_suppression before delete on %I for each row execute function interdire_suppression()', t);
  end loop;
  foreach t in array array['organisations', 'boutiques', 'membres', 'parametres_boutique', 'categories', 'produits', 'produit_couts', 'produit_unites', 'clients', 'creances', 'stock_courant', 'clotures_caisse'] loop
    execute format('create trigger trg_modifie_le before update on %I for each row execute function maj_modifie_le()', t);
  end loop;
end $$;

create trigger trg_vente_modifiable before update on ventes
  for each row execute function verifier_vente_modifiable();

-- Aides RLS (security definer : lisent membres sans passer par la RLS).
create function app_org_id() returns uuid language sql stable security definer set search_path = public as $$
  select organisation_id from membres where utilisateur_id = auth.uid() and actif
$$;

create function app_role() returns text language sql stable security definer set search_path = public as $$
  select role from membres where utilisateur_id = auth.uid() and actif
$$;

create function app_acces_boutique(p_boutique uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membres m join boutiques b on b.organisation_id = m.organisation_id
    where m.utilisateur_id = auth.uid() and m.actif and b.id = p_boutique
      and (m.role = 'proprietaire' or p_boutique = any (m.boutiques_autorisees))
  )
$$;

create function ecrire_journal(p_org uuid, p_boutique uuid, p_action text, p_entite text, p_entite_id text, p_details jsonb, p_alerte boolean default false)
returns void language sql security definer set search_path = public as $$
  insert into journal_activite (organisation_id, boutique_id, auteur_id, action, entite, entite_id, details, alerte)
  values (p_org, p_boutique, auth.uid(), p_action, p_entite, p_entite_id, coalesce(p_details, '{}'), p_alerte)
$$;

-- Stock courant maintenu par les mouvements (registre de référence).
create function maj_stock_courant() returns trigger language plpgsql security definer set search_path = public as $$
declare v_nouveau numeric; v_ancien numeric; v_seuil numeric; v_nom text;
begin
  insert into stock_courant (produit_id, boutique_id, organisation_id, quantite)
  values (new.produit_id, new.boutique_id, new.organisation_id, new.quantite)
  on conflict (produit_id, boutique_id)
  do update set quantite = stock_courant.quantite + excluded.quantite, modifie_le = now()
  returning quantite into v_nouveau;
  v_ancien := v_nouveau - new.quantite;
  select seuil_alerte, nom into v_seuil, v_nom from produits where id = new.produit_id;
  if v_nouveau < v_seuil and v_ancien >= v_seuil then
    perform ecrire_journal(new.organisation_id, new.boutique_id, 'stock_bas', 'produit', new.produit_id::text,
      jsonb_build_object('produit', v_nom, 'stock', v_nouveau, 'seuil', v_seuil), true);
  end if;
  return new;
end $$;

create trigger trg_stock_courant after insert on mouvements_stock
  for each row execute function maj_stock_courant();
