"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Champ de recherche avec délai (300 ms) : met à jour l'adresse de la page, sans rechargement lourd. */
export function RechercheSimple({
  chemin,
  placeholder,
}: {
  chemin: string;
  placeholder: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(minuteur.current), []);
  return (
    <input
      type="search"
      value={q}
      placeholder={placeholder}
      aria-label={placeholder}
      className="border-border min-h-11 rounded-lg border bg-white px-3 text-base"
      onChange={(e) => {
        setQ(e.target.value);
        clearTimeout(minuteur.current);
        minuteur.current = setTimeout(() => {
          const valeur = e.target.value.trim();
          router.replace(
            valeur ? `${chemin}?q=${encodeURIComponent(valeur)}` : chemin,
          );
        }, 300);
      }}
    />
  );
}
