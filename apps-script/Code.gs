// ============================================================================
// GOOGLE APPS SCRIPT — Sales Dashboard v4 (Opsi B: agregat per bill + per menu)
// ============================================================================
// Struktur sheets:
//   Data      : 1 baris per Bill (bill number, tanggal, jam, branch, purpose, total, item count)
//   MenuData  : 1 baris per (Date, Branch, Menu) — agregat qty & subtotal
//   Regional  : Regional | Area | Nama Toko (master data toko aktif)
//   Uploads   : catatan file yang sudah pernah diupload (untuk deteksi duplikat)
// ============================================================================

const SHEETS = {
  DATA: 'Data',
  MENU: 'MenuData',
  REGIONAL: 'Regional',
  UPLOADS: 'Uploads'
};

const HEADERS = {
  DATA:     ['Bill Number', 'Sales Date', 'Sales Date In', 'Branch', 'Visit Purpose', 'Total Bill', 'Item Count'],
  MENU:     ['Sales Date', 'Branch', 'Menu Category', 'Menu Category Detail', 'Menu', 'Qty', 'Subtotal'],
  REGIONAL: ['Regional', 'Area', 'Nama Toko'],
  UPLOADS:  ['Upload Time', 'File Name', 'First Bill', 'Last Bill', 'Date Start', 'Date End', 'Branches', 'Bill Count']
};

const CELL_LIMIT = 10000000; // 10 juta sel
const WARN_LEVELS = { warn: 0.6, alert: 0.8, critical: 0.95 };

// ============================================================================
// ROUTER
// ============================================================================
function doGet(e) {
  return _handle(e, (params) => {
    const action = params.action || 'status';
    if (action === 'fetchBills')    return { status: 'ok', data: _fetchBills(params.from, params.to) };
    if (action === 'fetchMenu')     return { status: 'ok', data: _fetchMenu(params.from, params.to) };
    if (action === 'fetchRegional') return { status: 'ok', data: _fetchRegional() };
    if (action === 'status')        return { status: 'ok', data: _status() };
    if (action === 'debug')         return { status: 'ok', debug: _debug() };
    throw new Error('Unknown action: ' + action);
  });
}

function doPost(e) {
  return _handle(e, () => {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'checkDuplicate') return { status: 'ok', data: _checkDuplicate(body) };
    if (body.action === 'uploadChunk')    return { status: 'ok', data: _uploadChunk(body) };
    if (body.action === 'archive')        return { status: 'ok', data: _archive(body) };
    throw new Error('Unknown action: ' + body.action);
  });
}

function _handle(e, fn) {
  try {
    const params = (e && e.parameter) || {};
    return _json(fn(params));
  } catch (err) {
    return _json({ status: 'error', error: err.message, stack: (err.stack||'').split('\n').slice(0,3).join('\n') });
  }
}

// ============================================================================
// FETCH — filter by date range di server (mengurangi payload)
// ============================================================================
function _fetchBills(from, to) {
  const sheet = _getSheet(SHEETS.DATA, HEADERS.DATA);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    if (!r[0]) continue;
    const date = _normalizeDate(r[1]);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;
    rows.push({
      bill:    String(r[0]),
      date:    date,
      time:    _normalizeTime(r[2]),
      branch:  String(r[3] || '').trim(),
      purpose: String(r[4] || '').trim(),
      total:   Number(r[5]) || 0,
      items:   Number(r[6]) || 0
    });
  }
  return rows;
}

function _fetchMenu(from, to) {
  const sheet = _getSheet(SHEETS.MENU, HEADERS.MENU);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const date = _normalizeDate(r[0]);
    if (!date) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;
    rows.push({
      date:     date,
      branch:   String(r[1] || '').trim(),
      category: String(r[2] || '').trim(),
      subCategory: String(r[3] || '').trim(),
      menu:     String(r[4] || '').trim(),
      qty:      Number(r[5]) || 0,
      subtotal: Number(r[6]) || 0
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
    rows.push({
      regional: String(r[0]).trim(),
      area:     String(r[1] || '').trim(),
      branch:   String(r[2]).trim()
    });
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
  let level = 'ok';
  if (usage >= WARN_LEVELS.critical) level = 'critical';
  else if (usage >= WARN_LEVELS.alert) level = 'alert';
  else if (usage >= WARN_LEVELS.warn) level = 'warn';

  // Cari tanggal terbaru
  const dataSheet = ss.getSheetByName(SHEETS.DATA);
  let lastDate = null, billCount = 0;
  if (dataSheet && dataSheet.getLastRow() > 1) {
    const dates = dataSheet.getRange(2, 2, dataSheet.getLastRow() - 1, 1).getValues();
    for (const [v] of dates) {
      const d = _normalizeDate(v);
      if (d && (!lastDate || d > lastDate)) lastDate = d;
    }
    billCount = dataSheet.getLastRow() - 1;
  }
  return {
    lastDate,
    billCount,
    totalCells,
    cellLimit: CELL_LIMIT,
    usage,
    level,
    perSheet,
    timestamp: new Date().toISOString()
  };
}

function _debug() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allSheets = ss.getSheets().map(s => ({
    name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn()
  }));
  const result = { spreadsheet: ss.getName(), id: ss.getId(), url: ss.getUrl(), sheets: allSheets };
  Object.values(SHEETS).forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) {
      const vals = s.getDataRange().getValues();
      result[name] = { header: vals[0] || null, firstRows: vals.slice(1, 3), lastRow: vals[vals.length-1] };
    } else {
      result[name] = 'NOT FOUND';
    }
  });
  return result;
}

