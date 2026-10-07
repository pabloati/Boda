# Backlog

## 1. Design fixes
- [x] Mobile horizontal overflow (countdown grid, hashtag box).
- [x] "Banquete principal" ribbon clipped on featured venue card.
- [x] Missing timeline icon (`fa-rings-wedding` is Font Awesome Pro only).
- [x] IBAN wraps onto several lines on mobile.
- [x] Envelope opening: layers overlap during the transition; keep overlay opaque until the animation ends.
- [x] Hero: full-bleed photo or illustration instead of a floating card on a gradient.
- [x] Reduce section padding on mobile (page is ~13,000px tall).
- [x] Simplify: parents as a single block, drop dress-code icons, one floating button instead of two.
- [ ] Single RSVP submit button once a backend exists (WhatsApp button is now a secondary outline style).
- [x] Countdown box contrast on burgundy background.

## 1b. Redesign (branch `redesign`, preview link in `NOTES.local.md`)
- [x] New palette, fonts, paper texture; icons and card chrome removed.
- [x] Merged into `main` on 2026-10-07 so the couple can review on their phones.
- [x] Wax seal: replaced by the real wax seal cut from the couple's reference photo (2026-10-07).
- [x] ES/EN language toggle (2026-10-07). Keep the EN dictionary in `js/i18n.js` in step with new texts.
- [ ] Couple's short texts from the doc ("Textos cortos").
- [ ] Couple's own photos (hero), ideally also one or two snapshots for the intro band.
- [x] Line illustrations of the church and the venue (couple's drawings, rendered to PNG in olive, 2026-10-07).
- [ ] Review on a real phone.

## 2. Real content
Source: the couple's Claude Doc (link in `docs/decisions.md`). Applied on 2026-10-06.
- [x] Couple names, date, monogram, hashtag.
- [x] Parents.
- [x] Venues, times, addresses, map links (ceremony + banquet; no separate party venue).
- [x] Timeline.
- [x] Dress code section removed at the couple's request.
- [ ] Bank details: holder and concept done; **IBAN still a placeholder** (`ES00 …`).
- [x] Calendar event (`.ics` dates in `js/script.js`).
- [x] Local audio file in `assets/` (`Emborracharme.mp3`, 3.6 MB, 2026-10-07).
- [ ] Couple's own photos (hero landscape, hero portrait).
- [ ] Open Graph image for WhatsApp link previews.
- [ ] Bus: departure points and times (shown nowhere yet; the form only asks guests where they would board).

## 3. Data collection
- [x] Choose backend: Supabase free tier for the playlist; Google Sheet + Apps Script for the RSVP (see `docs/decisions.md`).
- [x] Wire RSVP form (name, phone, attendance, companions' names, bus + outward/return, allergies, vegetarian/vegan menu). Sends JSON to the Apps Script endpoint; see `docs/rsvp.md`.
- [x] Deploy the Apps Script (`docs/rsvp-apps-script.gs`) on the couple's Google account and paste the URL into `js/rsvp-config.js`.
- [x] WhatsApp number (in `js/rsvp-config.js`; used only by the "¿Alguna duda?" link, the form is no longer sent by WhatsApp).
- [ ] RSVP latency (saves take 1 to 40 s, a third look failed but are saved): apply the fixes in `docs/rsvp-latency.md`, in order. Fix 1 (one row per device) first.
- [x] Song suggestions widget (search + vote + Excel/TSV export, demo mode).
- [x] Create the Supabase project, run `docs/playlist-schema.sql`, fill `js/playlist-config.js` (2026-10-07; keep-alive GitHub Action every 3 days).
- [ ] Load the couple's starting song list into Supabase (SQL insert; waiting for the list).
- [ ] GitHub disables scheduled workflows after 60 days without commits (it emails first). If that happens, run "Keep the playlist database awake" manually once or push any change; otherwise the free Supabase project pauses after 7 idle days.
- [x] Favicon: two gold rings (`assets/favicon.svg` + PNG fallbacks, 2026-10-07).
- [x] Remove the fake "Guardar confirmación" success message.
- [x] Private view of responses for the couple: the Google Sheet itself.

## 4. Deploy
- [x] Create GitHub repo, push `main` (https://github.com/pabloati/Boda).
- [x] GitHub Pages (the couple's choice; no custom domain). Expected URL: https://pabloati.github.io/Boda/
- [ ] Test on a real phone from a WhatsApp link.
