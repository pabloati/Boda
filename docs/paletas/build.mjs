// Builds docs/paletas/paletas.pdf: the candidate palettes, each with real screenshots of the page.
//   python3 -m http.server 8123            (in the repo root, another terminal)
//   PLAYWRIGHT=/path/to/node_modules/playwright node docs/paletas/build.mjs
// Writes img/*.jpg (screenshots), paletas.html and paletas.pdf next to this file.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const D = dirname(fileURLToPath(import.meta.url));
const SITE = process.env.SITE || 'http://localhost:8123/index.html';

// paper = fondo, alt = secciones alternas, green = bandas, deep = banda oscura, lead = botón y enlaces, ink = texto
const PALETTES = [
  { id: 'ahora', name: 'La de ahora', sub: 'Oliva y terracota', c: { paper: '#f3eee3', alt: '#e9e2d1', green: '#8e9166', deep: '#6c6f48', lead: '#b3613f', ink: '#3b382f' }, current: true,
    from: 'Es la que tiene la web hoy. Va aquí para comparar las demás con ella.',
    pro: 'Ya la conocéis y combina con las flores.', con: 'El oliva es más amarillo que el sobre y queda raro junto al naranja de la foto del cañón. El texto blanco sobre las bandas es el que peor se lee de todas.' },
  { id: 'salvia', name: 'Salvia del sobre y cañón', sub: 'Verde gris y naranja quemado', c: { paper: '#f6f0e3', alt: '#e8e3d0', green: '#7f866b', deep: '#5c634b', lead: '#b25a2a', ink: '#3a3229' },
    from: 'El verde gris sale del sobre y el naranja quemado, de la roca de la foto del cañón.',
    pro: 'La más parecida a la de ahora: mismo espíritu, pero el verde ya es el del sobre y el acento es el de la foto.', con: 'Es un cambio pequeño. El texto blanco sobre las bandas mejora, pero poco.' },
  { id: 'postal', name: 'Postal del Gran Cañón', sub: 'Azul petróleo y rojo roca', c: { paper: '#f6efdf', alt: '#eadfc6', green: '#46606b', deep: '#2f444e', lead: '#a4472f', ink: '#2e2a2b' },
    from: 'El azul petróleo es el cielo de la postal que sale del sobre, el rojo es su roca y el crema, su cartón.',
    pro: 'La web continúa los colores de lo primero que ve el invitado. El azul queda bien tanto con la foto naranja del cañón como con la del baile, y el texto sobre las bandas se lee muy bien.', con: 'Deja de ser una web verde: el sobre sigue siendo salvia y contrasta con el resto.' },
  { id: 'arenisca', name: 'Arenisca', sub: 'Arcilla y granate', c: { paper: '#faf1e6', alt: '#f1dfc9', green: '#a15b31', deep: '#7c4020', lead: '#7a2e12', ink: '#3b261b' },
    from: 'Toda sale de la foto del cañón: la arcilla de la roca para las bandas y su sombra más oscura para botón y enlaces.',
    pro: 'La más cálida y la que más se funde con la portada del móvil.', con: 'Todo queda en la misma familia de color, así que hay menos contraste entre secciones, y es la que más choca con el sobre verde.' },
  { id: 'marino', name: 'Marino y cobre', sub: 'Azul marino y cobre', c: { paper: '#f9f5ee', alt: '#ece4d8', green: '#2c3d55', deep: '#1c2940', lead: '#b5633a', ink: '#232a35' },
    from: 'El azul marino es el del vestido de la foto del baile; el cobre, el naranja del cañón algo más apagado.',
    pro: 'La más formal y la que mejor se lee: el texto blanco sobre el marino tiene el mayor contraste.', con: 'Es la más oscura y seria. Las bandas pesan mucho en una pantalla de móvil.' },
  { id: 'cielo', name: 'Cielo de Copenhague', sub: 'Azul claro y naranja', c: { paper: '#f7f4ee', alt: '#e3e8ee', green: '#6c83a3', deep: '#4a607f', lead: '#b55f33', ink: '#2c3340' },
    from: 'El azul claro es el cielo de las fotos de Madrid y Copenhague, frente al naranja del cañón.',
    pro: 'La más ligera y luminosa; azul y naranja son colores opuestos y se realzan.', con: 'Las secciones alternas pasan a ser azuladas, y el dibujo de La Cigüeña, que tiene fondo beige, se nota como un recuadro. El texto blanco sobre las bandas es justo.' },
];

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
// same derivation as fromFlower() in _dev/editor-site.js
const tokens = c => ({ paper: c.paper, 'paper-deep': c.alt, 'paper-line': mix(c.alt, c.ink, 0.12), olive: c.green, 'olive-deep': c.deep,
  'olive-soft': mix(c.green, c.paper, 0.55), terracotta: c.lead, 'terracotta-deep': mix(c.lead, '#000000', 0.2), ink: c.ink,
  'ink-soft': mix(c.ink, c.paper, 0.35), 'ink-faint': mix(c.ink, c.paper, 0.55), 'cream-text': mix(c.paper, '#ffffff', 0.3),
  'olive-wash': `rgba(${hex(c.green).join(', ')}, 0.16)` });
