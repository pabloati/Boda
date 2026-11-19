# Roadmap

Status as of 2026-11-18. The site is live at https://pabloati.github.io/Boda/ with the final design, the RSVP saving to the Google Sheet, the playlist on Supabase, the bus map and the site editor (`docs/editor.md`, also running on clab). What follows is only what is still open, grouped by who has to act. Done work is in `docs/decisions.md` and the git log.

## A. Needs the couple

This is the couple's to-do list. Tick or delete a row when it is delivered.

| # | What | How to deliver it | Then Claude… |
| --- | --- | --- | --- |
| 0b | **Decide what happens with `cambio_meri`** (Mª Ángeles's saves from the editor: flowers placed, colours, one text; 2026-11-10, not published). It was made before the new photos. | Chat: publish, keep working on it, or drop it. | merges or brings it up to date with `main` |
| 0 | **Our story** (branch `introduccion`, 2026-11-18): the welcome (two sentences), the text behind each of the three prints (Madrid, Copenhague, Valencia; two or three sentences each), The welcome and the Madrid text are in (2026-11-19); Copenhague and Valencia are still placeholders in brackets. The three photos are in as a first trial (2026-11-19): confirm them or pick others. | Texts in the editor (Textos tab) or chat; other photos by chat. | writes the English versions, merges |
| 1 | **Short texts** for each section (welcome line, intro band, timeline lines, RSVP, gift, playlist, photos, farewell) | Fill the "Textos cortos" table at the end of the data doc (link in `NOTES.local.md`). Empty rows = nothing shown. | applies them, writes the English versions, publishes |
| 2 | **Flowers**: choose the botanical plates and place them | The editor's Flores tab (`docs/editor.md`), save on a branch. The layout on `main` is still empty. | checks desktop, cleans the cherry / apple / jonquilla cut-outs, merges |
| 3 | **IBAN** | Write it in the data doc (Regalos table). The site shows `ES00 0000…` until then. | updates the gift section |
| 5 | **Starting song list** for the playlist | Chat, one per line: `Title – Artist`. | turns it into an SQL insert for you to paste in Supabase → SQL Editor |
| 6 | **Recommendations**: where to stay and how to get to the church | Chat or data doc: places, links, prices if any, and where the section goes. | builds the section in both languages |
| 8 | **"Cuaderno de viaje" restyle**: yes, no or parts of it (proposal of 2026-10-18, `docs/propuesta-cuaderno-de-viaje.md` and its PDF, local files) | Chat. | implements only the approved phases |
| 9 | **WhatsApp contact link**: under the RSVP form (now) or in the footer | Chat. | moves it if needed |

## B. Claude does once A arrives

- [ ] English versions of the texts in A1 (same commit, `js/i18n.js`).
- [x] Open Graph image (`assets/og.jpg`, envelope + names) and `og:image` tags (2026-10-07). Optionally redo with one of the couple's photos.
- [ ] Seed the playlist with A5.
- [ ] **Botanical plates** (after A2): desktop check, clean the cherry, apple and jonquilla cut-outs, merge the layout into `main`. Notes in `docs/flores/README.md`.
- [ ] **Recommendations section**: where to stay (accommodation) and how to get to the church (transport). Placement not decided yet. Needs the couple's picks first (places, links, prices if any); do not invent recommendations. Both languages in `js/i18n.js`, bump the `?v=` cache-buster.

## Future improvements (not planned yet)

- **Bus map, finer points**: more street names up close. The map is rebuilt with `_dev/mapa_extract.py` (from a Geofabrik file, needs `pip install osmium`) or `_dev/mapa_fetch.py` (public servers, often down), then `_dev/mapa_build.py`.
- **Preview of the shared album in the Fotos section** (now only a link, decided 2026-11-17). Google Photos has no embed and no official way to read a shared album, so the options are:
  - *Fixed strip*: a few photos the couple chooses, saved in `assets/`, refreshed by hand. Stable, not live.
  - *Live strip*: a small separate Google Apps Script (not the RSVP one) reads the album's public share page and returns the latest ~6 thumbnail addresses; the site shows them and each opens the album. Unofficial, can break without notice, so it must fall back to the link alone. Not tested against the real album yet. A scheduled GitHub job writing the list to the repo is the alternative, at the cost of one commit per change.
  - To weigh first: guests' photos would show on a public site, and the album is empty until the wedding (seed it or keep the strip hidden until there are enough photos).

## D. Before sending the invitations

- [ ] Final run-through on two real phones (Android + iPhone) from a WhatsApp link: envelope, music, RSVP save, playlist vote, language toggle.
- [ ] Check the Google Sheet receives a test reply and delete it.
- [ ] Restore the Supabase project (paused on purpose since 2026-11-02, the keep-alive pings did not stop the pause): Supabase dashboard → project → Restore. Then open the site and check the ranking loads.
- [ ] Remove the olive quote band if the couple's intro text replaces it.

## E. Known maintenance

- GitHub disables scheduled workflows after 60 days without commits (it emails first). If that happens, run "Keep the playlist database awake" manually once, or push any change. Otherwise the free Supabase project pauses after 7 idle days.
- Removing a song: Supabase → Table Editor → `songs` → tick `hidden`. Votes stay attached; untick to restore.
- Cache-buster `?v=` in `index.html` must be bumped whenever `css/` or `js/` change.
