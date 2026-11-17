#!/usr/bin/env python3
"""Build assets/mapa.svg, the base of the bus map (section #mapa, drawn by js/mapa.js).

    python3 _dev/mapa_build.py <folder with the downloaded data>

The folder holds what `_dev/mapa_fetch.py <folder>` downloads: OpenStreetMap extracts from the
Overpass API (major.json, mid.json, local.json, water.json, parks.json) and the driving routes from
the public OSRM server (route-*.json). The map data is (c) OpenStreetMap contributors, ODbL: the
credit line under the map must stay.

The SVG is a plain equirectangular projection of the area between Madrid and Arganda. Its root
carries data-w / data-n / data-k / data-cos, which js/mapa.js uses to place the stops:
    x = (lon - w) * cos * k        y = (n - lat) * k
Layers are groups with a class (z1 always, z2 from mid zoom, z3 only close up); js/mapa.js sets
data-z on the root as the visitor zooms. Stops, labels and texts are not here: they live in
js/mapa.js so they can be translated.
"""
import json
import math
import os
import sys

S, W, N, E = 40.24, -3.76, 40.48, -3.44
K = 4000.0
COS = math.cos(math.radians((S + N) / 2))
WIDTH = (E - W) * COS * K
HEIGHT = (N - S) * K

# Close-up areas: every street is drawn here (lat, lon, half-height, half-width in degrees)
DETAIL = [(40.4189, -3.6955, 0.006, 0.009), (40.4380, -3.6765, 0.006, 0.008), (40.2911, -3.5144, 0.006, 0.008)]


def proj(lat, lon):
    return ((lon - W) * COS * K, (N - lat) * K)


def geom(way):
    return [proj(p['lat'], p['lon']) for p in way.get('geometry', []) if p]


def simplify(pts, tol):
    """Douglas-Peucker, iterative."""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        d2 = dx * dx + dy * dy
        worst, wi = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            if d2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / d2))
                d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > worst:
                worst, wi = d, i
        if worst > tol:
            keep[wi] = True
            stack.append((a, wi))
            stack.append((wi, b))
    return [p for p, k in zip(pts, keep) if k]


def inside(pts, margin=20):
    return any(-margin <= x <= WIDTH + margin and -margin <= y <= HEIGHT + margin for x, y in pts)


def in_box(pts, b):
    lat, lon, dh, dw = b
    x0, y0 = proj(lat + dh, lon - dw)
    x1, y1 = proj(lat - dh, lon + dw)
    return any(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts)


def in_detail(pts):
    return any(in_box(pts, b) for b in DETAIL)


def area(pts):
    return abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1] for i in range(len(pts) - 1))) / 2


def d_of(pts, nd, close=False):
    out, last = [], None
    for i, (x, y) in enumerate(pts):
        s = '%s %s' % (('%.*f' % (nd, x)).rstrip('0').rstrip('.'), ('%.*f' % (nd, y)).rstrip('0').rstrip('.'))
        if s == last:
            continue
        out.append(('M' if not out else 'L') + s)
        last = s
    if len(out) < 2:
        return ''
    return ''.join(out) + ('Z' if close else '')


def rings(rel):
    """Stitch the outer members of a multipolygon relation into closed rings."""
    parts = [geom(m) for m in rel.get('members', []) if m.get('type') == 'way' and m.get('role') in ('outer', '') and m.get('geometry')]
    parts = [p for p in parts if len(p) > 1]
    done = []
    while parts:
        ring = parts.pop()
        grew = True
        while ring[0] != ring[-1] and grew:
            grew = False
            for i, p in enumerate(parts):
                if p[0] == ring[-1]:
                    ring += p[1:]
                elif p[-1] == ring[-1]:
                    ring += p[-2::-1]
                elif p[-1] == ring[0]:
                    ring = p[:-1] + ring
                elif p[0] == ring[0]:
                    ring = p[:0:-1] + ring
                else:
                    continue
                parts.pop(i)
                grew = True
                break
        if ring[0] == ring[-1] and len(ring) > 3:
            done.append(ring)
    return done


def load(folder, name):
    path = os.path.join(folder, name + '.json')
    if not os.path.exists(path):
        print('missing', path)
        return []
    return json.load(open(path, encoding='utf-8')).get('elements', [])


def polygons(elements):
    for el in elements:
        if el['type'] == 'way':
            g = geom(el)
            if len(g) > 3 and g[0] == g[-1]:
                yield el.get('tags', {}), g
        elif el['type'] == 'relation':
            for r in rings(el):
                yield el.get('tags', {}), r


