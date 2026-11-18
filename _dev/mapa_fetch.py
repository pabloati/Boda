#!/usr/bin/env python3
"""Download the data `_dev/mapa_build.py` draws the bus map from.

    python3 _dev/mapa_fetch.py <folder>

OpenStreetMap extracts from the Overpass API and the driving routes from the public OSRM server.
Files already in the folder are kept, so a run that failed half way (the public servers answer
502 / 504 often) can simply be repeated. Keep the folder outside the repo: the raw data is ~12 MB.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

BB = '40.16,-3.90,40.56,-3.34'    # the same area as S, W, N, E in mapa_build.py
# church, Cibeles, Avenida de América, La Cigüeña
PTS = {'iglesia': (40.4189, -3.6975), 'cibeles': (40.4193, -3.6931), 'avamerica': (40.4380, -3.6765), 'ciguena': (40.2911, -3.5144)}
UA = {'User-Agent': 'map-prototype/1.0'}
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']


def box(lat, lon, dlat=0.007, dlon=0.010):
    return '%s,%s,%s,%s' % (lat - dlat, lon - dlon, lat + dlat, lon + dlon)


LOCAL = 'secondary|tertiary|residential|unclassified|living_street|pedestrian|service'
QUERIES = {
    'major': '[out:json][timeout:120];way[highway~"^(motorway|trunk|primary)$"](%s);out geom;' % BB,
    'mid': '[out:json][timeout:120];way[highway~"^(secondary|tertiary)$"](40.400,-3.715,40.446,-3.660);out geom;',
    'water': '[out:json][timeout:120];(way[waterway=river](%s);way[natural=water](%s);relation[natural=water](%s););out geom;' % (BB, BB, BB),
    'parks': '[out:json][timeout:120];(way[leisure=park](%s);relation[leisure=park](%s);way[landuse=forest](%s););out geom;' % (BB, BB, BB),
    'local': '[out:json][timeout:120];(' + ''.join('way[highway~"^(%s)$"](%s);' % (LOCAL, box(a, b)) for a, b in PTS.values()) + ');out geom;',
}
ROUTES = {
    'out': ('cibeles', 'ciguena'),      # the bus to the reception, also the way back to Cibeles
    'ret': ('ciguena', 'avamerica'),    # the way back to Avenida de América
}


def get(url, data=None):
    req = urllib.request.Request(url, data=data, headers=UA)
    return urllib.request.urlopen(req, timeout=180).read()


def main():
    folder = sys.argv[1]
    os.makedirs(folder, exist_ok=True)
    for name, q in QUERIES.items():
        path = os.path.join(folder, name + '.json')
        if os.path.exists(path):
            continue
        for attempt in range(12):
            ep = OVERPASS[attempt % len(OVERPASS)]
            try:
                raw = get(ep, urllib.parse.urlencode({'data': q}).encode())
                json.loads(raw)
                open(path, 'wb').write(raw)
                print(name, len(raw), flush=True)
                break
            except Exception as e:  # noqa: BLE001 (public servers: any failure means try the next one)
                print(name, ep, 'failed:', e, flush=True)
                time.sleep(8)
    for name, (a, b) in ROUTES.items():
        path = os.path.join(folder, 'route-%s.json' % name)
        if os.path.exists(path):
            continue
        url = 'https://router.project-osrm.org/route/v1/driving/%s,%s;%s,%s?overview=full&geometries=geojson' % (
            PTS[a][1], PTS[a][0], PTS[b][1], PTS[b][0])
        open(path, 'wb').write(get(url))
        print('route', name, flush=True)


if __name__ == '__main__':
    main()
