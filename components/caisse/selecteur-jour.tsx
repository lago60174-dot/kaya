"use client";

import { Calendar } from "lucide-react";
import { useRouter } from "next/navigation";

/** Choix du jour de la caisse : un clic sur la date ouvre le calendrier du téléphone ou de l'ordinateur. */
export function SelecteurJour({ jour, max }: { jour: string; max: string }) {
  const router = useRouter();
  return (
    <label className="border-border flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold shadow-sm">
      <Calendar aria-hidden="true" size={18} className="text-orange-600" />
      <span className="sr-only">Choisir le jour</span>
      <input
        type="date"
        value={jour}
        max={max}
        onChange={(e) => e.target.value && router.push(`/caisse?date=${e.target.value}`)}
        className="bg-transparent font-bold"
      />
    </label>
  );
}
