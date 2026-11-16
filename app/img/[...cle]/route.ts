import { MIME_IMAGE } from "@/lib/images/compression";
import { estCleCatalogue, typeDeCle } from "@/server/images/cles";
import { bucketImages } from "@/server/images/bucket";

/** Sert une photo de produit ou un logo depuis R2, avec un cache long (le nom du fichier change si l'image change). */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ cle: string[] }> },
) {
  const cle = (await params).cle.join("/");
  const type = typeDeCle(cle);
  if (!type) return new Response("Introuvable", { status: 404 });
  const bucket = bucketImages();
  if (!bucket) return new Response("Stockage indisponible", { status: 503 });
  const objet = await bucket.lire(cle);
  if (!objet) return new Response("Introuvable", { status: 404 });
  return new Response(objet.body, {
    headers: {
      "Content-Type": MIME_IMAGE[type],
      // Photo de boutique : le nom change avec le contenu, cache d'un an. Photo du catalogue : le nom est fixe, une semaine.
      "Cache-Control": estCleCatalogue(cle)
        ? "public, max-age=604800, s-maxage=604800"
        : "public, max-age=31536000, s-maxage=31536000, immutable",
      ETag: objet.httpEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
