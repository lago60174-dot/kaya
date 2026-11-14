import type { MetadataRoute } from "next";
import { urlSite } from "@/lib/vitrine/site";

export default function robots(): MetadataRoute.Robots {
  const base = urlSite();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espaces connectés, reçus partagés et liens d'affiliés : rien à indexer.
      disallow: [
        "/hors-ligne",
        "/r/",
        "/a/",
        "/img/",
        "/patron",
        "/vente",
        "/stock",
        "/clients",
        "/recus",
        "/parametres",
        "/mot-de-passe",
      ],
    },
    ...(base && { sitemap: `${base}/sitemap.xml` }),
  };
}
