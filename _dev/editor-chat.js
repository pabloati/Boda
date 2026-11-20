// Site editor: the chat with Claude. A button in the bar opens a panel on the right; a request is sent to
// _dev/serve.py, which runs Claude Code on the open branch with the file tools only (see _dev/editor_chat.py)
// and saves what it changed as one save of the branch. The panel polls while Claude works and reloads the
// branch when it ends. Each branch has its own conversation, kept on the server, so every computer sees it.
// The button stays hidden on a server without Claude.
(function () {
  'use strict';
  const SITE = window.SITE, $ = id => document.getElementById(id);
  const btn = $('chatBtn');
  if (!SITE || !btn) return;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const api = async (method, path, body) => {
    const r = await fetch('/_dev/api/chat' + path, method === 'GET' ? { cache: 'no-store' }
      : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
    return j;
  };

  const css = document.createElement('style');
  css.textContent = `
  #chatBtn.busy .ic { animation: spin 1.6s linear infinite; color: var(--acc); }
  #chatBtn.open { background: #f1efe8; }
  #chat { position: fixed; top: 52px; right: 0; bottom: 0; width: min(400px, 100vw); z-index: 15; display: flex; flex-direction: column; background: var(--panel); border-left: 1px solid var(--line); box-shadow: -14px 0 30px -18px rgba(38,38,31,.5); font-size: 14px; line-height: 1.45; }
  #chat[hidden] { display: none; }
  #chat header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
  #chat header div { flex: 1; min-width: 0; } #chat header strong { display: block; font-size: 15px; }
  #chat header span { display: block; color: var(--soft); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #chat header button { padding: 3px 8px; font-size: 12px; }
  #chatThread { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .c-msg { border-radius: 10px; padding: 8px 11px; overflow-wrap: anywhere; }
  .c-msg.you { align-self: flex-end; max-width: 88%; background: #fbe6ee; white-space: pre-wrap; }
  .c-msg.you small { display: block; color: var(--soft); font-size: 11px; }
  .c-msg.claude { background: #f1efe8; }
  .c-msg p { margin: 0 0 7px; } .c-msg p:last-child, .c-msg ul:last-child { margin-bottom: 0; } .c-msg ul { margin: 0 0 7px; padding-left: 18px; }
  .c-msg code { font: 12px monospace; background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 0 3px; }
  .c-err { color: #a22; } .c-meta { margin-top: 6px; font-size: 12px; color: var(--soft); } .c-meta summary { cursor: pointer; }
  .c-meta b { color: var(--accd); } .c-steps { margin: 4px 0 0; padding-left: 16px; font-size: 12px; color: var(--soft); }
  .c-work { display: flex; align-items: center; gap: 7px; color: var(--soft); font-size: 13px; margin-bottom: 4px; } .c-work button { margin-left: auto; padding: 2px 8px; font-size: 12px; color: #a22; }
  .c-spin { width: 11px; height: 11px; border-radius: 50%; border: 2px solid var(--acc); border-right-color: transparent; animation: spin .8s linear infinite; }
  .c-empty { color: var(--soft); } .c-empty ul { padding-left: 18px; margin: 6px 0; }
  #chatForm { border-top: 1px solid var(--line); padding: 10px 12px 12px; }
  #chatForm textarea { min-height: 0; height: 74px; resize: none; font-size: 14px; border-radius: 8px; padding: 8px; }
  #chatForm textarea:focus { outline: 0; border-color: var(--acc); }
  #chatModel { border: 0; background: transparent; padding: 0; color: var(--soft); font-size: 12px; text-decoration: underline dotted; cursor: pointer; }
  #chatModelForm { display: grid; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--line); background: #fff; font-size: 13px; }
  #chatModelForm[hidden] { display: none; } #chatModelForm label { color: var(--soft); font-size: 12px; }
  #chatModelForm select, #chatModelForm input { font: inherit; padding: 5px 7px; border: 1px solid var(--line); border-radius: 6px; background: #fff; }
  #chatModelForm div { display: flex; gap: 6px; justify-content: flex-end; } #chatModelForm p { margin: 0; color: #a22; font-size: 12.5px; } #chatModelForm p:empty { display: none; }
  #chatNote { color: #a22; font-size: 12.5px; margin: 0 0 6px; } #chatNote:empty { display: none; }
  #chatForm div { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 6px; color: var(--soft); font-size: 12px; }`;
  document.head.appendChild(css);

  const box = document.createElement('aside');
  box.id = 'chat'; box.hidden = true; box.setAttribute('aria-label', 'Claude');
  box.innerHTML = `<header><div><strong>Claude</strong><span id="chatSub"></span></div>
      <button id="chatNew" title="Empezar una conversación nueva: Claude olvida esta, los cambios se quedan">Nueva</button>
      <button id="chatClose" title="Cerrar (Esc)" aria-label="Cerrar">✕</button></header>
    <form id="chatModelForm" hidden><label for="chatModelSel">Modelo de Claude para todas las peticiones</label>
      <select id="chatModelSel"></select>
      <input id="chatModelPw" type="password" placeholder="Contraseña de administrador" autocomplete="off">
      <p id="chatModelErr"></p><div><button type="button" id="chatModelNo">Cancelar</button><button class="primary">Cambiar</button></div></form>
    <div id="chatThread"></div>
    <form id="chatForm"><p id="chatNote"></p>
      <textarea id="chatText" placeholder="Pídele un cambio o pregúntale algo…" maxlength="4000"></textarea>
      <div><button type="button" id="chatModel" title="El modelo de Claude que contesta. Solo Pablo lo cambia, con su contraseña"></button><button class="primary" id="chatSend">Enviar</button></div></form>`;
  document.body.appendChild(box);

  let last = null;      // the server's last answer (model, list of models)
  let timer = 0, running = false, sig = '', shown = null, started = 0, available = false;
  const note = m => { $('chatNote').textContent = m || ''; };

  // the little Markdown Claude writes: paragraphs, lists, **bold**, `code`
  function md(text) {
    const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const item = /^\s*([-*•]|\d+[.)])\s+/;
    let html = '', para = [], list = [];
    const flush = () => {
      if (para.length) html += '<p>' + para.join('<br>') + '</p>';
      if (list.length) html += '<ul>' + list.map(l => '<li>' + l + '</li>').join('') + '</ul>';
      para = []; list = [];
    };
    String(text).split('\n').forEach(l => {
      if (!l.trim()) return flush();
      if (item.test(l)) { if (para.length) { html += '<p>' + para.join('<br>') + '</p>'; para = []; } list.push(inline(l.replace(item, ''))); }
      else { if (list.length) flush(); para.push(inline(l.replace(/^#+\s*/, ''))); }
    });
    flush();
    return html;
  }
  const stepsHTML = steps => steps && steps.length ? `<ul class="c-steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '';

  function draw(d) {
    const th = $('chatThread'), atEnd = th.scrollHeight - th.scrollTop - th.clientHeight < 60;
    let html = '';
    if (!d.turns.length && !d.live) {
      html = `<div class="c-empty"><p>Escribe lo que quieres cambiar en la web y Claude lo hace en la rama <b>${esc(shown)}</b>. Por ejemplo:</p>
        <ul><li>«Pon el botón de confirmar un poco más grande en el móvil»</li><li>«Añade una pregunta sobre alergias al formulario»</li><li>«¿Dónde se cambia la hora del autobús?»</li></ul>
        <p>Lo que cambie queda guardado en esta rama y aparece en el Historial, donde se puede deshacer. Los invitados no ven nada hasta que pulses «Publicar».</p></div>`;
    }
    d.turns.forEach(t => {
      if (t.role === 'you') { html += `<div class="c-msg you">${t.who ? `<small>${esc(t.who)}</small>` : ''}${esc(t.text)}</div>`; return; }
      const pushed = t.pushed === true ? ' · subido a GitHub' : (t.pushed ? ' · <span class="c-err">no se pudo subir a GitHub</span>' : '');
      const meta = t.commit ? `<b>Guardado ${esc(t.commit)}</b>${pushed}: ${t.changed.map(esc).join(', ')}` : (t.error ? '' : 'No ha cambiado ningún archivo');
      html += `<div class="c-msg claude">${t.text ? md(t.text) : ''}${t.error ? `<p class="c-err">${esc(t.error)}</p>` : ''}
        <div class="c-meta">${meta}${t.steps && t.steps.length ? `<details><summary>${t.steps.length} paso${t.steps.length === 1 ? '' : 's'}</summary>${stepsHTML(t.steps)}</details>` : ''}</div></div>`;
    });
    if (d.live) {
      html += `<div class="c-msg claude"><div class="c-work"><span class="c-spin"></span>Trabajando… <span id="chatSecs"></span><button type="button" id="chatStop">Parar</button></div>
        ${d.live.text ? md(d.live.text) : ''}${stepsHTML(d.live.steps)}</div>`;
    }
    th.innerHTML = html;
    const st = $('chatStop');
    if (st) st.onclick = async () => { st.disabled = true; try { await api('POST', '/stop'); } catch (e) { note(e.message); } };
    if (atEnd) th.scrollTop = th.scrollHeight;
  }
  // the container's token is used for a month: say so when the end is near
  function left(until) {
    if (!until) return '';
    const days = Math.ceil((until - Date.now() / 1000) / 86400);
    return days <= 7 ? ' · el chat caduca en ' + days + (days === 1 ? ' día' : ' días') : '';
  }
  function tick() {
    const el = $('chatSecs'); if (!el || !started) return;
    const s = Math.max(0, Math.round(Date.now() / 1000 - started));
    el.textContent = s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
  }
  setInterval(tick, 1000);

  // Claude ended: if it saved something, load the branch again (texts, look and page are the new ones)
  async function finished(d) {
    const last = d.turns[d.turns.length - 1];
    if (!last || last.role !== 'claude' || !last.commit) return;
    if (SITE.dirty()) { SITE.checkHead(); return; }     // unsaved work here: the "alguien ha guardado" banner takes over
    await SITE.reopen();
    const bad = !!last.pushed && last.pushed !== true;
    SITE.status(`Claude ha guardado en ${shown} (${last.commit})` + (last.pushed === true ? ' · subido a GitHub' : bad ? ' · NO se pudo subir: ' + last.pushed : ''), bad, true);
  }

  async function refresh() {
    clearTimeout(timer);
    const b = SITE.branch();
    if (!b) { timer = setTimeout(refresh, 1500); return; }
    let d;
    try { d = await api('GET', '?branch=' + encodeURIComponent(b)); } catch (e) { timer = setTimeout(refresh, 5000); return; }
    if (b !== SITE.branch()) return refresh();
    available = !!d.available; btn.hidden = !available;
    if (!available) { box.hidden = true; return; }
    const was = running && shown === b;
    running = !!d.running; shown = b; started = d.live ? d.live.started : 0;
    btn.classList.toggle('busy', running || !!d.busy);
    $('chatSend').disabled = running || !!d.busy;
    $('chatSub').textContent = b === 'main' ? 'main es la web publicada: abre una rama para pedirle cambios'
      : d.busy ? 'Ocupado con la rama ' + d.busy + ': espera a que termine' : 'Cambia la rama ' + b + ' · solo la web' + left(d.until);
    last = d; $('chatModel').textContent = 'Modelo: ' + d.model;
    const s = JSON.stringify([b, d.turns.length, d.live, d.busy]);
    if (s !== sig && !box.hidden) { sig = s; draw(d); tick(); }
    if (was && !running) finished(d);
    // while it works, follow it closely; otherwise look now and then (another computer may have asked)
    timer = setTimeout(refresh, running ? 1200 : (d.busy ? 5000 : (box.hidden ? 60000 : 15000)));
  }

  function open(on) {
    box.hidden = !on; btn.classList.toggle('open', on);
    try { localStorage.setItem('ed-chat', on ? '1' : ''); } catch (e) {}
    if (on) { sig = ''; refresh(); $('chatText').focus(); }
  }

  // what the person is looking at, so "esto" and "aquí" mean something to Claude
  function view() {
    const v = { device: $('devD') && $('devD').classList.contains('on') ? 'escritorio' : 'móvil' };
    try {
      const f = $('f'), doc = f.contentDocument, mid = f.contentWindow.innerHeight / 2;
      for (const s of doc.querySelectorAll('header[id], section[id], footer[id]')) {
        const r = s.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { v.section = s.id; break; }
      }
    } catch (e) {}
    if (SITE.tab() === 'textos' && SITE.selText()) v.text = SITE.selText();
    return v;
  }

  async function send() {
    const ta = $('chatText'), message = ta.value.trim(), b = SITE.branch();
    note('');
    if (!message || running || !b) return;
    if (b === 'main') return note('Estás en main, que es la web publicada: abre una rama (arriba) y pídeselo ahí.');
    if (SITE.busy()) return note('Espera a que termine el guardado.');
    if (SITE.dirty()) return note('Guarda o descarta tus cambios antes: Claude trabaja sobre lo último guardado.');
    const who = $('who').value.trim();
    if (!who) { SITE.needWho(); return note('Escribe tu nombre (arriba) para firmar el cambio.'); }
    $('chatSend').disabled = true;
    try {
      await api('POST', '', { branch: b, message, who, push: $('push').checked, head: SITE.head(), view: view() });
      ta.value = ''; running = true; shown = b;
    } catch (e) { note(e.message); }
    refresh();
  }

  // the model: shown under the text box; changing it asks for the admin password (not on Pablo's own computer)
  const modelForm = on => { $('chatModelForm').hidden = !on; $('chatModelErr').textContent = ''; $('chatModelPw').value = ''; };
  $('chatModel').onclick = () => {
    if (!last) return;
    if (!$('chatModelForm').hidden) return modelForm(false);
    $('chatModelSel').innerHTML = last.models.map(m => `<option${m === last.model ? ' selected' : ''}>${esc(m)}</option>`).join('');
    $('chatModelPw').hidden = !last.model_password;
    modelForm(true); (last.model_password ? $('chatModelPw') : $('chatModelSel')).focus();
  };
  $('chatModelNo').onclick = () => modelForm(false);
  $('chatModelForm').onsubmit = async e => {
    e.preventDefault();
    try { await api('POST', '/model', { model: $('chatModelSel').value, password: $('chatModelPw').value }); modelForm(false); refresh(); }
    catch (err) { $('chatModelErr').textContent = err.message; }
  };
  btn.onclick = () => open(box.hidden);
  $('chatClose').onclick = () => open(false);
  $('chatForm').onsubmit = e => { e.preventDefault(); send(); };
  $('chatText').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } };
  box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); open(false); } else e.stopPropagation(); });   // typing here is not an editor shortcut
  $('chatNew').onclick = async () => {
    if (!confirm('¿Empezar una conversación nueva?\n\nClaude olvida esta. Los cambios que hizo se quedan, y el Historial los conserva.')) return;
    try { await api('POST', '/new', { branch: SITE.branch() }); sig = ''; refresh(); } catch (e) { note(e.message); }
  };
  $('branch').addEventListener('change', () => setTimeout(() => { sig = ''; refresh(); }, 600));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh().then(() => { try { if (available && localStorage.getItem('ed-chat')) open(true); } catch (e) {} });
})();
