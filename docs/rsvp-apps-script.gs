/**
 * RSVP collector for the wedding site. Paste this into a Google Apps Script
 * bound to the couple's Google Sheet (Extensions → Apps Script), deploy it as
 * a web app, then run setup() once. Steps in docs/rsvp.md.
 *
 * Why a queue: opening the Sheet inside the web request made each reply take
 * 10 to 30 seconds (docs/rsvp-latency.md). Now doPost only stores the reply in
 * Script Properties (fast and persistent) and answers straight away. A
 * time trigger runs flushQueue() every minute and writes the queued replies to
 * the "Respuestas" sheet. If the trigger fails, replies stay in the queue and
 * the next run writes them; nothing is lost.
 *
 * One row per reply: each reply carries an Id (replyId, made by the page). A
 * resend of the same reply, e.g. after Google returned a false error, has the
 * same Id and overwrites its row instead of adding a duplicate. Each person
 * sends their own reply, so different people on the same phone get different
 * Ids and separate rows.
 */

var SHEET_NAME = 'Respuestas';
var QUEUE_PREFIX = 'q_';
var MAX_TEXT = 2000;   // per field; a Script Property holds at most 9 KB

var HEADERS = [
  'Fecha',
  'Nombre',
  'Teléfono',
  'Asistencia',
  'Autobús',
  'Tipo de bus',
  'Destino vuelta',
  'Alergias',
  'Menú',
  'Mensaje',
  'Id'
];
var ID_COL = HEADERS.length;   // Id is the last column

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // Honeypot: real guests never see this field, bots fill it in.
    if (data.website) {
      return respond({ ok: true });
    }

    var name = clean(data.guestName);
    if (!name) {
      return respond({ ok: false, error: 'missing name' });
    }

    var id = String(data.replyId || '').replace(/[^\w-]/g, '').slice(0, 64) || Utilities.getUuid();
    var row = [
      new Date().toISOString(),
      name,
      clean(data.phone),
      data.status === 'asistire' ? 'Sí' : 'No',
      clean(data.bus),
      clean(data.busType),
      clean(data.returnStop),
      clean(data.diet),
      clean(data.menu),
      clean(data.message),
      id
    ];
    PropertiesService.getScriptProperties().setProperty(QUEUE_PREFIX + id, JSON.stringify(row));

    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}

// Opening the web app URL in a browser shows this, handy to check the deploy.
function doGet() {
  return respond({ ok: true, message: 'RSVP endpoint activo' });
}

// Run by the time trigger every minute (and once by setup). Writes every
// queued reply to the Sheet: overwrites the row with the same Id, otherwise
// appends. Removes a reply from the queue only after it is written.
function flushQueue() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var keys = Object.keys(all).filter(function (k) { return k.indexOf(QUEUE_PREFIX) === 0; });
  if (!keys.length) return 0;   // nothing queued: do not even open the Sheet

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 0;   // another run is flushing
  try {
    var items = keys.map(function (k) { return { key: k, json: all[k], row: JSON.parse(all[k]) }; })
      .sort(function (a, b) { return a.row[0] < b.row[0] ? -1 : a.row[0] > b.row[0] ? 1 : 0; });

    var sheet = getSheet();
    var last = sheet.getLastRow();
    var ids = last > 1
      ? sheet.getRange(2, ID_COL, last - 1, 1).getValues().map(function (r) { return String(r[0]); })
      : [];

    var appends = [];
    items.forEach(function (it) {
      var row = it.row.slice();
      row[0] = new Date(row[0]);
      var at = ids.indexOf(String(row[ID_COL - 1]));
      if (at >= 0) {
        sheet.getRange(at + 2, 1, 1, HEADERS.length).setValues([row]);
      } else {
        appends.push(row);
      }
    });
    if (appends.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, HEADERS.length).setValues(appends);
    }
    SpreadsheetApp.flush();

    // A resend may have replaced a queued reply while we were writing; keep it
    // for the next run in that case.
    items.forEach(function (it) {
      if (props.getProperty(it.key) === it.json) props.deleteProperty(it.key);
    });
    return items.length;
  } finally {
    lock.releaseLock();
  }
}

// Run once by hand from the editor (select "setup", then Run) after pasting a
// new version. Writes the header row, (re)creates the every-minute trigger and
// flushes anything already queued. Running it again is harmless.
function setup() {
  var sheet = getSheet();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'flushQueue') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('flushQueue').timeBased().everyMinutes(1).create();

  flushQueue();
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Trimmed, capped text. A leading = + - @ would make Sheets read the value as
// a formula (a phone like "+34 600…" turns into #ERROR!), so it is kept as text.
function clean(v) {
  var s = String(v == null ? '' : v).trim().slice(0, MAX_TEXT);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
