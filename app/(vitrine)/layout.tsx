import { BoutonWhatsAppFlottant } from "@/components/vitrine/bouton-whatsapp-flottant";
import { Entete } from "@/components/vitrine/entete";
import { Pied } from "@/components/vitrine/pied";
import { affiche, texte } from "@/lib/vitrine/polices";
import { lienContact } from "@/lib/vitrine/site";
import "./vitrine.css";

export default function LayoutVitrine({
  children,
}: {
  children: React.ReactNode;
}) {
  const lien = lienContact();
  return (
    <div
      className={`${affiche.variable} ${texte.variable} vitrine flex flex-1 flex-col`}
    >
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <Entete />
      {children}
      <Pied lienWhatsApp={lien} />
      {lien && <BoutonWhatsAppFlottant href={lien} />}
    </div>
  );
}
