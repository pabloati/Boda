# RSVP latency: measurements and fixes to apply

Handover note, 2026-10-07. The RSVP form saves replies through a Google Apps Script web app (see `docs/rsvp.md`). It works, but each save takes 1 to 40 seconds and about a third of the answers come back as a Google 404 even though the row was written. Below: what was measured, why, and the fixes in the order to apply them.

## Benchmark

24 requests with curl from a WSL shell against the endpoint in `js/rsvp-config.js`. Plain requests to www.google.com, docs.google.com and script.google.com answered in 0.3 s, so the network is not the cause.

| Request type | Count | Best | Typical | Worst | Came back as Google 404 |
| --- | --- | --- | --- | --- | --- |
| GET, `doGet` only, no Sheet access | 3 (+10 first hop only) | 0.9 s | 6 to 10 s | 41 s | 1 of 3 |
| POST dropped by the honeypot, no Sheet write | 5 | 1.7 s | 14 s | 23 s | 1 of 5 |
| POST writing one real row | 3 | 12.7 s | 21 s | 31 s | 0 of 3 |
| 5 real POSTs at the same time | 5 | 4.8 s | 22 s | 40 s | 3 of 5 |

Every 404 still wrote its row: all 8 "PRUEBA benchmark" and "PRUEBA paralelo" rows were in the Sheet afterwards.

To rerun one timing (use `"website":"x"` in the JSON to take the honeypot path and write nothing):

```bash
curl -sL -H 'Content-Type: text/plain;charset=UTF-8' \
  --data-binary '{"guestName":"BOT","website":"x"}' "$ENDPOINT" \
  -o /dev/null -w 'first_byte=%{time_starttransfer} redirect=%{time_redirect} total=%{time_total} http=%{http_code}\n'
```

## Where the time goes

A reply makes two HTTP hops, and both are slow on Google's side.

1. The browser POSTs to script.google.com. Connect and TLS take 0.1 to 0.25 s. Google then takes 1 to 30 s to start and run the script, even for `doGet`, which touches nothing. The Sheet write is not the bottleneck.
2. Google answers with a 302 to script.googleusercontent.com, where the result is served. That hop adds 1 to 27 s and sometimes returns a Drive "Página no encontrada" 404 page instead of the JSON, after the script has already run.

So the guest watches the spinner for 10 to 30 s, and roughly one in three gets "No hemos podido guardar tu respuesta" although the row exists. If they click again, the Sheet gets a duplicate. Nothing in `js/script.js` can tell a real failure from this false one, which is why fix 1 comes first.

The variance looks like Apps Script having a bad period rather than a quota: volumes are far below the 20,000 calls/day and 30 concurrent executions limits. Benchmark again at a different time of day before deciding on fix 3.

## Fix 1, do first: one row per device

Goal: a resend after a false error, or a guest changing their answer later, overwrites their row instead of adding one.

**Client, `js/script.js` section 7.** In `getRsvpFormData()` add `replyId`: read `localStorage.rsvpReplyId`; if absent, create one with `crypto.randomUUID()` (fallback `Date.now().toString(36) + Math.random().toString(36).slice(2)`) and store it. Wrap the storage access in try/catch, as `js/playlist.js` does. Send it in the JSON like the other fields.

**Server, `docs/rsvp-apps-script.gs`.** Add an `Id` column at the end of `HEADERS`. In `doPost`, inside the lock: if `data.replyId` is set, scan the Id column (`sheet.getRange(2, idCol, lastRow - 1, 1).getValues()`) for it; on a hit, `setValues` over that row with the new values and a fresh date; otherwise `appendRow` as now. Keep the honeypot check before any Sheet access.

**Then** the user republishes the script as a new version (Deploy → Manage deployments → pencil → Version: New version → Deploy). Saving alone changes nothing. Existing rows have an empty Id and stay as they are.

**Check** with two POSTs carrying the same `replyId` and different names: the Sheet must show one row with the second name. Delete it afterwards.

Side effect worth keeping: the couple can tell guests "if you need to change something, just send the form again".

## Fix 2: set expectations while waiting

Cheap, does not shorten the wait, but stops guests from giving up or double-clicking.

- Pending text in `showRsvpStatus('pending', …)`: "Enviando tu respuesta… puede tardar unos segundos." The button is already disabled while sending.
- Client-side timeout: wrap the `fetch` in `sendRsvp()` with an `AbortController` at 60 s (the worst measured case was 41 s). Without it the browser waits as long as it likes.
- Error text: keep the "inténtalo de nuevo" wording. Once fix 1 is in, a retry is harmless, so the message can say so: "Si ya habías enviado, no pasa nada por repetir."
- Optional: after 8 s of pending, swap the text to "Sigue enviando, Google tarda un poco…" so the spinner does not look frozen.

## Fix 3, only if latency stays bad: change the transport

Two options keep the couple's Sheet as the place they read replies; one does not.

| Option | Save time | Browser can confirm the save | Replies land in | Effort |
| --- | --- | --- | --- | --- |
| Keep Apps Script (current) | 1 to 40 s | Yes, but a third are false failures | The Sheet | None |
| Hidden Google Form, posted from the page | under 1 s | No: `mode: 'no-cors'`, opaque response, page shows "recibido" on send | The Form's linked Sheet (new Sheet or a new tab) | Create the Form with the same fields, map each `entry.NNN` id, POST `application/x-www-form-urlencoded` to `/formResponse`; `js/script.js` section 7 only |
| Supabase (free tier, already planned for the playlist) | 0.1 to 0.5 s | Yes, real HTTP status | A `rsvp` table; export to Excel/TSV from a page like `playlist-admin.html` | Table + RLS policy (anon insert only) in SQL, `fetch` to the REST endpoint; the couple loses the Sheet view unless an export is added |

Recommendation if it comes to this: the Google Form. It keeps the Sheet, needs no new account, and Google Forms' submission endpoint is far more reliable than Apps Script's redirect. The lost confirmation matters little once fix 1 exists, and a failed Form POST is rare. Keep the honeypot: Forms have no server-side hook, so drop bot submissions in the Sheet instead (filter on the honeypot column).

## Working notes for whoever takes over

- **Branch and worktree.** This work lives on branch `rsvp`, checked out in the worktree `.claude/worktrees/rsvp`, so it does not collide with the front-page session in the main checkout on `redesign`. Merge `main` into `rsvp`, resolve, then `git fetch . rsvp:main` and `git push origin main`. Pushing `main` deploys the site within seconds.
- **Cache-busters.** Bump `?v=` on `js/script.js` (and `css/styles.css` if touched) in `index.html` on every change.
- **Browser tests.** Playwright scripts `test_rsvp.js` and `test_wa.js` live in the scratchpad of the session that wrote them, not in the repo. If you rewrite them, keep `page.route('https://script.google.com/**', route => route.abort())` registered before the stub route, or the test posts real rows to the Sheet.
- **Live checks.** Any real POST adds a row. Name test replies "PRUEBA … (borrar)" and tell the user to delete them. `curl -L` without `-X POST` follows the 302 as a GET, which is what the browser does; with `-X POST` the second hop answers 405.
- **Redeploying the script.** Every edit to `docs/rsvp-apps-script.gs` must be pasted into the Apps Script editor by the user and published as a new version. The URL does not change.
- **Rows still to delete** at the time of writing: "PRUEBA desde el terminal (borrar)", "PRUEBA 2 con mensaje (borrar)", "PRUEBA benchmark 1–3 (borrar)", "PRUEBA paralelo 1–5 (borrar)", "Prueba", "Prueba Sin Endpoint".
