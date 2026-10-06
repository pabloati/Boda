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

- `index.html` — all markup, in section order: envelope overlay, floating controls, hero, quote, parents, countdown, venues, timeline, RSVP form, dress code, gifts/IBAN, hotels + playlist, hashtag, footer.
- `css/styles.css` — one file. Design tokens live in `:root` at the top (burgundy/sage/gold/cream palette, `--font-serif` Cormorant Garamond, `--font-sans` Montserrat, `--font-script` Great Vibes). The only breakpoint is `@media (max-width: 768px)` near the end.
- `js/script.js` — one IIFE, numbered sections: DOM refs, audio engine, envelope open, countdown, `.ics` generator, RSVP conditional fields, RSVP submit / WhatsApp text builder, clipboard copy, song suggestions.
- `assets/` — images and audio (currently empty; the background track is still hotlinked from a third-party URL in `index.html`).
- `docs/backlog.md` — the agreed work plan. `docs/decisions.md` — one-line log of choices.

## Things that are easy to get wrong

- **Wedding date is duplicated** in three places: the `data-target-date` attribute on `#countdown-clock`, the `DTSTART`/`DTEND` lines in the `.ics` block of `js/script.js` (UTC, so Madrid summer time = local minus 2h), and the visible text throughout `index.html`.
- **Icons come from the Font Awesome 6 free CDN.** Pro-only icon names render as an empty box. Check the free set before adding one.
- **The RSVP form does not persist anything yet.** The "Guardar confirmación" handler only shows a success message. The WhatsApp button opens a prefilled message with no recipient number. A backend is planned; see `docs/backlog.md` section 3.
- **JS is defensive by design.** Every DOM lookup is null-guarded so sections can be removed from the HTML without breaking the script. Keep that pattern when adding features.
- **User-provided text goes through `escapeHtml()`** before being inserted with `innerHTML`. Keep doing that.

## Content and language

All guest-facing copy is Spanish (Spain, `vosotros` forms).

**Source of truth for real content** is a Claude Doc the couple edits, "Datos para la invitación de boda":
https://claude.ai/code/artifact/42c14bb1-1d61-485b-8bb8-954cc798b53f
Each section of the site has a table there with a "Valor" column. When the user says the doc changed, read it with the Claude Docs tools (never web-fetch it) and update `index.html` / `js/script.js` to match. Anything still marked as placeholder in the doc stays as invented text and must be replaced before the site is shared.

## Git

Default branch is `main`. Commit as `pabloati <pabloatienzalo@gmail.com>` (the address linked to GitHub).
