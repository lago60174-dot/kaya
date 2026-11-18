/* Service worker Kaya. Ne met JAMAIS en cache les pages ni les données : elles sont privées (boutique, ventes, crédits).
   Il garde seulement les fichiers statiques (code, icônes, photos) et une page « hors ligne ». */
const VERSION = "kaya-v4";
const SHELL = "/hors-ligne/vente"; // écran de vente sans réseau : son HTML ne contient aucune donnée privée
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
  if (event.data && event.data.type === "PRECHARGER") event.waitUntil(precharger());
});

// Envoi des ventes gardées sur l'appareil, même application fermée (Background Sync, Chrome Android).
self.addEventListener("sync", (event) => {
  if (event.tag === "kaya-ventes") event.waitUntil(envoyerVentesEnAttente());
});

async function envoyerVentesEnAttente() {
  const db = await new Promise((resolu, rejete) => {
    const r = indexedDB.open("kaya-hors-ligne");
    r.onsuccess = () => resolu(r.result);
    r.onerror = () => rejete(r.error);
  });
  const faire = (mode, action) =>
    new Promise((resolu, rejete) => {
      const t = db.transaction("ventes", mode);
      const requete = action(t.objectStore("ventes"));
      t.oncomplete = () => resolu(requete && requete.result);
      t.onerror = () => rejete(t.error);
    });
  const ventes = ((await faire("readonly", (s) => s.getAll())) || [])
    .filter((v) => v.statut === "attente")
    .sort((a, b) => a.creeLe - b.creeLe);
  let reessayer = false;
  for (const v of ventes) {
    try {
      const reponse = await fetch("/api/hors-ligne/synchro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v.corps, cle: v.cle, type: v.type || "vente" }),
        credentials: "same-origin",
        redirect: "manual",
      });
      if (reponse.type === "opaqueredirect" || !reponse.ok) {
        reessayer = true; // session expirée ou serveur indisponible : on garde tout
        break;
      }
      const r = await reponse.json();
      if (r.ok) await faire("readwrite", (s) => s.delete(v.cle));
      else await faire("readwrite", (s) => s.put({ ...v, statut: "refusee", erreur: r.erreur || "Vente refusée." }));
    } catch {
      reessayer = true;
      break;
    }
  }
  db.close();
  const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  fenetres.forEach((f) => f.postMessage({ type: "FILE_CHANGEE" }));
  if (reessayer) throw new Error("reessayer"); // le navigateur relancera l'envoi plus tard
}

// Garde la page de vente hors ligne et ses fichiers (pas de donnée privée : les produits viennent de l'appareil).
async function precharger() {
  try {
    const cache = await caches.open(CACHE_STATIQUE);
    const reponse = await fetch(SHELL, { credentials: "same-origin" });
    if (!reponse.ok || reponse.redirected) return;
    const html = await reponse.clone().text();
    await cache.put(SHELL, reponse);
    const trouves = html.match(/(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s)]+\.(?:js|css)/g) || [];
    const fichiers = [...new Set(trouves.map((f) => "/_next/" + f.replace(/^\/_next\//, "")))];
    await Promise.all(fichiers.map((f) => cache.add(f).catch(() => {})));
  } catch {
    /* sans cache, la page « hors ligne » simple reste disponible */
  }
}

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
      (async () => {
        try {
          const reponse = await fetch(requete);
          if (url.pathname === SHELL && reponse.ok && !reponse.redirected) {
            (await caches.open(CACHE_STATIQUE)).put(SHELL, reponse.clone());
          }
          return reponse;
        } catch {
          const cache = await caches.open(CACHE_STATIQUE);
          // Sans réseau, la vente et la caisse ouvrent l'écran hors ligne (vente, dépense), par une vraie redirection.
          if (url.pathname === SHELL) {
            const ecran = await cache.match(SHELL);
            if (ecran) return ecran;
          } else if ((url.pathname === "/vente" || url.pathname === "/caisse") && (await cache.match(SHELL))) {
            const cible = url.pathname === "/caisse" ? SHELL + "?onglet=depense" : SHELL;
            return Response.redirect(new URL(cible, self.location.origin).href, 302);
          }
          return (
            (await cache.match(PAGE_HORS_LIGNE)) ??
            new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
          );
        }
      })(),
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

// Notifications push : alertes envoyées par le serveur (stock bas, écart de caisse...). Le texte vient du serveur.
self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = {};
  }
  event.waitUntil(
    self.registration.showNotification(d.titre || "Kaya", {
      body: d.corps || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag,
      data: { lien: d.lien || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const lien = (event.notification.data && event.notification.data.lien) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ("focus" in f) {
          if ("navigate" in f) f.navigate(lien);
          return f.focus();
        }
      }
      return self.clients.openWindow(lien);
    }),
  );
});
