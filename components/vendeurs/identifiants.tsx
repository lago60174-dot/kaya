export function IdentifiantsProvisoires({
  email,
  motDePasse,
}: {
  email?: string;
  motDePasse: string;
}) {
  return (
    <div
      role="status"
      className="border-border bg-brand-soft rounded-lg border p-3 text-sm"
    >
      <p className="font-semibold">
        Notez ces identifiants maintenant : le mot de passe ne sera plus
        affiché.
      </p>
      {email && <p>Email : {email}</p>}
      <p>
        Mot de passe provisoire :{" "}
        <span className="font-mono text-base font-bold">{motDePasse}</span>
      </p>
      <p className="text-muted">
        Le vendeur devra le changer à sa première connexion.
      </p>
    </div>
  );
}
