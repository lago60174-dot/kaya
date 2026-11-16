"use server";

import { planifierNotifications } from "@/server/notifications/declencher";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LIMITES_IMAGE, type TypeImage } from "@/lib/images/compression";
import { formatQuantite } from "@/lib/format";
import { configR2 } from "@/lib/env";
import { mouvementSchema, produitSchema } from "@/lib/stock/schemas";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";
import { bucketImages } from "@/server/images/bucket";
import {
  cleAppartient,
  construireCle,
  estCleCatalogue,
} from "@/server/images/cles";
import { signerEnvoi } from "@/server/images/signature";
import { verifierImageStockee } from "@/server/images/verification";

export interface EtatStock {
  erreur?: string;
  champs?: Record<string, string>;
  succes?: string;
}

const ERREUR_COMPTE = "Impossible de charger votre boutique. Reconnectez-vous.";

async function contexteProprietaire() {
  const profil = await exigerRole("proprietaire");
  const boutiqueId = profil.boutiqueIds[0];
  return profil.organisationId && boutiqueId
    ? { organisationId: profil.organisationId, boutiqueId }
    : null;
}

export async function demanderUrlEnvoiAction(entree: {
  hash: string;
  type: TypeImage;
  taille: number;
}): Promise<{ url?: string; cle?: string; erreur?: string }> {
  const ctx = await contexteProprietaire();
  if (!ctx) return { erreur: ERREUR_COMPTE };
  if (
    !(entree.type in LIMITES_IMAGE) ||
    !Number.isInteger(entree.taille) ||
    entree.taille <= 0 ||
    entree.taille > LIMITES_IMAGE[entree.type].octets
  ) {
    return { erreur: "Cette photo est trop lourde. Choisissez-en une autre." };
  }
  const cle = construireCle(ctx.organisationId, entree.hash, entree.type);
  const config = configR2();
  if (!cle) return { erreur: "Photo invalide." };
  if (!config)
    return { erreur: "L'envoi des photos n'est pas encore configuré." };
  return { url: await signerEnvoi(config, cle), cle };
}

type Supabase = Awaited<ReturnType<typeof supabaseServeur>>;

/** Trouve ou crée une catégorie / une marque saisie à la main. */
async function idPourNom(
  supabase: Supabase,
  table: "categories" | "marques",
  organisationId: string,
  nom: string,
): Promise<{ id?: string; erreur?: string }> {
  const { data, error } = await supabase
    .from(table)
    .insert({ organisation_id: organisationId, nom })
    .select("id")
    .single();
  if (data) return { id: data.id };
  if (error?.code === "23505") {
    const { data: existant } = await supabase
      .from(table)
      .select("id")
      .ilike("nom", nom)
      .maybeSingle();
    return existant
      ? { id: existant.id }
      : { erreur: `« ${nom} » existe déjà : choisissez-le dans la liste.` };
  }
  return { erreur: messageErreurBase(error) };
}

