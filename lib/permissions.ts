import { peutUtiliser, type Fonctionnalite, type Plan } from "./plans";

export type Role =
  "proprietaire" | "vendeur" | "administrateur_plateforme" | "affilie";
export type Zone =
  "public" | "connecte" | "boutique" | "proprietaire" | "admin" | "affilie";

const PUBLIC_EXACT = [
  "/",
  "/connexion",
  "/inscription",
  "/partenaire",
  "/mentions-legales",
  "/confidentialite",
  "/conditions",
];
const PUBLIC_PREFIXES = ["/a/", "/r/", "/api/webhooks/"];
const PROPRIETAIRE_PREFIXES = [
  "/patron",
  "/parametres",
  "/journal",
  "/devis",
  "/fournisseurs",
];

const startsWithSegment = (chemin: string, prefixe: string) =>
  chemin === prefixe || chemin.startsWith(`${prefixe}/`);

/** Zone d'accès d'un chemin. Tout ce qui n'est pas explicitement public demande une connexion. */
export function zonePourChemin(chemin: string): Zone {
  if (
    PUBLIC_EXACT.includes(chemin) ||
    PUBLIC_PREFIXES.some((p) => chemin.startsWith(p))
  )
    return "public";
  if (startsWithSegment(chemin, "/mot-de-passe")) return "connecte";
  if (startsWithSegment(chemin, "/admin")) return "admin";
  if (startsWithSegment(chemin, "/affilie")) return "affilie";
  if (PROPRIETAIRE_PREFIXES.some((p) => startsWithSegment(chemin, p)))
    return "proprietaire";
  return "boutique";
}

export function roleAutorise(role: Role | null, zone: Zone): boolean {
  if (zone === "public") return true;
  if (role === null) return false;
  switch (zone) {
    case "connecte":
      return true;
    case "boutique":
      return role === "proprietaire" || role === "vendeur";
    case "proprietaire":
      return role === "proprietaire";
    case "admin":
      return role === "administrateur_plateforme";
    case "affilie":
      return role === "affilie";
  }
}

export interface EtatSession {
  role: Role | null;
  doitChangerMotDePasse: boolean;
}
export type DecisionGarde =
  { type: "ok" } | { type: "rediriger"; vers: string };

/** Décide si un utilisateur peut voir une zone, ou où le renvoyer. Utilisée par les pages et les actions. */
export function decisionGarde(
  session: EtatSession | null,
  zone: Zone,
): DecisionGarde {
  if (zone === "public") return { type: "ok" };
  if (!session || session.role === null)
    return { type: "rediriger", vers: "/connexion" };
  if (session.doitChangerMotDePasse && zone !== "connecte")
    return { type: "rediriger", vers: "/mot-de-passe" };
  if (!roleAutorise(session.role, zone))
    return { type: "rediriger", vers: accueilPour(session.role) };
  return { type: "ok" };
}

export function accueilPour(role: Role): string {
  switch (role) {
    case "proprietaire":
      return "/patron";
    case "vendeur":
      return "/vente";
    case "administrateur_plateforme":
      return "/admin";
    case "affilie":
      return "/affilie";
  }
}

export interface EntreeMenu {
  href: string;
  libelle: string;
}

interface DefinitionMenu extends EntreeMenu {
  roles: Role[];
  fonction?: Fonctionnalite;
}

const MENU: DefinitionMenu[] = [
  { href: "/vente", libelle: "Vente", roles: ["proprietaire", "vendeur"] },
  { href: "/stock", libelle: "Stock", roles: ["proprietaire", "vendeur"] },
  { href: "/clients", libelle: "Clients", roles: ["proprietaire", "vendeur"] },
  { href: "/caisse", libelle: "Caisse", roles: ["proprietaire", "vendeur"] },
  { href: "/patron", libelle: "Tableau de bord", roles: ["proprietaire"] },
  { href: "/journal", libelle: "Journal", roles: ["proprietaire"] },
  {
    href: "/devis",
    libelle: "Devis",
    roles: ["proprietaire"],
    fonction: "devis",
  },
  {
    href: "/fournisseurs",
    libelle: "Fournisseurs",
    roles: ["proprietaire"],
    fonction: "fournisseurs",
  },
  { href: "/parametres", libelle: "Paramètres", roles: ["proprietaire"] },
];

/** Menu d'un utilisateur. Une fonction absente du plan n'apparaît pas : pas de bouton verrouillé. */
export function menuPour(role: Role, plan: Plan): EntreeMenu[] {
  return MENU.filter(
    (m) =>
      m.roles.includes(role) && (!m.fonction || peutUtiliser(plan, m.fonction)),
  ).map(({ href, libelle }) => ({ href, libelle }));
}
