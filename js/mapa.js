/* ========================================================
   BUS MAP (section #mapa)
   A map of the day that can be zoomed and dragged, like the map of a
   video game: the church, where the bus leaves, the reception and the
   stops on the way back.

   The base is assets/mapa.svg (built by _dev/mapa_build.py from
   OpenStreetMap data, so the credit line under the map must stay). This
   file adds the stops and the place names on top, and moves the map by
   changing the SVG's viewBox.

   On the page, one finger scrolls the page as usual; two fingers (or the
   mouse) move and zoom the map. "Ampliar" opens it full screen, where one
   finger drags it.
======================================================== */
(function () {
  'use strict';

  const box = document.getElementById('mapa-canvas');
  if (!box || !window.fetch) return;
  const section = document.getElementById('mapa');
  const card = document.getElementById('mapa-card');
  const t = (window.I18N && window.I18N.t) || function (k) { return k; };
  const esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const NS = 'http://www.w3.org/2000/svg';

  // --- The stops. lat/lon place them; dx/dy is where the round drawing sits, in screen
  //     pixels from the exact point (so two stops that are close do not cover each other).
  //     `narrow` replaces dx/dy/below on phone-width frames, where there is less room sideways.
  const STOPS = [
    { id: 'iglesia', lat: 40.41905, lon: -3.69742, art: 'assets/ruta-ceremonia.png', dx: -52, dy: -6, below: true,
      narrow: { dx: -36, dy: -40, below: false },
      href: 'https://share.google/moPjthgGraOJOiUeF' },
    { id: 'cibeles', lat: 40.41930, lon: -3.69310, art: 'assets/ruta-buses.png', dx: -2, dy: 52, below: true,
      href: 'https://www.google.com/maps/search/?api=1&query=Plaza+de+Cibeles%2C+Madrid' },
    { id: 'avamerica', lat: 40.43800, lon: -3.67650, art: 'assets/ruta-buses.png', dx: 50, dy: -12, below: true,
      narrow: { dx: 46, dy: -24, below: false },
      href: 'https://www.google.com/maps/search/?api=1&query=Avenida+de+Am%C3%A9rica%2C+Madrid' },
    { id: 'ciguena', lat: 40.29114, lon: -3.51444, art: 'assets/ruta-convite.png', dx: -52, dy: 12,
      narrow: { dx: -30, dy: 46, below: true },
      href: 'https://share.google/xqutfRoSoisIk9tlh' }
  ];
  function placeName(pl) {
    return (narrow && pl.short) || pl.name;
  }
  // where a stop's drawing sits for the current frame
  function place(s) {
    return (narrow && s.narrow) || s;
  }

  // --- Size of the round drawings: K scales them (1 = a 24 px circle), R is the radius on screen.
  //     Narrow frames (phones) get smaller ones, or the three stops in Madrid cover each other.
  let K = 1.8, R = 24 * K, narrow = false;
  function sizeUp() {
    const was = narrow;
    narrow = box.clientWidth < 480;
    K = narrow ? (box.clientWidth < 340 ? 1.15 : 1.4) : 1.8;   // the smallest phones: or the far view does not fit the drawn area
    R = 24 * K;
    return was !== narrow;
  }

  // --- Place names. z = the zoom steps they show in (1 far, 2 middle, 3 close).
  //     wide = left out of the far view on phone-width frames, where the drawings need the room;
  //     short = the name used on those frames.
  const PLACES = [
    { name: 'Madrid', lat: 40.4560, lon: -3.7180, z: [1, 2], cls: 'city', wide: true },
    { name: 'Vallecas', lat: 40.3800, lon: -3.6350, z: [1, 2], cls: 'town', wide: true },
    { name: 'Rivas', lat: 40.3560, lon: -3.5250, z: [1, 2], cls: 'town' },
    { name: 'Arganda del Rey', short: 'Arganda', lat: 40.3000, lon: -3.4700, z: [1, 2], cls: 'town' },
    { name: 'Coslada', lat: 40.4290, lon: -3.5560, z: [2], cls: 'town' },
    { name: 'Getafe', lat: 40.3080, lon: -3.7300, z: [2], cls: 'town' },
    { name: 'A-3', lat: 40.3660, lon: -3.5767, z: [1, 2], cls: 'road' },
    { name: 'A-4', lat: 40.3080, lon: -3.6900, z: [1, 2], cls: 'road', wide: true },
    { name: 'El Retiro', lat: 40.4140, lon: -3.6830, z: [2, 3], cls: 'park' },
    { name: 'Río Jarama', lat: 40.3050, lon: -3.5330, z: [2, 3], cls: 'park' },
    // Street names (from `python3 _dev/mapa_calles.py <data folder>`). s = when they show: 1 the main
    // streets, from a middle zoom; 2 the rest, only close up. rot = the angle of the street.
    { name: 'Calle de Alcalá', lat: 40.41877, lon: -3.69619, s: 1, rot: -17, cls: 'street' },
    { name: 'Gran Vía', lat: 40.42011, lon: -3.70297, s: 1, rot: 5, cls: 'street' },
    { name: 'Paseo de Recoletos', lat: 40.42411, lon: -3.69138, s: 1, rot: -71, cls: 'street' },
    { name: 'Paseo del Prado', lat: 40.41286, lon: -3.69351, s: 1, rot: 74, cls: 'street' },
    { name: 'Calle de Alcalá', lat: 40.42030, lon: -3.68751, s: 2, rot: -14, cls: 'street' },
    { name: 'Calle de Alfonso XII', lat: 40.41718, lon: -3.68887, s: 2, rot: -86, cls: 'street' },
    { name: 'Calle del Barquillo', lat: 40.42135, lon: -3.69566, s: 2, rot: 90, cls: 'street' },
    { name: 'Carrera de San Jerónimo', lat: 40.41619, lon: -3.69745, s: 2, rot: 20, cls: 'street' },
    { name: 'Calle de Hortaleza', lat: 40.42243, lon: -3.69953, s: 2, rot: -61, cls: 'street' },
    { name: 'Calle de Fuencarral', lat: 40.42248, lon: -3.70089, s: 2, rot: -80, cls: 'street' },
    { name: 'Avenida de América', lat: 40.43955, lon: -3.67064, s: 1, rot: -25, cls: 'street' },
    { name: 'Calle de María de Molina', lat: 40.43768, lon: -3.68374, s: 1, rot: 4, cls: 'street' },
    { name: 'Calle de Francisco Silvela', lat: 40.43276, lon: -3.67264, s: 1, rot: 58, cls: 'street' },
    { name: 'Calle del Príncipe de Vergara', lat: 40.44278, lon: -3.67850, s: 1, rot: -85, cls: 'street' },
    { name: 'Calle de Cartagena', lat: 40.43732, lon: -3.67127, s: 2, rot: 39, cls: 'street' },
    { name: 'Calle de López de Hoyos', lat: 40.44276, lon: -3.67599, s: 2, rot: -38, cls: 'street' },   // 275 m from its anchor
    { name: 'Calle de Velázquez', lat: 40.43464, lon: -3.68334, s: 2, rot: -86, cls: 'street' },
    { name: 'Calle de Juan Bravo', lat: 40.43269, lon: -3.68209, s: 2, rot: 4, cls: 'street' },
    { name: 'Calle de Diego de León', lat: 40.43473, lon: -3.67902, s: 2, rot: 4, cls: 'street' },
    { name: 'M-506', lat: 40.28581, lon: -3.49705, s: 1, rot: 0, cls: 'road' },
    { name: 'M-832', lat: 40.29104, lon: -3.50769, s: 1, rot: 0, cls: 'road' }
  ];

  // --- The views the buttons under the map jump to: the stops each one frames.
  //     min = the narrowest the view gets, in map units (1 unit is about 28 m).
  //     card = whose details show under the map: a stop, or 'vuelta' for the way back as a whole.
  const VIEWS = {
    todo: { stops: ['iglesia', 'cibeles', 'avamerica', 'ciguena'], refs: ['A-4', 'Arganda del Rey'] },
    iglesia: { stops: ['iglesia', 'cibeles'], min: 45, card: 'iglesia' },
    salida: { stops: ['iglesia', 'cibeles'], min: 45, card: 'cibeles' },
    convite: { stops: ['ciguena'], min: 90, card: 'ciguena' },
    vuelta: { stops: ['cibeles', 'avamerica'], fit: ['iglesia', 'cibeles', 'avamerica'], card: 'vuelta' }
  };
  const VIEW_OF_STOP = { iglesia: 'iglesia', cibeles: 'salida', ciguena: 'convite' };

  let svg = null;
  let W = 1707, H = 1600, geo = null;
  let view = { x: 0, y: 0, w: 975 };   // the viewBox: left, top, width (height follows the frame)
  let selected = null;
  let anim = 0;

  function project(lat, lon) {
    return { x: (lon - geo.w) * geo.cos * geo.k, y: (geo.n - lat) * geo.k };
  }

  function frameSize() {
    return { w: box.clientWidth || 1, h: box.clientHeight || 1 };
  }

  // Keep the view inside the map and between the two zoom limits, then draw it.
  function apply() {
    const f = frameSize();
    const ratio = f.h / f.w;
    const M = 0;       // the view never leaves the drawn area, so the map always fills the frame
    const cx = view.x + view.w / 2, cy = view.y + view.w * ratio / 2;
    view.w = Math.min(W + 2 * M, (H + 2 * M) / ratio, Math.max(7, view.w));
    const h = view.w * ratio;
    view.x = cx - view.w / 2;       // a width that had to be cut keeps its centre
    view.y = cy - h / 2;
    view.x = Math.min(W + M - view.w, Math.max(-M, view.x));
    view.y = Math.min(H + M - h, Math.max(-M, view.y));
    svg.setAttribute('viewBox', view.x.toFixed(2) + ' ' + view.y.toFixed(2) + ' ' + view.w.toFixed(2) + ' ' + h.toFixed(2));
    const u = view.w / f.w;                       // map units per screen pixel
    svg.style.setProperty('--u', u.toFixed(5));
    const z = u > 0.55 ? 1 : (u > 0.115 ? 2 : 3);
    if (svg.getAttribute('data-z') !== String(z)) svg.setAttribute('data-z', z);
    const st = u < 0.075 ? 2 : (u < 0.17 ? 1 : 0);     // which street names show (see PLACES)
    if (svg.getAttribute('data-s') !== String(st)) svg.setAttribute('data-s', st);
  }

  function zoomAt(factor, px, py) {
    const f = frameSize();
    if (px == null) { px = f.w / 2; py = f.h / 2; }
    const u = view.w / f.w;
    const mx = view.x + px * u, my = view.y + py * u;
    const before = view.w;
    view.w = before * factor;
    apply();                                       // clamps the width
    const u2 = view.w / f.w;
    view.x = mx - px * u2;
    view.y = my - py * u2;
    apply();
  }

  // The view that frames a list of stops (and the place names in v.refs), as close as it can get
  // with every drawing and name whole inside the frame. Each thing is a point on the map plus a
  // box in screen pixels around it, so the fit is searched: the smallest scale where all fit.
  function viewFor(v) {
    const f = frameSize();
    const boxes = [];
    STOPS.forEach(function (s) {
      if ((v.fit || v.stops).indexOf(s.id) === -1) return;     // fit: also kept whole, though not part of the view
      const q = place(s), p = project(s.lat, s.lon), cx = q.dx * K, cy = q.dy * K;
      const half = Math.max(R, t('map.' + s.id + '.short').length * 5.6 + 8);
      boxes.push({ x: p.x, y: p.y, l: Math.min(0, cx - half), r: Math.max(0, cx + half),
        t: Math.min(0, cy - R - (q.below ? 2 : 36)), b: Math.max(0, cy + R + (q.below ? 36 : 2)) });
    });
    (v.refs || []).forEach(function (name) {
      const pl = PLACES.filter(function (x) { return x.name === name; })[0];
      if (!pl) return;
      const p = project(pl.lat, pl.lon), half = placeName(pl).length * 5.6 + 6;
      boxes.push({ x: p.x, y: p.y, l: -half, r: half, t: -15, b: 7 });
    });
    if (!boxes.length) return null;
    const m = 14, mBottom = 64;                     // free edge in pixels; the bottom one clears the buttons
    const span = function (u) {
      const o = { l: Infinity, r: -Infinity, t: Infinity, b: -Infinity };
      boxes.forEach(function (q) {
        o.l = Math.min(o.l, q.x / u + q.l); o.r = Math.max(o.r, q.x / u + q.r);
        o.t = Math.min(o.t, q.y / u + q.t); o.b = Math.max(o.b, q.y / u + q.b);
      });
      return o;
    };
    const fits = function (u) {
      const o = span(u);
      return o.r - o.l <= f.w - m * 2 && o.b - o.t <= f.h - m - mBottom;
    };
    let lo = (v.min || 11) / f.w, hi = 50;
    if (!fits(lo)) {
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (fits(mid)) hi = mid; else lo = mid;
      }
      lo = hi;
    }
    const u = lo, o = span(u);
    return {
      w: u * f.w,
      x: (o.l - (f.w - (o.r - o.l)) / 2) * u,
      y: (o.t - m - (f.h - m - mBottom - (o.b - o.t)) / 2) * u
    };
  }

  function flyTo(target, instant) {
    cancelAnimationFrame(anim);
    if (!target) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce) { view = { x: target.x, y: target.y, w: target.w }; apply(); return; }
    const f = frameSize(), ratio = f.h / f.w;
    const from = { cx: view.x + view.w / 2, cy: view.y + view.w * ratio / 2, w: view.w };
    const to = { cx: target.x + target.w / 2, cy: target.y + target.w * ratio / 2, w: target.w };
    const start = performance.now(), dur = 900;
    (function step(now) {
      let p = Math.min(1, (now - start) / dur);
      p = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;      // ease in and out
      const w = Math.exp(Math.log(from.w) + (Math.log(to.w) - Math.log(from.w)) * p);
      // move the centre in step with the zoom, so the target stays in sight all the way
      const q = Math.abs(to.w - from.w) < 0.001 ? p : (w - from.w) / (to.w - from.w);
      const cx = from.cx + (to.cx - from.cx) * q, cy = from.cy + (to.cy - from.cy) * q;
      view = { w: w, x: cx - w / 2, y: cy - w * ratio / 2 };
      apply();
      if (p < 1) anim = requestAnimationFrame(step);
    })(start);
  }

  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // Stops and names are drawn in screen pixels: each group sits at its point of the map and is
  // scaled by --u (map units per pixel), so it keeps its size on screen at any zoom.
  function pinned(parent, p, cls) {
    const g = el('g', { 'class': cls }, parent);
    g.style.transform = 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px) scale(var(--u))';
    return g;
  }

  function drawOverlay() {
    const old = svg.querySelector('.m-over');
    if (old) old.remove();
    const over = el('g', { 'class': 'm-over' }, svg);

    PLACES.forEach(function (pl) {
      const zs = (narrow && pl.wide) ? pl.z.filter(function (z) { return z !== 1; }) : (pl.z || []);
      const when = pl.s ? 'ons' + pl.s : zs.map(function (z) { return 'on' + z; }).join(' ');
      const g = pinned(over, project(pl.lat, pl.lon), 'm-name m-name-' + pl.cls + ' ' + when);
      const txt = el('text', { 'text-anchor': 'middle' }, g);
      if (pl.rot) txt.setAttribute('transform', 'rotate(' + pl.rot + ')');
      txt.textContent = placeName(pl);
    });

    const defs = el('defs', {}, over);
    el('circle', { r: 21 }, el('clipPath', { id: 'm-clip' }, defs));

    STOPS.forEach(function (s) {
      const g = pinned(over, project(s.lat, s.lon), 'm-stop' + (isOn(s.id) ? ' is-on' : ''));
      g.setAttribute('data-stop', s.id);
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', t('map.' + s.id + '.name'));
      const q = place(s);
      el('line', { x1: 0, y1: 0, x2: q.dx * K, y2: q.dy * K, 'class': 'm-stop-stem' }, g);
      el('circle', { r: 3.5, 'class': 'm-stop-dot' }, g);
      const b = el('g', { transform: 'translate(' + (q.dx * K) + ' ' + (q.dy * K) + ')' }, g);
      const art = el('g', { transform: 'scale(' + K + ')' }, b);
      el('circle', { r: 24, 'class': 'm-stop-badge' }, art);
      const img = el('image', { href: s.art, x: -21, y: -21, width: 42, height: 42, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#m-clip)' }, art);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', s.art);
      const name = t('map.' + s.id + '.short');
      // an unseen box behind the name, so the name is as easy to tap as the drawing
      el('rect', { x: -name.length * 5.6 - 8, y: q.below ? R : -R - 30, width: name.length * 11.2 + 16, height: 32, 'class': 'm-stop-hit' }, b);
      const label = el('text', { y: q.below ? R + 20 : -R - 8, 'text-anchor': 'middle', 'class': 'm-stop-label' }, b);
      label.textContent = name;
    });
  }

  function stopById(id) {
    return STOPS.filter(function (x) { return x.id === id; })[0] || null;
  }

  // selected is a stop, or 'vuelta' (the way back: its two stops light up together)
  function isOn(id) {
    return selected === id || (selected === 'vuelta' && VIEWS.vuelta.stops.indexOf(id) !== -1);
  }

  function renderCard() {
    if (!card) return;
    if (!selected) {
      card.innerHTML = '<p class="mapa-card-hint">' + esc(t('map.hint')) + '</p>';
      return;
    }
    const s = stopById(selected);
    let html =
      '<p class="hand-label">' + esc(t('map.' + selected + '.when')) + '</p>' +
      '<h3 class="mapa-card-name">' + esc(t('map.' + selected + '.name')) + '</h3>' +
      '<p class="mapa-card-note">' + esc(t('map.' + selected + '.note')) + '</p>';
    const link = function (st, label) {
      const href = st.href || ('https://www.google.com/maps/search/?api=1&query=' + st.lat + ',' + st.lon);
      return '<a class="text-link" target="_blank" rel="noopener noreferrer" href="' + esc(href) + '">' + esc(label) + '</a>';
    };
    if (s) {
      html += link(s, t('map.open'));
    } else if (selected === 'vuelta') {
      // the way back has two stops: one link to each
      html += '<p class="mapa-card-links">' + ['cibeles', 'avamerica'].map(function (id) {
        const st = stopById(id);
        return st ? link(st, t('map.' + id + '.name')) : '';
      }).join('') + '</p>';
    }
    card.innerHTML = html;
  }

  // the button under the map that goes with what is showing
  function markView(name) {
    document.querySelectorAll('[data-mapa]').forEach(function (x) {
      const v = x.getAttribute('data-mapa');
      if (VIEWS[v]) x.classList.toggle('is-on', v === name);
    });
  }

  function select(id, fly) {
    selected = id;
    svg.querySelectorAll('.m-stop').forEach(function (g) {
      g.classList.toggle('is-on', isOn(g.getAttribute('data-stop')));
    });
    renderCard();
    if (fly && stopById(id)) {
      markView(VIEW_OF_STOP[id] || null);
      // close enough to tell the stop from its neighbours, never further out than now
      const target = viewFor({ stops: [id], min: 45 });
      const f = frameSize();
      target.w = Math.min(view.w, Math.max(target.w, 46));
      const p = project.apply(null, STOPS.filter(function (x) { return x.id === id; }).map(function (x) { return [x.lat, x.lon]; })[0]);
      target.x = p.x - target.w / 2;
      target.y = p.y - target.w * (f.h / f.w) * 0.62;
      flyTo(target);
    }
  }

  // --- Gestures -------------------------------------------------------------------------
  const pointers = new Map();
  let moved = 0, gesture = null;

  function isOpen() { return !!(section && section.classList.contains('is-open')); }

  function local(e) {
    const r = box.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startGesture() {
    const pts = Array.from(pointers.values());
    if (pts.length === 1) {
      gesture = { kind: 'drag', x: pts[0].x, y: pts[0].y };
    } else if (pts.length >= 2) {
      gesture = {
        kind: 'pinch',
        d: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
    } else {
      gesture = null;
    }
  }

  box.addEventListener('pointerdown', function (e) {
    if (!svg || (e.pointerType === 'mouse' && e.button !== 0)) return;
    cancelAnimationFrame(anim);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) moved = 0;
    startGesture();
  });

  box.addEventListener('pointermove', function (e) {
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, local(e));
    const pts = Array.from(pointers.values());
    const u = view.w / frameSize().w;
    if (gesture.kind === 'drag' && pts.length === 1) {
      // on the page a single finger belongs to the page's own scroll
      if (e.pointerType === 'touch' && !isOpen()) return;
      const dx = pts[0].x - gesture.x, dy = pts[0].y - gesture.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        try { box.setPointerCapture(e.pointerId); } catch (err) { /* the pointer is already gone */ }
        box.classList.add('is-dragging');
      }
      view.x -= dx * u;
      view.y -= dy * u;
      gesture.x = pts[0].x;
      gesture.y = pts[0].y;
      apply();
    } else if (gesture.kind === 'pinch' && pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
      moved += 10;
      view.x -= (cx - gesture.x) * u;
      view.y -= (cy - gesture.y) * u;
      apply();
      zoomAt(gesture.d / d, cx, cy);
      gesture.d = d;
      gesture.x = cx;
      gesture.y = cy;
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    box.classList.remove('is-dragging');
    startGesture();
  }
  box.addEventListener('pointerup', endPointer);
  box.addEventListener('pointercancel', endPointer);
  box.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') endPointer(e); });

  // A click that was not a drag: on a stop it opens its card, elsewhere it closes it.
  box.addEventListener('click', function (e) {
    if (!svg || moved > 6) return;
    const g = e.target.closest ? e.target.closest('.m-stop') : null;
    select(g ? g.getAttribute('data-stop') : null, !!g);
    if (!g) markView(null);
  });
  box.addEventListener('keydown', function (e) {
    const g = e.target.closest ? e.target.closest('.m-stop') : null;
    if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(g.getAttribute('data-stop'), true); }
  });

  // The wheel zooms full screen, or with Ctrl / a trackpad pinch on the page (a plain wheel scrolls the page).
  box.addEventListener('wheel', function (e) {
    if (!svg || !(isOpen() || e.ctrlKey)) return;
    e.preventDefault();
    const p = local(e);
    zoomAt(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y);
  }, { passive: false });

  // --- Buttons --------------------------------------------------------------------------
  function setOpen(open) {
    if (!section) return;
    const f = frameSize();
    const centre = { x: view.x + view.w / 2, y: view.y + view.w * (f.h / f.w) / 2, u: view.w / f.w };
    section.classList.toggle('is-open', open);
    document.body.classList.toggle('mapa-open', open);
    const btn = document.getElementById('mapa-expand');
    if (btn) btn.textContent = t(open ? 'map.close' : 'map.expand');
    // same centre and same scale in the new frame
    const g = frameSize();
    view.w = centre.u * g.w;
    view.x = centre.x - view.w / 2;
    view.y = centre.y - view.w * (g.h / g.w) / 2;
    apply();
  }

  document.addEventListener('click', function (e) {
    const b = e.target.closest ? e.target.closest('[data-mapa]') : null;
    if (!b || !svg) return;
    const what = b.getAttribute('data-mapa');
    if (what === 'in') zoomAt(1 / 1.7);
    else if (what === 'out') zoomAt(1.7);
    else if (what === 'expand') setOpen(!isOpen());
    else if (VIEWS[what]) {
      select(VIEWS[what].card || null);
      flyTo(viewFor(VIEWS[what]));
      markView(what);
    }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) setOpen(false); });

  let resizeT = 0;
  window.addEventListener('resize', function () {
    if (!svg) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (sizeUp()) drawOverlay(); apply(); }, 80);
  });

  document.addEventListener('langchange', function () {
    // the button first: it must follow the language even before the map file has loaded
    const btn = document.getElementById('mapa-expand');
    if (btn) btn.textContent = t(isOpen() ? 'map.close' : 'map.expand');
    if (!svg) return;
    drawOverlay();
    renderCard();
  });

  // --- Start: the map file is only downloaded when the section is about to come into view ---
  function start() {
  fetch(box.getAttribute('data-src') || 'assets/mapa.svg')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const root = doc.documentElement;
      if (!root || root.nodeName !== 'svg') throw new Error('not an svg');
      svg = document.importNode(root, true);
      geo = {
        w: parseFloat(svg.getAttribute('data-w')), n: parseFloat(svg.getAttribute('data-n')),
        k: parseFloat(svg.getAttribute('data-k')), cos: parseFloat(svg.getAttribute('data-cos'))
      };
      const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
      if (vb.length === 4) { W = vb[2]; H = vb[3]; }
      svg.setAttribute('class', 'mapa-svg');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.setAttribute('aria-hidden', 'false');
      box.appendChild(svg);
      sizeUp();
      drawOverlay();
      renderCard();
      flyTo(viewFor(VIEWS.todo), true);
      if (section) section.classList.add('is-ready');
    })
    .catch(function () {
      // no map (offline, or the page opened straight from a folder): only the two lines stay
      if (section) section.classList.add('no-map');
    });
  }

  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { watcher.disconnect(); start(); }
    }, { rootMargin: '1200px 0px' });
    watcher.observe(box);
  } else {
    start();
  }
})();
