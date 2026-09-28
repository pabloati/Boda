# Decisions

Short log of choices made for the wedding site. One line each, newest first.

- 2026-09-28 — Stock photos from Unsplash (free licence, no attribution required; credits kept in a comment at the top of `index.html`). Hero photos are placeholders until the couple provides their own.
- 2026-09-28 — One floating button (music) instead of two. The RSVP shortcut covered content on phones.
- 2026-09-28 — Envelope container no longer uses `transform-style: preserve-3d`; flat stacking lets z-index put the card above the opened flap.
- 2026-09-28 — Keep the site as plain HTML/CSS/JS with no build step. Host as a static site (GitHub Pages or Netlify).
- 2026-09-28 — Replaced Gemini's PRD/SRS/ADD/TDD docs with this file and a real backlog. Specs were describing placeholder content.
- 2026-09-28 — Work order: (1) design fixes, (2) real content replacing placeholders, (3) RSVP data collection + backend.
- (pending) — Backend for RSVP / song suggestions. Candidates: Google Sheets via Apps Script, Formspree, Supabase.
- (pending) — Audio source. Current track is hotlinked from a third-party site; replace with a local royalty-free file in `assets/`.
