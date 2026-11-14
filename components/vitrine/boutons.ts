const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-lg font-bold text-center";

/** Bouton principal : dégradé orange. */
export const boutonOrange = `${base} bg-gradient-to-r from-[#ff8a2a] to-[var(--kaya)] text-white shadow-[0_10px_24px_rgba(242,106,15,0.35)]`;
/** Sur le bandeau orange. */
export const boutonBlanc = `${base} bg-white text-[var(--nuit)] shadow-[0_8px_20px_rgba(0,0,0,0.15)]`;
export const boutonContour = `${base} border-2 border-[var(--kaya)] text-[var(--nuit)]`;
export const boutonSombre = `${base} bg-[var(--nuit)] text-white`;
