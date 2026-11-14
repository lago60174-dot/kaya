import { MessageCircle } from "lucide-react";

/** Reste sous le pouce sur téléphone : un rond. Sur grand écran, le mot « WhatsApp » apparaît. */
export function BoutonWhatsAppFlottant({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="Parler à Kaya sur WhatsApp"
      className="fixed right-4 bottom-4 z-50 flex size-14 items-center justify-center gap-2 bg-[#0b7a4b] font-bold text-white shadow-[0.25rem_0.25rem_0_var(--goudron)] sm:h-14 sm:w-auto sm:px-5"
    >
      <MessageCircle aria-hidden="true" size={26} />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
