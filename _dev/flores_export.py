#!/usr/bin/env python3
"""Turns the colour cut-outs into web-sized PNGs for assets/flores/ and writes flores.json,
the list the editor (_dev/flores.html) shows in its library.

Use:  python3 _dev/flores_export.py [folder with the cut-outs]     (default docs/flores/img/color)
The cut-outs come from the plates in docs/flores (tools/cutout.py); cuts.json says which sides of
each one were cut when the plate was cropped.
"""
import json
import os
import sys
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'docs', 'flores', 'img', 'color')
CUTS = json.load(open(os.path.join(HERE, 'docs', 'flores', 'tools', 'cuts.json')))
OUT = os.path.join(HERE, 'assets', 'flores')
MAX_H = 640

NAMES = {   # source file → (web name, label shown in the editor)
    'narcissus-bessa': ('narciso-jonquilla', 'Narciso jonquilla'),
    'narcissus-poeticus-batava': ('narciso-poeta', 'Narciso de los poetas'),
    'redoute-narcissus': ('narciso-trompon', 'Narciso trompón'),
    'hyacinth-curtis': ('jacinto', 'Jacinto'),
    'hyacinth-botryoides-batava': ('muscari', 'Muscari'),
    'crocus-batava': ('azafran', 'Azafrán'),
    'anemone-apennina-batava': ('anemona-azul', 'Anémona azul'),
    'anemone-nemorosa-batava': ('anemona-bosque', 'Anémona de bosque'),
    'wisteria-witte': ('glicinia', 'Glicinia'),
    'convallaria-kohler': ('muguete', 'Muguete'),
    'malus-kohler': ('manzano', 'Flor de manzano'),
}

os.makedirs(OUT, exist_ok=True)
index = []
for src, (name, label) in NAMES.items():
    im = Image.open(os.path.join(SRC, src + '.png')).convert('RGBA')
    if im.size[1] > MAX_H:
        im = im.resize((round(im.size[0] * MAX_H / im.size[1]), MAX_H), Image.LANCZOS)
    im.quantize(256, method=Image.FASTOCTREE).save(os.path.join(OUT, name + '.png'), optimize=True)
    cut = CUTS[src]['cut']
    index.append({'id': name, 'label': label, 'w': im.size[0], 'h': im.size[1],
                  'cut': {k: v > 0.15 for k, v in cut.items()}})
    print(name, im.size, os.path.getsize(os.path.join(OUT, name + '.png')) // 1024, 'KB')
json.dump(index, open(os.path.join(OUT, 'flores.json'), 'w'), ensure_ascii=False, indent=1)
