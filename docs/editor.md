# Site editor

A Canva-like editor for the wedding site, local and unpublished (GitHub Pages skips `_dev/`).

Run `python3 _dev/serve.py [port]` from any worktree and open `http://localhost:8000/_dev/flores.html`.

## What it edits

| Tab | What | Saved to |
| --- | --- | --- |
| Flores | botanical plates on the sections (see `docs/flores/README.md`) | `js/flores-layout.js` |
| Textos | every `data-i18n` text, Spanish and English; click a text on the page or pick it in the list | Spanish inside `index.html`, English in the `EN` map of `js/i18n.js` |
| Colores | a palette (current, spring, the five flower palettes) or any single colour token | `css/editor.css` |
| Fotos | the two hero photos and the RSVP "Enviando…" photo (resized in the browser, JPEG), and their framing | `assets/*.jpg`, framing in `css/editor.css` |
| Secciones | order and visibility (the hero always first) | `css/editor.css` |

`css/editor.css` is generated, loaded after `styles.css`, and keeps its own state in a comment
(`/* editor-state {...} */`). Deleting it returns the site to `styles.css` alone.

## Branches

The bar has a branch selector: the editor loads that branch's files and **Guardar** writes the
changes into that branch and commits them (author pabloati, message `editor (<name>): <what>`),
then pushes the branch if "Subir" is ticked. A branch nobody has checked out gets a worktree under
`.claude/worktrees/ed-<branch>`. "＋ Nueva rama…" creates a branch from the current one. Editing
`main` publishes the site on push: use a branch and merge.

Saving bumps the `?v=` cache-busters of the css/js links and of any changed photo.

Server side: `_dev/editor_api.py` (validation: texts keep only a few inline tags and safe links;
colours must be hex or rgb(a); branch names `[A-Za-z0-9._-]`; photos must be JPEG under 4 MB).
Front end: `_dev/flores.html` (flowers, panels) + `_dev/editor-site.js` (the other tabs, branch, save).
