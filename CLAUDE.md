# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page digital wedding invitation in Spanish, plus an RSVP form to collect guest data. Plain HTML5 + CSS3 + vanilla JavaScript, no build step, no dependencies to install. Guests will open it from a WhatsApp link on their phones, so mobile is the primary target.

## Commands

There is no build, lint, or test suite. Preview locally with:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Opening `index.html` directly from the filesystem also works, but the clipboard API only works over `http://localhost` or `https://`.

To screenshot at phone and desktop widths, Playwright is available via Node (`npx playwright`). Install Chromium once with `npx playwright install chromium` in a scratch directory, not in the repo.

## Layout

- `index.html` — all markup, in section order: envelope overlay, floating controls (back-to-top + music), hero, intro band (quote), parents, countdown, venues (two columns with drawing slots), timeline, RSVP form, gift/IBAN, playlist (search + vote, `js/playlist.js`), photos/hashtag, footer.
- `css/styles.css` — one file. Design tokens live in `:root` at the top (olive / cream paper / terracotta palette, `--font-serif` Cormorant Garamond for all text, `--font-script` Allison for headings, `--font-hand` Homemade Apple for handwritten labels). Paper grain is an inline SVG on `body::before`. The only breakpoint is `@media (max-width: 768px)` near the end.
- `js/script.js` — one IIFE, numbered sections: DOM refs, audio engine, envelope open, countdown, `.ics` generator, RSVP conditional fields, RSVP submit (POST to Apps Script) + WhatsApp contact link, clipboard copy, back-to-top. `js/rsvp-config.js` holds the endpoint URL and WhatsApp number.
- `assets/` — images: `sobre.jpg`, `sello.png`, `sobre-papel.jpg` (envelope layers), `tarjeta.jpg` (the couple's card inside the envelope), stock hero photos (placeholders), drawing slots `dibujo-iglesia.png` / `dibujo-convite.png` (appear when the files exist). Background track: `assets/Emborracharme.mp3`.
- `docs/backlog.md` — the agreed work plan. `docs/decisions.md` — one-line log of choices.

## Things that are easy to get wrong

- **Wedding date is duplicated** in three places: the `data-target-date` attribute on `#countdown-clock`, the `DTSTART`/`DTEND` lines in the `.ics` block of `js/script.js` (UTC, so Madrid summer time = local minus 2h), and the visible text throughout `index.html`.
- **CSS/JS links carry a `?v=YYYYMMDD` cache-buster** in `index.html` and `playlist-admin.html`. Bump it in every link whenever `css/` or `js/` changes, or visitors get new HTML with stale styles for up to 10 minutes (GitHub Pages caching).
- **There is no icon font.** `js/playlist.js` and `js/script.js` still emit Font Awesome class names (`fa-heart`, `fa-play`…); the "icon shim" block at the end of `css/styles.css` maps them to plain glyphs. Add a glyph there if you use a new class name. Never add the Font Awesome CDN back: the artifact preview blocks it and the design avoids icons on purpose.
- **The RSVP form posts to a Google Apps Script endpoint** set in `js/rsvp-config.js` (empty = the form shows an error on submit). The WhatsApp number in the same config only feeds the "¿Alguna duda?" contact link; the form cannot be sent by WhatsApp. Setup and field list in `docs/rsvp.md`.
- **JS is defensive by design.** Every DOM lookup is null-guarded so sections can be removed from the HTML without breaking the script. Keep that pattern when adding features.
- **User-provided text goes through `escapeHtml()`** before being inserted with `innerHTML`. Keep doing that.

## Design

Target look (decided 2026-10-06): layout and tone of mieventobonito.com/marianoytere, colours of petalandpixel.wixsite.com/martaycarlos. No eyebrow labels, section descriptions, cards, badges or icon buttons; one script heading per section, text links instead of buttons except the terracotta primary. The envelope overlay is a photo (`assets/sobre.jpg`, 9:16) sliced into `clip-path` layers; the geometry percentages are documented in the HTML comment above `#envelope-overlay`. The seal is `assets/sello.png` with the monogram as CSS text. The older CSS-drawn envelope is kept in `docs/sobre-variante-css.css`. Preview the branch as a private Claude artifact (link in `NOTES.local.md`) before merging to `main`.

## Content and language

The site is bilingual (ES default, EN via the top-left toggle, `js/i18n.js`). **Every guest-facing text must be translatable:**
- Static text in `index.html`: add `data-i18n="section.key"` (or `data-i18n-placeholder`, `data-i18n-aria`, `data-i18n-title`) and the English entry in the `EN` map of `js/i18n.js`. Spanish is read from the HTML, so it is not repeated in the dictionary.
- Text built by a script: call `t('key', { var })` (alias of `I18N.t`) and add both the `ES` and `EN` entries. `{var}` placeholders are substituted.
- When a new text is added, write its English in the same commit. A missing EN entry shows a `[i18n] missing` warning in the browser console and falls back to Spanish.
- `js/i18n.js` loads before the other scripts. `js/playlist.js` re-renders its dynamic strings on the `langchange` event.

All guest-facing copy is Spanish (Spain). The guest is addressed as `tú`; sentence case in headings (no Title Case). Tone target: short and personal, no filler. The couple writes the short texts in the "Textos cortos" table of the data doc; do not invent jokes for them.

**Source of truth for real content** is a Claude Doc the couple edits, "Datos para la invitación de boda". Its link is in `NOTES.local.md` at the repo root (git-ignored; the repo is public). Each section of the site has a table there with a "Valor" column. When the user says the doc changed, read it with the Claude Docs tools (never web-fetch it) and update `index.html` / `js/script.js` to match. Anything still marked as placeholder in the doc stays as invented text and must be replaced before the site is shared.

## Git

Default branch is `main`. Commit as `pabloati <pabloatienzalo@gmail.com>` (the address linked to GitHub).
