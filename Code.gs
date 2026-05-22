const SHEET_NAME    = 'Trips';
const HEADERS       = ['ID', 'Trip Name', 'Destination', 'Start Date', 'End Date', 'Status', 'Notes'];

const SCHED_SHEET   = 'Schedules';
const SCHED_HEADERS = ['ID', 'TripID', 'DateTime', 'Detail', 'Transport', 'Cost', 'Map', 'Note', 'Status'];

const CACHE_TTL = 300; // 5-minute safety-net TTL (writes always clear immediately)

// ─── GViz SQL-like query helper ───────────────────────────────────────────────
// Usage: _querySheet('Trips', 'SELECT * WHERE F = "Planning" ORDER BY D ASC')
// Columns are referenced by letter (A, B, C …) matching sheet column order.
// Supported clauses: SELECT, WHERE, ORDER BY, LIMIT, GROUP BY, COUNT/SUM/AVG
//
// Returns an array of objects keyed by column label (header row value).
function _querySheet(sheetName, sql) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId()
            + '/gviz/tq?tq=' + encodeURIComponent(sql)
            + '&sheet='      + encodeURIComponent(sheetName)
            + '&headers=1';

  const res  = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });

  // GViz wraps JSON in  google.visualization.Query.setResponse({…});
  const raw  = res.getContentText().replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
  const json = JSON.parse(raw);

  if (json.status === 'error') {
    const msg = (json.errors || []).map(e => e.detailed_message || e.message).join('; ');
    throw new Error('[_querySheet] ' + sheetName + ': ' + msg);
  }

  const table = json.table;
  const cols  = table.cols.map(c => c.label || c.id);   // header labels
  return (table.rows || []).map(row => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row.c[i] ? row.c[i].v : null; });
    return obj;
  });
}

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

// ─── Cache helper ─────────────────────────────────────────────────────────────
function _cache() { return CacheService.getScriptCache(); }

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
  const cached = _cache().get('trips');
  if (cached) return JSON.parse(cached);

  getSheet(); // ensure sheet + headers exist before querying
  const tz   = Session.getScriptTimeZone();
  const rows  = _querySheet(SHEET_NAME, 'SELECT * ORDER BY D ASC');
  const trips = rows.map(r => ({
    id:          r['ID'],
    name:        r['Trip Name'],
    destination: r['Destination'],
    startDate:   r['Start Date'] ? Utilities.formatDate(new Date(r['Start Date']), tz, 'yyyy-MM-dd') : '',
    endDate:     r['End Date']   ? Utilities.formatDate(new Date(r['End Date']),   tz, 'yyyy-MM-dd') : '',
    status:      r['Status'],
    notes:       r['Notes'],
  }));
  _cache().put('trips', JSON.stringify(trips), CACHE_TTL);
  return trips;
}

function addTrip(trip) {
  const sheet = getSheet();
  const id    = 'TRIP-' + Date.now();
  sheet.appendRow([id, trip.name, trip.destination, trip.startDate, trip.endDate, trip.status, trip.notes || '']);
  _cache().remove('trips');
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
      _cache().remove('trips');
      return { success: true };
    }
  }
  return { success: false, error: 'Trip not found' };
}

function deleteTrip(id) {
  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      _cache().remove('trips');
      return { success: true };
    }
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
  const cacheKey = 'scheds-' + tripId;
  const cached   = _cache().get(cacheKey);
  if (cached) return JSON.parse(cached);

  getSchedSheet(); // ensure sheet + headers exist before querying
  const tz   = Session.getScriptTimeZone();
  const rows  = _querySheet(SCHED_SHEET,
    `SELECT * WHERE B = '${tripId}' ORDER BY C ASC`);
  const list  = rows.map(r => ({
    id:        r['ID'],
    tripId:    r['TripID'],
    dateTime:  r['DateTime'] ? Utilities.formatDate(new Date(r['DateTime']), tz, "yyyy-MM-dd'T'HH:mm") : '',
    detail:    r['Detail'],
    transport: r['Transport'],
    cost:      r['Cost'],
    map:       r['Map'],
    note:      r['Note'],
    status:    r['Status'],
  }));
  _cache().put(cacheKey, JSON.stringify(list), CACHE_TTL);
  return list;
}

function addSchedule(schedule) {
  const sheet = getSchedSheet();
  const id    = 'SCHED-' + Date.now();
  sheet.appendRow([
    id, schedule.tripId, schedule.dateTime, schedule.detail,
    schedule.transport || '', schedule.cost || '', schedule.map || '',
    schedule.note || '', schedule.status,
  ]);
  _cache().remove('scheds-' + schedule.tripId);
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
      _cache().remove('scheds-' + schedule.tripId);
      return { success: true };
    }
  }
  return { success: false, error: 'Schedule not found' };
}

function deleteSchedule(id) {
  const sheet  = getSchedSheet();
  const data   = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const tripId = data[i][1];
      sheet.deleteRow(i + 1);
      _cache().remove('scheds-' + tripId);
      return { success: true };
    }
  }
  return { success: false, error: 'Schedule not found' };
}

// ─── Users sheet ─────────────────────────────────────────────────────────────

const USERS_SHEET   = 'Users';
const USERS_HEADERS = ['ID', 'Name', 'Password', 'Salt', 'Role', 'CreatedAt', 'UpdatedAt', 'LastLoginAt', 'CreatedBy', 'IsActive', 'Email', 'AuthMethod', 'Lang'];

function getUsersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET);
    sheet.appendRow(USERS_HEADERS);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length)
      .setFontWeight('bold').setBackground('#b45309').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    const salt = Utilities.getUuid();
    sheet.appendRow(['USER-1', 'admin', hashPassword('admin123', salt), salt, 'admin', new Date(), new Date(), '', 'system', true, '', 'local', 'en']);
  }
  return sheet;
}

function hashPassword(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + salt,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function loginUser(name, password) {
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1]).toLowerCase() === String(name).toLowerCase() && row[9] === true) {
      if (hashPassword(password, String(row[3])) === String(row[2])) {
        sheet.getRange(i + 1, 8).setValue(new Date());
        return { success: true, user: { id: String(row[0]), name: String(row[1]), role: String(row[4]), lang: String(row[12] || 'en') } };
      }
    }
  }
  return { success: false, error: 'Invalid username or password' };
}

function registerUser(name, password) {
  if (!name || name.trim().length < 3)  return { success: false, error: 'Username must be at least 3 characters' };
  if (!password || password.length < 6) return { success: false, error: 'Password must be at least 6 characters' };
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).toLowerCase() === String(name).toLowerCase()) {
      return { success: false, error: 'Username already taken' };
    }
  }
  const id   = 'USER-' + Date.now();
  const salt = Utilities.getUuid();
  const now  = new Date();
  sheet.appendRow([id, name.trim(), hashPassword(password, salt), salt, 'viewer', now, now, '', 'self', true, '', 'local', 'en']);
  return { success: true };
}

function getUsers() {
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(row => ({
    id:          String(row[0]),
    name:        String(row[1]),
    role:        String(row[4]),
    createdAt:   row[5] ? Utilities.formatDate(new Date(row[5]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    lastLoginAt: row[7] ? Utilities.formatDate(new Date(row[7]), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : '—',
    isActive:    !!row[9],
    email:       String(row[10] || ''),
    authMethod:  String(row[11] || 'local'),
    lang:        String(row[12] || 'en'),
  }));
}

function updateUser(userId, updates) {
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      if (updates.role     !== undefined) sheet.getRange(i + 1, 5).setValue(updates.role);
      if (updates.isActive !== undefined) sheet.getRange(i + 1, 10).setValue(updates.isActive);
      sheet.getRange(i + 1, 7).setValue(new Date());
      return { success: true };
    }
  }
  return { success: false, error: 'User not found' };
}

function getGoogleUser() {
  try {
    const email = Session.getActiveUser().getEmail();
    return { success: true, email: email || '' };
  } catch (e) {
    return { success: false, email: '' };
  }
}

function loginWithGoogle(email) {
  if (!email) return { success: false, error: 'No email provided' };
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[10]).toLowerCase() === String(email).toLowerCase() &&
        String(row[11]) === 'google' && row[9] === true) {
      sheet.getRange(i + 1, 8).setValue(new Date());
      return { success: true, user: { id: String(row[0]), name: String(row[1]), role: String(row[4]), lang: String(row[12] || 'en') } };
    }
  }
  return { success: false, error: 'not_found', email: email };
}

function registerWithGoogle(email, name) {
  if (!email) return { success: false, error: 'No email provided' };
  if (!name || name.trim().length < 2) return { success: false, error: 'Name must be at least 2 characters' };
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][10]).toLowerCase() === String(email).toLowerCase()) {
      return { success: false, error: 'This Google account is already registered' };
    }
    if (String(data[i][1]).toLowerCase() === String(name.trim()).toLowerCase()) {
      return { success: false, error: 'Display name already taken' };
    }
  }
  const id  = 'USER-' + Date.now();
  const now = new Date();
  sheet.appendRow([id, name.trim(), '', '', 'viewer', now, now, now, 'google-oauth', true, email, 'google', 'en']);
  return { success: true, user: { id: id, name: name.trim(), role: 'viewer', lang: 'en' } };
}

function updateProfile(userId, updates) {
  const sheet = getUsersSheet();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      const row = data[i];
      if (updates.name !== undefined) {
        const newName = String(updates.name).trim();
        if (newName.length < 2) return { success: false, error: 'Name must be at least 2 characters' };
        for (let j = 1; j < data.length; j++) {
          if (j !== i && String(data[j][1]).toLowerCase() === newName.toLowerCase()) {
            return { success: false, error: 'Name already taken' };
          }
        }
        sheet.getRange(i + 1, 2).setValue(newName);
      }
      if (updates.newPassword !== undefined) {
        if (String(row[11]) !== 'local') return { success: false, error: 'Cannot change password for Google accounts' };
        if (!updates.currentPassword) return { success: false, error: 'Current password required' };
        if (hashPassword(updates.currentPassword, String(row[3])) !== String(row[2])) {
          return { success: false, error: 'Current password is incorrect' };
        }
        if (updates.newPassword.length < 6) return { success: false, error: 'New password must be at least 6 characters' };
        const salt = Utilities.getUuid();
        sheet.getRange(i + 1, 3).setValue(hashPassword(updates.newPassword, salt));
        sheet.getRange(i + 1, 4).setValue(salt);
      }
      if (updates.lang !== undefined) {
        sheet.getRange(i + 1, 13).setValue(updates.lang);
      }
      sheet.getRange(i + 1, 7).setValue(new Date());
      return { success: true };
    }
  }
  return { success: false, error: 'User not found' };
}
