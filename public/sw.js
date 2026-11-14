/* Service worker Kaya. Ne met JAMAIS en cache les pages ni les données : elles sont privées (boutique, ventes, crédits).
   Il garde seulement les fichiers statiques (code, icônes, photos) et une page « hors ligne ». */
const VERSION = "kaya-v1";
const CACHE_STATIQUE = `${VERSION}-statique`;
const PAGE_HORS_LIGNE = "/hors-ligne";
const PRECACHE = [
  PAGE_HORS_LIGNE,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIQUE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(
          cles
            .filter((c) => c.startsWith("kaya-") && !c.startsWith(VERSION))
            .map((c) => caches.delete(c)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function estStatique(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/img/") ||
    /\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return; // Supabase, R2… : jamais interceptés

  // Pages : réseau d'abord, page « hors ligne » si le réseau est coupé.
  if (requete.mode === "navigate") {
    event.respondWith(
      fetch(requete).catch(async () => {
        const cache = await caches.open(CACHE_STATIQUE);
        return (
          (await cache.match(PAGE_HORS_LIGNE)) ??
          new Response("Hors ligne", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
    return;
  }

  // Fichiers statiques : cache d'abord (noms à empreinte), mis à jour en arrière-plan.
  if (estStatique(url)) {
    event.respondWith(
      caches.open(CACHE_STATIQUE).then(async (cache) => {
        const enCache = await cache.match(requete);
        const reseau = fetch(requete)
          .then((reponse) => {
            if (reponse.ok) cache.put(requete, reponse.clone());
            return reponse;
          })
          .catch(() => enCache);
        return enCache ?? reseau;
      }),
    );
  }
});
