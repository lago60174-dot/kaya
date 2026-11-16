import type { Email } from "./resend";

const echapper = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Gabarit commun : une colonne, gros bouton orange, lisible sur un petit écran et sans image externe. */
function gabarit(titre: string, paragraphes: string[], bouton?: { libelle: string; lien: string }, pied?: string) {
  const corps = paragraphes
    .map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#2a2018">${p}</p>`)
    .join("");
  const b = bouton
    ? `<p style="margin:22px 0"><a href="${echapper(bouton.lien)}" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;padding:14px 22px;border-radius:10px">${echapper(bouton.libelle)}</a></p>
       <p style="margin:0 0 14px;font-size:13px;color:#6b5d50">Si le bouton ne marche pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all">${echapper(bouton.lien)}</span></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#fffaf5;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:14px;padding:28px 24px">
<tr><td>
<p style="margin:0 0 18px;font-size:26px;font-weight:800;color:#c2410c">Kaya</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#2a2018">${echapper(titre)}</h1>
${corps}${b}
<p style="margin:18px 0 0;font-size:12px;color:#6b5d50">${pied ?? "Vous recevez cet email car il concerne votre compte Kaya."}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function emailBienvenue(p: {
  a: string;
  nomBoutique: string;
  lienApp: string;
  lienConfirmation: string | null;
}): Email {
  const boutique = echapper(p.nomBoutique);
  const paragraphes = [
    `Bienvenue sur Kaya, et merci d'avoir créé le compte de <strong>${boutique}</strong>.`,
    "Pour bien démarrer : ajoutez vos premiers produits, faites une première vente, puis suivez votre boutique depuis votre téléphone.",
  ];
  if (p.lienConfirmation)
    paragraphes.push("Confirmez aussi votre adresse email : elle nous permet de vous aider si vous oubliez votre mot de passe.");
  return {
    a: p.a,
    sujet: "Bienvenue sur Kaya",
    html: gabarit(
      "Bienvenue sur Kaya",
      paragraphes,
      p.lienConfirmation
        ? { libelle: "Confirmer mon adresse email", lien: p.lienConfirmation }
        : { libelle: "Ouvrir Kaya", lien: p.lienApp },
    ),
    texte: [
      `Bienvenue sur Kaya, et merci d'avoir créé le compte de ${p.nomBoutique}.`,
      "Ajoutez vos premiers produits, faites une première vente, puis suivez votre boutique depuis votre téléphone.",
      p.lienConfirmation
        ? `Confirmez votre adresse email : ${p.lienConfirmation}`
        : `Ouvrir Kaya : ${p.lienApp}`,
    ].join("\n\n"),
  };
}

export function emailConfirmation(p: { a: string; lien: string }): Email {
  return {
    a: p.a,
    sujet: "Confirmez votre adresse email · Kaya",
    html: gabarit(
      "Confirmez votre adresse email",
      ["Un clic suffit pour confirmer que cette adresse est bien la vôtre."],
      { libelle: "Confirmer mon adresse email", lien: p.lien },
    ),
    texte: `Confirmez votre adresse email Kaya : ${p.lien}`,
  };
}

export function emailReinitialisation(p: { a: string; lien: string }): Email {
  return {
    a: p.a,
    sujet: "Réinitialiser votre mot de passe · Kaya",
    html: gabarit(
      "Réinitialiser votre mot de passe",
      [
        "Vous avez demandé à changer votre mot de passe. Appuyez sur le bouton pour en choisir un nouveau. Ce lien ne marche qu'une fois et expire rapidement.",
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
      ],
      { libelle: "Choisir un nouveau mot de passe", lien: p.lien },
    ),
    texte: `Choisissez un nouveau mot de passe Kaya : ${p.lien}\n\nSi vous n'avez rien demandé, ignorez ce message.`,
  };
}
