const SHEET_NAME    = 'Trips';
const HEADERS       = ['ID', 'Trip Name', 'Destination', 'Start Date', 'End Date', 'Status', 'Notes'];

const SCHED_SHEET   = 'Schedules';
const SCHED_HEADERS = ['ID', 'TripID', 'DateTime', 'Detail', 'Transport', 'Cost', 'Map', 'Note', 'Status'];

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

// ─── Trips sheet ──────────────────────────────────────────────────────────────

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getTrips() {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
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
  const id    = 'TRIP-' + Date.now();
  sheet.appendRow([id, trip.name, trip.destination, trip.startDate, trip.endDate, trip.status, trip.notes || '']);
  return { success: true, id };
}

function updateTrip(trip) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === trip.id) {
      sheet.getRange(i + 1, 2, 1, 6).setValues([[
        trip.name, trip.destination, trip.startDate, trip.endDate, trip.status, trip.notes || '',
      ]]);
      return { success: true };
    }
  }
  return { success: false, error: 'Trip not found' };
}

function deleteTrip(id) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false, error: 'Trip not found' };
}

// ─── Schedules sheet ──────────────────────────────────────────────────────────

function getSchedSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SCHED_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SCHED_SHEET);
    sheet.appendRow(SCHED_HEADERS);
    sheet.getRange(1, 1, 1, SCHED_HEADERS.length)
      .setFontWeight('bold').setBackground('#137333').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSchedulesByTripId(tripId) {
  const sheet = getSchedSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1)
    .filter(row => row[1] === tripId)
    .map(row => ({
      id:        row[0],
      tripId:    row[1],
      dateTime:  row[2] ? Utilities.formatDate(new Date(row[2]), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm") : '',
      detail:    row[3],
      transport: row[4],
      cost:      row[5],
      map:       row[6],
      note:      row[7],
      status:    row[8],
    }));
}

function addSchedule(schedule) {
  const sheet = getSchedSheet();
  const id    = 'SCHED-' + Date.now();
  sheet.appendRow([
    id, schedule.tripId, schedule.dateTime, schedule.detail,
    schedule.transport || '', schedule.cost || '', schedule.map || '',
    schedule.note || '', schedule.status,
  ]);
  return { success: true, id };
}

function updateSchedule(schedule) {
  const sheet = getSchedSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === schedule.id) {
      sheet.getRange(i + 1, 2, 1, 8).setValues([[
        schedule.tripId, schedule.dateTime, schedule.detail,
        schedule.transport || '', schedule.cost || '', schedule.map || '',
        schedule.note || '', schedule.status,
      ]]);
      return { success: true };
    }
  }
  return { success: false, error: 'Schedule not found' };
}

function deleteSchedule(id) {
  const sheet = getSchedSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  return { success: false, error: 'Schedule not found' };
}
