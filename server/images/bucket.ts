import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { BucketLu } from "./verification";

export interface BucketImages extends BucketLu {
  lire(cle: string): Promise<{ body: ReadableStream; httpEtag: string } | null>;
}

interface BindingR2 extends BucketLu {
  get(
    cle: string,
    options?: { range: { offset: number; length: number } },
  ): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    body: ReadableStream;
    httpEtag: string;
  } | null>;
}

/** Binding R2 `IMAGES` (wrangler.jsonc). Null s'il n'est pas disponible (ex. test local sans R2). */
export function bucketImages(): BucketImages | null {
  try {
    const binding = (
      getCloudflareContext().env as unknown as { IMAGES?: BindingR2 }
    ).IMAGES;
    if (!binding) return null;
    return {
      head: (cle) => binding.head(cle),
      get: (cle, options) => binding.get(cle, options),
      delete: (cle) => binding.delete(cle),
      lire: (cle) => binding.get(cle),
    };
  } catch {
    return null;
  }
}
