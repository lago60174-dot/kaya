import type { MetadataRoute } from "next";
import { urlSite } from "@/lib/vitrine/site";

const PAGES = [
  { chemin: "/", priorite: 1 },
  { chemin: "/tarifs", priorite: 0.9 },
  { chemin: "/inscription", priorite: 0.8 },
  { chemin: "/partenaire", priorite: 0.6 },
  { chemin: "/mentions-legales", priorite: 0.2 },
  { chemin: "/confidentialite", priorite: 0.2 },
  { chemin: "/conditions", priorite: 0.2 },
  { chemin: "/conditions-partenaires", priorite: 0.2 },
];

/** Sans adresse publique configurée, un plan du site ne peut pas contenir d'adresses valides : il reste vide. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlSite();
  if (!base) return [];
  return PAGES.map((p) => ({
    url: `${base}${p.chemin}`,
    priority: p.priorite,
  }));
}
