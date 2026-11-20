// RSVP backend settings (see docs/rsvp.md).
// endpoint: URL of the Google Apps Script web app that writes replies to the
// couple's Google Sheet. Empty = the form cannot save and shows an error.
// whatsappContacts: people guests can message with questions. Each number in
// international format without "+" or spaces (e.g. 34600000000). The site
// shows the name and the number and links to a WhatsApp chat. Empty list =
// the contact block under the form is hidden.
window.RSVP_CONFIG = {
  endpoint: 'https://script.google.com/macros/s/AKfycbz6iXojmG1SE4iJSj9_jl36scEA-Z3uYB8qaDhlHiXuGHul-AiKJHzScTpRDg-ooQFu6g/exec',
  whatsappContacts: [
    { name: 'Pablo', number: '34626841981' },
    { name: 'Mª Ángeles', number: '34635398221' }
  ]
};
