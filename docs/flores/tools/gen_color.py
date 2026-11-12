"""Builds color.html: the colour cut-outs as page decoration.

Design rules (decided 2026-11-09):
- One neutral base shared by every palette: the site's own tokens (paper, olive, ink). Nothing on the
  page is tinted with a flower colour.
- A palette only adds ONE accent, taken from the flower (button and times), checked for contrast.
- A flower is never left floating and never has a straight cut edge in the open: a side that was cut
  when the plate was cropped is placed flush with the screen edge or with a change of section, and
  every section clips what is inside it, so nothing straddles two sections.
"""
import json, pathlib, re

R = pathlib.Path(__file__).resolve().parent.parent
CUTS = json.loads((R / 'tools' / 'cuts.json').read_text())
head = re.search(r'<style>(.*?)</style>', (R / 'dossier.html').read_text(), re.S).group(1)

BASE = dict(paper='#f3eee3', paper_deep='#e9e2d1', olive='#8e9166', olive_deep='#6c6f48', ink='#3b382f')


def lum(c):
    v = [int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


PAL = [
    dict(name='Jonquilla y muscari', f1='narcissus-bessa', f2='hyacinth-botryoides-batava', accent='#8f620a', flor='#e0b71e'),
    dict(name='Jacinto y anémona de bosque', f1='hyacinth-curtis', f2='anemone-nemorosa-batava', accent='#a24b72', flor='#c98aa6'),
    dict(name='Anémona azul y azafrán', f1='anemone-apennina-batava', f2='crocus-batava', accent='#3f6a93', flor='#4a78a8'),
    dict(name='Glicinia y narciso de los poetas', f1='wisteria-witte', f2='narcissus-poeticus-batava', accent='#6a4f8f', flor='#5b4a78'),
    dict(name='Manzano y muguete', f1='malus-kohler', f2='convallaria-kohler', accent='#b5553e', flor='#d9755f'),
]
HANG = {'wisteria-witte'}          # hangs from the top edge of its section


def fl(name, side, h, strip=False):
    """A flower pinned to the edges it was cut on (or to the bottom, standing on the section edge)."""
    cut = CUTS[name]['cut']
    if name in HANG:
        h = min(h, 108)
    w0, h0 = CUTS[name]['size']
    if strip and w0 / h0 > 1.2:
        h = 40
    st = [f'height:{h}px']
    if name in HANG:
        st.append('top:0')
    else:
        st.append('bottom:0')
    if cut['left'] > 0.15 and cut['right'] <= 0.15:
        st.append('left:0')
    elif cut['right'] > 0.15 and cut['left'] <= 0.15:
        st.append('right:0')
    else:
        st.append(('left' if side == 'L' else 'right') + ':10px')
    return f'<img class="fl" src="img/color/{name}.png" style="{";".join(st)}">'


def phone(p, scale=True):
    a = p['accent']
    return f'''<div class="ph-wrap"><div class="phone cp" style="--acc:{a}"><div class="scr">
      <div class="sec" style="background:var(--olive-deep);color:var(--cream);height:170px;padding-top:42px">
        <div class="cap">Nos casamos</div><div class="script" style="font-size:34px;margin-top:8px">Mª Ángeles &amp; Pablo</div>
        <div style="font-size:13px;margin-top:6px">Sábado, 13 de marzo de 2027</div></div>
      <div class="sec" style="background:var(--paper);height:236px;padding-top:16px">
        <div class="cap" style="color:var(--olive-deep)">Itinerario</div><div class="script" style="color:var(--ink);margin-top:2px">Hoja de ruta</div>
        <div style="font-size:12.5px;margin-top:6px;line-height:1.65"><span class="tl-time" style="color:var(--acc)">12:30</span> Ceremonia<br><span class="tl-time" style="color:var(--acc)">14:30</span> Convite<br><span class="tl-time" style="color:var(--acc)">19:00</span> Fiesta</div>
        {fl(p['f1'], 'L', 138)}{fl(p['f2'], 'R', 122)}
      </div>
      <div class="sec" style="background:var(--olive);color:var(--cream);height:118px;padding-top:16px">
        <div class="script">¿Nos acompañas?</div><div class="btn" style="margin-top:12px;background:var(--acc)">Confirmar</div></div>
      <div class="sec" style="background:var(--paper);height:82px;padding-top:12px"><div class="script" style="color:var(--ink);font-size:28px">Fotos</div><div style="font-size:11px">#BodaMariAngelesYPablo</div>
        {fl(p['f2'], 'L', 66, True)}{fl(p['f1'], 'R', 70, True)}</div>
    </div></div></div>'''


def chip(c):
    return f'<span class="sw" style="background:{c}"></span>'


def img(n, h=64):
    return f'<img src="img/color/{n}.png" style="height:{h}px;width:auto">'


# --- page 1: how the palettes are organised -------------------------------------------------
rows = ''.join(
    f'''<tr><td>{p["name"]}</td><td class="im2">{img(p["f1"])}{img(p["f2"])}</td><td>{chip(p["accent"])}<span class="mono" style="font-size:9px"> {p["accent"]}</span></td><td class="small">{contrast("#ffffff", p["accent"]):.1f} : 1</td></tr>'''
    for p in PAL)
base = ''.join(f'<div class="bs"><span class="sw big" style="background:{v}"></span><div class="mono" style="font-size:8.5px">{k.replace("_", " ")}</div><div class="small">{v}</div></div>' for k, v in BASE.items())
page1 = f'''<section class="page"><h1>Cómo se organizan las paletas</h1>
<p class="lead">Dos capas. La base es la misma de la web en todas las páginas y no cambia con la flor. Cada paleta añade solo un acento, sacado del color de la flor, y la flor misma ya aporta el resto del color.</p>
<h3 style="margin-top:20px">1 · Base neutra, igual en las cinco</h3>
<p class="small">Son los colores que ya tiene la web en <span class="mono" style="font-size:9px">css/styles.css</span>. El fondo de las secciones es el papel, el cuerpo del RSVP es el oliva de siempre y la cabecera usa el oliva oscuro. Nada se tiñe de flor.</p>
<div class="bases">{base}</div>
<h3 style="margin-top:22px">2 · Un acento por paleta</h3>
<p class="small">Se usa en tres sitios: el botón, las horas del itinerario y los enlaces. Es el color de la flor oscurecido hasta que el texto blanco del botón se lee bien (el mínimo recomendado es 4,5 : 1).</p>
<table class="season acc"><tr><th>Paleta</th><th>Flores</th><th>Acento</th><th>Contraste del botón</th></tr>{rows}</table>
<h3 style="margin-top:22px">Por qué así</h3>
<ul class="bullets"><li>El color grande de cada página es el de las flores, así que no compite con un fondo teñido.</li>
<li>Cambiar de paleta es cambiar dos imágenes y un valor de color. Nada más.</li>
<li>La base es la misma, así que las cinco páginas se parecen entre sí y a la web actual.</li></ul></section>'''

# --- page 2: placement rules ----------------------------------------------------------------
bad = '''<div class="ph-wrap" style="width:216px;height:300px"><div class="phone cp" style="--acc:#3f6a93;height:416px;width:300px;transform:scale(.72);transform-origin:top left"><div class="scr">
  <div class="sec" style="background:var(--paper);height:300px;padding-top:16px"><div class="cap" style="color:var(--olive-deep)">Itinerario</div><div class="script" style="color:var(--ink)">Hoja de ruta</div>
  <img class="fl" src="img/color/anemone-apennina-batava.png" style="height:150px;left:38px;top:120px"></div>
  <div class="sec" style="background:var(--olive);height:116px"></div></div></div></div>'''
good = '''<div class="ph-wrap" style="width:216px;height:300px"><div class="phone cp" style="--acc:#3f6a93;height:416px;width:300px;transform:scale(.72);transform-origin:top left"><div class="scr">
  <div class="sec" style="background:var(--paper);height:300px;padding-top:16px"><div class="cap" style="color:var(--olive-deep)">Itinerario</div><div class="script" style="color:var(--ink)">Hoja de ruta</div>
  <img class="fl" src="img/color/anemone-apennina-batava.png" style="height:150px;left:0;bottom:0"></div>
  <div class="sec" style="background:var(--olive);height:116px"></div></div></div></div>'''
page2 = f'''<section class="page"><h1>Cómo se colocan las flores</h1>
<p class="lead">Dos fallos que no quiero en la web: plantas que flotan en medio de una sección y bordes rectos cortados que no coinciden con ningún cambio de sección.</p>
<div class="pair" style="margin-top:12px;gap:34px"><div><div class="cap" style="color:var(--terracotta-deep);margin-bottom:6px">Mal</div>{bad}<p class="small" style="margin-top:6px">La flor flota y su borde izquierdo, cortado en la lámina, queda recto en el aire.</p></div>
<div><div class="cap" style="color:var(--olive-deep);margin-bottom:6px">Bien</div>{good}<p class="small" style="margin-top:6px">El lado cortado va pegado al borde de la pantalla y la base se apoya en el cambio de sección.</p></div></div>
<h3 style="margin-top:24px">Reglas</h3>
<ul class="bullets">
<li><b>Toda flor toca un borde.</b> Se apoya en el cambio de sección que tiene debajo, o cuelga del que tiene encima (la glicinia). Ninguna queda a media altura.</li>
<li><b>Un lado cortado va pegado a un borde.</b> Si la lámina estaba cortada por la izquierda, la flor va al borde izquierdo de la pantalla. Si estaba cortada por abajo, se apoya en el cambio de sección.</li>
<li><b>Cada sección recorta lo suyo.</b> Una flor nunca cruza de una sección a otra, así que ningún corte recto cae dentro de un fondo.</li>
<li><b>Sin marcas de agua flotantes.</b> Quito la flor grande y tenue de detrás del RSVP de la versión anterior.</li></ul></section>'''

# --- pages 3-4: palettes ---------------------------------------------------------------------
def page_pal(items, title):
    cols = ''.join(
        f'<div><div class="cap" style="color:var(--olive-deep)">{p["name"]}</div><div class="swr" style="margin:6px 0 8px">{chip(p["accent"])}<span class="small">acento {p["accent"]}</span></div>{phone(p)}</div>' for p in items)
    return f'<section class="page"><h1>{title}</h1><p class="lead">Misma base, distinta flor y distinto acento. Fíjate en que el papel, el oliva y la cabecera no cambian.</p><div class="row3">{cols}</div></section>'


# --- page 5: fusion with the travel notebook -------------------------------------------------
STOPS = [('12:30', 'Ceremonia', 'hyacinth-curtis'), ('14:30', 'Convite', 'redoute-narcissus'), ('19:00', 'Fiesta', 'anemone-nemorosa-batava'), ('23:00', 'Buses', 'crocus-batava')]
stops = ''.join(
    f'''<div class="stopband" style="background:{'var(--paper)' if i % 2 == 0 else 'var(--paper-deep)'}"><div class="pin"><img src="img/color/{n}.png" style="object-fit:contain"></div><div class="tl-time" style="color:var(--acc)">{t}</div><div style="font-size:15px">{lab}</div>{fl(n, 'R', 84)}</div>'''
    for i, (t, lab, n) in enumerate(STOPS))
route = f'''<div class="ph-wrap" style="width:300px;height:620px"><div class="phone cp" style="--acc:#8f620a"><div class="scr">
  <div class="sec" style="background:var(--paper);padding-top:20px;height:92px"><div class="cap" style="color:var(--olive-deep)">Itinerario</div><div class="script" style="color:var(--ink)">Hoja de ruta</div></div>
  <div style="position:relative">{stops}<div class="route" style="top:0;bottom:0;z-index:0"></div></div>
  <div class="sec" style="background:var(--olive);color:var(--cream);height:130px;padding-top:20px"><div class="script">¿Nos acompañas?</div><div class="btn" style="margin-top:10px;background:var(--acc)">Embarcar</div></div>
</div></div></div>'''
card = f'''<div class="ph-wrap" style="width:300px;height:620px"><div class="phone cp" style="--acc:#3f6a93"><div class="scr">
  <div class="sec" style="background:var(--olive-deep);color:var(--cream);height:230px;padding-top:96px"><div class="cap">Nos casamos</div><div class="script" style="font-size:36px;margin-top:8px">Mª Ángeles &amp; Pablo</div><div style="font-size:13px;margin-top:6px">Sábado, 13 de marzo de 2027</div>
    <div class="stamp" style="right:16px;top:14px;width:70px"><img src="img/color/narcissus-bessa.png" style="width:48px;height:60px;object-fit:cover;object-position:left"><div class="d">13·III·2027</div></div></div>
  <div class="sec" style="background:var(--olive);height:390px;padding-top:16px"><div class="script" style="color:var(--cream)">¿Nos acompañas?</div>
    <div class="pass" style="color:var(--ink);margin-top:12px"><div class="h"><div><div class="mono" style="font-size:7px">Pasajero</div>Tu nombre</div><div><div class="mono" style="font-size:7px">Embarque</div>13 MAR</div></div>
      <div class="b" style="height:130px;position:relative;overflow:hidden">Asistencia · Menú · Bus{fl('crocus-batava', 'R', 118)}</div></div>
    <div class="btn" style="margin-top:14px;background:var(--acc)">Embarcar</div></div>
</div></div></div>'''
page5 = f'''<section class="page"><h1>Mezcla con el cuaderno de viaje</h1>
<p class="lead">Las ideas B (ruta florida) y A (sello y tarjeta) con las láminas a color y las mismas reglas de colocación. En la ruta cada parada es una banda propia, y así cada flor se apoya en el borde de su banda.</p>
<div class="pair" style="margin-top:12px"><div><div class="cap" style="color:var(--olive-deep);margin-bottom:6px">B · La ruta florida</div>{route}</div><div><div class="cap" style="color:var(--olive-deep);margin-bottom:6px">A · Sello y tarjeta</div>{card}</div></div>
<p class="small" style="margin-top:12px">En la tarjeta de embarque la flor queda pegada a la esquina de la tarjeta y la recorta su borde redondeado. El sello lleva solo el ramillete, recortado al marco del sello.</p></section>'''

extra = '''
.row3 { display:grid; grid-template-columns:repeat(3,216px); gap:20px 21px; margin-top:12px; justify-content:space-between; }
.ph-wrap { width:216px; height:446px; } .ph-wrap .phone { transform:scale(.72); transform-origin:top left; }
.swr { display:flex; gap:7px; align-items:center; } .sw { width:26px; height:14px; border-radius:7px; border:1px solid rgba(0,0,0,.12); display:inline-block; } .sw.big { width:56px; height:34px; border-radius:6px; }
.bases { display:flex; gap:16px; margin-top:8px; } .bs { flex:1; } .bs .big { display:block; margin-bottom:5px; }
table.acc td { text-align:left; vertical-align:middle; } .im2 { display:flex; gap:8px; align-items:flex-end; }
.cp { --paper:#f3eee3; --paper-deep:#e9e2d1; --olive:#8e9166; --olive-deep:#6c6f48; --ink:#3b382f; --cream:#f6f2e8; }
.sec { overflow:hidden; }
.stopband { position:relative; height:94px; padding:12px 0 0 62px; text-align:left; overflow:hidden; border-bottom:1px solid var(--paper-line); }
.stopband .pin { top:14px; z-index:1; }
.route { z-index:0; }
'''
html = (f'<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Flores a color</title>'
        '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Allison&family=Homemade+Apple&family=Special+Elite&display=block" rel="stylesheet">'
        f'<style>{head}{extra}</style></head><body>{page1}{page2}{page_pal(PAL[:3], "Cinco paletas (1 de 2)")}{page_pal(PAL[3:], "Cinco paletas (2 de 2)")}{page5}</body></html>')
(R / 'color.html').write_text(html)
print('color.html', len(html), [round(contrast('#ffffff', p['accent']), 2) for p in PAL])
