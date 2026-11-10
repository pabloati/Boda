// Site editor: branch, texts, colours, photos and sections, on top of the flower editor
// (_dev/flores.html exposes window.ED). Everything previews live in the page; "Guardar" sends the
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
  function blankLook() { return { tokens: {}, frame: {}, order: [], hidden: [], text: {}, palettes: [] }; }
  let palEdit = null;   // the palette being built in the Colores tab: { idx, name, before }
  const lookDirty = () => JSON.stringify(look) !== savedLook;
  const dirtyParts = () => [ED.floresDirty() && 'flores', Object.keys(textEdits).length && 'textos', lookDirty() && 'colores/secciones/textos movidos', Object.keys(photos).length && 'fotos'].filter(Boolean);

  function status(msg, bad) {
    const parts = dirtyParts(), el = $('status');
    el.textContent = msg || (parts.length ? 'Sin guardar: ' + parts.join(', ') : 'Sin cambios');
    el.classList.toggle('dirty', !!bad || (!msg && parts.length > 0));
  }

  // ---------- live preview: the same CSS the server writes into css/editor.css ----------
  // A moved text keeps its place in the flow; only where it is painted changes (transform), and a
  // layer puts it under or over the plates (z-index against .flor -1 and .flor--front 2).
  const TEXT_Z = { back: -2, front: 3 };
  const tsel = k => k.startsWith('#') ? 'main ' + k : `main [data-i18n="${k}"]`;
  function tdecl(p, reset) {
    const d = [];
    if (p.x || p.y) d.push(`transform: translate(${p.x || 0}px, ${p.y || 0}px)`); else if (reset) d.push('transform: none');
    if (TEXT_Z[p.z] != null) d.push('position: relative', 'z-index: ' + TEXT_Z[p.z]); else if (reset) d.push('z-index: auto');
    return d.join('; ');
  }
  function lookCSS(l) {
    const sel = s => s === 'footer' ? '.footer-section' : '#' + s, css = [];
    const t = Object.entries(l.tokens);
    if (t.length) css.push(':root {' + t.map(([k, v]) => `--${k}: ${v};`).join(' ') + '}');
    const f = l.frame;
    if (f['hero-desktop']) css.push(`@media (min-width: 769px) and (orientation: landscape) { .hero-photo img { object-position: ${f['hero-desktop'][0]}% ${f['hero-desktop'][1]}%; } }`);
    if (f['hero-mobile']) css.push(`@media (max-width: 768px), (orientation: portrait) { .hero-photo img { object-position: ${f['hero-mobile'][0]}% ${f['hero-mobile'][1]}%; } }`);
    if (f['foto-envio']) css.push(`.rsvp-modal-photo img { object-position: ${f['foto-envio'][0]}% ${f['foto-envio'][1]}%; }`);
    if (l.order.length) { css.push('#main-content { display: flex; flex-direction: column; } #hero { order: -1; }'); l.order.forEach((s, i) => css.push(`${sel(s)} { order: ${i + 1}; }`)); }
    if (l.hidden.length) css.push(l.hidden.map(sel).join(', ') + ' { display: none !important; }');
    Object.entries(l.text || {}).forEach(([k, p]) => {
      css.push(`${tsel(k)} { ${tdecl(p, false)}; }`);
      if (p.d) css.push(`@media (min-width: 769px) { ${tsel(k)} { ${tdecl(p.d, true)}; } }`);
    });
    return css.join('\n');
  }
  function applyLook() {
    const d = ED.doc; if (!d) return;
    let st = d.getElementById('ed-look');
    if (!st) { st = d.createElement('style'); st.id = 'ed-look'; d.head.appendChild(st); }
    st.textContent = lookCSS(look);
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
  async function openBranch(b) {
    if (branch && dirtyParts().length) { $('branch').value = branch; status('Guarda o descarta los cambios antes de cambiar de rama', true); return; }
    status('Abriendo ' + b + '…');
    const r = await fetch('/_dev/api/state?branch=' + encodeURIComponent(b), { cache: 'no-store' }), st = await r.json();
    if (!r.ok) { status(st.error || 'No se pudo abrir la rama', true); $('branch').value = branch || ''; return; }
    branch = b; try { localStorage.setItem('ed-branch', b); } catch (e) {}
    texts = st.texts || {}; textEdits = {}; photos = {}; selText = null;
    look = Object.assign(blankLook(), st.look || {}); savedLook = JSON.stringify(look);
    ED.open(st.url, b); ED.setTextPos(look.text);
    palEdit = null;
    renderTab(); status();
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
  function pickText(k, scroll) {
    selText = k; renderTexts(); drawProps($('props'));
    const d = ED.doc; if (!d) return;
    d.querySelectorAll('.ed-tsel').forEach(e => e.classList.remove('ed-tsel'));
    const els = [...d.querySelectorAll(`[data-i18n="${k}"]`)].filter(e => !e.closest('#envelope-overlay'));
    els.forEach(e => e.classList.add('ed-tsel'));
    if (scroll && els[0]) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function textProps(p) {
    if (!selText) { p.innerHTML = '<h2>Textos</h2><p class="hint">Elige un texto en la lista o haz clic sobre él en la web. Puedes escribirlo en español y en inglés.</p><p class="hint">Un salto de línea en el cuadro es un salto de línea en la web.</p>' + changesList(); return; }
    const v = cur(selText), mod = !!textEdits[selText];
    p.innerHTML = `<h2>Texto</h2><p class="hint" style="font:11px monospace">${esc(selText)}</p>
      <label class="hint">Español</label><textarea id="tEs" rows="4">${esc(toEdit(v.es || ''))}</textarea>
      <label class="hint">Inglés</label><textarea id="tEn" rows="4">${esc(toEdit(v.en || ''))}</textarea>
      ${/<[a-z]/i.test(toEdit(v.es || '')) ? '<p class="hint">Las marcas entre &lt; &gt; dan estilo (por ejemplo, el texto más pequeño entre paréntesis): déjalas si quieres mantenerlo.</p>' : ''}
      <div class="btns"><button id="tUndo"${mod ? '' : ' disabled'}>Deshacer cambios de este texto</button></div>${changesList()}`;
    const upd = () => {
      const es = fromEdit($('tEs').value), en = fromEdit($('tEn').value), o = texts[selText];
      if (es === o.es && en === o.en) delete textEdits[selText]; else textEdits[selText] = { es, en };
      ED.doc && ED.doc.querySelectorAll(`[data-i18n="${selText}"]`).forEach(el => { el.innerHTML = es; });
      $('tUndo').disabled = !textEdits[selText]; status();
      const b = $('tab-textos').querySelector(`.t-item[data-k="${CSS.escape(selText)}"]`); if (b) { b.classList.toggle('mod', !!textEdits[selText]); b.textContent = plain(es) || selText; }
    };
    $('tEs').oninput = upd; $('tEn').oninput = upd;
    $('tUndo').onclick = () => { const k = selText; delete textEdits[k]; ED.doc && ED.doc.querySelectorAll(`[data-i18n="${k}"]`).forEach(el => { el.innerHTML = texts[k].es; }); renderTexts(); textProps(p); status(); };
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
    box.innerHTML = '<h2>Secciones</h2><p class="hint">Arrastra para cambiar el orden. La casilla las muestra u oculta. La portada va siempre primero.</p>' +
      order.map((s, i) => `<div class="sec-row${look.hidden.includes(s) ? ' off' : ''}" draggable="true" data-s="${s}"><input type="checkbox"${look.hidden.includes(s) ? '' : ' checked'} title="Mostrar"><span>${LABELS[s] || s}</span><button data-mv="-1"${i ? '' : ' disabled'}>↑</button><button data-mv="1"${i < order.length - 1 ? '' : ' disabled'}>↓</button></div>`).join('') +
      `<div class="btns" style="margin-top:8px"><button id="secReset"${look.order.length || look.hidden.length ? '' : ' disabled'}>Orden original, todas visibles</button></div>`;
    let drag = null;
    box.querySelectorAll('.sec-row').forEach(row => {
      const s = row.dataset.s;
      row.querySelector('input').onchange = e => { look.hidden = e.target.checked ? look.hidden.filter(x => x !== s) : [...look.hidden, s]; applyLook(); renderSections(); };
      row.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => move(s, +b.dataset.mv));
      row.ondragstart = () => { drag = s; };
      row.ondragover = e => { e.preventDefault(); row.classList.add('over'); };
      row.ondragleave = () => row.classList.remove('over');
      row.ondrop = e => { e.preventDefault(); if (drag && drag !== s) { const o = currentOrder().filter(x => x !== drag); o.splice(o.indexOf(s), 0, drag); look.order = o; applyLook(); renderSections(); } };
    });
    $('secReset').onclick = () => { look.order = []; look.hidden = []; applyLook(); renderSections(); };
  }
  function move(s, d) { const o = currentOrder(), i = o.indexOf(s), j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; look.order = o; applyLook(); renderSections(); }

  // ---------- panels ----------
  function changesList() {
    const parts = dirtyParts();
    return parts.length ? `<h2 style="margin-top:14px">Sin guardar</h2><p class="hint">${parts.join(', ')}. «Guardar» lo sube todo a la rama <b>${esc(branch)}</b> en un solo cambio.</p>` : '';
  }
  function drawProps(p) {
    if ($('branch').value === '__new') return newBranchForm(p);
    if (tab === 'textos') return textProps(p);
    if (tab === 'colores' && palEdit) return paletteForm(p);
    const help = { colores: 'Elige una paleta o cambia un color suelto: la web se actualiza al momento. «↺» devuelve ese color al de la web. Con «Nueva paleta» creas la tuya a partir de seis colores.', fotos: 'Las fotos nuevas se reducen a un tamaño adecuado para la web antes de guardarse.', secciones: 'Ocultar una sección no la borra: se puede volver a mostrar cuando quieras.' }[tab] || '';
    p.innerHTML = `<h2>${{ colores: 'Colores', fotos: 'Fotos', secciones: 'Secciones' }[tab] || ''}</h2><p class="hint">${help}</p>` + changesList();
  }
  function renderTab() {
    if (tab === 'textos') renderTexts();
    if (tab === 'colores') renderColours();
    if (tab === 'fotos') renderPhotos();
    if (tab === 'secciones') renderSections();
  }
  function setTab(t) {
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    document.querySelectorAll('#lib .tab').forEach(s => { s.hidden = s.id !== 'tab-' + t; });
    if (ED.doc) ED.doc.documentElement.classList.toggle('ed-mode-textos', t === 'textos');
    ED.setMode(t === 'flores' ? 'flores' : t);
    renderTab();
  }

  // ---------- save ----------
  async function save() {
    if (saving) return;
    const parts = dirtyParts();
    if (!parts.length) { status('No hay nada que guardar'); return; }
    const who = $('who').value.trim();
    if (!who) { status('Escribe tu nombre (arriba) para firmar el cambio', true); $('who').focus(); return; }
    const payload = { branch, who, push: $('push').checked };
    if (ED.floresDirty()) payload.flores = ED.floresItems();
    if (Object.keys(textEdits).length) payload.texts = textEdits;
    if (lookDirty()) payload.look = look;
    if (Object.keys(photos).length) payload.photos = photos;
    saving = true; status('Guardando…');
    try {
      const r = await fetch('/_dev/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || r.status);
      Object.entries(textEdits).forEach(([k, v]) => { texts[k] = Object.assign({}, texts[k], v); });
      textEdits = {}; photos = {}; savedLook = JSON.stringify(look);
      ED.markSaved(); ED.reloadFrame();
      const pushed = j.pushed === true ? ' · subido a GitHub' : (j.pushed ? ' · NO se pudo subir: ' + j.pushed : '');
      status(j.commit ? `Guardado en ${branch} (${j.commit})${pushed}` : 'Nada que guardar', !!(j.pushed && j.pushed !== true));
    } catch (e) { status('No se pudo guardar: ' + e.message, true); }
    saving = false;
  }

  // ---------- page events ----------
  function onFrame(win, doc) {
    const st = doc.createElement('style');
    st.textContent = `.ed-mode-textos [data-i18n] { cursor: text; } .ed-mode-textos [data-i18n]:hover { outline: 1.5px dashed #c83c78; outline-offset: 2px; }
      .ed-tsel { outline: 2px solid #c83c78 !important; outline-offset: 2px; }`;
    doc.head.appendChild(st);
    doc.documentElement.classList.toggle('ed-mode-textos', tab === 'textos');
    applyLook(); applyTexts(); applyPhotos();
    if (!$('goto').options.length) $('goto').innerHTML = '<option value="">Ir a sección…</option>' + SECTIONS.map(k => `<option>${k}</option>`).join('');
    renderTab(); ED.fit(); status();
  }
  function onPointer(e) {
    if (tab !== 'textos') return;
    const el = e.target.closest('[data-i18n]');
    if (el && texts[el.dataset.i18n]) { e.preventDefault(); pickText(el.dataset.i18n, false); }
  }

  // ---------- boot ----------
  // the flower editor moved a text (or undid a move): mirror it in the look and repaint
  function textChanged() { look.text = ED.textPos(); applyLook(); }
  window.SITE = { save, status, onFrame, onPointer, drawProps, textChanged, dirty: () => dirtyParts().length > 0 };
  try { $('who').value = localStorage.getItem('ed-who') || ''; } catch (e) {}
  $('who').oninput = () => { try { localStorage.setItem('ed-who', $('who').value); } catch (e) {} };
  $('branch').onchange = e => { if (e.target.value === '__new') drawProps($('props')); else openBranch(e.target.value); };
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && e.target.closest('input, textarea, select')) { e.preventDefault(); save(); } });
  window.addEventListener('beforeunload', e => { if (dirtyParts().length) { e.preventDefault(); e.returnValue = ''; } });
  loadBranches();
})();
