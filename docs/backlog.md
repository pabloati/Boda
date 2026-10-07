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
- [ ] Wax seal: the couple still dislikes it; try a plainer disc or a real wax-seal photo/PNG.
- [ ] ES/EN language toggle (after the final texts).
- [ ] Couple's short texts from the doc ("Textos cortos").
- [ ] Couple's own photos (hero), ideally also one or two snapshots for the intro band.
- [ ] Line illustrations of the church and the venue (optional, as in the second reference).
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
- [ ] Local audio file in `assets/`.
- [ ] Couple's own photos (hero landscape, hero portrait).
- [ ] Open Graph image for WhatsApp link previews.
- [ ] Bus: departure points and times (shown nowhere yet; the form only asks guests where they would board).

## 3. Data collection
- [x] Choose backend: Supabase free tier (see `docs/decisions.md`).
- [ ] Wire RSVP form (name, phone, attendance, companions' names, bus + boarding point, allergies, vegetarian/vegan menu).
- [ ] WhatsApp number for the RSVP button (empty in the doc).
- [x] Song suggestions widget (search + vote + Excel/TSV export, demo mode).
- [ ] Create the Supabase project, run `docs/playlist-schema.sql`, fill `js/playlist-config.js`.
- [ ] Remove the fake "Guardar confirmación" success message.
- [ ] Private view of responses for the couple.

## 4. Deploy
- [x] Create GitHub repo, push `main` (https://github.com/pabloati/Boda).
- [ ] GitHub Pages (the couple's choice; no custom domain). Expected URL: https://pabloati.github.io/Boda/
- [ ] Test on a real phone from a WhatsApp link.
