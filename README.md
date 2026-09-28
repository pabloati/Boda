# Invitación digital de boda

Single-page wedding invitation with an envelope-opening animation, countdown, venue details, timeline, RSVP form, gift details and hotel suggestions. Plain HTML, CSS and vanilla JavaScript. No build step.

## Preview

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly also works, but copy-to-clipboard buttons only work over `localhost` or `https`.

## Structure

- `index.html` — all content and markup
- `css/styles.css` — styles; design tokens at the top in `:root`
- `js/script.js` — envelope, audio, countdown, calendar file, RSVP, clipboard, song list
- `assets/` — images and audio
- `docs/backlog.md` — what's left to do
- `docs/decisions.md` — why things are the way they are

## Customising

Names, dates, venues and bank details are text in `index.html`. The countdown target is the `data-target-date` attribute on the countdown element. The calendar event dates are in the `.ics` block in `js/script.js`.
