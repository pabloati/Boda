# Site editor

A Canva-like editor for the wedding site, local and unpublished (GitHub Pages skips `_dev/`).

Run `python3 _dev/serve.py [port]` from any worktree and open `http://localhost:8000/_dev/flores.html`.

## What it edits

| Tab | What | Saved to |
| --- | --- | --- |
| Flores | botanical plates on the sections (see `docs/flores/README.md`); headings and paragraphs can be dragged too and put under or over the plates (`transform` + `z-index`, own desktop variant like the plates). Clicking a text also gives it its own **style**: size in px, colour, alignment and font role (Texto / Títulos / Manuscrita), separate for phone and desktop like the move, with undo/redo. «Quitar estilo» removes only the style, «Dejar en su sitio» only the move | plates in `js/flores-layout.js`, moved and styled texts in `css/editor.css` (`text`, rules under `#main-content [data-i18n=…]`) |
| Textos | every `data-i18n` text, Spanish and English. Click a text on the page and **write on it** (Enter is a line break, a paste is plain text, Esc or a click elsewhere ends it; the Spanish box follows), or pick it in the list. English only in its box | Spanish inside `index.html`, English in the `EN` map of `js/i18n.js` |
| Colores | a palette (current, spring, the five flower palettes, or the couple's own: "Nueva paleta" takes six base colours and derives the rest), or any single colour token, by picker or hex code | `css/editor.css` (own palettes in its `palettes` state) |
| Fuentes | the font of each role (Texto `--font-serif`, Títulos `--font-script`, Manuscrita `--font-hand`) from a short list of free Google Fonts; script fonts carry a size factor (`--font-script-scale`) so headings keep about the same width. «Las de la web» goes back to Cormorant Garamond / Allison / Homemade Apple. The list lives in `editor_api.FONTS` | `css/editor.css` (`fonts`; the file starts with an `@import` of the chosen families plus the `:root` tokens) |
| Fotos | the two hero photos and the RSVP "Enviando…" photo (resized in the browser, JPEG), and their framing | `assets/*.jpg`, framing in `css/editor.css` |
| Secciones | order and visibility (the hero always first); per section, **Fondo** (Como está / Papel / Papel oscuro / Verde, green with light text like the RSVP band) and **Arriba / Abajo** spacing (Menos / Normal / Más = ×0.6 / ×1 / ×1.5 of the current padding, phone and desktop). «↺» puts that section's background and spacing back | `css/editor.css` (`order`, `hidden`, `bg`, `space`) |
| Historial | the branch's last 40 saves, newest first (the editor's in pink). «Volver a este punto» puts the site back as it was then with a **new save on top** (`POST /_dev/api/revert`, the commit must belong to the branch); nothing is deleted, and it is refused with unsaved changes | a new commit `editor (<name>): volver a <sha> (…)` |

`css/editor.css` is generated, loaded after `styles.css`, and keeps its own state in a comment
(`/* editor-state {...} */`). Deleting it returns the site to `styles.css` alone. Inside the editor
the branch's saved `editor.css` is switched off and a live copy (`lookCSS()` in `editor-site.js`)
replaces it, so anything `write_look()` writes must be mirrored there.

## Bar buttons

- **Ver en mi móvil** shows the link and a QR code of the current branch's preview
  (`/b/<branch>/index.html`, served from git, so it shows the last save). Scan it with the phone
  or copy the link. The link always uses the server's public tunnel address: the page's own when
  the editor was opened through the tunnel; from localhost, the address `compartir.sh` or the
  container wrote to `BODA_PUBLIC_LINK_FILE` (`GET /_dev/api/public`). A server without a tunnel
  (plain `serve.py`) shows no QR, only how to get one, since the phone cannot reach it. The phone
  logs in once and lands on the preview. The QR is drawn locally by `_dev/qr.js`, no library.
- **Móvil / Escritorio.** The phone view is a fixed screen: the width and the visible height of
  the model chosen above the frame (`MODELS` in `flores.html`, default iPhone 12 – 14, 390 × 664;
  the choice is remembered per browser). The height is the screen minus the browser's bars (about
  185 px on iOS, 130 px on Android), so it is approximate. A window too short for the phone scales
  it down whole instead of cutting it. The desktop view is 1200 px wide and as tall as the window.
- **Zoom** (− / % / + above the page, or Ctrl + wheel over it) draws the page bigger in steps up
  to four times the size that fits the window. The page keeps its own width, so nothing reflows:
  it is only for placing things more finely. The percentage is the real scale; clicking it goes
  back to the fitted size.
