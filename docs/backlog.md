# Roadmap

Status as of 2026-11-17. The site is live at https://pabloati.github.io/Boda/ with the final design, the RSVP saving to the Google Sheet, the playlist on Supabase and the site editor (`docs/editor.md`, also running on clab). What follows is only what is still open, grouped by who has to act. Done work is in `docs/decisions.md` and the git log.

## A. Needs the couple

This is the couple's to-do list. Tick or delete a row when it is delivered.

| # | What | How to deliver it | Then Claude… |
| --- | --- | --- | --- |
| 0 | **Review the branch `nuevas-fotos-cancion`** (new hero photos, new song, Fotos section with the shared album link; pushed 2026-11-17, not merged) | Look at it in the editor (branch menu) on a phone and a computer; check where the lettering sits over the photos. | merges it into `main`, or you press «Publicar» in the editor |
| 0b | **Decide what happens with `cambio_meri`** (Mª Ángeles's saves from the editor: flowers placed, colours, one text; 2026-11-10, not published). It was made before the new photos. | Chat: publish, keep working on it, or drop it. | merges or brings it up to date with `main` |
| 1 | **Short texts** for each section (welcome line, intro band, timeline lines, RSVP, gift, playlist, photos, farewell) | Fill the "Textos cortos" table at the end of the data doc (link in `NOTES.local.md`). Empty rows = nothing shown. | applies them, writes the English versions, publishes |
| 2 | **Flowers**: choose the botanical plates and place them | The editor's Flores tab (`docs/editor.md`), save on a branch. The layout on `main` is still empty. | checks desktop, cleans the cherry / apple / jonquilla cut-outs, merges |
| 3 | **IBAN** | Write it in the data doc (Regalos table). The site shows `ES00 0000…` until then. | updates the gift section |
| 4 | **Bus details**: departure places and times, outward and return | Data doc (Confirmación table) or chat. Nothing about the buses is shown yet; the form only asks outward / return. | adds a line under "Buses" in the timeline and a note in the RSVP |
| 4b | **Bus map** (branch `mapa-buses`, prototype of 2026-11-17): look at it and confirm the stops. The pins are approximate: the exact pick-up point at Cibeles, the exact drop-off at Avenida de América, and the order of the two stops on the way back (the map draws a separate way back to Avenida de América, which is a guess). | Editor or chat; a Google Maps pin per stop is enough. | corrects `STOPS` in `js/mapa.js` and the route, merges |
| 5 | **Starting song list** for the playlist | Chat, one per line: `Title – Artist`. | turns it into an SQL insert for you to paste in Supabase → SQL Editor |
| 6 | **Recommendations**: where to stay and how to get to the church | Chat or data doc: places, links, prices if any, and where the section goes. | builds the section in both languages |
| 7 | **Bus block placement**: a note under the Buses stop or a small section after it | Chat. | builds it once A4 arrives |
| 8 | **"Cuaderno de viaje" restyle**: yes, no or parts of it (proposal of 2026-10-18, `docs/propuesta-cuaderno-de-viaje.md` and its PDF, local files) | Chat. | implements only the approved phases |
| 9 | **WhatsApp contact link**: under the RSVP form (now) or in the footer | Chat. | moves it if needed |

## B. Claude does once A arrives

- [ ] English versions of the texts in A1 (same commit, `js/i18n.js`).
- [x] Open Graph image (`assets/og.jpg`, envelope + names) and `og:image` tags (2026-10-07). Optionally redo with one of the couple's photos.
- [ ] Seed the playlist with A5.
- [ ] **Bus information block**: a short disclaimer under the Buses stop in the Hoja de ruta, or a small section right after it (couple decides which, 2026-11-09). Waits for A4 (places and times, outward and return). Both languages in `js/i18n.js`, bump the `?v=` cache-buster.
- [ ] **Botanical plates** (after A2): desktop check, clean the cherry, apple and jonquilla cut-outs, merge the layout into `main`. Notes in `docs/flores/README.md`.
- [ ] **Recommendations section**: where to stay (accommodation) and how to get to the church (transport). Placement not decided yet. Needs the couple's picks first (places, links, prices if any); do not invent recommendations. Both languages in `js/i18n.js`, bump the `?v=` cache-buster.

## Future improvements (not planned yet)

- **Bus map, finer points**: rivers (Jarama, Manzanares) and a wider drawn area are missing because the public OpenStreetMap servers were down on 2026-11-17 (`_dev/mapa_fetch.py` then `_dev/mapa_build.py`; to widen the area change `BB` and `S, W, N, E` together). More street names up close.
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
