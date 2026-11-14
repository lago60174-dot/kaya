/** Identifiant Android de l'application RawBT (Google Play). */
export const PAQUET_RAWBT = "ru.a402d.rawbtprinter";

/** Base64 d'octets, sans dépasser la taille d'arguments de `fromCharCode` (reçus très longs). */
export function versBase64(octets: Uint8Array): string {
  let binaire = "";
  for (let i = 0; i < octets.length; i += 0x8000)
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/**
 * Lien Android qui ouvre RawBT avec les octets ESC/POS (schéma `rawbt:base64,...`, documenté par RawBT).
 * La forme `intent:` nomme le paquet : si RawBT n'est pas installé, Android propose de l'installer.
 */
export function lienRawBT(octets: Uint8Array): string {
  return `intent:base64,${versBase64(octets)}#Intent;scheme=rawbt;package=${PAQUET_RAWBT};end;`;
}

export const estAndroid = (userAgent: string) => /android/i.test(userAgent);
