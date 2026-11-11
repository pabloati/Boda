// Site editor: branch, texts, colours, fonts, photos, sections, history, "Ver en mi móvil" and
// "Publicar", on top of the flower editor (_dev/flores.html exposes window.ED). Everything previews live in the page; "Guardar" sends the
// changes to _dev/serve.py, which writes them into the chosen branch's worktree and commits them
// (see _dev/editor_api.py). Not published: GitHub Pages skips _dev/.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const ED = window.ED;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const SECTIONS = ['intro', 'countdown', 'locations', 'timeline', 'rsvp', 'gifts', 'playlist', 'social', 'footer'];
  const LABELS = { hero: 'Portada', intro: 'Cita', countdown: 'Cuenta atrás', locations: 'Dónde y cuándo', timeline: 'Hoja de ruta', rsvp: 'Confirmación', gifts: 'Regalo', playlist: 'Playlist', social: 'Fotos', footer: 'Pie', envelope: 'Sobre', other: 'Otros' };
  const TOKENS = [['paper', 'Fondo'], ['paper-deep', 'Secciones alternas'], ['paper-line', 'Líneas y bordes'], ['olive', 'Bandas verdes'], ['olive-deep', 'Verde oscuro'], ['olive-soft', 'Verde suave'], ['terracotta', 'Botón y enlaces'], ['terracotta-deep', 'Botón (al pasar)'], ['ink', 'Texto'], ['ink-soft', 'Texto secundario'], ['ink-faint', 'Texto tenue'], ['cream-text', 'Texto sobre verde'], ['gold', 'Dorado']];
  const PHOTOS = [
    { slot: 'hero-mobile', path: 'assets/hero-mobile.jpg', label: 'Portada en el móvil', max: 1600, sel: '.hero-photo source, .hero-photo img' },
    { slot: 'hero-desktop', path: 'assets/hero-desktop.jpg', label: 'Portada en el ordenador', max: 2200, sel: '.hero-photo img' },
    { slot: 'foto-envio', path: 'assets/foto-envio.jpg', label: 'Foto del «Enviando…»', max: 900, sel: '.rsvp-modal-photo img' },
  ];

  // ---------- palettes ----------
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  // a flower palette (paper, alt, green, deep, lead, ink) → the site's tokens
  function fromFlower(c) {
    return { paper: c.paper, 'paper-deep': c.alt, 'paper-line': mix(c.alt, c.ink, 0.12), olive: c.green, 'olive-deep': c.deep,
      'olive-soft': mix(c.green, c.paper, 0.55), terracotta: c.lead, 'terracotta-deep': mix(c.lead, '#000000', 0.2), ink: c.ink,
      'ink-soft': mix(c.ink, c.paper, 0.35), 'ink-faint': mix(c.ink, c.paper, 0.55), 'cream-text': mix(c.paper, '#ffffff', 0.3) };
  }
  const PRESETS = [
    { name: 'La de ahora (oliva y terracota)', tokens: {} },
    { name: 'Primavera: salvia, azul y rosa', tokens: { paper: '#f6f4ef', 'paper-deep': '#e3eaf0', 'paper-line': '#cfd7da', olive: '#7e9479', 'olive-deep': '#5f7563', 'olive-soft': '#c3cfbf', terracotta: '#b4566c', 'terracotta-deep': '#934257', ink: '#33404d', 'ink-soft': '#5f6b78', 'ink-faint': '#8f98a3', 'cream-text': '#f7f5f0' } },
    { name: 'Tulipán rosa y prímula', tokens: fromFlower({ paper: '#fbf8f1', alt: '#f6e6ea', green: '#6b8a4f', deep: '#43592f', lead: '#a15885', ink: '#2f3127' }) },
    { name: 'Azucenas y almendro', tokens: fromFlower({ paper: '#fcf9f4', alt: '#f3e3e7', green: '#7c9670', deep: '#4f6645', lead: '#c1326b', ink: '#352a30' }) },
    { name: 'Tulipán morado y mimosa', tokens: fromFlower({ paper: '#faf8f0', alt: '#ece7f3', green: '#5f8452', deep: '#355636', lead: '#7d3884', ink: '#262a24' }) },
    { name: 'Crisantemo y tulipán melocotón', tokens: fromFlower({ paper: '#fbf6ef', alt: '#f2e6dc', green: '#7a8b5a', deep: '#4c5a35', lead: '#c12158', ink: '#33291f' }) },
    { name: 'Lirio coral y prímula lila', tokens: fromFlower({ paper: '#fbf7f2', alt: '#ede8f4', green: '#6f8f6a', deep: '#476147', lead: '#d13100', ink: '#2f2a2a' }) },
  ];

  // ---------- state ----------
  let branch = null, texts = {}, textEdits = {}, look = blankLook(), savedLook = '', photos = {}, selText = null, tab = 'flores', saving = false;
  let FONTS = {}, FALLBACK = {};   // the curated fonts per role, from the server (editor_api.FONTS)
  function blankLook() { return { tokens: {}, frame: {}, order: [], hidden: [], text: {}, palettes: [], fonts: {}, bg: {}, space: {} }; }
  let palEdit = null;   // the palette being built in the Colores tab: { idx, name, before }
  let head = null;           // the branch's commit when it was opened (or last saved here): the server refuses a save on top of a newer one
  let remoteHead = null, remoteHidden = null;   // a newer commit seen by the poll, and the one whose banner was closed
  let conflict = null;       // { head } after a save answered 409: the props panel offers reload or save anyway
  let hist = null, histPick = null, histErr = '';   // Historial tab: commits of the branch, the one picked to go back to
  let sitePending = null, draftHold = false, draftOffered = false, draftTimer = 0;   // drafts: see offerDraft()
  const lookDirty = () => JSON.stringify(look) !== savedLook;
  const dirtyParts = () => [ED.floresDirty() && 'flores', Object.keys(textEdits).length && 'textos', lookDirty() && 'colores/fuentes/secciones/textos movidos', Object.keys(photos).length && 'fotos'].filter(Boolean);

  // stick: keep this message (the result of a save or a go-back) while nothing is unsaved, so the
  // page reload that follows (which calls status() again) does not replace it with "Sin cambios"
  let note = null;
  function status(msg, bad, stick) {
    const parts = dirtyParts(), el = $('status');
    if (msg) note = stick ? { msg, bad } : null;
    else if (note && !parts.length) { msg = note.msg; bad = note.bad; }
    else note = null;
    el.textContent = msg || (parts.length ? 'Sin guardar: ' + parts.join(', ') : 'Sin cambios');
    el.classList.toggle('dirty', !!bad || (!msg && parts.length > 0));
    scheduleDraft(); renderRemote();
  }
  const sameHead = (a, b) => !!a && !!b && (a.startsWith(b) || b.startsWith(a));

  // ---------- drafts: texts and look kept in localStorage per branch, offered back on open ----------
  // The flowers keep their own ('flores-draft:<branch>', in flores.html); one banner offers both.
  // While the banner waits for an answer, neither draft is overwritten. Photos are not drafted.
  const draftKey = () => 'site-draft:' + branch;
  function scheduleDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(writeDraft, 400); }
  function writeDraft() {
    if (!branch || draftHold) return;
    try {
      if (Object.keys(textEdits).length || lookDirty()) localStorage.setItem(draftKey(), JSON.stringify({ texts: textEdits, look, at: Date.now() }));
      else localStorage.removeItem(draftKey());
    } catch (e) {}
  }
  function dropSiteDraft() { clearTimeout(draftTimer); try { localStorage.removeItem(draftKey()); } catch (e) {} }
  // read on open, before anything can overwrite it; kept only if it differs from what the branch has
  function readSiteDraft() {
    let d = null; try { d = JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch (e) {}
    if (!d || typeof d !== 'object') return null;
    const t = {};
    Object.entries(d.texts || {}).forEach(([k, v]) => {
      if (!texts[k] || !v || typeof v !== 'object') return;
      const es = String(v.es ?? texts[k].es), en = String(v.en ?? texts[k].en);
      if (es !== texts[k].es || en !== texts[k].en) t[k] = { es, en };
    });
    const l = Object.assign(blankLook(), d.look && typeof d.look === 'object' ? d.look : {});
    return Object.keys(t).length || JSON.stringify(l) !== savedLook ? { texts: t, look: l } : null;
  }
  // called by flores.html once the page (and the flower layout) has loaded
  function offerDraft() {
    if (draftOffered || !branch) return;
    draftOffered = true;
    const fl = ED.floresDraft(), bn = $('banner');
    if ((!sitePending && !fl) || !bn) { draftHold = false; sitePending = null; return; }
    bn.classList.add('show');
    const done = () => { bn.classList.remove('show'); draftHold = false; sitePending = null; status(); };
    $('bRestore').onclick = () => {
      if (sitePending) {
        textEdits = sitePending.texts; look = sitePending.look;
        ED.setTextPos(look.text); applyTexts(); applyLook(); ED.renderAll();
      }
      ED.restoreFloresDraft();   // after the look: it mirrors the text positions back into it
      palEdit = null; done(); renderTab(); drawProps($('props'));
    };
    $('bDrop').onclick = () => { dropSiteDraft(); ED.dropFloresDraft(); done(); };
  }
  function hideDraftBanner() { const bn = $('banner'); if (bn) bn.classList.remove('show'); }

  // ---------- live preview: the same CSS the server writes into css/editor.css ----------
  // A moved text keeps its place in the flow; only where it is painted changes (transform), and a
  // layer puts it under or over the plates (z-index against .flor -1 and .flor--front 2).
  const TEXT_Z = { back: -2, front: 3 };
  const tsel = k => k.startsWith('#') ? 'main ' + k : `main [data-i18n="${k}"]`;
  function tdecl(p, reset) {
    const d = [];
    if (p.x || p.y) d.push(`transform: translate(${p.x || 0}px, ${p.y || 0}px)`); else if (reset) d.push('transform: none');
    if (TEXT_Z[p.z] != null) d.push('position: relative', 'z-index: ' + TEXT_Z[p.z]); else if (reset) d.push('z-index: auto');
    return d;
  }
  // a text's own style: size (px), colour, alignment, font role. Its own rules under #main-content
  // (an id beats styles.css's class rules); an aligned script heading (an inline-block as wide as
  // its text) becomes a block of that width placed by its margins. Same as _trules in editor_api.py.
  const tkey = k => k.startsWith('#') ? k : `[data-i18n="${k}"]`;
  const H_ALIGN = { left: ['0', 'auto'], center: ['auto', 'auto'], right: ['auto', '0'] };
  function trules(k, p) {
    const d = [];
    if (p.size != null) d.push(`font-size: ${Math.round(p.size)}px`);
    if (normHex(p.color)) d.push('color: ' + normHex(p.color));
    if (H_ALIGN[p.align]) d.push('text-align: ' + p.align);
    if (['serif', 'script', 'hand'].includes(p.font)) d.push(`font-family: var(--font-${p.font})`);
    const r = d.length ? [`#main-content ${tkey(k)} { ${d.join('; ')}; }`] : [];
    if (H_ALIGN[p.align]) r.push(`#main-content .h-script${tkey(k)} { display: block; width: fit-content; margin-left: ${H_ALIGN[p.align][0]}; margin-right: ${H_ALIGN[p.align][1]}; }`);
    return r;
  }
  // fonts: {role: family} → the Google Fonts stylesheet and the :root tokens (same as the server)
  const fontSpec = (role, name) => (FONTS[role] || []).find(f => f.name === name);
  function fontsURL(fonts) {
    const fam = Object.entries(fonts || {}).map(([r, n]) => fontSpec(r, n)).filter(Boolean).map(f => 'family=' + f.name.replace(/ /g, '+') + (f.axes ? ':' + f.axes : ''));
    return fam.length ? 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap' : '';
  }
  // Section background and spacing: the same rules as section_css() in editor_api.py.
  // Verde reproduces the olive band of #rsvp (.band-olive, .band-olive p, .band-olive .link-button,
  // .h-script.light and its wash), plus the texts in ON_OLIVE so they stay readable on green.
  // Papel / Papel oscuro undo that cream text on a section that was green (#intro, #rsvp, the footer).
  // Text inside a .paper-panel (the RSVP form, the playlist card) keeps its own colours.
  // The colour rules weigh one id plus one class, so a text's own colour (written after them) wins.
  const BG = { paper: 'var(--paper)', alt: 'var(--paper-deep)', olive: 'var(--olive)' };
  const SPACE = { '-1': 0.6, 0: 1, 1: 1.5 };
  const BG_OPTS = [['paper', 'Papel'], ['alt', 'Papel oscuro'], ['olive', 'Verde']], SPACE_OPTS = [[-1, 'Menos'], [0, 'Normal'], [1, 'Más']];
  const WASH = { light: 'rgba(243, 238, 227, 0.16) 0%, rgba(243, 238, 227, 0) 68%', paper: 'var(--olive-wash) 0%, rgba(142, 145, 102, 0) 68%' };
  const OUT = ':not(.paper-panel *)';
  // texts that turn cream on green (the ones styles.css colours with ink, ink-faint or olive-deep)
  const ON_OLIVE = 'p, h1, h2, h3, h4, li, .h-script, .link-button, .text-link, .section-note, .countdown-number, .countdown-label, .ruta-time, .iban-code, .hashtag-text';
  // vertical padding in styles.css: [top, bottom] on wide screens, then on phones (.section, .intro-band, .footer-section)
  const PAD = s => s === 'intro' ? [[64, 64], [48, 48]] : s === 'footer' ? [[64, 48], [64, 48]] : [[72, 72], [52, 52]];
  function sectionCSS(S, s, bg, space) {
    const css = [];
    if (bg === 'olive') css.push(`${S} { background: var(--olive); color: var(--cream-text); }`,
      `${S} :where(${ON_OLIVE})${OUT} { color: var(--cream-text); }`,
      `${S} .h-script::before { background: radial-gradient(ellipse at 50% 60%, ${WASH.light}); }`);
    else if (BG[bg]) css.push(`${S} { background: ${BG[bg]}; color: var(--ink); }`,
      `${S}:where(.band-olive, .intro-band) :where(p)${OUT} { color: var(--ink-soft); }`,
      `${S} :where(.h-script.light) { color: var(--ink); }`,
      `${S} .h-script.light::before { background: radial-gradient(ellipse at 50% 60%, ${WASH.paper}); }`,
      `${S}:where(.band-olive) :where(.link-button)${OUT} { color: var(--terracotta); }`);
    if (space && (space[0] || space[1])) {
      const decl = pad => ['top', 'bottom'].map((side, i) => space[i] ? `padding-${side}: ${Math.round(pad[i] * SPACE[space[i]])}px` : '').filter(Boolean).join('; ');
      css.push(`${S} { ${decl(PAD(s)[0])}; }`, `@media (max-width: 768px) { ${S} { ${decl(PAD(s)[1])}; } }`);
    }
    return css;
  }
  function lookCSS(l) {
    const sel = s => s === 'footer' ? '.footer-section' : '#' + s, css = [];
    const fo = Object.entries(l.fonts || {}).filter(([r, n]) => fontSpec(r, n));
    if (fo.length) {
      const sc = l.fonts.script && fontSpec('script', l.fonts.script);
      css.push(':root {' + fo.map(([r, n]) => `--font-${r}: '${n}', ${FALLBACK[r] || 'serif'};`).join(' ') + (sc ? ` --font-script-scale: ${sc.scale};` : '') + '}');
    }
    const t = Object.entries(l.tokens);
    if (t.length) css.push(':root {' + t.map(([k, v]) => `--${k}: ${v};`).join(' ') + '}');
    const f = l.frame;
    const hp = ([x, y]) => `.hero-photo img { object-position: ${x}% ${y}%; } .card-back { background-position: ${x}% ${y}%; }`;
    if (f['hero-desktop']) css.push(`@media (min-width: 769px) and (orientation: landscape) { ${hp(f['hero-desktop'])} }`);
    if (f['hero-mobile']) css.push(`@media (max-width: 768px), (orientation: portrait) { ${hp(f['hero-mobile'])} }`);
    if (f['foto-envio']) css.push(`.rsvp-modal-photo img { object-position: ${f['foto-envio'][0]}% ${f['foto-envio'][1]}%; }`);
    if (l.order.length) { css.push('#main-content { display: flex; flex-direction: column; } #hero { order: -1; }'); l.order.forEach((s, i) => css.push(`${sel(s)} { order: ${i + 1}; }`)); }
    if (l.hidden.length) css.push(l.hidden.map(sel).join(', ') + ' { display: none !important; }');
    SECTIONS.forEach(s => css.push(...sectionCSS(sel(s), s, (l.bg || {})[s], (l.space || {})[s])));
    Object.entries(l.text || {}).forEach(([k, p]) => {
      const base = tdecl(p, false);
      if (base.length) css.push(`${tsel(k)} { ${base.join('; ')}; }`);
      if (p.d) css.push(`@media (min-width: 769px) { ${tsel(k)} { ${tdecl(p.d, true).join('; ')}; } }`);
      if (!p.d) css.push(...trules(k, p));
      else [['(max-width: 768px)', p], ['(min-width: 769px)', p.d]].forEach(([mq, q]) => { const r = trules(k, q); if (r.length) css.push(`@media ${mq} { ${r.join(' ')} }`); });
    });
    return css.join('\n');
  }
  function applyLook() {
    const d = ED.doc; if (!d) return;
    let st = d.getElementById('ed-look');
    if (!st) { st = d.createElement('style'); st.id = 'ed-look'; d.head.appendChild(st); }
    st.textContent = lookCSS(look);
    // the branch's saved css/editor.css is off in the preview: #ed-look mirrors it, so a choice
    // undone here (a font, a text style, a move) also disappears from the page before saving
    d.querySelectorAll('link[rel=stylesheet][href*="css/editor.css"]').forEach(l => { l.disabled = true; });
    const url = fontsURL(look.fonts);   // the chosen fonts' stylesheet, before the look's <style>
    let fl = d.getElementById('ed-fonts');
    if (url && !fl) { fl = d.createElement('link'); fl.id = 'ed-fonts'; fl.rel = 'stylesheet'; d.head.insertBefore(fl, st); }
    if (fl) { if (url) { if (fl.getAttribute('href') !== url) fl.setAttribute('href', url); } else fl.remove(); }
    const olive = look.tokens.olive;
    if (olive) d.documentElement.style.setProperty('--olive-wash', `rgba(${hex(olive).join(', ')}, 0.16)`); else d.documentElement.style.removeProperty('--olive-wash');
    status();
  }
  function applyTexts() {
    const d = ED.doc; if (!d) return;
    Object.entries(textEdits).forEach(([k, v]) => d.querySelectorAll(`[data-i18n="${k}"]`).forEach(el => { if (v.es != null) el.innerHTML = v.es; }));
  }
  function applyPhotos() {
    const d = ED.doc; if (!d) return;
    PHOTOS.forEach(P => {
      if (!photos[P.slot]) return;
      d.querySelectorAll('img, source').forEach(el => {
        ['src', 'srcset'].forEach(a => { const v = el.getAttribute(a); if (v && v.split('?')[0].endsWith(P.path)) el.setAttribute(a, photos[P.slot]); });
      });
    });
  }

  // ---------- branch ----------
  async function loadBranches(pick) {
    const list = await (await fetch('/_dev/api/branches', { cache: 'no-store' })).json();
    $('branch').innerHTML = list.map(b => `<option value="${esc(b.branch)}">${esc(b.branch)}${b.branch === 'main' ? ' (web publicada)' : ''}</option>`).join('') + '<option value="__new">＋ Nueva rama…</option>';
    const want = pick || (() => { try { return localStorage.getItem('ed-branch'); } catch (e) { return null; } })();
    const b = list.find(x => x.branch === want) ? want : (list.find(x => x.branch === 'editor') ? 'editor' : list[0].branch);
    $('branch').value = b;
    await openBranch(b);
  }
  // force: open even with unsaved changes, which are lost (used by "Recargar y perder mis cambios")
  async function openBranch(b, force) {
    if (!force && branch && dirtyParts().length) { $('branch').value = branch; status('Guarda o descarta los cambios antes de cambiar de rama', true); return; }
    const hold = draftHold; draftHold = true; clearTimeout(draftTimer);   // nothing is drafted while the branch is (re)loading
    status('Abriendo ' + b + '…');
    let r, st;
    try { r = await fetch('/_dev/api/state?branch=' + encodeURIComponent(b), { cache: 'no-store' }); st = await r.json(); } catch (e) { r = { ok: false }; st = {}; }
    if (!r.ok) { draftHold = hold; status(st.error || 'No se pudo abrir la rama', true); $('branch').value = branch || ''; return; }
    if (branch !== b) histPick = null;
    resetHistory();
    endEdit();
    branch = b; pub = null; closeShare(); $('branch').value = b; try { localStorage.setItem('ed-branch', b); } catch (e) {}
    texts = st.texts || {}; textEdits = {}; photos = {}; selText = null;
    FONTS = st.fonts || {}; FALLBACK = st.font_fallback || {};
    look = Object.assign(blankLook(), st.look || {}); savedLook = JSON.stringify(look);
    head = st.head || null; remoteHead = null; remoteHidden = null; conflict = null; histErr = '';
    hideDraftBanner(); sitePending = readSiteDraft(); draftHold = true; draftOffered = false;
    ED.open(st.url, b); ED.setTextPos(look.text);
    palEdit = null;
    renderTab(); status();
    if (tab !== 'flores') panel();   // the flower editor redraws its own panel once the branch loads
  }
  function newBranchForm(p) {
    p.innerHTML = `<h2>Nueva rama</h2><p class="hint">Una rama es una copia de la web en la que probar cambios sin tocar la publicada. Se crea a partir de la rama actual (${esc(branch)}).</p>
      <div class="row"><label>Nombre</label><input type="text" id="nbName" placeholder="p. ej. colores-maria" style="flex:1;min-width:0;padding:4px 6px;border:1px solid var(--line);border-radius:5px"></div>
      <div class="btns"><button id="nbGo" class="primary">Crear y abrir</button><button id="nbNo">Cancelar</button></div><p id="nbErr" class="note" hidden></p>`;
    $('nbName').focus();
    $('nbNo').onclick = () => { $('branch').value = branch; drawProps(p); };
    $('nbGo').onclick = async () => {
      const name = $('nbName').value.trim().replace(/\s+/g, '-');
      const r = await fetch('/_dev/api/branch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, base: branch }) });
      const j = await r.json();
      if (!r.ok) { $('nbErr').hidden = false; $('nbErr').textContent = j.error || 'No se pudo crear'; return; }
      await loadBranches(name);
    };
  }

  // ---------- texts ----------
  const toEdit = h => h.replace(/\s*\n\s*/g, ' ').replace(/<br\s*\/?>\s*/gi, '\n').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  const fromEdit = t => t.replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;').replace(/\r?\n/g, '<br>');
  const plain = h => toEdit(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const norm = h => fromEdit(toEdit(h || '')).trim();   // a text as the panel would write it back: same text, same form
  // The HTML of a text written on the page, kept to the tags clean_html() allows on the server
  // (br, span with class, a with a safe href, strong, em, b, i). The rest keep only their text;
  // a block the browser may slip in (div, p) becomes a line break.
  const KEEP = { br: [], span: ['class'], a: ['href', 'target', 'rel'], strong: [], em: [], b: [], i: [] };
  function cleanNode(n) {
    let out = '';
    n.childNodes.forEach(c => {
      if (c.nodeType === 3) { out += c.data.replace(/\u00a0/g, ' ').replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])); return; }
      if (c.nodeType !== 1) return;
      const t = c.tagName.toLowerCase();
      if (t === 'script' || t === 'style') return;
      if (t === 'br') { out += '<br>'; return; }
      const inner = cleanNode(c);
      if (t === 'div' || t === 'p') { out += (out && !/<br>$/.test(out) ? '<br>' : '') + inner; return; }
      if (!KEEP[t]) { out += inner; return; }
      const attrs = KEEP[t].map(a => {
        let v = c.getAttribute(a);
        if (a === 'class' && v != null) v = v.split(/\s+/).filter(x => x && !x.startsWith('ed-')).join(' ');   // not the editor's own marks
        if (v == null || (a === 'class' && !v) || (a === 'href' && !/^(#|https?:\/\/|mailto:|tel:)/.test(v))) return '';
        return ` ${a}="${esc(v)}"`;
      }).join('');
      if (t === 'span' && !attrs) { out += inner; return; }   // a bare span (the browser adds some while typing) says nothing
      out += `<${t}${attrs}>${inner}</${t}>`;
    });
    return out;
  }
  // innerHTML of a text being written → the Spanish to save (no trailing line breaks: they show nothing)
  const fromPage = el => norm(cleanNode(el)).replace(/(\s*<br>)+$/, '').trim();
  function textSection(key) {
    const el = ED.doc && ED.doc.querySelector(`main [data-i18n="${key}"]`) || (ED.doc && ED.doc.querySelector(`[data-i18n="${key}"]`));
    if (!el) return 'other';
    if (el.closest('#envelope-overlay')) return 'envelope';
    const s = el.closest('main > *'); return s ? (s.id || (s.classList.contains('footer-section') ? 'footer' : 'other')) : 'other';
  }
  function renderTexts() {
    const box = $('tab-textos'), q = (box.querySelector('.search') || {}).value || '';
    const groups = {};
    Object.keys(texts).forEach(k => { const sec = textSection(k); (groups[sec] = groups[sec] || []).push(k); });
    const order = ['hero', ...SECTIONS, 'envelope', 'other'];
    const ql = q.toLowerCase();
    box.innerHTML = `<h2>Textos</h2><input class="search" placeholder="Buscar texto…" value="${esc(q)}">
      <p class="hint">También puedes hacer clic en un texto de la web.</p>` +
      order.filter(g => groups[g]).map(g => {
        const ks = groups[g].filter(k => !ql || plain(cur(k).es).toLowerCase().includes(ql) || plain(cur(k).en).toLowerCase().includes(ql));
        return ks.length ? `<div class="pl-sec">${LABELS[g] || g}</div>` + ks.map(k => `<button class="t-item${k === selText ? ' on' : ''}${textEdits[k] ? ' mod' : ''}" data-k="${esc(k)}" title="${esc(plain(cur(k).es))}">${esc(plain(cur(k).es) || k)}</button>`).join('') : '';
      }).join('');
    const s = box.querySelector('.search');
    s.oninput = () => { const pos = s.selectionStart; renderTexts(); const n = $('tab-textos').querySelector('.search'); n.focus(); n.setSelectionRange(pos, pos); };
    box.querySelectorAll('.t-item').forEach(b => b.onclick = () => pickText(b.dataset.k, true));
  }
  const cur = k => Object.assign({}, texts[k], textEdits[k] || {});
  // A text changed (in the panel or on the page): keep textEdits, the page and the list in step.
  // skip: the element being written on, which already shows it (rewriting it would lose the caret).
  function setText(k, es, en, skip) {
    const o = texts[k];
    if (es === norm(o.es) && en === norm(o.en)) delete textEdits[k]; else textEdits[k] = { es, en };
    if (ED.doc) ED.doc.querySelectorAll(`[data-i18n="${k}"]`).forEach(el => { if (el !== skip) el.innerHTML = es; });
    if (selText === k && $('tUndo')) $('tUndo').disabled = !textEdits[k];
    status();
    const b = $('tab-textos').querySelector(`.t-item[data-k="${CSS.escape(k)}"]`); if (b) { b.classList.toggle('mod', !!textEdits[k]); b.textContent = plain(es) || k; }
  }
  // at: { el, x, y } when the text was clicked on the page: that element becomes writable there
  function pickText(k, scroll, at) {
    if (editing && (editing.k !== k || !at || at.el !== editing.el)) endEdit();
    selText = k; renderTexts(); drawProps($('props'));
    const d = ED.doc; if (!d) return;
    d.querySelectorAll('.ed-tsel').forEach(e => e.classList.remove('ed-tsel'));
    const els = [...d.querySelectorAll(`[data-i18n="${k}"]`)].filter(e => !e.closest('#envelope-overlay'));
    els.forEach(e => e.classList.add('ed-tsel'));
    els.forEach(e => { const det = e.closest('details:not([open])'); if (det && !e.closest('summary')) det.open = true; });   // a text inside the closed IBAN box shows
    if (scroll && els[0]) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (at && els.includes(at.el) && !(editing && editing.el === at.el)) startEdit(at.el, k, at.x, at.y);
  }

  // ---------- writing on the page ----------
  // Only the clicked element is editable. Enter is a line break, a paste is plain text; every
  // keystroke lands in textEdits (and the Spanish box). Esc or a click elsewhere ends it, keeping it.
  let editing = null;   // { el, k, on: listeners }
  // not on the envelope (pickText leaves it out too) nor inside a button or a form control (no caret there)
  const inlineOK = el => !el.closest('#envelope-overlay, button, select, option, textarea, input');
  function startEdit(el, k, x, y) {
    endEdit();
    const d = ED.doc, w = ED.win;
    if (!d || !el.isConnected || !inlineOK(el)) return;
    const lineBreak = () => d.execCommand('insertLineBreak');
    const on = {
      keydown: e => {
        if (e.key === 'Enter') { e.preventDefault(); lineBreak(); }
        else if (e.key === ' ' && el.closest('summary')) { e.preventDefault(); d.execCommand('insertText', false, ' '); }
        else if (e.key === 'Escape') { e.preventDefault(); endEdit(); }
      },
      paste: e => {
        e.preventDefault();
        const t = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').replace(/\r\n?/g, '\n');
        t.split('\n').forEach((line, i) => { if (i) lineBreak(); if (line) d.execCommand('insertText', false, line); });
      },
      drop: e => e.preventDefault(),
      input: () => { if (editing && editing.el === el) inlineInput(); },
      blur: () => { if (editing && editing.el === el) endEdit(); },
    };
    Object.entries(on).forEach(([t, f]) => el.addEventListener(t, f));
    el.setAttribute('contenteditable', 'true');
    editing = { el, k, on };
    el.focus({ preventScroll: true });
    // the caret where she clicked (else at the end)
    let r = null;
    if (x != null && d.caretRangeFromPoint) r = d.caretRangeFromPoint(x, y);
    else if (x != null && d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(x, y); if (p) { r = d.createRange(); r.setStart(p.offsetNode, p.offset); } }
    const inside = !!(r && el.contains(r.startContainer));
    if (!inside) { r = d.createRange(); r.selectNodeContents(el); }
    r.collapse(inside);
    const s = w.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function inlineInput() {
    const { el, k } = editing, es = fromPage(el);
    const en = selText === k && $('tEn') ? fromEdit($('tEn').value) : norm(cur(k).en);
    setText(k, es, en, el);
    if (selText === k && $('tEs')) $('tEs').value = toEdit(es);
  }
  function endEdit() {
    if (!editing) return;
    const { el, k, on } = editing; editing = null;
    Object.entries(on).forEach(([t, f]) => el.removeEventListener(t, f));
    el.removeAttribute('contenteditable');
    if (textEdits[k] && el.isConnected) el.innerHTML = textEdits[k].es;   // show exactly what will be saved
    try { const s = ED.win && ED.win.getSelection(); if (s && s.anchorNode && el.contains(s.anchorNode)) s.removeAllRanges(); } catch (e) {}
  }
  function textProps(p) {
    if (!selText) { p.innerHTML = '<h2>Textos</h2><p class="hint">Haz clic en un texto de la web y escribe encima, o elígelo en la lista. Puedes escribirlo en español y en inglés.</p><p class="hint">Un salto de línea en el cuadro es un salto de línea en la web.</p>' + changesList(); return; }
    const v = cur(selText), mod = !!textEdits[selText];
    const onPage = ED.doc && [...ED.doc.querySelectorAll(`[data-i18n="${selText}"]`)].some(inlineOK);
    p.innerHTML = `<h2>Texto</h2><p class="hint" style="font:11px monospace">${esc(selText)}</p>
      <p class="hint" id="tWhere">${onPage ? 'Escribe directamente sobre la web, o aquí.' : 'Este texto se cambia aquí.'} El inglés, solo aquí.</p>
      <label class="hint">Español</label><textarea id="tEs" rows="4">${esc(toEdit(v.es || ''))}</textarea>
      <label class="hint">Inglés</label><textarea id="tEn" rows="4">${esc(toEdit(v.en || ''))}</textarea>
      ${/<[a-z]/i.test(toEdit(v.es || '')) ? '<p class="hint">Las marcas entre &lt; &gt; dan estilo (por ejemplo, el texto más pequeño entre paréntesis): déjalas si quieres mantenerlo.</p>' : ''}
      <div class="btns"><button id="tUndo"${mod ? '' : ' disabled'}>Deshacer cambios de este texto</button></div>${changesList()}`;
    const upd = () => { endEdit(); setText(selText, fromEdit($('tEs').value), fromEdit($('tEn').value)); };
    $('tEs').oninput = upd; $('tEn').oninput = upd;
    $('tUndo').onclick = () => { endEdit(); const k = selText; delete textEdits[k]; ED.doc && ED.doc.querySelectorAll(`[data-i18n="${k}"]`).forEach(el => { el.innerHTML = texts[k].es; }); renderTexts(); textProps(p); status(); };
  }

  // ---------- colours ----------
  const normHex = v => { let h = String(v || '').trim().replace(/^#/, ''); if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join(''); return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null; };
  const siteVal = k => { const cs = ED.doc ? ED.win.getComputedStyle(ED.doc.documentElement) : null; return normHex(cs && cs.getPropertyValue('--' + k)) || '#000000'; };
  const tokVal = k => normHex(look.tokens[k]) || siteVal(k);
  // colour picker + hex box for one token
  const colourRow = (k, label, v, extra) => `<div class="sw-row"><input type="color" data-t="${k}" value="${v}"><input type="text" class="hex" data-h="${k}" value="${v}" maxlength="7" spellcheck="false" title="Código hex, p. ej. #a8853f"><span style="flex:1">${label}</span>${extra || ''}</div>`;
  // set(k, hex, live): live = while dragging the picker
  function wireColourRows(box, set) {
    box.querySelectorAll('[data-t]').forEach(inp => {
      const hx = box.querySelector(`[data-h="${inp.dataset.t}"]`);
      inp.oninput = () => { hx.value = inp.value; set(inp.dataset.t, inp.value, true); };
      inp.onchange = () => set(inp.dataset.t, inp.value, false);
    });
    box.querySelectorAll('[data-h]').forEach(hx => {
      const inp = box.querySelector(`[data-t="${hx.dataset.h}"]`);
      hx.oninput = () => { const h = normHex(hx.value); hx.classList.toggle('bad', !h); if (h) { inp.value = h; set(hx.dataset.h, h, true); } };
      hx.onchange = () => { const h = normHex(hx.value); if (h) { hx.value = h; hx.classList.remove('bad'); set(hx.dataset.h, h, false); } else { hx.value = inp.value; hx.classList.remove('bad'); } };
    });
  }
  const allPalettes = () => [...PRESETS, ...(look.palettes || []).map(p => Object.assign({ own: true }, p))];
  function renderColours() {
    const box = $('tab-colores');
    const active = allPalettes().findIndex(pr => JSON.stringify(pr.tokens) === JSON.stringify(look.tokens));
    const btn = (pr, i) => {
      const sw = ['paper', 'paper-deep', 'olive', 'olive-deep', 'terracotta', 'ink'].map(k => `<b style="background:${normHex(pr.tokens[k]) || siteVal(k)}"></b>`).join('');
      return `<div class="pal-row"><button class="preset${i === active ? ' on' : ''}" data-p="${i}"><i>${sw}</i>${esc(pr.name)}</button>${pr.own ? `<button data-pe="${i - PRESETS.length}" title="Editar">✎</button><button data-px="${i - PRESETS.length}" title="Borrar" class="danger">✕</button>` : ''}</div>`;
    };
    const all = allPalettes();
    box.innerHTML = `<h2>Paletas</h2>` + all.slice(0, PRESETS.length).map(btn).join('') +
      `<h2 style="margin-top:14px">Mis paletas</h2>` + (look.palettes.length ? all.slice(PRESETS.length).map((pr, i) => btn(pr, i + PRESETS.length)).join('') : '<p class="hint">Ninguna todavía.</p>') +
      `<div class="btns"><button id="palNew"${palEdit ? ' disabled' : ''}>+ Nueva paleta…</button></div>` +
      `<h2 style="margin-top:14px">Cada color</h2><p class="hint">Elige con el selector o escribe el código (#rrggbb).</p>` + TOKENS.map(([k, label]) =>
      colourRow(k, label, tokVal(k), look.tokens[k] ? `<button data-r="${k}" title="Volver al de la web">↺</button>` : '')).join('');
    box.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { if (palEdit) return; look.tokens = Object.assign({}, all[+b.dataset.p].tokens); applyLook(); renderColours(); });
    box.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => startPalette(+b.dataset.pe));
    box.querySelectorAll('[data-px]').forEach(b => b.onclick = () => { const i = +b.dataset.px; if (!confirm('¿Borrar la paleta «' + look.palettes[i].name + '»?')) return; look.palettes.splice(i, 1); applyLook(); renderColours(); });
    $('palNew').onclick = () => startPalette(-1);
    wireColourRows(box, (k, h, live) => { look.tokens[k] = h; applyLook(); if (!live) renderColours(); });
    box.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { delete look.tokens[b.dataset.r]; applyLook(); renderColours(); });
  }
  // A palette of your own: six base colours, the rest derived (then any of them can be tuned).
  // While the form is open, the page shows the palette being built; Cancelar puts the colours back.
  const BASE = [['paper', 'Papel (fondo)'], ['paper-deep', 'Secciones alternas'], ['olive', 'Verde'], ['olive-deep', 'Verde oscuro'], ['terracotta', 'Color principal (botón y enlaces)'], ['ink', 'Tinta (texto)']];
  function startPalette(idx) {
    palEdit = { idx, name: idx >= 0 ? look.palettes[idx].name : '', before: Object.assign({}, look.tokens) };
    if (idx >= 0) look.tokens = Object.assign({}, look.palettes[idx].tokens);
    else TOKENS.forEach(([k]) => { look.tokens[k] = tokVal(k); });
    applyLook(); renderColours(); drawProps($('props'));
  }
  const derive = t => fromFlower({ paper: t.paper, alt: t['paper-deep'], green: t.olive, deep: t['olive-deep'], lead: t.terracotta, ink: t.ink });
  function paletteForm(p) {
    const isNew = palEdit.idx < 0;
    p.innerHTML = `<h2>${isNew ? 'Nueva paleta' : 'Editar paleta'}</h2>
      <div class="row"><label>Nombre</label><input type="text" id="palName" value="${esc(palEdit.name)}" placeholder="p. ej. Lavanda y oliva" style="flex:1;min-width:0;padding:4px 6px;border:1px solid var(--line);border-radius:5px"></div>
      <h2 style="margin-top:12px">Colores base</h2>
      <p class="hint">Elige estos seis y pulsa «Derivar el resto»: el editor calcula líneas, texto secundario, verde suave y el botón al pasar. Después puedes afinar cualquiera abajo. La web cambia al momento.</p>
      <div id="palBase">${BASE.map(([k, l]) => colourRow(k, l, tokVal(k))).join('')}</div>
      <div class="btns"><button id="palDerive">Derivar el resto</button></div>
      <h2 style="margin-top:12px">Todos los colores</h2>
      <div id="palAll">${TOKENS.filter(([k]) => !BASE.some(b => b[0] === k)).map(([k, l]) => colourRow(k, l, tokVal(k))).join('')}</div>
      <div class="btns" style="margin-top:8px"><button id="palSave" class="primary">${isNew ? 'Guardar paleta' : 'Guardar cambios'}</button><button id="palCancel">Cancelar</button></div>
      <p class="hint">La paleta se guarda con la rama al pulsar «Guardar» arriba; la ven todos los que abran esta rama.</p>`;
    const set = (k, h) => { look.tokens[k] = h; applyLook(); };
    wireColourRows(p, set);
    $('palName').oninput = () => { palEdit.name = $('palName').value; };
    $('palDerive').onclick = () => { Object.assign(look.tokens, derive(look.tokens)); applyLook(); paletteForm(p); };
    $('palCancel').onclick = () => { look.tokens = palEdit.before; palEdit = null; applyLook(); renderColours(); drawProps($('props')); };
    $('palSave').onclick = () => {
      const name = palEdit.name.trim() || ('Paleta ' + (look.palettes.length + 1));
      const pal = { name, tokens: Object.assign({}, look.tokens) };
      if (palEdit.idx >= 0) look.palettes[palEdit.idx] = pal; else look.palettes.push(pal);
      palEdit = null; applyLook(); renderColours(); drawProps($('props'));
    };
  }

  // ---------- fonts ----------
  // Three roles, as in styles.css: --font-serif (all text), --font-script (headings), --font-hand
  // (handwritten labels). The first of each list is the site's own: picking it clears the choice.
  const ROLES = [['serif', 'Texto', 'Todo el texto de la web.'], ['script', 'Títulos', 'Los títulos con letra de pluma.'], ['hand', 'Manuscrita', 'Las etiquetas escritas a mano.']];
  function editorFonts() {   // the editor page loads every listed font once, so each name shows in its own face
    if (document.getElementById('ed-font-names')) return;
    const fam = Object.values(FONTS).flat().map(f => 'family=' + f.name.replace(/ /g, '+'));
    if (!fam.length) return;
    const l = document.createElement('link'); l.id = 'ed-font-names'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + fam.join('&') + '&display=swap'; document.head.appendChild(l);
  }
  function renderFonts() {
    const box = $('tab-fuentes');
    if (!box) return;
    if (!Object.keys(FONTS).length) { box.innerHTML = '<h2>Fuentes</h2><p class="hint">El servidor del editor no tiene la lista de fuentes: reinícialo.</p>'; return; }
    editorFonts();
    const fonts = look.fonts || {};
    box.innerHTML = '<h2>Fuentes</h2><p class="hint">Todas son Google Fonts gratuitas: la web las descarga de Google al abrirse.</p>' + ROLES.map(([r, label, help]) => {
      const list = FONTS[r] || [], cur = fonts[r] || (list[0] && list[0].name);
      return `<div class="pl-sec">${label}</div><p class="hint" style="margin:2px 0 4px">${help}</p>` + list.map((f, i) =>
        `<button class="font-row${f.name === cur ? ' on' : ''}" data-fr="${r}" data-fn="${esc(f.name)}" title="${esc(f.name)}"><span style="font-family:'${esc(f.name)}', ${r === 'serif' ? 'serif' : 'cursive'}${r === 'script' ? ';font-size:' + Math.round(26 * (f.scale || 1)) + 'px' : ''}">${esc(f.name)}</span>${i ? '' : '<em>la de la web</em>'}</button>`).join('');
    }).join('') + `<div class="btns" style="margin-top:10px"><button id="fontReset"${Object.keys(fonts).length ? '' : ' disabled'}>Las de la web</button></div>`;
    box.querySelectorAll('[data-fr]').forEach(b => b.onclick = () => {
      const r = b.dataset.fr, n = b.dataset.fn, first = (FONTS[r] || [])[0];
      look.fonts = Object.assign({}, look.fonts);
      if (first && first.name === n) delete look.fonts[r]; else look.fonts[r] = n;
      applyLook(); renderFonts(); if (ED.renderAll) setTimeout(ED.renderAll, 300);   // the boxes follow the new text sizes
    });
    $('fontReset').onclick = () => { look.fonts = {}; applyLook(); renderFonts(); };
  }

  // ---------- photos ----------
  function framePos(P) {
    if (look.frame[P.slot]) return look.frame[P.slot];
    const img = ED.doc && ED.doc.querySelector(P.slot === 'foto-envio' ? '.rsvp-modal-photo img' : '.hero-photo img');
    const pos = img ? ED.win.getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v)) : [50, 50];
    return [isNaN(pos[0]) ? 50 : pos[0], isNaN(pos[1]) ? 50 : pos[1]];
  }
  function renderPhotos() {
    const box = $('tab-fotos'), t = Date.now();
    box.innerHTML = '<h2>Fotos</h2><p class="hint">Arrastra una foto encima o pulsa «Cambiar». Los deslizadores eligen qué parte se ve cuando la pantalla la recorta.</p>' + PHOTOS.map(P => {
      const [x, y] = framePos(P);
      return `<div class="ph-slot" data-s="${P.slot}"><b>${P.label}</b>${photos[P.slot] ? ' <em class="hint">(nueva, sin guardar)</em>' : ''}
        <img src="${photos[P.slot] || ED.base + P.path + '?t=' + t}" alt="">
        <div class="btns"><label class="btn-file"><input type="file" accept="image/*" hidden> <span class="fake-btn">Cambiar</span></label>${photos[P.slot] ? '<button data-u>Quitar la nueva</button>' : ''}</div>
        <div class="row"><label>Horizontal</label><input type="range" min="0" max="100" value="${x}" data-ax="0"></div>
        <div class="row"><label>Vertical</label><input type="range" min="0" max="100" value="${y}" data-ax="1"></div></div>`;
    }).join('');
    box.querySelectorAll('.ph-slot').forEach(el => {
      const P = PHOTOS.find(q => q.slot === el.dataset.s), file = el.querySelector('input[type=file]');
      el.querySelector('.fake-btn').onclick = () => file.click();
      file.onchange = () => file.files[0] && takePhoto(P, file.files[0]);
      el.ondragover = e => { e.preventDefault(); el.classList.add('drop'); };
      el.ondragleave = () => el.classList.remove('drop');
      el.ondrop = e => { e.preventDefault(); el.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) takePhoto(P, f); };
      const u = el.querySelector('[data-u]'); if (u) u.onclick = () => { delete photos[P.slot]; ED.reloadFrame(); renderPhotos(); status(); };
      el.querySelectorAll('[data-ax]').forEach(r => r.oninput = () => {
        const pos = framePos(P).slice(); pos[+r.dataset.ax] = +r.value; look.frame[P.slot] = pos; applyLook();
      });
    });
  }
  // Resize in the browser (longest side P.max) and send as JPEG.
  function takePhoto(P, file) {
    if (!/^image\//.test(file.type)) { status('Eso no es una imagen', true); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const s = Math.min(1, P.max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      photos[P.slot] = c.toDataURL('image/jpeg', 0.84); URL.revokeObjectURL(url);
      applyPhotos(); renderPhotos(); status();
    };
    img.onerror = () => status('No se pudo leer la imagen', true);
    img.src = url;
  }

  // ---------- sections ----------
  // every section on the page: the saved order first, then any it does not mention, in page order
  function currentOrder() {
    const onPage = SECTIONS.filter(s => ED.doc && (s === 'footer' ? ED.doc.querySelector('.footer-section') : ED.doc.getElementById(s)));
    return [...look.order.filter(s => onPage.includes(s)), ...onPage.filter(s => !look.order.includes(s))];
  }
  function renderSections() {
    const box = $('tab-secciones'), order = currentOrder();
    const opt = (v, label, on) => `<option value="${v}"${on ? ' selected' : ''}>${label}</option>`;
    const spaceSel = (s, i) => { const v = (look.space[s] || [0, 0])[i]; return `<select data-sp="${i}">${SPACE_OPTS.map(([n, l]) => opt(n, l, n === v)).join('')}</select>`; };
    box.innerHTML = '<h2>Secciones</h2><p class="hint">Arrastra para cambiar el orden. La casilla las muestra u oculta. La portada va siempre primero.</p>' +
      order.map((s, i) => `<div class="sec-row${look.hidden.includes(s) ? ' off' : ''}" draggable="true" data-s="${s}"><input type="checkbox"${look.hidden.includes(s) ? '' : ' checked'} title="Mostrar"><span>${LABELS[s] || s}</span><button data-mv="-1"${i ? '' : ' disabled'}>↑</button><button data-mv="1"${i < order.length - 1 ? '' : ' disabled'}>↓</button>
        <div class="sec-opts"><label>Fondo <select data-bg>${opt('', 'Como está', !look.bg[s])}${BG_OPTS.map(([v, l]) => opt(v, l, look.bg[s] === v)).join('')}</select></label><label>Arriba ${spaceSel(s, 0)}</label><label>Abajo ${spaceSel(s, 1)}</label><button data-rs title="Fondo y espacio como en la web"${look.bg[s] || look.space[s] ? '' : ' disabled'}>↺</button></div></div>`).join('') +
      `<div class="btns" style="margin-top:8px"><button id="secReset"${look.order.length || look.hidden.length ? '' : ' disabled'}>Orden original, todas visibles</button></div>`;
    let drag = null;
    box.querySelectorAll('.sec-row').forEach(row => {
      const s = row.dataset.s;
      row.querySelector('input').onchange = e => { look.hidden = e.target.checked ? look.hidden.filter(x => x !== s) : [...look.hidden, s]; applyLook(); renderSections(); };
      row.querySelector('[data-bg]').onchange = e => { if (e.target.value) look.bg[s] = e.target.value; else delete look.bg[s]; applyLook(); renderSections(); };
      row.querySelectorAll('[data-sp]').forEach(sel => sel.onchange = () => {
        const sp = (look.space[s] || [0, 0]).slice(); sp[+sel.dataset.sp] = +sel.value;
        if (sp[0] || sp[1]) look.space[s] = sp; else delete look.space[s];
        applyLook(); renderSections();
      });
      row.querySelector('[data-rs]').onclick = () => { delete look.bg[s]; delete look.space[s]; applyLook(); renderSections(); };
      row.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => move(s, +b.dataset.mv));
      row.ondragstart = () => { drag = s; };
      row.ondragover = e => { e.preventDefault(); row.classList.add('over'); };
      row.ondragleave = () => row.classList.remove('over');
      row.ondrop = e => { e.preventDefault(); if (drag && drag !== s) { const o = currentOrder().filter(x => x !== drag); o.splice(o.indexOf(s), 0, drag); look.order = o; applyLook(); renderSections(); } };
    });
    $('secReset').onclick = () => { look.order = []; look.hidden = []; applyLook(); renderSections(); };
  }
  // ---------- history: the branch's last commits, and going back to one ----------
  const DAY = 86400;
  function ago(ts) {
    const s = Math.max(0, Date.now() / 1000 - ts);
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < DAY) return 'hace ' + Math.round(s / 3600) + ' h';
    if (s < 2 * DAY) return 'ayer';
    if (s < 30 * DAY) return 'hace ' + Math.round(s / DAY) + ' días';
    return new Date(ts * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  const when = ts => new Date(ts * 1000).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  // only the latest request counts: resetHistory() (branch opened, saved, reverted) makes older answers stale
  let histReq = 0, histBusy = false;
  function resetHistory() { hist = null; histBusy = false; histReq++; }
  async function loadHistory() {
    const id = ++histReq; histBusy = true;
    let list = null, error = '';
    try {
      const r = await fetch('/_dev/api/history?branch=' + encodeURIComponent(branch), { cache: 'no-store' }), j = await r.json();
      if (!r.ok) throw new Error(j.error || r.status);
      list = j.commits;
    } catch (e) { list = []; error = 'No se pudo leer el historial: ' + e.message; }
    if (id !== histReq) return;
    hist = list; histErr = error; histBusy = false;
    if (histPick && !hist.some(c => c.sha === histPick.sha)) histPick = null;
    if (tab === 'historial') { renderHistory(); panel(); }
  }
  function renderHistory() {
    const box = $('tab-historial'); if (!box) return;
    if (!hist) { box.innerHTML = '<h2>Historial</h2><p class="hint">Cargando…</p>'; if (!histBusy) loadHistory(); return; }
    const files = f => esc(f.slice(0, 3).join(', ')) + (f.length > 3 ? ' +' + (f.length - 3) : '');
    box.innerHTML = `<h2>Historial</h2><p class="hint">Los últimos guardados de <b>${esc(branch)}</b>, del más nuevo al más antiguo. Los del editor llevan la marca rosa.</p>` +
      (histErr ? `<p class="note">${esc(histErr)}</p>` : '') +
      hist.map((c, i) => `<div class="h-row${c.editor ? ' ed' : ''}${histPick && histPick.sha === c.sha ? ' on' : ''}">
        <div class="h-top"><code>${esc(c.short)}</code><span>${esc(c.who)}</span><span title="${esc(when(c.date))}">${esc(ago(c.date))}</span>${i === 0 ? '<span class="h-tag now">ahora</span>' : ''}${c.editor ? '<span class="h-tag">editor</span>' : ''}</div>
        <div class="h-sub">${esc(c.subject)}</div>${c.files.length ? `<div class="h-files">${files(c.files)}</div>` : (c.merge ? '<div class="h-files">fusión de ramas</div>' : '')}
        ${i ? `<button data-rev="${esc(c.sha)}">Volver a este punto</button>` : ''}</div>`).join('') +
      '<div class="btns"><button id="histReload">Actualizar</button></div>';
    box.querySelectorAll('[data-rev]').forEach(bt => bt.onclick = () => { histPick = hist.find(c => c.sha === bt.dataset.rev) || null; renderHistory(); drawProps($('props')); });
    $('histReload').onclick = () => { resetHistory(); renderHistory(); };
  }
  function historyProps(p) {
    if (!histPick) {
      p.innerHTML = '<h2>Historial</h2><p class="hint">Cada vez que alguien pulsa «Guardar» queda un punto en el historial. «Volver a este punto» deja la web como estaba entonces con un guardado nuevo: no se borra nada.</p>' + changesList();
      return;
    }
    const c = histPick, dirty = dirtyParts().length > 0;
    p.innerHTML = `<h2>Volver atrás</h2>
      <p>La web volverá a como estaba el ${esc(when(c.date))} (${esc(c.subject)}). Los guardados posteriores no se borran: se crea un guardado nuevo que deshace los cambios.</p>
      ${dirty ? `<p class="note">Tienes cambios sin guardar (${esc(dirtyParts().join(', '))}). Guárdalos o descártalos antes de volver atrás.</p>` : ''}
      <p class="hint">${$('push').checked ? 'Con «Subir» marcado, la rama se sube a GitHub después.' : '«Subir» está desmarcado: el cambio se queda en este ordenador.'}</p>
      <div class="btns"><button id="revGo" class="primary"${dirty ? ' disabled' : ''}>Volver a este punto</button><button id="revNo">Cancelar</button></div><p id="revErr" class="note" hidden></p>`;
    $('revNo').onclick = () => { histPick = null; renderHistory(); historyProps(p); };
    $('revGo').onclick = () => revertTo(c);
  }
  async function revertTo(c) {
    const err = m => { const e = $('revErr'); if (e) { e.hidden = false; e.textContent = m; } status(m, true); };
    if (dirtyParts().length) return err('Guarda o descarta los cambios antes de volver atrás');
    const who = $('who').value.trim();
    if (!who) { $('who').focus(); return err('Escribe tu nombre (arriba) para firmar el cambio'); }
    if (saving) return;
    saving = true; status('Volviendo a ' + c.short + '…');
    try {
      const r = await fetch('/_dev/api/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch, sha: c.sha, who, push: $('push').checked, head }) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || r.status);
      saving = false; histPick = null;
      await openBranch(branch);
      const pushed = j.pushed === true ? ' · subido a GitHub' : (j.pushed ? ' · NO se pudo subir: ' + j.pushed : '');
      status(j.commit ? `Vuelto a ${c.short} (guardado nuevo ${j.commit})${pushed}` : 'La web ya estaba así: nada que cambiar', !!(j.pushed && j.pushed !== true), true);
    } catch (e) {
      saving = false; err('No se pudo volver atrás: ' + e.message);
      resetHistory(); if (tab === 'historial') renderHistory();
    }
  }

  function move(s, d) { const o = currentOrder(), i = o.indexOf(s), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; look.order = o; applyLook(); renderSections(); }

  // ---------- panels ----------
  function changesList() {
    const parts = dirtyParts();
    return parts.length ? `<h2 style="margin-top:14px">Sin guardar</h2><p class="hint">${parts.join(', ')}. «Guardar» lo sube todo a la rama <b>${esc(branch)}</b> en un solo cambio.</p>` : '';
  }
  // after a 409: someone saved on this branch since it was opened here
  function conflictProps(p) {
    p.innerHTML = `<h2>La rama ha cambiado</h2>
      <p>Otro ordenador ha guardado en <b>${esc(branch)}</b> desde que la abriste${conflict.head ? ` (ahora está en <code>${esc(conflict.head)}</code>)` : ''}. Tus cambios siguen aquí sin guardar: ${esc(dirtyParts().join(', ') || 'ninguno')}.</p>
      <div class="btns"><button id="cfReload">Recargar y perder mis cambios</button></div>
      <p class="hint">Abre la versión nueva de la rama. Lo que has cambiado aquí se pierde.</p>
      <div class="btns"><button id="cfForce" class="primary">Guardar igualmente</button></div>
      <p class="hint">Escribe tus cambios encima de la versión nueva, sin mezclar nada. Los textos que no has tocado se quedan como los dejó la otra persona, pero lo que tú guardas va entero: si también cambió esos mismos textos, los colores, las secciones, los textos movidos o las flores, su versión de eso se pierde (la puedes recuperar desde el Historial).</p>
      <div class="btns"><button id="cfNo">Cancelar</button></div>`;
    $('cfReload').onclick = () => { conflict = null; dropSiteDraft(); ED.dropFloresDraft(); openBranch(branch, true); };
    $('cfForce').onclick = () => { conflict = null; save(true); };
    $('cfNo').onclick = () => { conflict = null; status(); panel(); };
  }
  // the right panel of the current tab (the flower editor draws its own)
  const panel = () => tab === 'flores' ? ED.drawProps() : drawProps($('props'));
  function drawProps(p) {
    if (publishPanel(p)) return;
    if ($('branch').value === '__new') return newBranchForm(p);
    if (conflict) return conflictProps(p);
    if (tab === 'historial') return historyProps(p);
    if (tab === 'textos') return textProps(p);
    if (tab === 'colores' && palEdit) return paletteForm(p);
    const help = { fuentes: 'Elige una fuente para cada papel: la web cambia al momento. Los títulos se ajustan de tamaño para que cada letra de pluma ocupe lo mismo. Para cambiar la letra de un solo texto, selecciónalo en la pestaña Flores.', colores: 'Elige una paleta o cambia un color suelto: la web se actualiza al momento. «↺» devuelve ese color al de la web. Con «Nueva paleta» creas la tuya a partir de seis colores.', fotos: 'Las fotos nuevas se reducen a un tamaño adecuado para la web antes de guardarse.', secciones: 'Ocultar una sección no la borra: se puede volver a mostrar cuando quieras.<br><br>Fondo: papel, papel oscuro o verde (como la confirmación, con el texto claro). Arriba y abajo: menos o más aire en ese borde. «↺» deja el fondo y el espacio de esa sección como en la web.' }[tab] || '';
    p.innerHTML = `<h2>${{ colores: 'Colores', fuentes: 'Fuentes', fotos: 'Fotos', secciones: 'Secciones' }[tab] || ''}</h2><p class="hint">${help}</p>` + changesList();
  }
  function renderTab() {
    if (tab === 'textos') renderTexts();
    if (tab === 'colores') renderColours();
    if (tab === 'fuentes') renderFonts();
    if (tab === 'fotos') renderPhotos();
    if (tab === 'secciones') renderSections();
    if (tab === 'historial') renderHistory();
  }
  function setTab(t) {
    endEdit();
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('#lib .tab').forEach(s => { s.hidden = s.id !== 'tab-' + t; });
    if (ED.doc) ED.doc.documentElement.classList.toggle('ed-mode-textos', t === 'textos');
    ED.setMode(t === 'flores' ? 'flores' : t);
    renderTab();
  }

  // ---------- save ----------
  // force: write even if the branch moved on since it was opened here (the choice offered after a 409)
  async function save(force) {
    if (saving) return;
    force = force === true;
    endEdit();
    const parts = dirtyParts();
    if (!parts.length) { status('No hay nada que guardar'); return; }
    const who = $('who').value.trim();
    if (!who) { status('Escribe tu nombre (arriba) para firmar el cambio', true); $('who').focus(); return; }
    const payload = { branch, who, push: $('push').checked, head };
    if (force) payload.force = true;
    if (ED.floresDirty()) payload.flores = ED.floresItems();
    if (Object.keys(textEdits).length) payload.texts = textEdits;
    if (lookDirty()) payload.look = look;
    if (Object.keys(photos).length) payload.photos = photos;
    saving = true; status('Guardando…');
    try {
      const r = await fetch('/_dev/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (r.status === 409) {   // someone saved on this branch since it was opened here: ask what to do
        conflict = { head: j.head || '' }; saving = false;
        status(j.error || 'La rama ha cambiado desde que la abriste', true); panel();
        return;
      }
      if (!r.ok || !j.ok) throw new Error(j.error || r.status);
      Object.entries(textEdits).forEach(([k, v]) => { texts[k] = Object.assign({}, texts[k], v); });
      textEdits = {}; photos = {}; savedLook = JSON.stringify(look); conflict = null;
      if (j.head) head = j.head;
      remoteHead = null; resetHistory(); dropSiteDraft();
      ED.markSaved(); ED.reloadFrame();
      const pushed = j.pushed === true ? ' · subido a GitHub' : (j.pushed ? ' · NO se pudo subir: ' + j.pushed : '');
      status(j.commit ? `Guardado en ${branch} (${j.commit})${pushed}` : 'Nada que guardar', !!(j.pushed && j.pushed !== true), true);
      if (tab === 'historial') renderHistory();
      if (force) {   // written on top of someone else's version: read the branch again so every text and colour is the current one
        saving = false; const msg = $('status').textContent, bad = $('status').classList.contains('dirty');
        await openBranch(branch); status(msg, bad, true);
      }
    } catch (e) { status('No se pudo guardar: ' + e.message, true); }
    saving = false;
  }

  // ---------- "Ver en mi móvil": link and QR of this branch's last save ----------
  // /b/<branch>/ is served by serve.py straight from git ("/" in a branch name is written "~").
  // Through the tunnel location.origin is the public https address, so the phone can open it.
  const previewURL = b => location.origin + '/b/' + b.split('/').map(encodeURIComponent).join('~') + '/index.html';
  function closeShare() { const el = $('sharePop'); if (el) el.remove(); document.removeEventListener('pointerdown', shareOutside, true); }
  function shareOutside(e) { if (!e.target.closest('#sharePop, #share')) closeShare(); }
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); return true; } catch (e) {}
    const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); return ok;
  }
  function openShare() {
    if ($('sharePop')) { closeShare(); return; }
    if (!branch) return;
    const url = previewURL(branch), local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
    let qr = '';
    try { qr = window.QR ? window.QR.svg(url, 220, '#26261f') : ''; } catch (e) { qr = ''; }
    const pop = document.createElement('div'); pop.id = 'sharePop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Ver en mi móvil');
    pop.innerHTML = `<h2>Ver en mi móvil</h2>
      <div class="qr">${qr || '<p class="note">No se pudo crear el código QR.</p>'}</div>
      <p class="hint">Escanea el código con la cámara del móvil o copia el enlace.</p>
      <div class="share-url"><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a></div>
      <div class="btns"><button id="shareCopy" class="primary">Copiar enlace</button><button id="shareClose">Cerrar</button></div>
      <p class="hint">Muestra lo último guardado en esta rama (<b>${esc(branch)}</b>).${dirtyParts().length ? ' Lo que aún no has guardado no sale.' : ''} Si te pide contraseña, es la misma del editor.</p>
      ${local ? '<p class="note">Has abierto el editor en este ordenador (localhost): el móvil no llega a este enlace. Ábrelo con la dirección compartida del editor para que funcione.</p>' : ''}`;
    document.body.appendChild(pop);
    const r = $('share').getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.top = (r.bottom + 6) + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    $('shareClose').onclick = closeShare;
    $('shareCopy').onclick = async () => { const ok = await copyText(url); $('shareCopy').textContent = ok ? 'Copiado' : 'No se pudo copiar'; };
    setTimeout(() => document.addEventListener('pointerdown', shareOutside, true), 0);
  }

  // ---------- "Publicar": merge this branch into main and push main (the guests' site) ----------
  // The confirmation lives in the right panel and stays there (in any tab) until Cancelar.
  let pub = null;   // { step: 'check' | 'plan' | 'busy' | 'done' | 'error' | 'refused', plan, error, result }
  const whenISO = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
  const commitRow = c => `<div class="pub-c"><code>${esc(c.sha)}</code> <span>${esc(c.who)} · ${esc(whenISO(c.when))}</span><div>${esc(c.subject)}</div></div>`;
  function pubRefusal() {
    if (!branch) return 'Todavía no hay ninguna rama abierta.';
    if (branch === 'main') return 'Estás en main, que ya es la web publicada. Abre la rama con los cambios que quieres publicar.';
    const parts = dirtyParts();
    if (parts.length) return `Tienes cambios sin guardar (${parts.join(', ')}). Guárdalos o descártalos antes de publicar: solo se publica lo guardado.`;
    return '';
  }
  function closePublish() { pub = null; if (ED.drawProps) ED.drawProps(); else drawProps($('props')); }
  async function openPublish() {
    closeShare();
    if (pub && (pub.step === 'busy' || pub.step === 'check')) return;
    if (ED.openProps) ED.openProps();
    const why = pubRefusal();
    pub = why ? { step: 'refused', error: why } : { step: 'check' };
    showPublish();
    if (why) { status(why, true); return; }
    const b = branch;
    try {
      const r = await fetch('/_dev/api/publish?branch=' + encodeURIComponent(b), { cache: 'no-store' }), j = await r.json();
      if (!pub || b !== branch) return;
      if (!r.ok || j.ok === false) throw new Error(j.error || r.status);
      pub = { step: 'plan', plan: j };
    } catch (e) { if (pub) pub = { step: 'error', error: 'No se pudo comprobar qué se publicaría: ' + e.message }; }
    showPublish();
  }
  function showPublish() { if (ED.drawProps) ED.drawProps(); else publishPanel($('props')); }
  // drawn instead of the usual properties while a publish is open (flores.html asks through SITE.overlay)
  function publishPanel(p) {
    if (!pub || !p) return false;
    const close = '<button id="pubNo">Cerrar</button>';
    let h = '<h2>Publicar</h2>';
    if (pub.step === 'refused') h += `<p class="note">${esc(pub.error)}</p><div class="btns">${close}</div>`;
    else if (pub.step === 'check') h += `<p class="hint">Comprobando qué se publicaría…</p>`;
    else if (pub.step === 'error') h += `<p class="note warn">${esc(pub.error)}</p><div class="btns">${close}</div>`;
    else if (pub.step === 'done') {
      const r = pub.result;
      h += r.commit
        ? `<p class="note own">Publicado (${esc(r.commit)}). GitHub tarda uno o dos minutos en servir la web nueva.</p><div class="pub-list">${(r.merged || []).map(commitRow).join('')}</div>`
        : '<p class="note own">No había nada nuevo que publicar: la web ya tenía todo lo de esta rama.</p>';
      h += `<div class="btns">${close}</div>`;
    } else {
      const pl = pub.plan, busy = pub.step === 'busy', n = pl.commits.length;
      h += `<p class="hint">Esto une la rama <b>${esc(pl.branch)}</b> a main, que es la web que ven los invitados.</p>`;
      if (pl.upToDate) h += '<p class="note own">No hay nada que publicar: main ya tiene todo lo de esta rama.</p>' + `<div class="btns">${close}</div>`;
      else {
        h += `<p class="note warn"><b>Publicar es inmediato.</b> En cuanto pulses «Publicar ahora», ${n === 1 ? 'este guardado pasa' : 'estos ' + n + ' guardados pasan'} a la web que ven los invitados.</p>`;
        h += `<h2 style="margin-top:12px">${n === 1 ? 'Lo que se publica' : 'Lo que se publica (' + n + ')'}</h2><div class="pub-list">${pl.commits.map(commitRow).join('')}</div>`;
        if (!pl.fetched) h += '<p class="note">No se pudo conectar con GitHub: la lista puede no estar al día y no se podrá publicar hasta que vuelva la conexión.</p>';
        if (pl.pushBranch) h += `<p class="hint">Antes se subirá la rama ${esc(pl.branch)} a GitHub, para que coincida con lo publicado.</p>`;
        if (pl.problem) h += `<p class="note warn">${esc(pl.problem)}</p>`;
        h += `<div class="btns"><button id="pubGo" class="primary"${busy || pl.problem || !pl.fetched ? ' disabled' : ''}>${busy ? 'Publicando…' : 'Publicar ahora'}</button><button id="pubNo"${busy ? ' disabled' : ''}>Cancelar</button></div>`;
        if (pub.error) h += `<p class="note warn">${esc(pub.error)}</p>`;
      }
    }
    p.innerHTML = h;
    const no = $('pubNo'); if (no) no.onclick = closePublish;
    const go = $('pubGo'); if (go) go.onclick = doPublish;
    return true;
  }
  async function doPublish() {
    if (!pub || pub.step !== 'plan') return;
    const why = pubRefusal();
    if (why) { pub = { step: 'refused', error: why }; showPublish(); status(why, true); return; }
    const who = $('who').value.trim();
    if (!who) { pub.error = 'Escribe tu nombre (arriba) para firmar la publicación.'; showPublish(); status('Escribe tu nombre (arriba) para firmar la publicación', true); $('who').focus(); return; }
    pub.step = 'busy'; pub.error = ''; showPublish(); status('Publicando…');
    try {
      const r = await fetch('/_dev/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch, who }) });
      let j = {}; try { j = await r.json(); } catch (e) {}
      if (!r.ok || !j.ok) throw new Error(j.error || 'error ' + r.status);
      pub = { step: 'done', result: j };
      showPublish(); status(j.commit ? `Publicado (${j.commit})` : 'Nada nuevo que publicar');
    } catch (e) {
      if (pub) { pub.step = 'plan'; pub.error = e.message; }
      showPublish(); status('No se pudo publicar', true);
    }
  }

  // ---------- someone else saved on this branch: poll its HEAD every minute while the tab is visible ----------
  async function checkHead() {
    if (!branch || !head || saving || document.hidden) return;
    const b = branch;
    try {
      const r = await fetch('/_dev/api/state?head=1&branch=' + encodeURIComponent(b), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (b === branch && !saving && j.head) { remoteHead = sameHead(j.head, head) ? null : j.head; renderRemote(); }
    } catch (e) {}
  }
  function renderRemote() {
    const bn = $('remote'); if (!bn) return;
    const show = !!remoteHead && !sameHead(remoteHead, head) && remoteHead !== remoteHidden;
    bn.classList.toggle('show', show);
    if (!show) { bn.innerHTML = ''; bn.dataset.k = ''; return; }
    const dirty = dirtyParts().length > 0, key = remoteHead + (dirty ? ':d' : ':c');
    if (bn.dataset.k === key) return;   // status() runs often: redraw only when something changed
    bn.dataset.k = key;
    bn.innerHTML = dirty
      ? '<span>Alguien ha guardado en esta rama. Tienes cambios sin guardar: al guardar podrás elegir qué hacer.</span><button data-x title="Cerrar">✕</button>'
      : '<span>Alguien ha guardado en esta rama.</span><button data-rl>Recargar</button><button data-x title="Cerrar">✕</button>';
    const rl = bn.querySelector('[data-rl]');
    if (rl) rl.onclick = () => { if (!dirtyParts().length) openBranch(branch); };
    bn.querySelector('[data-x]').onclick = () => { remoteHidden = remoteHead; renderRemote(); };
  }

  // ---------- page events ----------
  function onFrame(win, doc) {
    editing = null;   // a new page: nothing is being written on it
    const st = doc.createElement('style');
    st.textContent = `.ed-mode-textos [data-i18n] { cursor: text; } .ed-mode-textos [data-i18n]:hover { outline: 1.5px dashed #c83c78; outline-offset: 2px; }
      .ed-tsel { outline: 2px solid #c83c78 !important; outline-offset: 2px; }
      .ed-tsel[contenteditable] { cursor: text; caret-color: #c83c78; }`;
    doc.head.appendChild(st);
    // a click on the <summary> being written must not open or close its <details>
    doc.addEventListener('click', e => { if (editing && editing.el.contains(e.target) && e.target.closest('summary')) e.preventDefault(); }, true);
    doc.documentElement.classList.toggle('ed-mode-textos', tab === 'textos');
    applyLook(); applyTexts(); applyPhotos();
    if (!$('goto').options.length) $('goto').innerHTML = '<option value="">Ir a sección…</option>' + SECTIONS.map(k => `<option>${k}</option>`).join('');
    renderTab(); ED.fit(); status();
  }
  function onPointer(e) {
    if (tab !== 'textos') return;
    if (editing && editing.el.contains(e.target)) return;   // inside the text being written: the browser moves the caret
    const el = e.target.closest('[data-i18n]');
    if (el && texts[el.dataset.i18n]) { e.preventDefault(); pickText(el.dataset.i18n, false, { el, x: e.clientX, y: e.clientY }); }
  }

  // ---------- boot ----------
  // the flower editor moved a text (or undid a move): mirror it in the look and repaint
  function textChanged() { look.text = ED.textPos(); applyLook(); }
  window.SITE = { save, status, onFrame, onPointer, drawProps, textChanged, offerDraft, checkHead, asking: () => !!conflict,
    dirty: () => dirtyParts().length > 0, overlay: publishPanel, previewURL,
    colourRow, wireColourRows, normHex,   // the text style panel in _dev/flores.html reuses the colour row
    edits: () => JSON.parse(JSON.stringify(textEdits)), editing: () => editing && editing.k };   // the texts changed (and the one being written), for tests
  if ($('share')) $('share').onclick = openShare;
  if ($('publish')) $('publish').onclick = openPublish;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('sharePop')) closeShare(); });
  try { $('who').value = localStorage.getItem('ed-who') || ''; } catch (e) {}
  $('who').oninput = () => { try { localStorage.setItem('ed-who', $('who').value); } catch (e) {} };
  $('branch').onchange = e => { if (e.target.value === '__new') drawProps($('props')); else openBranch(e.target.value); };
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && e.target.closest('input, textarea, select')) { e.preventDefault(); save(); } });
  window.addEventListener('beforeunload', e => { if (dirtyParts().length) { e.preventDefault(); e.returnValue = ''; } });
  setInterval(checkHead, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkHead(); });
  loadBranches();
})();
