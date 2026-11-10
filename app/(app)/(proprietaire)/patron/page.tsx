import { exigerRole } from "@/server/auth/session";

export const metadata = { title: "Tableau de bord · Kaya" };

export default async function PagePatron() {
  const profil = await exigerRole("proprietaire");
  return (
    <>
      <h1 className="text-2xl font-bold">
        Bonjour{profil.nom ? ` ${profil.nom}` : ""}
      </h1>
      <p className="text-muted mt-2">
        Votre tableau de bord sera bientôt disponible.
      </p>
    </>
  );
}
