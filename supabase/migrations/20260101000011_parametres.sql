-- Étape 9 (suite) : paramètres de la boutique (section 9.9).
-- Les réglages passent par une fonction atomique : droits, compte en lecture seule, validation et journal.
-- L'écriture directe est retirée (elle contournait le journal et la lecture seule d'un compte suspendu).

revoke update on boutiques, parametres_boutique from authenticated;
drop policy ecriture_modif on boutiques;
drop policy ecriture_modif on parametres_boutique;

create function modifier_parametres_boutique(
  p_boutique uuid, p_nom text, p_adresse text, p_telephone text, p_mention_legale text,
  p_seuil_remise numeric, p_plafond_credit bigint, p_stock_negatif boolean, p_ecart_tolere bigint
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m membres; b boutiques; r parametres_boutique;
  v_nom text := trim(coalesce(p_nom, ''));
  v_adresse text := nullif(trim(coalesce(p_adresse, '')), '');
  v_tel text := nullif(trim(coalesce(p_telephone, '')), '');
  v_mention text := nullif(trim(coalesce(p_mention_legale, '')), '');
  v_champs text[] := '{}'; v_avant jsonb := '{}'; v_apres jsonb := '{}';
begin
  m := exiger_acces(p_boutique);
  if m.role <> 'proprietaire' then raise exception 'Seul le propriétaire peut modifier les paramètres.'; end if;
  perform verifier_ecriture(m.organisation_id);

  if char_length(v_nom) < 2 or char_length(v_nom) > 80 then raise exception 'Le nom de la boutique doit faire entre 2 et 80 caractères.'; end if;
  if char_length(v_adresse) > 160 then raise exception 'L''adresse est trop longue (160 caractères maximum).'; end if;
  if v_tel is not null and v_tel !~ '^\+?[0-9 ]{8,20}$' then raise exception 'Le numéro de téléphone est invalide.'; end if;
  if char_length(v_mention) > 300 then raise exception 'Le message de pied de reçu est trop long (300 caractères maximum).'; end if;
  if p_seuil_remise is null or p_seuil_remise < 0 or p_seuil_remise > 100 then raise exception 'Le seuil de remise doit être entre 0 et 100 %%.'; end if;
  if p_seuil_remise <> round(p_seuil_remise, 2) then raise exception 'Le seuil de remise accepte au plus deux décimales.'; end if;
  if p_plafond_credit is null or p_plafond_credit < 0 or p_plafond_credit > 100000000 then raise exception 'Le plafond de crédit est invalide.'; end if;
  if p_stock_negatif is null then raise exception 'Choisissez si le stock négatif est autorisé.'; end if;
  if p_ecart_tolere is null or p_ecart_tolere < 0 or p_ecart_tolere > 10000000 then raise exception 'L''écart de caisse toléré est invalide.'; end if;

  select * into b from boutiques where id = p_boutique for update;
  select * into r from parametres_boutique where boutique_id = p_boutique for update;

  if v_nom is distinct from b.nom then v_champs := array_append(v_champs, 'nom'); end if;
  if v_adresse is distinct from b.adresse then v_champs := array_append(v_champs, 'adresse'); end if;
  if v_tel is distinct from b.telephone then v_champs := array_append(v_champs, 'telephone'); end if;
  if v_mention is distinct from b.mention_legale then v_champs := array_append(v_champs, 'pied_de_recu'); end if;
  if p_seuil_remise is distinct from r.seuil_remise_vendeur then
    v_champs := array_append(v_champs, 'seuil_remise_vendeur');
    v_avant := v_avant || jsonb_build_object('seuil_remise_vendeur', r.seuil_remise_vendeur);
    v_apres := v_apres || jsonb_build_object('seuil_remise_vendeur', p_seuil_remise);
  end if;
  if p_plafond_credit is distinct from r.plafond_credit_defaut then
    v_champs := array_append(v_champs, 'plafond_credit_defaut');
    v_avant := v_avant || jsonb_build_object('plafond_credit_defaut', r.plafond_credit_defaut);
    v_apres := v_apres || jsonb_build_object('plafond_credit_defaut', p_plafond_credit);
  end if;
  if p_stock_negatif is distinct from r.stock_negatif_autorise then
    v_champs := array_append(v_champs, 'stock_negatif_autorise');
    v_avant := v_avant || jsonb_build_object('stock_negatif_autorise', r.stock_negatif_autorise);
    v_apres := v_apres || jsonb_build_object('stock_negatif_autorise', p_stock_negatif);
  end if;
  if p_ecart_tolere is distinct from r.ecart_caisse_tolere then
    v_champs := array_append(v_champs, 'ecart_caisse_tolere');
    v_avant := v_avant || jsonb_build_object('ecart_caisse_tolere', r.ecart_caisse_tolere);
    v_apres := v_apres || jsonb_build_object('ecart_caisse_tolere', p_ecart_tolere);
  end if;

  -- Rien n'a changé : on n'écrit rien, on ne pollue pas le journal.
  if cardinality(v_champs) = 0 then return jsonb_build_object('modifie', false); end if;

  update boutiques set nom = v_nom, adresse = v_adresse, telephone = v_tel, mention_legale = v_mention where id = p_boutique;
  update parametres_boutique set seuil_remise_vendeur = p_seuil_remise, plafond_credit_defaut = p_plafond_credit,
    stock_negatif_autorise = p_stock_negatif, ecart_caisse_tolere = p_ecart_tolere where boutique_id = p_boutique;
  perform ecrire_journal(m.organisation_id, p_boutique, 'parametres_modifies', 'boutique', p_boutique::text,
    jsonb_build_object('champs', to_jsonb(v_champs), 'avant', v_avant, 'apres', v_apres));
  return jsonb_build_object('modifie', true, 'champs', to_jsonb(v_champs));
end $$;

revoke execute on function modifier_parametres_boutique(uuid, text, text, text, text, numeric, bigint, boolean, bigint) from public, anon, authenticated;
grant execute on function modifier_parametres_boutique(uuid, text, text, text, text, numeric, bigint, boolean, bigint) to authenticated;