const lum = h => hex(h).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const read = r => r >= 4.5 ? 'buena' : r >= 3.2 ? 'justa' : 'floja';

const SHOTS = [['cuenta', 'Historia y cuenta atrás'], ['donde', 'Dónde y cuándo'], ['confirmar', 'Confirmación'], ['final', 'Regalo, fotos y final']];

const b = await chromium.launch();
for (const p of process.env.SKIP_SHOTS ? [] : PALETTES) {
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(SITE, { waitUntil: 'load' });
  const t = p.current ? null : tokens(p.c);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}#envelope-overlay,.float-btn,.lang-toggle{display:none!important}' + (t ? ':root{' + Object.entries(t).map(([k, v]) => `--${k}:${v}`).join(';') + '}' : '') });
  await page.evaluate(() => { document.body.classList.remove('envelope-closed', 'no-scroll'); document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'visible'; document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-in')); });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  const go = async (id, off) => { await page.evaluate(([i, o]) => { const el = document.getElementById(i); scrollTo(0, el ? el.getBoundingClientRect().top + scrollY - o : document.documentElement.scrollHeight); }, [id, off]); await page.waitForTimeout(900); };
  for (const [key, id, off] of [['cuenta', 'countdown', 250], ['donde', 'locations', 40], ['confirmar', 'rsvp', 150], ['final', '', 0]]) {
    await go(id, off);
    await page.screenshot({ path: `${D}/img/${p.id}-${key}.jpg`, type: 'jpeg', quality: 82 });
  }
  await page.close();
  console.log('shots', p.id);
}

const chip = (v, label) => `<div class="chip"><b style="background:${v}"></b><span>${label}</span><code>${v}</code></div>`;
const chips = p => { const t = tokens(p.c); return [chip(p.c.paper, 'Papel'), chip(p.c.alt, 'Secciones alternas'), chip(t['olive-soft'], 'Banda suave'), chip(p.c.green, 'Bandas'), chip(p.c.deep, 'Banda oscura'), chip(p.c.lead, 'Botón y enlaces'), chip(p.c.ink, 'Texto')].join(''); };
const strip = p => `<span class="strip">${['paper', 'alt', 'green', 'deep', 'lead', 'ink'].map(k => `<b style="background:${p.c[k]}"></b>`).join('')}</span>`;
const PHOTOS = [['hero-mobile.jpg', 'El cañón', ['#742a07', '#af6433', '#e9b380']], ['hero-desktop.jpg', 'El baile', ['#1a1d20', '#2c3d55', '#dee2e3']], ['historia-1.jpg', 'Madrid', ['#877262', '#a39586', '#d1e2ec']],
  ['historia-2.jpg', 'Copenhague', ['#7b5133', '#d18865', '#a5baea']], ['historia-3.jpg', 'Valencia', ['#0b1821', '#b1c7af', '#ded6b2']], ['tarjeta.jpg', 'La postal', ['#3f545e', '#743a36', '#e8dec0']], ['sobre.jpg', 'El sobre', ['#9fa185', '#a6a98e', '#acb095']]];
const news = PALETTES.filter(p => !p.current);
const pagePal = (p, n) => `<section class="page">
  <p class="mono">${p.current ? 'Para comparar' : `Paleta ${n} de ${news.length}`}</p>
  <h2>${p.name}</h2>
  <p class="lead">${p.from}</p>
  <div class="chips">${chips(p)}</div>
  <div class="phones">${SHOTS.map(([k, cap]) => `<figure><div class="ph"><img src="img/${p.id}-${k}.jpg" alt=""></div><figcaption>${cap}</figcaption></figure>`).join('')}</div>
  <p class="mono" style="margin-top:18px">Junto a las fotos y el sobre, que no cambian</p>
  <div class="tiles">
    <div style="background:${p.c.green}"><img src="../../assets/hero-mobile.jpg" alt=""><span style="color:${tokens(p.c)['cream-text']}">Banda</span></div>
    <div style="background:${tokens(p.c)['olive-soft']}"><img src="../../assets/hero-desktop.jpg" alt=""><span style="color:${p.c.ink}">Banda suave</span></div>
    <div style="background:${p.c.paper}"><img src="../../assets/tarjeta.jpg" alt=""><span style="color:${p.c.lead}">Enlace</span></div>
    <div style="background:${p.c.alt}"><img src="../../assets/sobre.jpg" alt=""><span style="color:${p.c.ink}">Alterna</span></div>
  </div>
  <div class="procon"><p><b>A favor.</b> ${p.pro}</p><p><b>En contra.</b> ${p.con}</p>
  <p class="small">Lectura del texto blanco sobre las bandas: <b>${read(contrast(tokens(p.c)['cream-text'], p.c.green))}</b>. Lectura de los enlaces sobre el papel: <b>${read(contrast(p.c.lead, p.c.paper))}</b>.</p></div>
</section>`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Paletas nuevas</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Allison&family=Special+Elite&display=swap" rel="stylesheet">
<style>
  :root { --paper:#f3eee3; --paper-deep:#e9e2d1; --paper-line:#d9d0ba; --ink:#3a3a2e; --ink-soft:#6a6a58; --accent:#6c6f48;
    --serif:'Cormorant Garamond',serif; --script:'Allison',cursive; --mono:'Special Elite','Courier New',monospace; }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin:0; background:#ddd; font-family:var(--serif); color:var(--ink); }
  .page { width:794px; height:1123px; background:var(--paper); margin:0 auto 20px; padding:44px 50px; position:relative; overflow:hidden; page-break-after:always; }
  h1 { font-family:var(--script); font-weight:400; font-size:58px; line-height:1; margin:0 0 10px; }
  h2 { font-family:var(--script); font-weight:400; font-size:48px; line-height:1; margin:2px 0 8px; }
  p { font-size:15.5px; line-height:1.45; margin:0 0 10px; }
  .lead { font-size:17px; color:var(--ink-soft); max-width:660px; }
  .mono { font-family:var(--mono); font-size:10.5px; letter-spacing:1.4px; text-transform:uppercase; color:var(--accent); margin-bottom:4px; }
  .small { font-size:13px; color:var(--ink-soft); }
  .photos { display:grid; grid-template-columns:repeat(7,1fr); gap:10px; margin:16px 0 22px; }
  .photos figure { margin:0; } .photos .im { height:118px; border-radius:4px; overflow:hidden; } .photos img { width:100%; height:100%; object-fit:cover; display:block; }
  .photos .dots { display:flex; gap:4px; margin-top:6px; } .photos .dots b { flex:1; height:12px; border-radius:6px; border:1px solid rgba(0,0,0,.1); }
  .photos figcaption { font-size:12.5px; color:var(--ink-soft); margin-top:3px; }
  table { border-collapse:collapse; width:100%; margin-top:6px; } td { border-top:1px solid var(--paper-line); padding:9px 6px; font-size:14.5px; vertical-align:middle; line-height:1.3; }
  td.n { font-family:var(--mono); font-size:11px; color:var(--accent); width:22px; } td.nm { font-weight:600; font-size:16px; width:205px; } td.nm i { display:block; font-weight:400; font-size:13.5px; color:var(--ink-soft); }
  .strip { display:flex; width:168px; height:30px; border-radius:6px; overflow:hidden; border:1px solid rgba(0,0,0,.1); } .strip b { flex:1; }
  .box { margin-top:18px; padding:14px 18px; background:var(--paper-deep); border-radius:6px; } .box p:last-child { margin:0; }
  .chips { display:grid; grid-template-columns:repeat(7,1fr); gap:8px; margin:12px 0 16px; }
  .chip b { display:block; height:44px; border-radius:6px; border:1px solid rgba(0,0,0,.1); } .chip span { display:block; font-size:12.5px; line-height:1.2; margin-top:5px; } .chip code { font-family:var(--mono); font-size:9.5px; color:var(--ink-soft); }
  .phones { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; } .phones figure { margin:0; }
  .ph { border:5px solid #1d1d19; border-radius:22px; overflow:hidden; background:#fff; } .ph img { width:100%; display:block; }
  .phones figcaption { font-size:13px; color:var(--ink-soft); text-align:center; margin-top:6px; }
  .tiles { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:6px; }
  .tiles div { height:172px; border-radius:6px; border:1px solid rgba(0,0,0,.1); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; }
  .tiles img { height:118px; width:96px; object-fit:cover; border:4px solid #fbf9f3; box-shadow:0 2px 8px rgba(0,0,0,.18); }
  .tiles span { font-size:14px; font-style:italic; }
  .procon { margin-top:16px; } .procon p { margin-bottom:7px; }
</style></head><body>
<section class="page">
  <p class="mono">Invitación digital · noviembre de 2026</p>
  <h1>Paletas nuevas</h1>
  <p class="lead">Cinco propuestas de color sacadas de las fotos que ya están en la web. Cada una ocupa una página, con cuatro pantallas reales de la invitación tal como quedaría. La última página es la paleta de ahora, para comparar.</p>
  <p class="mono" style="margin-top:22px">De dónde salen los colores</p>
  <div class="photos">${PHOTOS.map(([f, cap, cs]) => `<figure><div class="im"><img src="../../assets/${f}" alt=""></div><div class="dots">${cs.map(c => `<b style="background:${c}"></b>`).join('')}</div><figcaption>${cap}</figcaption></figure>`).join('')}</div>
  <p>Las fotos tiran hacia dos familias: los naranjas y tierras del cañón, y los azules del cielo, de la postal y del vestido. El oliva de ahora no aparece en ninguna, y el verde del sobre es más gris que él.</p>
  <p class="mono" style="margin-top:20px">Las cinco, de un vistazo</p>
  <table>${news.map((p, i) => `<tr><td class="n">${i + 1}</td><td class="nm">${p.name}<i>${p.sub}</i></td><td>${strip(p)}</td><td>${p.from}</td></tr>`).join('')}</table>
  <div class="box"><p><b>Cómo leer los colores.</b> De izquierda a derecha: papel de fondo, secciones alternas, bandas (confirmación y final), banda oscura, botón y enlaces, texto.</p>
  <p><b>Lo que no cambia con la paleta.</b> El sobre es una foto y sigue siendo verde salvia; los dibujos de la iglesia, del convite y de la hoja de ruta mantienen su tono sepia.</p>
  <p><b>Sugerencia.</b> La 2, la de la postal: es lo primero que sale del sobre, así que la web seguiría con sus colores. La 1 es la opción prudente y la 4, la más formal.</p></div>
</section>
${news.map((p, i) => pagePal(p, i + 1)).join('\n')}
${pagePal(PALETTES[0], 0)}
</body></html>`;
writeFileSync(`${D}/paletas.html`, html);

const p = await b.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1.5 });
await p.goto('file://' + D + '/paletas.html', { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
await p.pdf({ path: D + '/paletas.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
const pages = await p.$$('.page');
for (let i = 0; i < pages.length; i++) { const bb = await pages[i].evaluate(el => [el.scrollHeight, el.clientHeight]); if (bb[0] > bb[1]) console.log('OVERFLOW page', i + 1, bb); }
if (process.env.PREVIEW) for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: `${process.env.PREVIEW}/pdf${i + 1}.png` });
console.log('pages', pages.length);
await b.close();
