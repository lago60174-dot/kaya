import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kaya : gestion de quincaillerie",
    short_name: "Kaya",
    description:
      "Stock, ventes, crédits clients et caisse de votre quincaillerie, depuis votre téléphone.",
    lang: "fr",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffbf5",
    theme_color: "#ff7900",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Nouvelle vente", short_name: "Vente", url: "/vente", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Stock", short_name: "Stock", url: "/stock", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Caisse", short_name: "Caisse", url: "/caisse", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