// ============================================================================
// UPLOAD — dengan deteksi duplikat
// ============================================================================
function _checkDuplicate(body) {
  const uploadsSheet = _getSheet(SHEETS.UPLOADS, HEADERS.UPLOADS);
  const rows = uploadsSheet.getDataRange().getValues();
  const firstBill = String(body.firstBill || '');
  const dateStart = String(body.dateStart || '');
  const dateEnd = String(body.dateEnd || '');
  const branches = (body.branches || []).map(String).sort().join(',');

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const existingFirstBill = String(r[2] || '');
    const existingStart = _normalizeDate(r[4]);
    const existingEnd = _normalizeDate(r[5]);
    const existingBranches = String(r[6] || '');

    // Cek 1: bill number sama
    if (firstBill && existingFirstBill === firstBill) {
      return { duplicate: true, reason: 'Bill Number ' + firstBill + ' sudah pernah diupload pada ' + r[0], match: 'bill' };
    }
    // Cek 2: overlap tanggal + branch sama persis
    if (dateStart && dateEnd && existingStart && existingEnd) {
      const overlap = !(dateEnd < existingStart || dateStart > existingEnd);
      if (overlap && existingBranches === branches) {
        return { duplicate: true, reason: 'Data untuk tanggal ' + existingStart + ' – ' + existingEnd + ' (branch: ' + branches + ') sudah ada.', match: 'range' };
      }
    }
  }
  return { duplicate: false };
}

function _uploadChunk(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const chunkType = body.chunkType; // 'bills' | 'menu' | 'record'
  if (chunkType === 'bills') {
    const sheet = _getSheet(SHEETS.DATA, HEADERS.DATA);
    const rows = (body.rows || []).map(r => [
      r.bill, r.date, r.time || '', r.branch, r.purpose, r.total, r.items
    ]);
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.DATA.length).setValues(rows);
    }
    return { added: rows.length };
  }
  if (chunkType === 'menu') {
    const sheet = _getSheet(SHEETS.MENU, HEADERS.MENU);
    const rows = (body.rows || []).map(r => [
      r.date, r.branch, r.category, r.subCategory, r.menu, r.qty, r.subtotal
    ]);
    if (rows.length > 0) {
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.MENU.length).setValues(rows);
    }
    return { added: rows.length };
  }
  if (chunkType === 'record') {
    // Catat di sheet Uploads
    const sheet = _getSheet(SHEETS.UPLOADS, HEADERS.UPLOADS);
    const now = new Date();
    const branches = (body.branches || []).map(String).sort().join(',');
    sheet.appendRow([
      Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      body.fileName || '',
      body.firstBill || '',
      body.lastBill || '',
      body.dateStart || '',
      body.dateEnd || '',
      branches,
      body.billCount || 0
    ]);
    return { recorded: true };
  }
  throw new Error('Unknown chunkType: ' + chunkType);
}

// ============================================================================
// ARCHIVE — pindah data lama ke sheet arsip
// ============================================================================
function _archive(body) {
  const beforeDate = body.beforeDate; // YYYY-MM-DD
  if (!beforeDate) throw new Error('beforeDate wajib diisi');
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const archive = (srcName, headerArr, dateColIdx) => {
    const src = ss.getSheetByName(srcName);
    if (!src) return { moved: 0 };
    const archName = 'Arsip_' + srcName + '_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
    const values = src.getDataRange().getValues();
    if (values.length < 2) return { moved: 0 };
    const keep = [values[0]];
    const moved = [values[0]];
    for (let i = 1; i < values.length; i++) {
      const d = _normalizeDate(values[i][dateColIdx]);
      if (d && d < beforeDate) moved.push(values[i]);
      else keep.push(values[i]);
    }
    if (moved.length > 1) {
      const arch = ss.insertSheet(archName);
      arch.getRange(1, 1, moved.length, headerArr.length).setValues(moved);
      // Rewrite source sheet
      src.clearContents();
      src.getRange(1, 1, keep.length, headerArr.length).setValues(keep);
    }
    return { moved: moved.length - 1, archiveSheet: archName };
  };

  const bills = archive(SHEETS.DATA, HEADERS.DATA, 1);
  const menu = archive(SHEETS.MENU, HEADERS.MENU, 0);
  return { bills, menu };
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
  } else if (s.getLastRow() === 0 || !s.getRange(1, 1).getValue()) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
  }
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

function _normalizeTime(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
  }
  if (typeof v === 'string') {
    const m = v.match(/(\d{1,2}):(\d{2})/);
    if (m) return _pad(m[1]) + ':' + _pad(m[2]);
  }
  return '';
}

function _pad(s) { return String(s).padStart(2, '0'); }

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
