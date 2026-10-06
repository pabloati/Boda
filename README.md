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

The real wedding data (names, dates, venues, parents, dress code, IBAN, hotels, music) is kept in a Claude Doc the couple edits:
<https://claude.ai/code/artifact/42c14bb1-1d61-485b-8bb8-954cc798b53f>. When something changes there, ask Claude to read the doc and update the site.

Names, dates, venues and bank details are text in `index.html`. The countdown target is the `data-target-date` attribute on the countdown element. The calendar event dates are in the `.ics` block in `js/script.js`.
