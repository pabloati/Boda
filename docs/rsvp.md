# RSVP: collecting replies in a Google Sheet

The "Confirmar" button POSTs the form as JSON to a Google Apps Script web app. The script appends one row per reply to a Google Sheet the couple owns. Google hosts the script for free and the Sheet is the private view of the responses; no extra account or server is needed.

WhatsApp is not a way to send the form any more. Under the button, "¿Alguna duda? Escríbenos por WhatsApp" opens a chat with the couple (number from `js/rsvp-config.js`) for questions only; the link is hidden while the number is empty.

## Files

- `js/rsvp-config.js`: web app URL and WhatsApp number. Empty URL = the form cannot save and shows an error.
- `js/script.js`, section 7: builds the reply (`getRsvpFormData`), sends it (`sendRsvp`), shows the pending / success / error message, sets the WhatsApp contact link.
- `docs/rsvp-apps-script.gs`: the server side, to paste into Google.

## Fields sent

| Key | Form field | Values |
| --- | --- | --- |
| guestName | Nombre y apellidos | free text, required |
| phone | Teléfono | free text, optional |
| status | ¿Vienes? | `asistire` / `no_asistire` |
| companions | Acompañantes | list of names, one per line |
| bus | Autobús | `No, voy por mi cuenta` / `Si, necesito plaza en el autobus` |
| busType | ¿Qué bus necesitas? | `Ida` / `Vuelta` / `Ida y vuelta`, only when bus is needed |
| diet | Alergias o intolerancias | free text, `Ninguna` when empty |
| menu | Menú | `Ninguno` / `Vegetariano` |
| message | Déjanos un mensajito | free text, optional, asked to everyone |
| website | hidden honeypot | always empty for real guests; bots fill it and are dropped |

When the guest is not coming, companions, bus, diet and menu are sent empty. The message is kept either way.

## Setup (about 10 minutes, once)

1. Create a Google Sheet (any name, e.g. "Confirmaciones boda") with the Google account the couple will use to read replies.
2. In the Sheet: Extensions → Apps Script. Delete the sample code and paste the whole of `docs/rsvp-apps-script.gs`. Save (Ctrl+S).
3. Deploy → New deployment → type "Web app". Description: "RSVP". Execute as: **Me**. Who has access: **Anyone**. Click Deploy.
4. Google asks for authorisation the first time: Review permissions → choose the account → "Advanced" → "Go to … (unsafe)" → Allow. This warning only appears because the script is not published in the store; it is your own code.
5. Copy the web app URL (ends in `/exec`). Open it in a browser: it must show `{"ok":true,"message":"RSVP endpoint activo"}`.
6. Paste that URL into `endpoint` in `js/rsvp-config.js`, and the couple's number into `whatsappNumber` (digits only, with country code: `34600000000`).
7. Bump the `?v=` cache-buster on `js/rsvp-config.js` in `index.html`, commit, push. Send a test reply from the published site and check the row appears in the "Respuestas" sheet.

## After the first deploy

- **Editing the script later** needs a new version: Deploy → Manage deployments → pencil → Version: "New version" → Deploy. The URL does not change. Saving the file alone does not update the live endpoint.
- **Duplicates.** A guest who submits twice makes two rows. Keep the newest.
- **Why `fetch` sends plain text.** Apps Script cannot answer the CORS preflight that a `Content-Type: application/json` request triggers, so the body is sent with the default text/plain type and parsed as JSON on the server. Do not add custom headers to the request.
- **Testing locally.** The endpoint accepts requests from any origin, so `python3 -m http.server` works. Mark test rows in the Sheet so they can be deleted.
- **Quota.** Apps Script allows roughly 20,000 web app calls per day on a personal account. A wedding will not get close.
