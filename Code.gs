const SHEET_NAME    = 'Trips';
const HEADERS       = ['ID', 'Trip Name', 'Destination', 'Start Date', 'End Date', 'Status', 'Notes'];

const SCHED_SHEET   = 'Schedules';
const SCHED_HEADERS = ['ID', 'TripID', 'DateTime', 'Detail', 'Transport', 'Cost', 'Map', 'Note', 'Status'];

const CACHE_TTL = 300; // 5-minute safety-net TTL (writes always clear immediately)

// ─── Spreadsheet instance cache (per execution) ───────────────────────────────
// getActiveSpreadsheet() costs ~200 ms each call — reuse within same execution.
let _ss = null;
function _getSpreadsheet() {
  if (!_ss) _ss = SpreadsheetApp.getActiveSpreadsheet();
  return _ss;
}

function doGet() {
  // Pre-warm CacheService while the HTML template is being built so the first
  // client-side getAppData() call hits cache instead of reading Sheets cold.
  try { getTrips(); getAllSchedules(); } catch (e) {}
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
  const ss = _getSpreadsheet();
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

  const sheet = getSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const trips = data.slice(1).map(row => ({
    id:          row[0],
    name:        row[1],
    destination: row[2],
    startDate:   row[3] ? Utilities.formatDate(new Date(row[3]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    endDate:     row[4] ? Utilities.formatDate(new Date(row[4]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : '',
    status:      row[5],
    notes:       row[6],
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
  const ss = _getSpreadsheet();
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

  const sheet = getSchedSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const list = data.slice(1)
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
  _cache().put(cacheKey, JSON.stringify(list), CACHE_TTL);
  return list;
}

// Returns ALL schedules across all trips (used by getAppData batch call)
function getAllSchedules() {
  const cached = _cache().get('scheds-all');
  if (cached) return JSON.parse(cached);

  const sheet = getSchedSheet();
  const data  = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const tz   = Session.getScriptTimeZone();
  const list = data.slice(1).map(row => ({
    id:        row[0],
    tripId:    row[1],
    dateTime:  row[2] ? Utilities.formatDate(new Date(row[2]), tz, "yyyy-MM-dd'T'HH:mm") : '',
    detail:    row[3],
    transport: row[4],
    cost:      row[5],
    map:       row[6],
    note:      row[7],
    status:    row[8],
  }));
  _cache().put('scheds-all', JSON.stringify(list), CACHE_TTL);
  return list;
}

// Single batch endpoint — one round trip replaces two separate calls
function getAppData() {
  return { trips: getTrips(), schedules: getAllSchedules() };
}

function addSchedule(schedule) {
  const sheet = getSchedSheet();
  const id    = 'SCHED-' + Date.now();
  sheet.appendRow([
    id, schedule.tripId, schedule.dateTime, schedule.detail,
    schedule.transport || '', schedule.cost || '', schedule.map || '',
    schedule.note || '', schedule.status,
  ]);
  _cache().removeAll(['scheds-' + schedule.tripId, 'scheds-all']);
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
      _cache().removeAll(['scheds-' + schedule.tripId, 'scheds-all']);
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
      _cache().removeAll(['scheds-' + tripId, 'scheds-all']);
      return { success: true };
    }
  }
  return { success: false, error: 'Schedule not found' };
}

// ─── Users sheet ─────────────────────────────────────────────────────────────

const USERS_SHEET   = 'Users';
const USERS_HEADERS = ['ID', 'Name', 'Password', 'Salt', 'Role', 'CreatedAt', 'UpdatedAt', 'LastLoginAt', 'CreatedBy', 'IsActive', 'Email', 'AuthMethod', 'Lang'];

function getUsersSheet() {
  const ss = _getSpreadsheet();
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
