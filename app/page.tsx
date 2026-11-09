import { formatFcfa } from "@/lib/format";

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-brand-strong text-4xl font-bold">Kaya</h1>
      <p className="text-lg">
        Votre quincaillerie sous contrôle : stock, ventes, crédits et caisse,
        depuis votre téléphone.
      </p>
      <div className="border-border bg-brand-soft rounded-lg border p-4">
        <p className="text-muted text-sm">Ventes du jour</p>
        <p className="text-2xl font-semibold">{formatFcfa(1250000)}</p>
      </div>
      <a
        role="button"
        href="/connexion"
        className="bg-brand-strong flex items-center justify-center rounded-lg px-4 text-base font-semibold text-white"
      >
        Se connecter
      </a>
    </main>
  );
}