- **Sincronizar** brings the open branch level with GitHub, for work done outside the editor
  (another computer, a Claude session) and pushed there. It fetches, brings in the commits the
  editor lacks (fast-forward, or a merge commit `sincronizar: unir <branch> con GitHub` when there
  are saves on both sides) and pushes the saves GitHub lacks; then it reloads the branch and the
  branch list. The badge on the button counts what waits each way (↓ on GitHub, ↑ not pushed yet;
  `GET /_dev/api/sync?branch=…`, checked on opening a branch, after a save and every five minutes,
  with at most one fetch every two minutes). With unsaved changes nothing is brought in: save or
  discard first. Both sides always stamp a new `?v=` on the same links, so that collision is merged
  again without the stamps and given a fresh one (`_merge_stamps`); any real conflict undoes the
  merge, changes nothing and asks to tell Pablo. `main` is only ever brought in, never pushed:
  that is «Publicar».
- **Publicar** merges the open branch into `main` and pushes `main`, which publishes the site at
  once. The right panel first lists the saves that would go live (`GET /_dev/api/publish?branch=…`,
  a dry run). It is refused with unsaved changes, on `main` itself, when `main` has local commits
  not on GitHub, or when GitHub has changes the editor lacks. A conflict aborts the merge, leaves
  `main` untouched and asks to tell Pablo. The branch is pushed first if needed; the merge commit
  reads `publicar: <branch> (editor, <who>)`. «Publicar ahora» sends the branch commit the list was
  made from; if someone saved on the branch since, nothing is published (409) and the panel shows
  the new list to confirm again.

## Adding and deleting sections

The Secciones tab can add a section: a script heading and a paragraph. It is written into
`index.html` as `<section class="section extra-section" id="extra-N">` just before the footer, with
its texts under `extraN.title` and `extraN.text` (the English entries start as a copy of the
Spanish and are rewritten in the Textos tab). From then on it is a section like the rest: order,
background, spacing, flowers and moved texts all work on it, because the section list is read from
the page (`editor_api.sections()`, sent to the editor in `/_dev/api/state`).

«Eliminar» takes any section out of the page for good, the original ones included: its markup
(with the comment line above it), the flowers placed on it and what `editor.css` says about it
(order, background, spacing, moved texts). An added section also loses its English entries; the
original ones keep theirs in `js/i18n.js`, because scripts may use the same keys and an unused
entry does no harm. The site's scripts null-guard every lookup, so a missing section breaks
nothing. It is refused on `main` (delete on a branch and publish it). The checkbox still hides a
section without deleting it.

The padlock locks a section (`locked` in the editor state of `editor.css`, saved with «Guardar»):
its row cannot be deleted, hidden, moved or restyled until it is unlocked, and the server refuses
to delete it. The lock covers the section's row, not the texts and flowers inside it.

Both are saves of their own (`POST /_dev/api/section`, one commit each), since they change the
page the editor is showing: they need everything else saved first, and they can be undone from the
Historial.

## Safety

- **Branch changed elsewhere.** The editor remembers the commit it opened the branch at and sends
  it with every save; if another computer saved in between, the server answers 409 and the panel
  offers «Recargar y perder mis cambios» or «Guardar igualmente» (writes on top, no merging). Every
  minute (and when the tab comes back) it checks the branch and shows «Alguien ha guardado en esta
  rama».
- **Drafts.** Texts, colours, fonts, sections, moved/styled texts and flowers are kept in the
  browser per branch (`site-draft:<branch>`, `flores-draft:<branch>`) and offered back with one
  banner when the branch is opened again. Photos are not drafted. A draft remembers the commit and
  the look/layout it started from: if another computer saved since, «Recuperar» re-applies only what
  the draft changed on top of the newer version (per colour, font, section, text property and
  flower), so the other computer's changes stay.
- **One save at a time per branch.** Saves and «Volver a este punto» on the same branch run one
  after the other on the server (the 409 check and the commit are one step). «Volver a este punto»
  is refused on `main`: go back on a branch and publish it.
- **API reads** (`GET /_dev/api/…`) only answer this machine's Host in local mode and, from a
  browser, only requests from the editor's own site (`Sec-Fetch-Site`), because opening a branch
  creates a worktree and the publish dry run fetches from GitHub.

## Branches

The bar has a branch selector: the editor loads that branch's files and **Guardar** writes the
changes into that branch and commits them (author pabloati, message `editor (<name>): <what>`),
then pushes the branch if "Subir" is ticked. A branch nobody has checked out gets a worktree under
`.claude/worktrees/ed-<branch>`. "＋ Nueva rama…" creates a branch from the current one. Editing
`main` publishes the site on push: use a branch and «Publicar» (or merge by hand).

Saving bumps the `?v=` cache-busters of the css/js links and of any changed photo (`YYYYMMDDHHMM-<sha>`,
the minute plus the commit the save goes on top of, so the URL changes even for a go-back made in
the same minute as the save it undoes).

Server side: `_dev/editor_api.py` (validation: texts keep only a few inline tags and safe links;
colours must be hex or rgb(a); branch names `[A-Za-z0-9._-]`; photos must be JPEG under 4 MB).
Front end: `_dev/flores.html` (flowers, text style, panels) + `_dev/editor-site.js` (the other tabs,
branch, save, drafts, share and publish) + `_dev/qr.js` (QR encoder).
