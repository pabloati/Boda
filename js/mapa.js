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
  const STOPS = [
    { id: 'iglesia', lat: 40.41905, lon: -3.69742, art: 'assets/ruta-ceremonia.png', dx: -52, dy: -6, below: true,
      href: 'https://share.google/moPjthgGraOJOiUeF' },
    { id: 'cibeles', lat: 40.41930, lon: -3.69310, art: 'assets/ruta-buses.png', dx: -2, dy: 52, below: true },
    { id: 'avamerica', lat: 40.43800, lon: -3.67650, art: 'assets/ruta-buses.png', dx: 36, dy: -40 },
    { id: 'ciguena', lat: 40.29114, lon: -3.51444, art: 'assets/ruta-convite.png', dx: 46, dy: -30,
      href: 'https://share.google/xqutfRoSoisIk9tlh' }
  ];

  // --- Place names. z = the zoom steps they show in (1 far, 2 middle, 3 close).
  const PLACES = [
    { name: 'Madrid', lat: 40.4520, lon: -3.7300, z: [1], cls: 'city' },
    { name: 'Vallecas', lat: 40.3800, lon: -3.6350, z: [1, 2], cls: 'town' },
    { name: 'Rivas-Vaciamadrid', lat: 40.3560, lon: -3.5420, z: [2], cls: 'town' },
    { name: 'Arganda del Rey', lat: 40.3030, lon: -3.4560, z: [2], cls: 'town' },
    { name: 'Coslada', lat: 40.4290, lon: -3.5560, z: [1, 2], cls: 'town' },
    { name: 'Getafe', lat: 40.3080, lon: -3.7300, z: [1, 2], cls: 'town' },
    { name: 'A-3', lat: 40.3660, lon: -3.5960, z: [1, 2], cls: 'road' },
    { name: 'El Retiro', lat: 40.4140, lon: -3.6830, z: [2, 3], cls: 'park' },
    { name: 'Gran Vía', lat: 40.4200, lon: -3.7030, z: [3], cls: 'street' },
    { name: 'Calle de Alcalá', lat: 40.4196, lon: -3.6952, z: [3], cls: 'street' },
    { name: 'Paseo del Prado', lat: 40.4150, lon: -3.6938, z: [3], cls: 'street' },
    { name: 'Paseo de Recoletos', lat: 40.4228, lon: -3.6917, z: [3], cls: 'street' },
    { name: 'Puerta de Alcalá', lat: 40.4201, lon: -3.6887, z: [3], cls: 'street' },
    { name: 'Calle de María de Molina', lat: 40.4372, lon: -3.6835, z: [3], cls: 'street' },
    { name: 'Río Jarama', lat: 40.3050, lon: -3.5330, z: [2, 3], cls: 'park' }
  ];

  // --- The views the buttons under the map jump to: the stops each one frames.
  //     min = the narrowest the view gets, in map units (1 unit is about 28 m).
  //     card = whose details show under the map: a stop, or 'vuelta' for the way back as a whole.
  const VIEWS = {
    todo: { stops: ['iglesia', 'cibeles', 'avamerica', 'ciguena'] },
    iglesia: { stops: ['iglesia', 'cibeles'], card: 'iglesia' },
    salida: { stops: ['iglesia', 'cibeles'], card: 'cibeles' },
    convite: { stops: ['ciguena'], min: 90, card: 'ciguena' },
    vuelta: { stops: ['cibeles', 'avamerica'], card: 'vuelta' }
  };
  const VIEW_OF_STOP = { iglesia: 'iglesia', cibeles: 'salida', ciguena: 'convite' };

  let svg = null;
  let W = 975, H = 960, geo = null;
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
    const M = 150;     // how far past the drawn area the view may go (it fades into the paper there)
    const cx = view.x + view.w / 2, cy = view.y + view.w * ratio / 2;
    view.w = Math.min(W + 2 * M, Math.max(7, view.w));
    const h = view.w * ratio;
    view.x = cx - view.w / 2;       // a width that had to be cut keeps its centre
    view.y = cy - h / 2;
    view.x = Math.min(W + M - view.w, Math.max(-M, view.x));
    // a tall frame can show more than the drawn height: then the map sits in the middle
    view.y = h >= H + 2 * M ? (H - h) / 2 : Math.min(H + M - h, Math.max(-M, view.y));
    svg.setAttribute('viewBox', view.x.toFixed(2) + ' ' + view.y.toFixed(2) + ' ' + view.w.toFixed(2) + ' ' + h.toFixed(2));
    const u = view.w / f.w;                       // map units per screen pixel
    svg.style.setProperty('--u', u.toFixed(5));
    const z = u > 0.55 ? 1 : (u > 0.115 ? 2 : 3);
    if (svg.getAttribute('data-z') !== String(z)) svg.setAttribute('data-z', z);
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

  // The view that frames a list of stops, with room for their drawings.
  function viewFor(v) {
    const ids = v.stops;
    const f = frameSize();
    const pts = STOPS.filter(function (s) { return ids.indexOf(s.id) !== -1; }).map(function (s) { return project(s.lat, s.lon); });
    if (!pts.length) return null;
    const xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    const x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    const y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const padX = 88, padTop = 128, padBottom = 126;     // screen pixels kept free around the stops
    const availW = Math.max(60, f.w - padX * 2), availH = Math.max(60, f.h - padTop - padBottom);
    const u = Math.max((x1 - x0) / availW, (y1 - y0) / availH, (v.min || 11) / f.w);
    const w = u * f.w;
    return {
      w: w,
      x: (x0 + x1) / 2 - w / 2,
      y: (y0 + y1) / 2 - (padTop + availH / 2) * u
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
      const g = pinned(over, project(pl.lat, pl.lon), 'm-name m-name-' + pl.cls + ' ' + pl.z.map(function (z) { return 'on' + z; }).join(' '));
      el('text', { 'text-anchor': 'middle' }, g).textContent = pl.name;
    });

    const defs = el('defs', {}, over);
    el('circle', { r: 21 }, el('clipPath', { id: 'm-clip' }, defs));

    STOPS.forEach(function (s) {
      const g = pinned(over, project(s.lat, s.lon), 'm-stop' + (isOn(s.id) ? ' is-on' : ''));
      g.setAttribute('data-stop', s.id);
      g.setAttribute('role', 'button');
      g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', t('map.' + s.id + '.name'));
      el('line', { x1: 0, y1: 0, x2: s.dx, y2: s.dy, 'class': 'm-stop-stem' }, g);
      el('circle', { r: 3.5, 'class': 'm-stop-dot' }, g);
      const b = el('g', { transform: 'translate(' + s.dx + ' ' + s.dy + ')' }, g);
      el('circle', { r: 24, 'class': 'm-stop-badge' }, b);
      const img = el('image', { href: s.art, x: -21, y: -21, width: 42, height: 42, preserveAspectRatio: 'xMidYMid slice', 'clip-path': 'url(#m-clip)' }, b);
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', s.art);
      const name = t('map.' + s.id + '.short');
      // an unseen box behind the name, so the name is as easy to tap as the drawing
      el('rect', { x: -name.length * 4.6 - 8, y: s.below ? 24 : -50, width: name.length * 9.2 + 16, height: 28, 'class': 'm-stop-hit' }, b);
      const label = el('text', { y: s.below ? 41 : -31, 'text-anchor': 'middle', 'class': 'm-stop-label' }, b);
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
    if (s) {
      const href = s.href || ('https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lon);
      html += '<a class="text-link" target="_blank" rel="noopener noreferrer" href="' + esc(href) + '">' + esc(t('map.open')) + '</a>';
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
      const target = viewFor({ stops: [id] });
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
    resizeT = setTimeout(apply, 80);
  });

  document.addEventListener('langchange', function () {
    if (!svg) return;
    drawOverlay();
    renderCard();
    const btn = document.getElementById('mapa-expand');
    if (btn) btn.textContent = t(isOpen() ? 'map.close' : 'map.expand');
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
