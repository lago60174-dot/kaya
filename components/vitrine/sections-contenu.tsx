const titre =
  "font-affiche text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[0.92] max-w-[16ch]";
const conteneur = "mx-auto w-full max-w-6xl px-5 sm:px-8";

const PROBLEMES = [
  {
    titre: "Le cahier se perd.",
    texte:
      "Une page arrachée, un cahier oublié chez le vendeur : des mois de ventes ne se retrouvent plus.",
  },
  {
    titre: "Les crédits s'oublient.",
    texte:
      "Le client dit qu'il a déjà payé. Vous n'avez rien d'écrit pour dire le contraire.",
  },
  {
    titre: "Le stock est un mystère.",
    texte:
      "Vous apprenez que le ciment est fini quand le client est devant vous.",
  },
  {
    titre: "La caisse ne tombe pas juste.",
    texte:
      "Le soir, il manque de l'argent. Impossible de savoir quand, ni pourquoi.",
  },
  {
    titre: "Vous n'êtes jamais là au bon moment.",
    texte:
      "Chantier, fournisseur, famille : la boutique tourne et vous ne voyez rien.",
  },
];

export function Probleme() {
  return (
    <section className="bg-goudron sur-sombre pt-16 pb-16 text-white lg:pt-44 lg:pb-24">
      <div className={conteneur}>
        <h2 className={titre}>Le cahier ne vous dit pas tout.</h2>
        <ul className="mt-10">
          {PROBLEMES.map((p) => (
            <li
              key={p.titre}
              className="grid gap-2 border-t-2 border-white/30 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-10"
            >
              <p className="font-affiche text-[clamp(2rem,4.2vw,3rem)] leading-none">
                {p.titre}
              </p>
              <p className="text-beton text-lg">{p.texte}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const ETAPES = [
  {
    titre: "Créez vos produits.",
    texte:
      "Ajoutez le ciment, le fer à béton, les clous. Un même produit peut se vendre en sac, au kilo ou à la barre : vous le notez une seule fois.",
    exemple: "1 sac = 50 kg. Vous vendez 1 kg : Kaya retire 0,02 sac du stock.",
  },
  {
    titre: "Vendez.",
    texte:
      "Touchez le produit, tapez la quantité, choisissez espèces, MTN Mobile Money, Orange Money ou crédit. Le reçu part sur WhatsApp.",
    exemple: "Une vente de trois articles se fait sans quitter l'écran.",
  },
  {
    titre: "Suivez depuis votre téléphone.",
    texte:
      "Ventes du jour, caisse, stock bas, dettes des clients : tout se met à jour en direct, où que vous soyez.",
    exemple:
      "Vous êtes au chantier. Vous voyez la vente qui vient d'être faite.",
  },
];

export function Etapes() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className={conteneur}>
        <h2 className={titre}>Trois gestes, et votre boutique est suivie.</h2>
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {ETAPES.map((e, i) => (
            <li key={e.titre} className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="font-affiche text-brand-strong text-8xl leading-none"
              >
                {i + 1}
              </span>
              <h3 className="font-affiche text-4xl leading-none">{e.titre}</h3>
              <p className="text-terre">{e.texte}</p>
              <p className="bg-beton mt-auto p-4 font-bold">{e.exemple}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const FONCTIONS = [
  [
    "Le stock se met à jour tout seul",
    "Chaque vente retire les articles du stock. Une alerte vous prévient avant la rupture.",
  ],
  [
    "Plusieurs unités pour un produit",
    "Sac, kilo, barre, mètre, pièce : un seul produit, plusieurs façons de le vendre.",
  ],
  [
    "Les crédits ne s'oublient plus",
    "Vous voyez qui vous doit de l'argent et depuis quand. Un rappel poli part sur WhatsApp en un geste.",
  ],
  [
    "Une caisse qui tombe juste",
    "Kaya calcule les espèces attendues. Vous comptez, et l'écart s'affiche.",
  ],
  [
    "Vos marges, pour vous seul",
    "Vous voyez ce que chaque vente rapporte. Vos vendeurs ne voient jamais vos prix d'achat.",
  ],
  [
    "Un reçu numéroté à chaque vente",
    "Le reçu part en PDF sur WhatsApp. Une fois écrit, personne ne peut le modifier ni l'effacer.",
  ],
  [
    "Votre boutique en direct",
    "Ventes du jour, produits les plus vendus, stock bas, dettes : sur votre téléphone, en temps réel.",
  ],
  [
    "Des vendeurs avec des droits limités",
    "Votre vendeur vend. Il ne peut ni changer un prix, ni annuler une vente. Vous seul le pouvez.",
  ],
  [
    "Un journal que personne n'efface",
    "Les ventes, remises, annulations et clôtures de caisse sont notées, avec qui les a faites.",
  ],
];

export function Fonctions() {
  return (
    <section className="bg-beton py-16 lg:py-24">
      <div
        className={`${conteneur} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]`}
      >
        <h2 className={`${titre} lg:sticky lg:top-8 lg:self-start`}>
          Tout ce qu&apos;il faut pour tenir la boutique.
        </h2>
        <dl>
          {FONCTIONS.map(([terme, definition]) => (
            <div key={terme} className="border-goudron/40 border-t-2 py-5">
              <dt className="text-xl font-bold">{terme}</dt>
              <dd className="text-terre mt-1 max-w-[60ch]">{definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

const COMPARAISONS = [
  {
    question: "Combien de sacs de ciment me reste-t-il ?",
    cahier: "On compte le dimanche soir, ou on devine.",
    kaya: "Le chiffre est à jour après chaque vente.",
  },
  {
    question: "Qui me doit de l'argent ?",
    cahier: "Il faut feuilleter les pages et espérer que tout est noté.",
    kaya: "Une liste claire : qui doit combien, depuis quand.",
  },
  {
    question: "La caisse est-elle juste ?",
    cahier: "On découvre l'écart le soir, sans savoir d'où il vient.",
    kaya: "Kaya calcule ce qui doit être en caisse. L'écart s'affiche.",
  },
  {
    question: "Que fait mon vendeur quand je ne suis pas là ?",
    cahier: "Vous lui faites confiance, et vous espérez.",
    kaya: "Chaque vente, remise et annulation est notée avec son nom.",
  },
  {
    question: "Et si le cahier disparaît ?",
    cahier: "Tout est perdu.",
    kaya: "Vos données sont sauvegardées. Vous changez de téléphone, tout est là.",
  },
];

export function AvantApres() {
  return (
    <section className="bg-white py-16 lg:py-24">
      <div className={conteneur}>
        <h2 className={titre}>Le cahier contre Kaya.</h2>
        <div className="mt-10 flex flex-col gap-10">
          {COMPARAISONS.map((c) => (
            <article
              key={c.question}
              className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch lg:gap-6"
            >
              <h3 className="font-affiche text-[clamp(1.9rem,3.4vw,2.6rem)] leading-none">
                {c.question}
              </h3>
              <p className="papier border-goudron/30 border">
                <strong>Avec le cahier. </strong>
                {c.cahier}
              </p>
              <p className="bg-goudron p-4 text-white">
                <strong>Avec Kaya. </strong>
                {c.kaya}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
