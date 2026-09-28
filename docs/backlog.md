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

## 2. Real content
- [ ] Couple names, date, monogram, hashtag.
- [ ] Parents.
- [ ] Venues, times, addresses, map links.
- [ ] Timeline.
- [ ] Dress code text.
- [ ] Bank details (IBAN, holder, concept).
- [ ] Hotels.
- [ ] Calendar event (`.ics` dates in `js/script.js`).
- [ ] Local audio file in `assets/`.
- [ ] Open Graph image for WhatsApp link previews.

## 3. Data collection
- [ ] Choose backend (see `docs/decisions.md`).
- [ ] Wire RSVP form (name, attendance, companions' names, bus, allergies, message).
- [ ] Wire song suggestions.
- [ ] Remove the fake "Guardar confirmación" success message.
- [ ] Private view of responses for the couple.

## 4. Deploy
- [ ] Create GitHub repo, push `main`.
- [ ] GitHub Pages or Netlify.
- [ ] Test on a real phone from a WhatsApp link.
