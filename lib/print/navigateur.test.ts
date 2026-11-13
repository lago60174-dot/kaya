import { afterEach, describe, expect, it, vi } from "vitest";
import { environnementNavigateur, imprimerPageNavigateur } from "./navigateur";

/** Faux navigateur minimal : assez pour vérifier la feuille de style, l'attribut et le nettoyage. */
function fauxNavigateur(
  print: () => void = () => {},
  open: () => unknown = () => ({}),
) {
  const styles: { id: string; textContent: string; removed: boolean }[] = [];
  const ecouteurs = new Map<string, () => void>();
  const body = { dataset: {} as Record<string, string> };
  const win = {
    print,
    open,
    location: { href: "" },
    addEventListener: (n: string, f: () => void) => ecouteurs.set(n, f),
    removeEventListener: (n: string) => ecouteurs.delete(n),
    setTimeout: (f: () => void) => {
      void f;
      return 0;
    },
  };
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { userAgent: "Android" });
  vi.stubGlobal("document", {
    body,
    head: { append: () => {} },
    createElement: () => {
      const s = {
        id: "",
        textContent: "",
        removed: false,
        remove() {
          this.removed = true;
        },
      };
      styles.push(s);
      return s;
    },
  });
  return { styles, ecouteurs, body, win };
}

afterEach(() => vi.unstubAllGlobals());

describe("imprimerPageNavigateur", () => {
  it("pose la page sans marge et l'attribut, imprime, puis nettoie après l'impression", async () => {
    const print = vi.fn();
    const n = fauxNavigateur(print);
    await imprimerPageNavigateur("ticket");
    expect(n.styles[0].textContent).toContain("margin: 0");
    expect(n.body.dataset.impression).toBe("ticket");
    expect(print).toHaveBeenCalledOnce();
    n.ecouteurs.get("afterprint")?.();
    expect(n.styles[0].removed).toBe(true);
    expect(n.body.dataset.impression).toBeUndefined();
  });
  it("A4 : page A4", async () => {
    const n = fauxNavigateur();
    await imprimerPageNavigateur("a4");
    expect(n.styles[0].textContent).toContain("A4");
  });
  it("nettoie et signale l'échec si l'impression plante", async () => {
    const n = fauxNavigateur(() => {
      throw new Error("non");
    });
    await expect(imprimerPageNavigateur("ticket")).rejects.toThrow("non");
    expect(n.styles[0].removed).toBe(true);
    expect(n.body.dataset.impression).toBeUndefined();
  });
});

describe("environnementNavigateur", () => {
  it("ouvre un lien en changeant l'adresse de la page", () => {
    const n = fauxNavigateur();
    environnementNavigateur().ouvrirLien("intent:base64,AA==#Intent;end;");
    expect(n.win.location.href).toBe("intent:base64,AA==#Intent;end;");
  });
  it("signale une fenêtre PDF bloquée", () => {
    fauxNavigateur(undefined, () => null);
    expect(() => environnementNavigateur().ouvrirPdf("/x.pdf")).toThrow();
    fauxNavigateur(undefined, () => ({}));
    expect(() => environnementNavigateur().ouvrirPdf("/x.pdf")).not.toThrow();
  });
});
