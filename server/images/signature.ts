import { AwsClient } from "aws4fetch";

export interface ConfigR2 {
  compteId: string;
  cleAcces: string;
  cleSecrete: string;
  bucket: string;
}

export const DUREE_URL_SECONDES = 300;

/** URL d'envoi (PUT) valable 5 minutes vers R2 (API compatible S3). */
export async function signerEnvoi(
  config: ConfigR2,
  cle: string,
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: config.cleAcces,
    secretAccessKey: config.cleSecrete,
    service: "s3",
    region: "auto",
  });
  const url = new URL(
    `https://${config.compteId}.r2.cloudflarestorage.com/${config.bucket}/${cle}`,
  );
  url.searchParams.set("X-Amz-Expires", String(DUREE_URL_SECONDES));
  const signee = await client.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signee.url;
}
