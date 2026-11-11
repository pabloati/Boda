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
  or copy the link. Through the tunnel the phone logs in once and lands on the preview; from
  localhost the phone cannot reach the link. The QR is drawn locally by `_dev/qr.js`, no library.
- **Publicar** merges the open branch into `main` and pushes `main`, which publishes the site at
  once. The right panel first lists the saves that would go live (`GET /_dev/api/publish?branch=…`,
  a dry run). It is refused with unsaved changes, on `main` itself, when `main` has local commits
  not on GitHub, or when GitHub has changes the editor lacks. A conflict aborts the merge, leaves
  `main` untouched and asks to tell Pablo. The branch is pushed first if needed; the merge commit
  reads `publicar: <branch> (editor, <who>)`. «Publicar ahora» sends the branch commit the list was
  made from; if someone saved on the branch since, nothing is published (409) and the panel shows
  the new list to confirm again.

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

Saving bumps the `?v=` cache-busters of the css/js links and of any changed photo (`YYYYMMDDHHMM`,
with `-2`, `-3`… when a save or a go-back lands in the same minute, so the URL always changes).

Server side: `_dev/editor_api.py` (validation: texts keep only a few inline tags and safe links;
colours must be hex or rgb(a); branch names `[A-Za-z0-9._-]`; photos must be JPEG under 4 MB).
Front end: `_dev/flores.html` (flowers, text style, panels) + `_dev/editor-site.js` (the other tabs,
branch, save, drafts, share and publish) + `_dev/qr.js` (QR encoder).
