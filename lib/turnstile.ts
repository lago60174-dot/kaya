const URL_VERIFICATION =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

interface Options {
  secret?: string;
  ip?: string;
  production: boolean;
  fetchImpl?: typeof fetch;
}

/** Vérifie un jeton Cloudflare Turnstile. Sans clé secrète : accepté en développement, refusé en production. */
export async function verifierTurnstile(
  jeton: string | null | undefined,
  options: Options,
): Promise<boolean> {
  if (!options.secret) return !options.production;
  if (!jeton) return false;
  const corps = new URLSearchParams({
    secret: options.secret,
    response: jeton,
  });
  if (options.ip) corps.set("remoteip", options.ip);
  try {
    const reponse = await (options.fetchImpl ?? fetch)(URL_VERIFICATION, {
      method: "POST",
      body: corps,
    });
    if (!reponse.ok) return false;
    const donnees = (await reponse.json()) as { success?: boolean };
    return donnees.success === true;
  } catch {
    return false;
  }
}
