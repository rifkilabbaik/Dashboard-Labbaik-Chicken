// ============================================================================
// SALES DASHBOARD v5 — Apps Script (format lama, ringan & tahan lama)
// ============================================================================
// Sheet 'Data': 1 baris per (Sales Date, Branch), kolom = channel
// Sheet 'Regional': mapping toko aktif
// ============================================================================

const SHEETS = { DATA: 'Data', REGIONAL: 'Regional' };
const CHANNELS = ['DINE IN','TAKE AWAY','GRABFOOD','GOFOOD','SHOPEE FOOD','BAZAR','CATERING','ESB Order Delivery','ESB Order Pickup','PAKAR'];
const HEADERS = {
  DATA:     ['Sales Date', 'Branch Name', ...CHANNELS, 'Total'],
  REGIONAL: ['Regional', 'Area', 'Nama Toko']
};
const CELL_LIMIT = 10000000;

function doGet(e) {
  return _handle(e, (p) => {
    const a = p.action || 'status';
    if (a === 'fetchAll')      return { status: 'ok', data: _fetchAll() };
    if (a === 'fetchRegional') return { status: 'ok', data: _fetchRegional() };
    if (a === 'status')        return { status: 'ok', data: _status() };
    if (a === 'debug')         return { status: 'ok', debug: _debug() };
    throw new Error('Unknown action: ' + a);
  });
}

function doPost(e) {
  return _handle(e, () => {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'checkDuplicate') return { status: 'ok', data: _checkDuplicate(b.pairs || []) };
    if (b.action === 'upload')         return { status: 'ok', data: _upload(b.rows || []) };
    throw new Error('Unknown action: ' + b.action);
  });
}

function _handle(e, fn) {
  try { return _json(fn((e && e.parameter) || {})); }
  catch (err) { return _json({ status: 'error', error: err.message, stack: (err.stack||'').split('\n').slice(0,3).join('\n') }); }
}

// ============================================================================
// FETCH
// ============================================================================
function _fetchAll() {
  const sheet = _getSheet(SHEETS.DATA, HEADERS.DATA);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0].map(v => String(v || '').trim().toLowerCase());
  const dateIdx = header.indexOf('sales date');
  const branchIdx = header.indexOf('branch name');
  const totalIdx = header.indexOf('total');
  const chIdx = {};
  CHANNELS.forEach(c => { chIdx[c] = header.indexOf(c.toLowerCase()); });
  if (dateIdx < 0 || branchIdx < 0) throw new Error('Header sheet Data tidak valid');

  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[dateIdx] || !r[branchIdx]) continue;
    const date = _normalizeDate(r[dateIdx]);
    if (!date) continue;
    const channels = {};
    let total = 0;
    CHANNELS.forEach(c => {
      const idx = chIdx[c];
      const v = idx >= 0 ? (Number(r[idx]) || 0) : 0;
      channels[c] = v;
      total += v;
    });
    const totalSheet = totalIdx >= 0 ? Number(r[totalIdx]) || 0 : 0;
    rows.push({
      date, branch: String(r[branchIdx]).trim(),
      channels, total: totalSheet > 0 ? totalSheet : total
    });
  }
  return rows;
}

function _fetchRegional() {
  const sheet = _getSheet(SHEETS.REGIONAL, HEADERS.REGIONAL);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0] || !r[2]) continue;
    rows.push({ regional: String(r[0]).trim(), area: String(r[1] || '').trim(), branch: String(r[2]).trim() });
  }
  return rows;
}

// ============================================================================
// STATUS & CAPACITY
// ============================================================================
function _status() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let totalCells = 0;
  const perSheet = {};
  sheets.forEach(s => {
    const c = s.getMaxRows() * s.getMaxColumns();
    totalCells += c;
    perSheet[s.getName()] = { rows: s.getLastRow(), cells: c };
  });
  const usage = totalCells / CELL_LIMIT;
  const dataSheet = ss.getSheetByName(SHEETS.DATA);
  let lastDate = null, rowCount = 0, dateSet = {};
  if (dataSheet && dataSheet.getLastRow() > 1) {
    const dates = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, 1).getValues();
    for (const [v] of dates) {
      const d = _normalizeDate(v);
      if (d) {
        dateSet[d] = 1;
        if (!lastDate || d > lastDate) lastDate = d;
      }
    }
    rowCount = dataSheet.getLastRow() - 1;
  }
  const distinctDates = Object.keys(dateSet).length;
  return {
    lastDate, rowCount, distinctDates,
    totalCells, cellLimit: CELL_LIMIT, usage,
    perSheet, timestamp: new Date().toISOString()
  };
}

function _debug() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets().map(s => ({ name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn(), maxRows: s.getMaxRows(), maxCols: s.getMaxColumns() }));
  return { spreadsheet: ss.getName(), id: ss.getId(), sheets: allSheets };
}

// ============================================================================
// DUPLICATE CHECK — cek pasangan (date, branch)
// ============================================================================
function _checkDuplicate(pairs) {
  // pairs = [{date, branch}, ...]
  const sheet = _getSheet(SHEETS.DATA, HEADERS.DATA);
  const values = sheet.getDataRange().getValues();
  const existing = {};
  for (let i = 1; i < values.length; i++) {
    const d = _normalizeDate(values[i][0]);
    const b = String(values[i][1] || '').trim();
    if (d && b) existing[d + '|' + b] = true;
  }
  const duplicates = [];
  const newOnes = [];
  pairs.forEach(p => {
    if (existing[p.date + '|' + p.branch]) duplicates.push(p);
    else newOnes.push(p);
  });
  return { totalInFile: pairs.length, duplicates: duplicates.length, newOnes: newOnes.length, duplicatePairs: duplicates.slice(0, 20) };
}

// ============================================================================
// UPLOAD — batch insert
// ============================================================================
function _upload(rows) {
  // rows = [{date, branch, channels: {...}}, ...]
  if (!rows || rows.length === 0) return { added: 0 };
  const sheet = _getSheet(SHEETS.DATA, HEADERS.DATA);
  const arr = rows.map(r => {
    const line = [r.date, r.branch];
    let total = 0;
    CHANNELS.forEach(c => {
      const v = Number((r.channels || {})[c]) || 0;
      line.push(v);
      total += v;
    });
    line.push(total);
    return line;
  });
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, arr.length, HEADERS.DATA.length).setValues(arr);
  return { added: arr.length };
}

// ============================================================================
// HELPERS
// ============================================================================
function _getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
    // Trim kolom & rows berlebih
    const cols = s.getMaxColumns();
    if (cols > headers.length) s.deleteColumns(headers.length + 1, cols - headers.length);
    const rows = s.getMaxRows();
    if (rows > 100) s.deleteRows(101, rows - 100);
  } else if (s.getLastRow() === 0 || !s.getRange(1, 1).getValue()) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
  }
  // Trim kolom kalau sheet lama masih boros
  const cols = s.getMaxColumns();
  if (cols > headers.length) s.deleteColumns(headers.length + 1, cols - headers.length);
  return s;
}

function _normalizeDate(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (typeof v === 'string') {
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + _pad(m[2]) + '-' + _pad(m[3]);
    m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return m[3] + '-' + _pad(m[2]) + '-' + _pad(m[1]);
    const d = new Date(v);
    if (!isNaN(d)) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return null;
}
function _pad(s) { return String(s).padStart(2, '0'); }
function _json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
