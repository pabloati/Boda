/**
 * RSVP collector for the wedding site. Paste this into a Google Apps Script
 * bound to the couple's Google Sheet (Extensions → Apps Script), then deploy
 * it as a web app. Setup steps in docs/rsvp.md.
 *
 * The site POSTs one JSON object per reply (see getRsvpFormData in
 * js/script.js). Each reply becomes one row in the "Respuestas" sheet.
 * Rows are only appended, never edited: if a guest submits twice, keep the
 * newest row and delete the older one by hand.
 */

var SHEET_NAME = 'Respuestas';

var HEADERS = [
  'Fecha',
  'Nombre',
  'Teléfono',
  'Asistencia',
  'Acompañantes',
  'Autobús',
  'Tipo de bus',
  'Alergias',
  'Menú',
  'Mensaje'
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);

    // Honeypot: real guests never see this field, bots fill it in.
    if (data.website) {
      return respond({ ok: true });
    }

    var name = String(data.guestName || '').trim();
    if (!name) {
      return respond({ ok: false, error: 'missing name' });
    }

    var sheet = getSheet();
    sheet.appendRow([
      new Date(),
      name,
      String(data.phone || ''),
      data.status === 'asistire' ? 'Sí' : 'No',
      Array.isArray(data.companions) ? data.companions.join(', ') : String(data.companions || ''),
      String(data.bus || ''),
      String(data.busType || ''),
      String(data.diet || ''),
      String(data.menu || ''),
      String(data.message || '')
    ]);

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the web app URL in a browser shows this, handy to check the deploy.
function doGet() {
  return respond({ ok: true, message: 'RSVP endpoint activo' });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
