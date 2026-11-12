import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Recu } from "@/components/vente/recu";
import { lireRecuPublic } from "@/server/ventes/lecture";

// Le jeton est un secret partagé : cette page ne doit jamais apparaître dans un moteur de recherche.
export const metadata = {
  title: "Reçu · Kaya",
  robots: { index: false, follow: false },
};

export default function PageRecuPublic({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <Suspense fallback={<p className="text-muted">Chargement du reçu…</p>}>
        <ContenuRecu params={params} />
      </Suspense>
    </main>
  );
}

async function ContenuRecu({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params;
  const recu = await lireRecuPublic(jeton);
  if (!recu) notFound();
  return (
    <>
      <Recu recu={recu} />
      <a
        href={`/r/${jeton}/pdf`}
        className="bg-brand-strong flex min-h-11 items-center justify-center rounded-lg px-4 text-base font-semibold text-white"
      >
        Télécharger le PDF
      </a>
    </>
  );
}
