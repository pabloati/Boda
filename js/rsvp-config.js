// RSVP backend settings (see docs/rsvp.md).
// endpoint: URL of the Google Apps Script web app that writes replies to the
// couple's Google Sheet. Leave empty until it is deployed; the form then tells
// guests to send their reply by WhatsApp instead.
// whatsappNumber: international format without "+" or spaces (e.g. 34600000000).
// Empty = WhatsApp opens with the text and no recipient.
window.RSVP_CONFIG = {
  endpoint: '',
  whatsappNumber: ''
};
