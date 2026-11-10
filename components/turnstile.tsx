"use client";

import Script from "next/script";

/** Vérification anti-robot Cloudflare. Sans clé de site (développement), rien n'est affiché. */
export function Turnstile() {
  const cleSite = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!cleSite) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div className="cf-turnstile" data-sitekey={cleSite} />
    </>
  );
}
