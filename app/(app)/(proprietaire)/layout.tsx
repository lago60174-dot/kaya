import { Suspense } from "react";
import { exigerRole } from "@/server/auth/session";

/** Tout ce qui se trouve ici est réservé au propriétaire, même si l'adresse est tapée à la main. */
export default function MiseEnPageProprietaire({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <GardeProprietaire>{children}</GardeProprietaire>
    </Suspense>
  );
}

async function GardeProprietaire({ children }: { children: React.ReactNode }) {
  await exigerRole("proprietaire");
  return children;
}
