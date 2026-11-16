#!/usr/bin/env node
/**
 * Envoie les images du catalogue modèle (catalogue/images/*.webp) dans le bucket R2, sous catalogue/<fichier>.
 * Les fichiers déjà présents avec la même taille sont sautés : on peut relancer sans risque après chaque nouveau lot.
 *
 * Usage : R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=kaya-images \
 *         node catalogue/outils/televerser_r2.mjs [--simuler]
 * (mêmes variables que l'application ; la clé d'API R2 doit avoir le droit d'écriture sur le bucket)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AwsClient } from "aws4fetch";

const simuler = process.argv.includes("--simuler");
const dossier = join(dirname(fileURLToPath(import.meta.url)), "..", "images");
const fichiers = readdirSync(dossier).filter((f) => /^[a-z0-9-]+\.webp$/.test(f));
console.log(`${fichiers.length} fichiers dans ${dossier}`);
if (simuler) {
  console.log("Simulation : rien n'est envoyé.");
  process.exit(0);
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error("Variables manquantes : R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.");
  process.exit(1);
}
const client = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const base = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/catalogue`;

let envoyes = 0, sautes = 0, echecs = 0;
for (const f of fichiers) {
  const chemin = join(dossier, f);
  const taille = statSync(chemin).size;
  const tete = await client.fetch(`${base}/${f}`, { method: "HEAD" });
  if (tete.ok && Number(tete.headers.get("content-length")) === taille) {
    sautes++;
    continue;
  }
  const r = await client.fetch(`${base}/${f}`, {
    method: "PUT",
    headers: { "Content-Type": "image/webp" },
    body: readFileSync(chemin),
  });
  if (r.ok) envoyes++;
  else {
    echecs++;
    console.error(`Échec ${r.status} : ${f}`);
  }
}
console.log(`Envoyés : ${envoyes}, déjà à jour : ${sautes}, échecs : ${echecs}`);
process.exit(echecs ? 1 : 0);
