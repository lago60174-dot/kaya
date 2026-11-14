import { AwsClient } from "aws4fetch";
import type { BucketLu } from "./verification";

export interface BucketImages extends BucketLu {
  lire(cle: string): Promise<{ body: ReadableStream; httpEtag: string } | null>;
}

export interface ConfigAcces {
  compteId: string;
  cleAcces: string;
  cleSecrete: string;
  bucket: string;
}

/** Accès à R2 par l'API S3 (signée avec aws4fetch) : fonctionne sur Vercel, sans binding Cloudflare. */
export function creerBucketS3(
  config: ConfigAcces,
  fetchImpl?: typeof fetch,
): BucketImages {
  const client = new AwsClient({
    accessKeyId: config.cleAcces,
    secretAccessKey: config.cleSecrete,
    service: "s3",
    region: "auto",
  });
  const envoyer = (cle: string, init: RequestInit) =>
    fetchImpl
      ? fetchImpl(
          `https://${config.compteId}.r2.cloudflarestorage.com/${config.bucket}/${cle}`,
          init,
        )
      : client.fetch(
          `https://${config.compteId}.r2.cloudflarestorage.com/${config.bucket}/${cle}`,
          init,
        );

  const lireObjet = async (cle: string, headers?: Record<string, string>) => {
    const r = await envoyer(cle, { method: "GET", headers });
    if (r.status === 404) return null;
    if (!r.ok || !r.body) throw new Error(`R2 GET ${r.status}`);
    return {
      body: r.body,
      httpEtag: r.headers.get("etag") ?? "",
      arrayBuffer: () => new Response(r.body).arrayBuffer(),
    };
  };

  return {
    async head(cle) {
      const r = await envoyer(cle, { method: "HEAD" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`R2 HEAD ${r.status}`);
      return { size: Number(r.headers.get("content-length") ?? 0) };
    },
    async get(cle, options) {
      const o = await lireObjet(
        cle,
        options
          ? {
              Range: `bytes=${options.range.offset}-${options.range.offset + options.range.length - 1}`,
            }
          : undefined,
      );
      return o ? { arrayBuffer: o.arrayBuffer } : null;
    },
    async delete(cle) {
      const r = await envoyer(cle, { method: "DELETE" });
      if (!r.ok && r.status !== 404) throw new Error(`R2 DELETE ${r.status}`);
    },
    async lire(cle) {
      const o = await lireObjet(cle);
      return o ? { body: o.body, httpEtag: o.httpEtag } : null;
    },
  };
}
