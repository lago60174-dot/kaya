#!/usr/bin/env python3
"""Convertit un lot du catalogue (CSV ; séparateur point-virgule) en lib/catalogue/lot-N.json, après contrôle.

Usage : python3 catalogue/outils/csv_vers_json.py catalogue/source/lot-2.csv lib/catalogue/lot-2.json
Contrôles : références et noms de fichiers uniques, pas de doublon nom + marque, un conditionnement de facteur 1,
facteurs > 0. S'arrête à la première erreur. Ensuite : preparer_images.py, puis ajouter le lot dans lib/catalogue/index.ts.
"""
import csv, json, sys, collections

def main():
    src, dst = sys.argv[1], sys.argv[2]
    rows = list(csv.DictReader(open(src, encoding="utf-8-sig"), delimiter=";"))
    erreurs = []
    for cle in ("ref", "nom_fichier_image"):
        for k, c in collections.Counter(r[cle] for r in rows).items():
            if c > 1: erreurs.append(f"{cle} dupliqué : {k}")
    for k, c in collections.Counter((r["nom"].strip().lower(), r["marque"].strip().lower()) for r in rows).items():
        if c > 1: erreurs.append(f"nom + marque dupliqué : {k}")
    for r in rows:
        conds = []
        for c in r["conditionnements"].split("|"):
            n, f = c.rsplit("=", 1)
            conds.append({"nom": n.strip(), "facteur": float(f)})
        if len({c["nom"].lower() for c in conds}) != len(conds): erreurs.append(f"{r['ref']} : conditionnements en double")
        if any(c["facteur"] <= 0 for c in conds): erreurs.append(f"{r['ref']} : facteur <= 0")
        if not any(c["facteur"] == 1 for c in conds): erreurs.append(f"{r['ref']} : pas de facteur 1")
        r["conditionnements"] = conds
        r["synonymes_locaux"] = [s for s in r["synonymes_locaux"].split("|") if s]
        r["propose_par_defaut"] = "Retirer" not in r["notes"]
        r["image"] = None
    if erreurs:
        sys.exit("\n".join(erreurs))
    json.dump(rows, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(rows), "produits écrits dans", dst)

main()
