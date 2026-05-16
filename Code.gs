const SHEET_NAME = 'Trips';
const HEADERS = ['ID', 'Trip Name', 'Destination', 'Start Date', 'End Date', 'Status', 'Notes'];

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Trip Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ─── Sheet helpers ────────────────────────────────────────────────────────────

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#1a73e8')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function generateId() {
  return 'TRIP-' + Date.now();
}

// ─── Public API (called from client via google.script.run) ───────────────────

function getTrips() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    id:          row[0],
    name:        row[1],
    destination: row[2],
    startDate:   row[3] ? Utilities.formatDate(new Date(row[3]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    endDate:     row[4] ? Utilities.formatDate(new Date(row[4]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    status:      row[5],
    notes:       row[6],
  }));
}

function addTrip(trip) {
  const sheet = getSheet();
  const id = generateId();
  sheet.appendRow([
    id,
    trip.name,
    trip.destination,
    trip.startDate,
    trip.endDate,
    trip.status,
    trip.notes || '',
  ]);
  return { success: true, id };
}

function updateTrip(trip) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trip.id) {
      const row = i + 1;
      sheet.getRange(row, 2, 1, 6).setValues([[
        trip.name,
        trip.destination,
        trip.startDate,
        trip.endDate,
        trip.status,
        trip.notes || '',
      ]]);
      return { success: true };
    }
  }
  return { success: false, error: 'Trip not found' };
}

function deleteTrip(id) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Trip not found' };
}
