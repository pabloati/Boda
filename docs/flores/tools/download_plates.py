import json, os, sys, urllib.parse, urllib.request
D = sys.argv[1]
UA = {'User-Agent': 'wedding-floral-research/1.0 (pabloatienzalo@gmail.com)'}
def fetch(u): return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40).read()
ia = {'narcissus-bessa':'clevelandart-1949.411-polyanthus-or-cluste','lilyvalley-cma':'clevelandart-1966.443-lily-of-the-valley','lilyvalley2-cma':'clevelandart-1966.445-miniature-lily-of-th','hyacinth-curtis':'clevelandart-1955.143-the-botanical-magazi','narcissus-flore':'clevelandart-1949.404-flore-des-jardiniers'}
for k, i in ia.items():
    try:
        files = json.loads(fetch('https://archive.org/metadata/' + i))['files']
        jp = [f for f in files if f['name'].lower().endswith('.jpg') and 'thumb' not in f['name'].lower()]
        jp.sort(key=lambda f: -int(f.get('size', 0)))
        name = jp[0]['name']
        open(os.path.join(D, k + '.jpg'), 'wb').write(fetch('https://archive.org/download/%s/%s' % (i, urllib.parse.quote(name))))
        print('ok', k, name, jp[0].get('size'))
    except Exception as e: print('fail', k, e)
com = {'narcissus-poeticus-batava':'Narcissus poeticus — Flora Batava — Volume v17.jpg','narcissus-pseudo-batava':'Narcissus pseudo-narcissus — Flora Batava — Volume v4.jpg','anemone-nemorosa-batava':'Anemone nemorosa — Flora Batava — Volume v4.jpg','anemone-apennina-batava':'Anemone apennina — Flora Batava — Volume v14.jpg','crocus-batava':'Crocus vernus — Flora Batava — Volume v6.jpg','hyacinth-botryoides-batava':'Hyacinthus botryoides — Flora Batava — Volume v5.jpg','convallaria-kohler':'Convallaria majalis - Köhler–s Medizinal-Pflanzen-045.jpg','malus-kohler':'Malus domestica - Köhler–s Medizinal-Pflanzen-108.jpg','cerasus-kohler':'Prunus cerasus - Köhler–s Medizinal-Pflanzen-113.jpg','wisteria-witte':'WitteHeinrichFlora1868-011-Wisteria sinensis.png','redoute-narcissus':'Narcissus pseudonarcissus - Les liliacées - vol. 3 - t. 158 - clean.jpg', 'gypsophila-batava':'Gypsophila paniculata — Flora Batava — Volume v20.jpg', 'tulipa-mayrhofer':'Johann Nepomuk Mayrhofer - Tulipa striata - Gestreifte Tulpe.jpg', 'primula-acaulis-batava':'Primula acaulis — Flora Batava — Volume v14.jpg', 'primula-curtis':'The Botanical Magazine, Plate 229 (Volume 7, 1794).png', 'lilium-bulbiferum-curtis':'Lilium bulbiferum 1787.jpg', 'lilium-speciosum-burnett':'BD n197 w1150 (37940602742).jpg', 'acacia-dealbata-hamilton':'Gardenillustrate4292lond 0023.jpg', 'acacia-decurrens-minchen':'Acacia-decurrens2.jpg', 'amygdalus-kohler':"Köhler's Medizinal-Pflanzen in naturgetreuen Abbildungen mit kurz erläuterndem Texte (Plate 94) (8231713901).jpg", 'chrysanthemum-roscoe':'Floral illustrations of the seasons (Plate 49) (6048971385).jpg'}
for k, n in com.items():
    try:
        u = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(n) + '?width=1100'
        data = fetch(u); ext = 'png' if n.endswith('png') else 'jpg'
        open(os.path.join(D, k + '.' + ext), 'wb').write(data); print('ok', k, len(data))
    except Exception as e: print('fail', k, e)
