# Roadmap

Status as of 2026-10-07. The site is live at https://pabloati.github.io/Boda/ with the final design, the RSVP saving to the Google Sheet and the playlist on Supabase. What follows is only what is still open, grouped by who has to act. Done work is in `docs/decisions.md` and the git log.

## A. Needs the couple

| # | What | How to deliver it | Then Claude… |
| --- | --- | --- | --- |
| 1 | **Short texts** for each section (welcome line, intro band, timeline lines, RSVP, gift, playlist, photos, farewell) | Fill the "Textos cortos" table at the end of the data doc (link in `NOTES.local.md`). Empty rows = nothing shown. | applies them, writes the English versions, publishes |
| 2 | **Photos** of you two | `assets/`: one landscape ≥1920 px wide for desktop, one portrait ≥1080 px wide for phones. Optional: 1–2 extra snapshots for the intro band. JPG, ideally <400 KB each. | replaces the stock hero photos, builds the WhatsApp preview image from one of them |
| 3 | **IBAN** | Write it in the data doc (Regalos table). The site shows `ES00 0000…` until then. | updates the gift section |
| 4 | **Bus details**: departure places and times, outward and return | Data doc (Confirmación table) or chat. Nothing about the buses is shown yet; the form only asks outward / return. | adds a line under "Buses" in the timeline and a note in the RSVP |
| 5 | **Starting song list** for the playlist | Chat, one per line: `Title – Artist`. | turns it into an SQL insert for you to paste in Supabase → SQL Editor |
| 6 | **Chrome on your phone**: turn off "Sitio para ordenador" for the site | Menu ⋮ → untick. Only affects your own browser. | — |

## B. Claude does once A arrives

- [ ] English versions of the texts in A1 (same commit, `js/i18n.js`).
- [ ] Open Graph image (1200 × 630) + `og:image` tag so the WhatsApp link shows a picture (needs A2).
- [ ] Seed the playlist with A5.

## C. Pending in the other working session (RSVP)

- [ ] RSVP latency: saves take 1 to 40 s; apply the fixes in `docs/rsvp-latency.md` in order, fix 1 first.
- [ ] Decide whether the "¿Alguna duda? Escríbenos por WhatsApp" link stays under the form or moves to the footer.

## D. Before sending the invitations

- [ ] Final run-through on two real phones (Android + iPhone) from a WhatsApp link: envelope, music, RSVP save, playlist vote, language toggle.
- [ ] Check the Google Sheet receives a test reply and delete it.
- [ ] Check the Supabase project is awake (open the site; the ranking loads) and that the Actions tab shows "Keep the playlist database awake" runs.
- [ ] Remove the olive quote band if the couple's intro text replaces it.

## E. Known maintenance

- GitHub disables scheduled workflows after 60 days without commits (it emails first). If that happens, run "Keep the playlist database awake" manually once, or push any change. Otherwise the free Supabase project pauses after 7 idle days.
- Removing a song: Supabase → Table Editor → `songs` → tick `hidden`. Votes stay attached; untick to restore.
- Cache-buster `?v=` in `index.html` must be bumped whenever `css/` or `js/` change.
