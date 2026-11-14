import type { ReactNode } from "react";
import type { Plan } from "@/lib/plans";
import { reponseImprimante } from "@/lib/vitrine/offre";

const conteneur = "mx-auto w-full max-w-6xl px-5 sm:px-8";

interface Question {
  question: string;
  reponse: ReactNode;
}

function questions(plans: Plan[], lienWhatsApp: string | null): Question[] {
  const liste: Question[] = [
    {
      question: "Et si ma connexion internet est lente ou coupe ?",
      reponse:
        "Les pages de Kaya sont légères et s'ouvrent vite, même avec un petit réseau. Si la connexion coupe, Kaya vous le dit et vous pouvez réessayer. Kaya a besoin d'internet : le mode sans connexion n'existe pas encore.",
    },
    {
      question: "Mes données sont-elles en sécurité ?",
      reponse:
        "Chaque boutique ne voit que ses propres données. Un reçu ne peut plus être modifié ni supprimé, par personne : une erreur se corrige par une annulation, qui reste visible. Vos données sont sauvegardées automatiquement.",
    },
    {
      question: "Mon vendeur peut-il voir mes prix d'achat ?",
      reponse:
        "Non. Votre vendeur voit les prix de vente et le stock. Il ne voit jamais vos prix d'achat ni vos marges, et il ne peut pas changer un prix.",
    },
    {
      question: "Faut-il une imprimante ?",
      reponse: reponseImprimante(plans),
    },
    {
      question: "Ça marche sur téléphone et sur ordinateur ?",
      reponse:
        "Oui, avec le même compte. Kaya est pensé d'abord pour le téléphone Android : gros boutons, clavier de chiffres. Sur ordinateur, vous avez un grand écran. Rien à télécharger : vous ouvrez Kaya dans votre navigateur.",
    },
    {
      question: "Comment je paie, et comment j'arrête ?",
      reponse:
        "Vous payez par MTN Mobile Money ou Orange Money. Il n'y a ni prélèvement automatique ni engagement. Si vous arrêtez de payer, votre compte passe en lecture seule : vos données ne sont pas supprimées.",
    },
  ];
  if (lienWhatsApp) {
    liste.push({
      question: "Qui m'aide si je suis bloqué ?",
      reponse: (
        <>
          Écrivez-nous sur{" "}
          <a
            href={lienWhatsApp}
            className="text-brand-strong font-bold underline underline-offset-4"
          >
            WhatsApp
          </a>
          . Nous vous répondons en français.
        </>
      ),
    });
  }
  return liste;
}

export function Faq({
  plans,
  lienWhatsApp,
}: {
  plans: Plan[];
  lienWhatsApp: string | null;
}) {
  return (
    <section id="faq" className="bg-white py-12 lg:py-16">
      <div
        className={`${conteneur} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]`}
      >
        <h2 className="text-3xl font-bold text-[var(--nuit)] sm:text-4xl">
          Vos questions.
        </h2>
        <div className="faq">
          {questions(plans, lienWhatsApp).map((q) => (
            <details key={q.question} className="mb-3 rounded-2xl bg-[#fdeee3] px-5">
              <summary className="flex min-h-14 items-center justify-between gap-4 py-3 text-xl font-bold">
                {q.question}
              </summary>
              <p className="text-terre max-w-[62ch] pb-5">{q.reponse}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
