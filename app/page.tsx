import Link from "next/link";

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-brand-strong text-4xl font-bold">Kaya</h1>
      <p className="text-lg">
        Votre quincaillerie sous contrôle : stock, ventes, crédits et caisse,
        depuis votre téléphone.
      </p>
      <Link
        href="/inscription"
        className="bg-brand-strong flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold text-white"
      >
        Essayer gratuitement
      </Link>
      <Link
        href="/connexion"
        className="border-border flex min-h-11 items-center justify-center rounded-lg border px-4 text-base font-semibold"
      >
        Se connecter
      </Link>
    </main>
  );
}
