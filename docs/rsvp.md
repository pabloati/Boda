# RSVP: collecting replies in a Google Sheet

The "Confirmar" button POSTs the form as JSON to a Google Apps Script web app. The script queues the reply and answers at once; a trigger writes the queue to a Google Sheet the couple owns every minute, one row per reply (details at the top of `docs/rsvp-apps-script.gs`). Google hosts the script for free and the Sheet is the private view of the responses; no extra account or server is needed.

WhatsApp is not a way to send the form any more. Under the button, "¿Alguna duda? Escríbenos por WhatsApp" lists one link per person in `whatsappContacts` (`js/rsvp-config.js`): WhatsApp logo, name and number, opening a chat with no prefilled text. The block is hidden while the list is empty.

## Files

- `js/rsvp-config.js`: web app URL and WhatsApp contacts (name + number). Empty URL = the form cannot save and shows an error.
- `js/script.js`, section 7: builds the reply (`getRsvpFormData`), sends it (`sendRsvp`), shows a card over the whole page while sending (it cannot be closed until the answer arrives) and then the success or error message with a "Cerrar" button, clears the form after a save, builds the WhatsApp contact links.
- `docs/rsvp-apps-script.gs`: the server side, to paste into Google.

## Fields sent

| Key | Form field | Values |
| --- | --- | --- |
| guestName | Nombre y apellidos | free text, required |
| phone | Teléfono | free text, optional |
| status | ¿Vienes? | `asistire` / `no_asistire` |
| bus | Autobús | `No, voy por mi cuenta` / `Si, necesito plaza en el autobus` |
| busType | ¿Qué bus necesitas? | `Ida` / `Vuelta` / `Ida y vuelta`, only when bus is needed |
| returnStop | ¿Dónde te dejamos a la vuelta? | `Cibeles` / `Avenida de América`, only when busType is `Vuelta` or `Ida y vuelta`; required then |
| diet | Alergias o intolerancias | free text, `Ninguna` when empty |
| menu | Menú | `Ninguno` / `Vegetariano` |
| message | Déjanos un mensajito | free text, optional, asked to everyone |
| replyId | (none, made by the page) | random Id of this reply; kept when the guest resends after an error, new for the next reply. Same Id = same row |
| website | hidden honeypot | always empty for real guests; bots fill it and are dropped |

When the guest is not coming, bus, diet and menu are sent empty. The message is kept either way.

One reply per person (decided 2026-11-02): there is no companions box. After a successful save the form clears itself so the next person, often on the same phone, can send theirs. The sending card has a square photo slot, `assets/foto-envio.jpg` (about 800×800); while that file is missing a dashed placeholder shows. The script still writes an "Acompañantes" column; it stays empty for new replies.

## Setup (about 10 minutes, once)

1. Create a Google Sheet (any name, e.g. "Confirmaciones boda") with the Google account the couple will use to read replies.
2. In the Sheet: Extensions → Apps Script. Delete the sample code and paste the whole of `docs/rsvp-apps-script.gs`. Save (Ctrl+S).
3. Deploy → New deployment → type "Web app". Description: "RSVP". Execute as: **Me**. Who has access: **Anyone**. Click Deploy.
4. In the editor, pick **setup** in the function list at the top and click **Run**. The list shows `doPost` by default, so choose `setup` yourself; if it is missing, the new code is not saved yet. Go through the whole permission prompt: closing it stops setup, and no trigger is created (check the Triggers page: one `flushQueue`, every minute). It writes the header row and creates the every-minute trigger that copies replies into the Sheet. Google asks for authorisation the first time: Review permissions → choose the account → "Advanced" → "Go to … (unsafe)" → Allow. This warning only appears because the script is not published in the store; it is your own code.
5. Copy the web app URL (ends in `/exec`). Open it in a browser: it must show `{"ok":true,"message":"RSVP endpoint activo"}`.
6. Paste that URL into `endpoint` in `js/rsvp-config.js`, and the couple's names and numbers into `whatsappContacts` (digits only, with country code: `34600000000`).
7. Bump the `?v=` cache-buster on `js/rsvp-config.js` in `index.html`, commit, push. Send a test reply from the published site and check the row appears in the "Respuestas" sheet.

## After the first deploy

- **Editing the script later** needs a new version: Deploy → Manage deployments → pencil → Version: "New version" → Deploy. The URL does not change. Saving the file alone does not update the live endpoint. Then run **setup** once more if the columns or the trigger changed; it is safe to run again.
- **Replies appear within a minute**, not instantly: the page gets its "¡Recibido!" as soon as the reply is queued, and the trigger copies it to the Sheet on its next run. Pending replies are kept in Project Settings → Script Properties (keys starting with `q_`) until written.
- **Duplicates.** A resend of the same reply (same Id) overwrites its row. Two separate sends from scratch by the same person still make two rows: keep the newest.
- **Why `fetch` sends plain text.** Apps Script cannot answer the CORS preflight that a `Content-Type: application/json` request triggers, so the body is sent with the default text/plain type and parsed as JSON on the server. Do not add custom headers to the request.
- **Testing locally.** The endpoint accepts requests from any origin, so `python3 -m http.server` works. Mark test rows in the Sheet so they can be deleted.
- **Quota.** Apps Script allows roughly 20,000 web app calls per day on a personal account. A wedding will not get close.
