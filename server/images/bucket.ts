import "server-only";
import { configR2 } from "@/lib/env";
import { creerBucketS3, type BucketImages } from "./s3";

export type { BucketImages };

/** Bucket R2 des images (variables R2_*). Null si elles ne sont pas configurées. */
export function bucketImages(): BucketImages | null {
  try {
    const config = configR2();
    return config ? creerBucketS3(config) : null;
  } catch {
    return null;
  }
}
