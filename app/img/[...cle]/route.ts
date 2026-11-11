import { CLE_VALIDE } from "@/server/images/cles";
import { bucketImages } from "@/server/images/bucket";

/** Sert une photo de produit depuis R2, avec un cache long (le nom du fichier change si l'image change). */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ cle: string[] }> },
) {
  const cle = (await params).cle.join("/");
  if (!CLE_VALIDE.test(cle))
    return new Response("Introuvable", { status: 404 });
  const bucket = bucketImages();
  if (!bucket) return new Response("Stockage indisponible", { status: 503 });
  const objet = await bucket.lire(cle);
  if (!objet) return new Response("Introuvable", { status: 404 });
  return new Response(objet.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: objet.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
