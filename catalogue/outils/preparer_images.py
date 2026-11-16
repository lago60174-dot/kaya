#!/usr/bin/env python3
"""Prépare les images du catalogue modèle : WebP 800 px (< 100 Ko) + vignette 200 px (< 15 Ko).

Usage : python3 catalogue/outils/preparer_images.py <dossier_images_source> <images-lot-N.json> [lot-N.json]
Produit catalogue/images/<slug>.webp et <slug>-v.webp, et met à jour le champ "image" du lot (slug) si lot-N.json est donné.
Le slug d'un fichier est celui du premier produit qui l'utilise : une image partagée n'est stockée qu'une fois.
Dépendance : Pillow (pip install pillow pillow-avif-plugin pour les .avif).
"""
import json, os, sys, re
from PIL import Image, ImageOps

try:
    import pillow_avif  # noqa: F401
except Exception:
    pass

def carre(im, cote):
    im = im.convert("RGB")
    im = ImageOps.contain(im, (cote, cote), Image.LANCZOS)
    fond = Image.new("RGB", (cote, cote), "white")
    fond.paste(im, ((cote - im.width) // 2, (cote - im.height) // 2))
    return fond

def enregistrer(im, chemin, octets_max):
    for q in range(90, 29, -5):
        im.save(chemin, "WEBP", quality=q, method=6)
        if os.path.getsize(chemin) <= octets_max:
            return q
    return None

def main():
    source, mapping = sys.argv[1], sys.argv[2]
    lot = sys.argv[3] if len(sys.argv) > 3 else None
    sortie = os.path.join(os.path.dirname(__file__), "..", "images")
    os.makedirs(sortie, exist_ok=True)
    carte = {k: v for k, v in json.load(open(mapping, encoding="utf-8")).items() if not k.startswith("_")}
    donnees = json.load(open(lot, encoding="utf-8")) if lot else None
    par_ref = {p["ref"]: p for p in donnees} if donnees else {}
    slug_de_source = {}
    for ref, fichier in carte.items():
        if fichier is None:
            if ref in par_ref: par_ref[ref]["image"] = None
            continue
        if fichier not in slug_de_source:
            nom = par_ref[ref]["nom_fichier_image"] if ref in par_ref else ref.lower()
            slug = re.sub(r"\.[a-z]+$", "", nom)
            slug_de_source[fichier] = slug
            im = Image.open(os.path.join(source, fichier)); im.load()
            qa = enregistrer(carre(im, 800), os.path.join(sortie, slug + ".webp"), 100 * 1024)
            qv = enregistrer(carre(im, 200), os.path.join(sortie, slug + "-v.webp"), 15 * 1024)
            if qa is None or qv is None:
                sys.exit(f"Image trop lourde même à la qualité minimale : {fichier}")
        if ref in par_ref: par_ref[ref]["image"] = slug_de_source[fichier]
    if donnees:
        json.dump(donnees, open(lot, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(slug_de_source), "images uniques,", sum(1 for v in carte.values() if v is None), "produits sans image")

main()
