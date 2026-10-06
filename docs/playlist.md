# Playlist: search, suggest, vote

Guests search a song (iTunes catalogue, no key needed), see the anonymous ranking, and either vote a song already in the list or add a new one. Each device gets 5 hearts (votes) and can add up to 3 songs.

## Files

- `js/playlist.js`: widget logic. Numbered sections: helpers, normalisation/fuzzy matching, stores, iTunes search, UI.
- `js/playlist-config.js`: Supabase URL + public key, limits. Empty = demo mode (localStorage only).
- `docs/playlist-schema.sql`: tables and functions to run in Supabase.
- `playlist-admin.html`: unlinked page with the ranking and Excel/TSV download buttons.

## How duplicates are avoided

1. Catalogue first. Most songs are picked from iTunes, so the spelling comes from the catalogue.
2. Normalised key `title|artist`. Lowercase, accents and punctuation removed, `(Remastered)`, `- Live`, `feat. X` dropped. Album, single and remaster versions collapse into one. The database has a unique index on it.
3. Fuzzy check before adding. Trigram similarity on title (≥ 0.75) and artist (≥ 0.6). If a likely match exists, the guest is asked "¿Te refieres a…?" and can vote for it instead.
4. Search shows existing songs first ("Ya en la lista"), with typo tolerance.
5. Anything that slips through: set `hidden = true` on the duplicate in Supabase (Table editor → songs).

## Going live with Supabase (free tier)

1. Create a project at supabase.com (region: EU West).
2. SQL Editor → paste `docs/playlist-schema.sql` → Run.
3. Project Settings → API: copy the Project URL and the `anon` / publishable key into `js/playlist-config.js`. Never the `service_role` / secret key.
4. Free projects pause after ~7 days without traffic. Before sharing the link, check the project is active; a scheduled GitHub Action that calls `get_ranking` every few days keeps it awake.

## Exporting

Open `/playlist-admin.html` on the published site. "Descargar Excel" makes a real `.xlsx`. "Descargar TSV" writes UTF-8 with BOM so accents survive in Excel. The ranking is anonymous and public anyway, so the page needs no login.
