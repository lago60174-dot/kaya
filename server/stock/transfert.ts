"use server";

import { revalidatePath } from "next/cache";
import { transfertSchema } from "@/lib/stock/transfert";
import { supabaseServeur } from "@/lib/supabase/server";
import { exigerRole } from "@/server/auth/session";
import { messageErreurBase } from "@/server/erreurs";
import { planifierNotifications } from "@/server/notifications/declencher";
import { listerProduits } from "./lecture";

export interface ProduitTransfert {
  id: string;
  nom: string;
  uniteBase: string;
  stock: number;
  unites: { id: string; nom: string; facteur: number }[];
}

export type ResultatTransfert =
  | { ok: true; message: string }
  | { ok: false; erreur: string };

/** Produits disponibles dans la boutique d'origine (stock supérieur à zéro), pour composer le transfert. */
export async function chercherProduitsTransfertAction(
  boutiqueId: string,
  recherche: string,
): Promise<ProduitTransfert[]> {
  const profil = await exigerRole("proprietaire");
  if (!profil.boutiqueIds.includes(boutiqueId)) return [];
  const page = await listerProduits(await supabaseServeur(), boutiqueId, {
    recherche: recherche.trim().slice(0, 80) || undefined,
  });
  return page.produits
    .filter((p) => p.actif && p.stock > 0)
    .map((p) => ({
      id: p.id,
      nom: p.nom_affiche,
      uniteBase: p.unite_base,
      stock: Number(p.stock),
      unites: p.unites.map((u) => ({ id: u.id, nom: u.nom, facteur: Number(u.facteur) })),
    }));
}

/** Déplace du stock d'une boutique à l'autre. La base vérifie tout (rôle, plan, stock, boutiques) en une transaction. */
export async function transfererStockAction(
  entree: unknown,
): Promise<ResultatTransfert> {
  const profil = await exigerRole("proprietaire");
  const lu = transfertSchema.safeParse(entree);
  if (!lu.success)
    return { ok: false, erreur: lu.error.issues[0]?.message ?? "Transfert invalide." };
  const t = lu.data;
  const { data, error } = await (
    await supabaseServeur()
  ).rpc("transferer_stock", {
    p_source: t.source,
    p_destination: t.destination,
    p_lignes: t.lignes.map((l) => ({
      produit_id: l.produitId,
      unite_id: l.uniteId ?? null,
      quantite: l.quantite,
    })),
    p_cle: t.cle,
    p_note: t.note ?? null,
  });
  if (error) return { ok: false, erreur: messageErreurBase(error) };
  revalidatePath("/stock");
  revalidatePath("/stock/transfert");
  planifierNotifications(profil.organisationId);
  const r = data as { nb_produits?: number; deja_enregistre?: boolean } | null;
  const nb = r?.nb_produits ?? t.lignes.length;
  return {
    ok: true,
    message: r?.deja_enregistre
      ? "Ce transfert était déjà enregistré : le stock n'a pas été déplacé une seconde fois."
      : `Transfert enregistré : ${nb} produit${nb > 1 ? "s" : ""} déplacé${nb > 1 ? "s" : ""}.`,
  };
}
