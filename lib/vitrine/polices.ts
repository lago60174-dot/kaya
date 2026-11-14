import localFont from "next/font/local";

// Polices auto-hébergées et réduites aux caractères du français (voir docs/DECISIONS.md).
// Affiche : Big Shoulders Display Black (lettres de panneau). Texte : Atkinson Hyperlegible Next (lisible en plein soleil).
export const affiche = localFont({
  src: "./polices/kaya-affiche.woff2",
  weight: "900",
  display: "swap",
  variable: "--police-affiche",
  fallback: ["Arial Narrow", "Impact", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const texte = localFont({
  src: [
    { path: "./polices/kaya-texte-400.woff2", weight: "400", style: "normal" },
    { path: "./polices/kaya-texte-700.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--police-texte",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});
