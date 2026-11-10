"use client";

import { useFormStatus } from "react-dom";

export function BoutonEnvoi({
  children,
  enCours = "Un instant…",
}: {
  children: React.ReactNode;
  enCours?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand-strong rounded-lg px-4 text-base font-semibold text-white disabled:opacity-60"
    >
      {pending ? enCours : children}
    </button>
  );
}
