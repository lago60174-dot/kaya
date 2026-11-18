import type { ProduitVente } from "@/lib/ventes/panier";

/** Mémoire de l'appareil (IndexedDB) : les produits à vendre sans réseau, et les ventes faites sans réseau en attente d'envoi. */
const BASE = "kaya-hors-ligne";

export interface Catalogue {
  role: "proprietaire" | "vendeur";
  seuilRemise: number;
  produits: ProduitVente[];
  /** Boutique à laquelle appartiennent ces produits. */
  boutiqueId?: string;
  enregistreLe: number;
}

export interface VenteEnAttente {
  /** Absent sur les anciennes entrées : c'est alors une vente. */
  type?: "vente" | "depense";
  cle: string;
  corps: Record<string, unknown>;
  total: number;
  nbLignes: number;
  creeLe: number;
  statut: "attente" | "refusee";
  erreur?: string;
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolu, rejete) => {
    const r = indexedDB.open(BASE, 2);
    r.onupgradeneeded = () => {
      const noms = r.result.objectStoreNames;
      if (!noms.contains("catalogue")) r.result.createObjectStore("catalogue");
      if (!noms.contains("ventes")) r.result.createObjectStore("ventes", { keyPath: "cle" });
      if (!noms.contains("clients")) r.result.createObjectStore("clients", { keyPath: "id" });
    };
    r.onsuccess = () => resolu(r.result);
    r.onerror = () => rejete(r.error);
  });
}

async function faire<T = unknown>(
  magasin: "catalogue" | "ventes" | "clients",
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await ouvrir();
  return new Promise<T>((resolu, rejete) => {
    const t = db.transaction(magasin, mode);
    const requete = action(t.objectStore(magasin));
    t.oncomplete = () => {
      db.close();
      resolu(requete.result as T);
    };
    t.onerror = t.onabort = () => {
      db.close();
      rejete(t.error);
    };
  });
}

/** Prévient les écrans (bandeau d'état) que la file d'attente a changé. */
const signaler = () => window.dispatchEvent(new Event("kaya:file"));

export const sauverCatalogue = (c: Catalogue) =>
  faire("catalogue", "readwrite", (s) => s.put(c, "courant")).then(() => undefined);

export const lireCatalogue = () =>
  faire<Catalogue | undefined>("catalogue", "readonly", (s) => s.get("courant")).then((c) => c ?? null);

/** Demande au service worker d'envoyer la vente même si l'application est fermée (Chrome Android). Sinon, l'envoi se fait à la réouverture. */
function demanderEnvoiArrierePlan() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => (reg as unknown as { sync?: { register(tag: string): Promise<void> } }).sync?.register("kaya-ventes"))
    .catch(() => {});
}

export const ajouterEnAttente = (v: VenteEnAttente) =>
  faire("ventes", "readwrite", (s) => s.put(v)).then(() => {
    signaler();
    if (v.statut === "attente") demanderEnvoiArrierePlan();
  });

export const mettreAJourVente = ajouterEnAttente;

export const retirerVente = (cle: string) =>
  faire("ventes", "readwrite", (s) => s.delete(cle)).then(signaler);

export const listerEnAttente = () =>
  faire<VenteEnAttente[]>("ventes", "readonly", (s) => s.getAll()).then((l) =>
    l.sort((a, b) => a.creeLe - b.creeLe),
  );

/** À la déconnexion : l'appareil ne garde ni produits ni ventes en attente. */
export const toutEffacer = async () => {
  await faire("catalogue", "readwrite", (s) => s.clear());
  await faire("clients", "readwrite", (s) => s.clear());
  await faire("ventes", "readwrite", (s) => s.clear());
  signaler();
};

/** Clients déjà cherchés avec du réseau : ils restent trouvables sans réseau (pour vendre à crédit). */
export interface ClientMemorise {
  id: string;
  nom: string;
  telephone: string | null;
}

export async function memoriserClients(clients: ClientMemorise[]) {
  for (const c of clients.slice(0, 50)) await faire("clients", "readwrite", (s) => s.put(c)).catch(() => {});
}

export async function chercherClientsLocal(recherche: string): Promise<ClientMemorise[]> {
  const q = recherche.trim().toLowerCase();
  if (q.length < 2) return [];
  const tous = await faire<ClientMemorise[]>("clients", "readonly", (s) => s.getAll());
  return tous.filter((c) => c.nom.toLowerCase().includes(q) || (c.telephone ?? "").includes(q)).slice(0, 8);
}
