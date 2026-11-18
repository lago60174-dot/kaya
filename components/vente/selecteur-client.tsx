"use client";

import { useRef, useState, useTransition } from "react";
import { chercherClientsLocal, memoriserClients } from "@/lib/hors-ligne/stockage";
import {
  chercherClientsAction,
  creerClientRapideAction,
  type ClientTrouve,
} from "@/server/ventes/actions";

const champ =
  "min-h-11 rounded-lg border border-border bg-white px-3 text-base";

interface Props {
  client: ClientTrouve | null;
  onChoisir: (c: ClientTrouve | null) => void;
  obligatoire: boolean;
}

/** Client facultatif (obligatoire pour un crédit) : recherche par nom ou téléphone, ou création en deux champs. */
export function SelecteurClient({ client, onChoisir, obligatoire }: Props) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<ClientTrouve[]>([]);
  const [creation, setCreation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const minuteur = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (client) {
    return (
      <div className="border-border flex items-center justify-between gap-2 rounded-lg border p-3">
        <p>
          <span className="font-medium">{client.nom}</span>
          {client.telephone && (
            <span className="text-muted block text-sm">{client.telephone}</span>
          )}
        </p>
        <button
          type="button"
          onClick={() => onChoisir(null)}
          className="border-border min-h-11 rounded-lg border px-3 text-sm"
        >
          Changer
        </button>
      </div>
    );
  }

  async function creer(formData: FormData) {
    setErreur(null);
    const r = await creerClientRapideAction({
      nom: formData.get("nom"),
      telephone: formData.get("telephone") || undefined,
    });
    if (r.ok) onChoisir(r.client);
    else setErreur(r.erreur);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={q}
        placeholder={
          obligatoire
            ? "Client (obligatoire) : nom ou téléphone"
            : "Client (facultatif) : nom ou téléphone"
        }
        aria-label="Chercher un client"
        className={champ}
        onChange={(e) => {
          const valeur = e.target.value;
          setQ(valeur);
          clearTimeout(minuteur.current);
          minuteur.current = setTimeout(
            () =>
              demarrer(async () =>
                setResultats(
                    await chercherClientsAction(valeur)
                      .then((r) => {
                        void memoriserClients(r);
                        return r;
                      })
                      .catch(() => chercherClientsLocal(valeur)),
                  ),
              ),
            250,
          );
        }}
      />
      {resultats.length > 0 && (
        <ul className="flex flex-col gap-1">
          {resultats.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onChoisir(c)}
                className="border-border hover:bg-brand-soft flex min-h-11 w-full flex-col items-start rounded-lg border px-3 py-1 text-left"
              >
                <span className="font-medium">{c.nom}</span>
                {c.telephone && (
                  <span className="text-muted text-sm">{c.telephone}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!creation ? (
        <button
          type="button"
          onClick={() => setCreation(true)}
          className="border-border min-h-11 self-start rounded-lg border px-3 text-sm font-medium"
        >
          + Nouveau client
        </button>
      ) : (
        <form
          action={creer}
          className="border-border flex flex-col gap-2 rounded-lg border p-3"
        >
          <input
            name="nom"
            placeholder="Nom du client"
            aria-label="Nom du client"
            required
            className={champ}
            defaultValue={q}
          />
          <input
            name="telephone"
            type="tel"
            inputMode="tel"
            placeholder="Téléphone (facultatif)"
            aria-label="Téléphone du client"
            className={champ}
          />
          {erreur && (
            <p role="alert" className="text-danger text-sm">
              {erreur}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-brand-strong min-h-11 rounded-lg px-4 text-sm font-semibold text-white"
            >
              Ajouter
            </button>
            <button
              type="button"
              onClick={() => setCreation(false)}
              className="border-border min-h-11 rounded-lg border px-4 text-sm"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