export async function enregistrerProduitAction(
  _e: EtatStock,
  formData: FormData,
): Promise<EtatStock> {
  const ctx = await contexteProprietaire();
  if (!ctx) return { erreur: ERREUR_COMPTE };
  const lu = produitSchema.safeParse(Object.fromEntries(formData));
  if (!lu.success) {
    const champs: Record<string, string> = {};
    for (const i of lu.error.issues) champs[String(i.path[0])] ??= i.message;
    return { erreur: "Vérifiez les champs en rouge.", champs };
  }
  const d = lu.data;

  // Photos : elles doivent être à nous, bien du WebP et assez légères (contrôle après envoi).
  const images: [string | undefined, TypeImage][] = [
    [d.imageCle, "photo"],
    [d.vignetteCle, "vignette"],
  ];
  for (const [cle, type] of images) {
    if (!cle) continue;
    if (!cleAppartient(cle, ctx.organisationId, type))
      return { erreur: "Photo invalide. Choisissez-la à nouveau." };
    if (estCleCatalogue(cle)) continue; // fichier statique du catalogue modèle : rien à contrôler dans R2
    const bucket = bucketImages();
    if (!bucket)
      return {
        erreur:
          "Les photos sont momentanément indisponibles. Enregistrez sans photo ou réessayez.",
      };
    const verification = await verifierImageStockee(bucket, cle, type);
    if (!verification.ok) return { erreur: verification.message };
  }

  const supabase = await supabaseServeur();
  let categorieId = d.categorieId;
  if (d.nouvelleCategorie) {
    const r = await idPourNom(
      supabase,
      "categories",
      ctx.organisationId,
      d.nouvelleCategorie,
    );
    if (r.erreur)
      return { erreur: r.erreur, champs: { nouvelleCategorie: r.erreur } };
    categorieId = r.id;
  }
  let marqueId = d.marqueId;
  if (d.nouvelleMarque) {
    const r = await idPourNom(
      supabase,
      "marques",
      ctx.organisationId,
      d.nouvelleMarque,
    );
    if (r.erreur)
      return { erreur: r.erreur, champs: { nouvelleMarque: r.erreur } };
    marqueId = r.id;
  }

  const { data: id, error } = await supabase.rpc("enregistrer_produit", {
    p_boutique: ctx.boutiqueId,
    p_id: d.id ?? null,
    p_nom: d.nom,
    p_categorie_id: categorieId ?? null,
    p_unite_base: d.uniteBase,
    p_seuil_alerte: d.seuilAlerte,
    p_prix_achat: d.prixAchat,
    p_unites: d.unites.map((u) => ({
      id: u.id ?? null,
      nom: u.nom,
      facteur: u.facteur,
      prix_vente: u.prixVente,
    })),
    p_image_cle: d.imageCle ?? null,
    p_vignette_cle: d.vignetteCle ?? null,
    p_code_barres: d.codeBarres ?? null,
    p_actif: d.actif,
    p_marque_id: marqueId ?? null,
  });
  if (error || !id) return { erreur: messageErreurBase(error) };
  revalidatePath("/stock");
  redirect(`/stock/${id}`);
}

export async function mouvementAction(
  _e: EtatStock,
  formData: FormData,
): Promise<EtatStock> {
  const ctx = await contexteProprietaire();
  if (!ctx) return { erreur: ERREUR_COMPTE };
  const lu = mouvementSchema.safeParse({
    ...Object.fromEntries(formData),
    boutiqueId: ctx.boutiqueId,
  });
  if (!lu.success) {
    const champs: Record<string, string> = {};
    for (const i of lu.error.issues) champs[String(i.path[0])] ??= i.message;
    return { erreur: "Vérifiez les champs en rouge.", champs };
  }
  const d = lu.data;
  const supabase = await supabaseServeur();
  const { data, error } = await supabase.rpc("enregistrer_mouvement_stock", {
    p_boutique: ctx.boutiqueId,
    p_produit: d.produitId,
    p_type: d.type,
    p_quantite: d.quantite,
    p_unite: d.uniteId ?? null,
    p_motif: d.motif ?? null,
    p_prix_achat: d.prixAchat ?? null,
  });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath("/stock");
  revalidatePath(`/stock/${d.produitId}`);
  planifierNotifications(ctx.organisationId);
  return {
    succes: `Enregistré. Nouveau stock : ${formatQuantite(Number(data))} (unité de base).`,
  };
}

export async function archiverProduitAction(
  _e: EtatStock,
  formData: FormData,
): Promise<EtatStock> {
  const ctx = await contexteProprietaire();
  if (!ctx) return { erreur: ERREUR_COMPTE };
  const supabase = await supabaseServeur();
  const { error } = await supabase.rpc("archiver_produit", {
    p_boutique: ctx.boutiqueId,
    p_id: String(formData.get("produitId")),
    p_archiver: true,
  });
  if (error) return { erreur: messageErreurBase(error) };
  revalidatePath("/stock");
  redirect("/stock");
}