def main():
    folder = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    layers = {k: [] for k in ('forest', 'park', 'park3', 'water', 'river', 'motorway', 'primary', 'mid', 'local')}

    for tags, g in polygons(load(folder, 'parks')):
        if not inside(g):
            continue
        a = area(g)
        if tags.get('landuse') == 'forest':
            if a >= 400:
                layers['forest'].append(d_of(simplify(g, 0.8), 1, True))
        elif a >= 120:
            layers['park'].append(d_of(simplify(g, 0.5), 1, True))
        elif a >= 0.4 and in_detail(g):
            layers['park3'].append(d_of(simplify(g, 0.04), 2, True))

    for el in load(folder, 'water'):
        tags = el.get('tags', {})
        if el['type'] == 'way' and tags.get('waterway') == 'river':
            g = geom(el)
            if inside(g):
                layers['river'].append(d_of(simplify(g, 0.3), 1))
    for tags, g in polygons([e for e in load(folder, 'water') if e.get('tags', {}).get('natural') == 'water']):
        if inside(g) and area(g) >= 25:
            layers['water'].append(d_of(simplify(g, 0.3), 1, True))

    for el in load(folder, 'major'):
        g = geom(el)
        if not inside(g):
            continue
        kind = el.get('tags', {}).get('highway')
        if kind in ('motorway', 'trunk'):
            layers['motorway'].append(d_of(simplify(g, 0.35), 1))
        else:
            layers['primary'].append(d_of(simplify(g, 0.25), 1))

    seen = set()
    for el in load(folder, 'mid'):
        seen.add(el['id'])
        g = geom(el)
        if inside(g):
            layers['mid'].append(d_of(simplify(g, 0.08), 2))
    for el in load(folder, 'local'):
        if el['id'] in seen:
            continue
        g = geom(el)
        kind = el.get('tags', {}).get('highway')
        if not in_detail(g) or (kind == 'service' and not in_box(g, DETAIL[2])):
            continue    # service roads only around La Cigüeña, where they are the only roads
        if kind in ('secondary', 'tertiary') or in_box(g, DETAIL[2]):
            layers['mid'].append(d_of(simplify(g, 0.08), 2))    # the few roads around La Cigüeña show from mid zoom
        else:
            layers['local'].append(d_of(simplify(g, 0.03), 2))

    routes = {}
    for name in ('ret', 'out'):
        path = os.path.join(folder, 'route-%s.json' % name)
        if os.path.exists(path):
            coords = json.load(open(path))['routes'][0]['geometry']['coordinates']
            routes[name] = d_of(simplify([proj(lat, lon) for lon, lat in coords], 0.05), 2)

    def group(cls, z, keys, close=False):
        d = ''.join(x for k in keys for x in layers[k] if x)
        return '<g class="%s %s"><path d="%s"/></g>\n' % (cls, z, d) if d else ''

    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.0f %.0f" data-w="%s" data-n="%s" data-k="%s" data-cos="%.6f">\n'
           % (WIDTH, HEIGHT, W, N, K, COS)]
    svg.append('<defs><clipPath id="m-area"><rect width="%.0f" height="%.0f"/></clipPath></defs>\n<g clip-path="url(#m-area)">\n' % (WIDTH, HEIGHT))
    svg.append(group('m-forest', 'z1', ['forest']))
    svg.append(group('m-park', 'z1', ['park']))
    svg.append(group('m-park', 'z3', ['park3']))
    svg.append(group('m-water', 'z1', ['water']))
    svg.append(group('m-river', 'z1', ['river']))
    svg.append(group('m-local', 'z3', ['local']))
    svg.append(group('m-mid', 'z2', ['mid']))
    svg.append(group('m-primary', 'z1', ['primary']))
    svg.append(group('m-motorway', 'z1', ['motorway']))
    svg.append('</g>\n')
    for name, d in routes.items():
        svg.append('<g class="m-route m-route-%s z1"><path class="m-route-case" d="%s"/><path class="m-route-line" d="%s"/></g>\n' % (name, d, d))
    # the drawn area fades into the paper on its four sides, so the view can go a little past it
    f = 70
    svg.append('<defs>' + ''.join(
        '<linearGradient id="m-fade-%s" x1="%s" y1="%s" x2="%s" y2="%s"><stop offset="0" class="m-fade-a"/><stop offset="1" class="m-fade-b"/></linearGradient>' % g
        for g in (('l', 0, 0, 1, 0), ('r', 1, 0, 0, 0), ('t', 0, 0, 0, 1), ('b', 0, 1, 0, 0))) + '</defs>\n')
    big = 400
    svg.append('<g class="m-fade">'
               '<rect x="%d" y="%d" width="%d" height="%d" fill="url(#m-fade-l)"/>' % (-1, -big, f + 1, HEIGHT + 2 * big) +
               '<rect x="%d" y="%d" width="%d" height="%d" fill="url(#m-fade-r)"/>' % (WIDTH - f, -big, f + 1, HEIGHT + 2 * big) +
               '<rect x="%d" y="%d" width="%d" height="%d" fill="url(#m-fade-t)"/>' % (-big, -1, WIDTH + 2 * big, f + 1) +
               '<rect x="%d" y="%d" width="%d" height="%d" fill="url(#m-fade-b)"/>' % (-big, HEIGHT - f, WIDTH + 2 * big, f + 1) +
               '</g>\n')
    idx = [i for i, x in enumerate(svg) if 'm-route' in x]
    if idx:    # the fade goes under the bus route
        svg.insert(idx[0], svg.pop())
    svg.append('</svg>\n')
    out = os.path.join(root, 'assets', 'mapa.svg')
    open(out, 'w', encoding='utf-8').write(''.join(svg))
    print('%s  %.0f KB  (%.0f x %.0f units)' % (out, os.path.getsize(out) / 1024, WIDTH, HEIGHT))
    for k, v in layers.items():
        print('  %-9s %5d paths %7.0f KB' % (k, len(v), sum(map(len, v)) / 1024))


if __name__ == '__main__':
    main()
