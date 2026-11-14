import type { Metadata } from "next";
import { AppelFinal } from "@/components/vitrine/appel-final";
import { Faq } from "@/components/vitrine/faq";
import { Hero } from "@/components/vitrine/hero";
import {
  AvantApres,
  Etapes,
  Fonctions,
  Probleme,
} from "@/components/vitrine/sections-contenu";
import { Tarifs } from "@/components/vitrine/tarifs";
import { donneesStructurees, jsonPourScript } from "@/lib/vitrine/offre";
import { lienContact } from "@/lib/vitrine/site";
import { chargerOffrePublique } from "@/server/vitrine/offre-publique";

// Les plans viennent de la base : la page ne doit jamais être figée au moment du build.
export const dynamic = "force-dynamic";

const TITRE =
  "Kaya : gestion de stock et de caisse pour quincaillerie au Cameroun";
const IMAGE_PARTAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "Fini le cahier qui disparaît avec le vendeur. Kaya, gestion de quincaillerie au Cameroun.",
};
const DESCRIPTION =
  "Logiciel de gestion de quincaillerie au Cameroun : stock, ventes, crédits clients et caisse depuis votre téléphone. Pour Yaoundé, Douala et tout le pays.";

export const metadata: Metadata = {
  title: { absolute: TITRE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_CM",
    siteName: "Kaya",
    title: TITRE,
    description: DESCRIPTION,
    url: "/",
    // Sans cette ligne, les balises de la page effacent l'image du dossier app/ : aucun aperçu au partage.
    images: [IMAGE_PARTAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [IMAGE_PARTAGE.url],
    title: TITRE,
    description: DESCRIPTION,
  },
};

export default async function Accueil() {
  const { plans, programme } = await chargerOffrePublique();
  const lienWhatsApp = lienContact();
  return (
    <main id="contenu">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonPourScript(donneesStructurees(plans, DESCRIPTION)),
        }}
      />
      <Hero plan={plans[0]} programme={programme} lienWhatsApp={lienWhatsApp} />
      <Probleme />
      <Etapes />
      <Fonctions />
      <AvantApres />
      <Tarifs plans={plans} lienWhatsApp={lienWhatsApp} />
      <Faq plans={plans} lienWhatsApp={lienWhatsApp} />
      <AppelFinal lienWhatsApp={lienWhatsApp} />
    </main>
  );
}
