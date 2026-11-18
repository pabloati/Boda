#!/usr/bin/env python3
"""Cut the data `_dev/mapa_build.py` needs out of a regional OpenStreetMap file.

    python3 _dev/mapa_extract.py <madrid-latest.osm.pbf> <folder>

The other way to get the data (`_dev/mapa_fetch.py` asks the public Overpass servers, which are
often down). The .pbf comes from https://download.geofabrik.de/europe/spain/madrid.html (85 MB:
keep it and the folder outside the repo). Needs `pip install osmium` (in a virtual environment).
Writes major.json, mid.json, local.json, water.json and parks.json in the shape Overpass gives.
The two route-*.json files still come from mapa_fetch.py (the OSRM server).
"""
import json
import os
import sys

import osmium

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mapa_build import DETAIL, E, N, S, W  # noqa: E402  (the drawn area and the close-up boxes)

MID_BOX = (40.400, -3.715, 40.446, -3.660)      # central Madrid: secondary and tertiary streets
LOCAL = {'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'pedestrian', 'service'}
PAD = 0.01


def in_area(pts, box=None):
    s, w, n, e = box or (S - PAD, W - PAD, N + PAD, E + PAD)
    return any(s <= p['lat'] <= n and w <= p['lon'] <= e for p in pts)


def in_detail(pts):
    return any(in_area(pts, (lat - dh, lon - dw, lat + dh, lon + dw)) for lat, lon, dh, dw in DETAIL)


class Cut(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.out = {k: [] for k in ('major', 'mid', 'local', 'water', 'parks')}

    def way(self, w):
        kind = w.tags.get('highway')
        river = w.tags.get('waterway') == 'river'
        if not kind and not river:
            return
        try:
            pts = [{'lat': n.lat, 'lon': n.lon} for n in w.nodes]
        except osmium.InvalidLocationError:
            return
        if not in_area(pts):
            return
        el = {'type': 'way', 'id': w.id, 'tags': dict(w.tags), 'geometry': pts}
        if river:
            self.out['water'].append(el)
        elif kind in ('motorway', 'trunk', 'primary'):
            self.out['major'].append(el)
        else:
            if kind in ('secondary', 'tertiary') and in_area(pts, MID_BOX):
                self.out['mid'].append(el)
            if kind in LOCAL and in_detail(pts):
                self.out['local'].append(el)

    def area(self, a):
        t = a.tags
        if t.get('natural') == 'water':
            key, tags = 'water', {'natural': 'water'}
        elif t.get('leisure') == 'park':
            key, tags = 'parks', {'leisure': 'park'}
        elif t.get('landuse') == 'forest':
            key, tags = 'parks', {'landuse': 'forest'}
        else:
            return
        for ring in a.outer_rings():
            try:
                pts = [{'lat': n.lat, 'lon': n.lon} for n in ring]
            except osmium.InvalidLocationError:
                continue
            if len(pts) > 3 and in_area(pts):
                self.out[key].append({'type': 'way', 'id': a.id, 'tags': tags, 'geometry': pts})


def main():
    pbf, folder = sys.argv[1], sys.argv[2]
    os.makedirs(folder, exist_ok=True)
    cut = Cut()
    cut.apply_file(pbf, locations=True)
    for name, els in cut.out.items():
        json.dump({'elements': els}, open(os.path.join(folder, name + '.json'), 'w', encoding='utf-8'))
        print('%-6s %6d' % (name, len(els)))


if __name__ == '__main__':
    main()
