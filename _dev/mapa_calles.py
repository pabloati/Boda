#!/usr/bin/env python3
"""Print the street-name entries for PLACES in js/mapa.js (position and angle of each name).

    python3 _dev/mapa_calles.py <folder with the downloaded data>

For each street in WANTED it takes the stretch of that street closest to the given anchor
(lat, lon) and prints where its name goes and the angle it follows. Paste the output into
PLACES; `s` is the zoom tier (1 = main streets, shown first; 2 = the rest, shown close up).
"""
import json
import math
import os
import sys

# name or ref, anchor lat, anchor lon, tier, text shown (None = the name)
WANTED = [
    # around the church and Cibeles
    ('Calle de Alcalá', 40.4186, -3.6962, 1, None),
    ('Gran Vía', 40.4200, -3.7030, 1, None),
    ('Paseo de Recoletos', 40.4238, -3.6915, 1, None),
    ('Paseo del Prado', 40.4128, -3.6935, 1, None),
    ('Calle de Alcalá', 40.4208, -3.6878, 2, None),
    ('Calle de Alfonso XII', 40.4170, -3.6885, 2, None),
    ('Calle del Barquillo', 40.4215, -3.6958, 2, None),
    ('Carrera de San Jerónimo', 40.4165, -3.6975, 2, None),
    ('Calle de Hortaleza', 40.4222, -3.6995, 2, None),
    ('Calle de Fuencarral', 40.4225, -3.7010, 2, None),
    # around Avenida de América
    ('Avenida de América', 40.4395, -3.6705, 1, None),
    ('Calle de María de Molina', 40.4378, -3.6838, 1, None),
    ('Calle de Francisco Silvela', 40.4330, -3.6722, 1, None),
    ('Calle del Príncipe de Vergara', 40.4428, -3.6785, 1, None),
    ('Calle de Cartagena', 40.4372, -3.6712, 2, None),
    ('Calle de López de Hoyos', 40.4408, -3.6740, 2, None),
    ('Calle de Velázquez', 40.4345, -3.6835, 2, None),
    ('Calle de Juan Bravo', 40.4322, -3.6820, 2, None),
    ('Calle de Diego de León', 40.4345, -3.6790, 2, None),
    # around La Cigüeña (roads have no street names there: their numbers)
    ('M-506', 40.2960, -3.5080, 1, None),
    ('M-832', 40.2900, -3.5200, 1, None),
]


def main():
    folder = sys.argv[1]
    ways = []
    for f in ('major', 'mid', 'local'):
        path = os.path.join(folder, f + '.json')
        if os.path.exists(path):
            ways += json.load(open(path, encoding='utf-8')).get('elements', [])
    for want, alat, alon, tier, text in WANTED:
        cos = math.cos(math.radians(alat))
        best = None
        for w in ways:
            t = w.get('tags', {})
            if want not in (t.get('name'), t.get('ref')):
                continue
            g = [p for p in w.get('geometry', []) if p]
            for i in range(len(g) - 1):
                mlat, mlon = (g[i]['lat'] + g[i + 1]['lat']) / 2, (g[i]['lon'] + g[i + 1]['lon']) / 2
                d = math.hypot((mlat - alat) * 111000, (mlon - alon) * 111000 * cos)
                if best is None or d < best[0]:
                    # direction over a longer stretch than one segment, so a kink does not tilt the name
                    a, b = g[max(0, i - 3)], g[min(len(g) - 1, i + 4)]
                    ang = math.degrees(math.atan2(-(b['lat'] - a['lat']), (b['lon'] - a['lon']) * cos))
                    best = (d, mlat, mlon, ang)
        if not best:
            print('    // not found: %s' % want)
            continue
        d, lat, lon, ang = best
        while ang > 90:
            ang -= 180
        while ang < -90:
            ang += 180
        cls = 'road' if want[:2] in ('M-', 'A-') else 'street'
        print("    { name: '%s', lat: %.5f, lon: %.5f, s: %d, rot: %d, cls: '%s' },%s"
              % (text or want, lat, lon, tier, round(ang), cls, '   // %d m from its anchor' % d if d > 150 else ''))


if __name__ == '__main__':
    main()
