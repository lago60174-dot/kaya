import { z } from "zod";
import { estJourValide } from "@/lib/caisse/caisse";
import {
  actionsDeCategorie,
  actionsVisibles,
  categoriesVisibles,
  type CategorieJournal,
} from "./journal";

export interface FiltresJournal {
  categorie: CategorieJournal | null;
  alertesSeulement: boolean;
  du: string | null;
  au: string | null;
}

/** Lit les filtres de l'adresse. Tout ce qui est invalide ou non permis par le plan est ignoré, jamais une erreur. */
export function lireFiltres(
  p: Record<string, string | undefined>,
  complet: boolean,
): FiltresJournal {
  const permises = categoriesVisibles(complet).map((c) => c.code);
  const categorie = permises.find((c) => c === p.type) ?? null;
  const du = p.du && estJourValide(p.du) ? p.du : null;
  const au = p.au && estJourValide(p.au) ? p.au : null;
  return {
    categorie,
    alertesSeulement: p.alertes === "1",
    // Une période à l'envers est remise dans l'ordre plutôt que de renvoyer une liste vide inexpliquée.
    du: du && au && du > au ? au : du,
    au: du && au && du > au ? du : au,
  };
}

/** Actions à demander à la base pour ces filtres (toujours limitées à ce que le plan permet). */
export function actionsFiltrees(f: FiltresJournal, complet: boolean): string[] {
  return f.categorie
    ? actionsDeCategorie(f.categorie, complet)
    : actionsVisibles(complet);
}

export function lienJournal(
  f: Partial<FiltresJournal>,
  curseur?: { date: string; id: number },
): string {
  const q = new URLSearchParams();
  if (f.categorie) q.set("type", f.categorie);
  if (f.alertesSeulement) q.set("alertes", "1");
  if (f.du) q.set("du", f.du);
  if (f.au) q.set("au", f.au);
  if (curseur) {
    q.set("apres", curseur.date);
    q.set("id", String(curseur.id));
  }
  const s = q.toString();
  return s ? `/journal?${s}` : "/journal";
}

// Le curseur vient de l'adresse : il est validé strictement avant d'être envoyé à la base.
const curseurSchema = z.object({
  apres: z.iso.datetime({ offset: true }),
  id: z.coerce.number().int().positive(),
});

export function lireCurseur(
  p: Record<string, string | undefined>,
): { date: string; id: number } | null {
  const c = curseurSchema.safeParse({ apres: p.apres, id: p.id });
  return c.success ? { date: c.data.apres, id: c.data.id } : null;
}
