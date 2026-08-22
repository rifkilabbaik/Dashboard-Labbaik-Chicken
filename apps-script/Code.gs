// ============================================================================
// SALES DASHBOARD v8 — Apps Script (Sales + Regional + Kegiatan + Komplain)
// ============================================================================
// Sheet 'Data': 1 baris per (Sales Date, Branch), kolom = channel
// Sheet 'Regional': mapping toko aktif
// ============================================================================

const SHEETS = { DATA: 'Data', REGIONAL: 'Regional', KEGIATAN: 'Kegiatan', KOMPLAIN: 'Komplain' };
const CHANNELS = ['DINE IN','TAKE AWAY','GRABFOOD','GOFOOD','SHOPEE FOOD','BAZAR','CATERING','ESB Order Delivery','ESB Order Pickup','PAKAR'];
const HEADERS = {
  DATA:     ['Sales Date', 'Branch Name', ...CHANNELS, 'Total'],
  REGIONAL: ['Regional', 'Area', 'Nama Toko'],
  // Kegiatan: Tanggal | Nama | Nama Toko | Kegiatan | Keterangan 1 | Keterangan 2
  KEGIATAN: ['Tanggal', 'Nama', 'Nama Toko', 'Kegiatan', 'Keterangan 1', 'Keterangan 2'],
  // Komplain: hanya kolom yang diinput dari aplikasi. Sheet boleh punya kolom lain
  // (Case Id, Tanggal Komplain, Area Manager, dst) — kolom itu dibiarkan kosong.
  KOMPLAIN: ['Nama', 'Kontak', 'Alamat', 'Nama Store', 'Media Komplain', 'Kategori', 'Tanggal Transaksi', 'Isi Komplain']
};
// key field -> nama header. Dipakai form input (subset) & upload file (semua).
const KOMPLAIN_FIELDS = [
  ['caseId',      'Case Id'],
  ['name',        'Nama'],
  ['contact',     'Kontak'],
  ['address',     'Alamat'],
  ['store',       'Nama Store'],
  ['media',       'Media Komplain'],
  ['category',    'Kategori'],
  ['trxDate',     'Tanggal Transaksi'],
  ['cmpDate',     'Tanggal Komplain'],
  ['body',        'Isi Komplain'],
  ['inputDate',   'Tanggal Input'],
  ['areaMgr',     'Area Manager'],
  ['regionalMgr', 'Regional Manager']
];
// Kolom tanggal komplain -> disimpan sebagai TEXT (hindari geser timezone)
const KOMPLAIN_DATE_KEYS = ['trxDate', 'cmpDate', 'inputDate'];
const CELL_LIMIT = 10000000;

function doGet(e) {
  return _handle(e, (p) => {
    const a = p.action || 'status';
    if (a === 'fetchAll')      return { status: 'ok', data: _fetchAll() };
    if (a === 'fetchRegional') return { status: 'ok', data: _fetchRegional() };
    if (a === 'status')        return { status: 'ok', data: _status() };
    if (a === 'fetchKegiatan') return { status: 'ok', data: _fetchKegiatan() };
    if (a === 'fetchKomplain') return { status: 'ok', data: _fetchKomplain() };
    if (a === 'debug')         return { status: 'ok', debug: _debug() };
    throw new Error('Unknown action: ' + a);
  });
}

function doPost(e) {
  return _handle(e, () => {
    const b = JSON.parse(e.postData.contents);
    if (b.action === 'checkDuplicate') return { status: 'ok', data: _checkDuplicate(b.pairs || []) };
    if (b.action === 'upload')         return { status: 'ok', data: _upload(b.rows || []) };
    if (b.action === 'addKegiatan')    return { status: 'ok', data: _addKegiatan(b.row || {}) };
    if (b.action === 'addKomplain')    return { status: 'ok', data: _addKomplain(b.row || {}) };
    if (b.action === 'checkDuplicateKomplain') return { status: 'ok', data: _checkDuplicateKomplain(b.keys || []) };
    if (b.action === 'uploadKomplain') return { status: 'ok', data: _uploadKomplain(b.rows || []) };
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
  // Paksa kolom Sales Date (kolom 1) jadi TEXT supaya tidak ada konversi timezone
  sheet.getRange(lastRow + 1, 1, arr.length, 1).setNumberFormat('@');
  sheet.getRange(lastRow + 1, 1, arr.length, HEADERS.DATA.length).setValues(arr);
  return { added: arr.length };
}

// ============================================================================
// KEGIATAN — sheet "Kegiatan"
// Tanggal | Nama | Nama Toko | Kegiatan | Keterangan 1 | Keterangan 2
// ============================================================================
function _fetchKegiatan() {
  const sheet = _getSheetSoft(SHEETS.KEGIATAN, HEADERS.KEGIATAN);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const idx = _headerIndex(values[0]);
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const date = _normalizeDate(_at(r, idx, 'tanggal'));
    const type = String(_at(r, idx, 'kegiatan') || '').trim();
    const name = String(_at(r, idx, 'nama') || '').trim();
    if (!date && !type && !name) continue;
    out.push({
      date: date || '',
      name: name,
      store: String(_at(r, idx, 'nama toko') || '').trim(),
      type: type,
      k1: String(_at(r, idx, 'keterangan 1') == null ? '' : _at(r, idx, 'keterangan 1')).trim(),
      k2: String(_at(r, idx, 'keterangan 2') == null ? '' : _at(r, idx, 'keterangan 2')).trim()
    });
  }
  return out;
}

function _addKegiatan(row) {
  const date = _normalizeDate(row.date);
  if (!date) throw new Error('Tanggal kegiatan tidak valid');
  if (!row.name)  throw new Error('Nama wajib diisi');
  if (!row.store) throw new Error('Nama Toko wajib diisi');
  if (!row.type)  throw new Error('Kegiatan wajib diisi');
  return _appendByHeader(SHEETS.KEGIATAN, HEADERS.KEGIATAN, {
    'tanggal':       date,
    'nama':          String(row.name).trim(),
    'nama toko':     String(row.store).trim(),
    'kegiatan':      String(row.type).trim(),
    'keterangan 1':  String(row.k1 == null ? '' : row.k1).trim(),
    'keterangan 2':  String(row.k2 == null ? '' : row.k2).trim()
  }, ['tanggal']);
}

// ============================================================================
// KOMPLAIN — sheet "Komplain"
// Hanya 8 kolom yang diinput dari aplikasi; kolom lain dibiarkan kosong.
// ============================================================================
function _fetchKomplain() {
  const sheet = _getSheetSoft(SHEETS.KOMPLAIN, HEADERS.KOMPLAIN);
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const idx = _headerIndex(values[0]);
  const out = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const name = String(_at(r, idx, 'nama') || '').trim();
    const store = String(_at(r, idx, 'nama store') || '').trim();
    if (!name && !store) continue;
    out.push({
      name: name,
      contact: String(_at(r, idx, 'kontak') || '').trim(),
      address: String(_at(r, idx, 'alamat') || '').trim(),
      store: store,
      media: String(_at(r, idx, 'media komplain') || '').trim(),
      category: String(_at(r, idx, 'kategori') || '').trim(),
      trxDate: _normalizeDate(_at(r, idx, 'tanggal transaksi')) || '',
      body: String(_at(r, idx, 'isi komplain') || '').trim()
    });
  }
  return out;
}

function _addKomplain(row) {
  const date = _normalizeDate(row.trxDate);
  if (!row.name)     throw new Error('Nama wajib diisi');
  if (!row.store)    throw new Error('Nama Store wajib diisi');
  if (!row.media)    throw new Error('Media Komplain wajib diisi');
  if (!row.category) throw new Error('Kategori wajib diisi');
  if (!date)         throw new Error('Tanggal Transaksi tidak valid');
  if (!row.body)     throw new Error('Isi Komplain wajib diisi');
  return _appendByHeader(SHEETS.KOMPLAIN, HEADERS.KOMPLAIN, {
    'nama':              String(row.name).trim(),
    'kontak':            String(row.contact == null ? '' : row.contact).trim(),
    'alamat':            String(row.address == null ? '' : row.address).trim(),
    'nama store':        String(row.store).trim(),
    'media komplain':    String(row.media).trim(),
    'kategori':          String(row.category).trim(),
    'tanggal transaksi': date,
    'isi komplain':      String(row.body).trim()
  }, ['tanggal transaksi']);
}

// ============================================================================
// KOMPLAIN — upload file (batch)
// ============================================================================
// Kunci duplikat. HARUS sama dengan UploadParser.complaintKey() di upload.js.
function _komplainKey(row) {
  const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
  if (norm(row.caseId)) return 'id:' + norm(row.caseId);
  return 'x:' + [norm(row.name), norm(row.store), String(row.trxDate || '').slice(0, 10), norm(row.body)].join('|');
}

// Baca sheet Komplain sekali, hasilkan set kunci yang sudah ada
function _komplainExistingKeys() {
  const sheet = _getSheetSoft(SHEETS.KOMPLAIN, HEADERS.KOMPLAIN);
  const set = {};
  if (sheet.getLastRow() < 2) return set;
  const values = sheet.getDataRange().getValues();
  const idx = _headerIndex(values[0]);
  const pick = {};
  KOMPLAIN_FIELDS.forEach(f => { pick[f[0]] = idx[f[1].toLowerCase()]; });
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const row = {};
    KOMPLAIN_FIELDS.forEach(f => {
      const ci = pick[f[0]];
      row[f[0]] = ci === undefined ? '' : r[ci];
    });
    if (!String(row.name || '').trim() && !String(row.store || '').trim()) continue;
    // Tanggal di sheet bisa berupa Date object -> samakan jadi yyyy-MM-dd dulu
    row.trxDate = _normalizeDate(row.trxDate) || String(row.trxDate || '');
    set[_komplainKey(row)] = true;
  }
  return set;
}

function _checkDuplicateKomplain(keys) {
  const existing = _komplainExistingKeys();
  let duplicates = 0;
  keys.forEach(k => { if (existing[k]) duplicates++; });
  return { totalInFile: keys.length, duplicates: duplicates, newOnes: keys.length - duplicates };
}

function _uploadKomplain(rows) {
  if (!rows || rows.length === 0) return { added: 0, skipped: 0 };
  const sheet = _getSheetSoft(SHEETS.KOMPLAIN, HEADERS.KOMPLAIN);
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.KOMPLAIN.length);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = _headerIndex(headerRow);

  // Tambah header yang belum ada di kanan (mis. sheet baru tanpa Case Id)
  let width = lastCol;
  KOMPLAIN_FIELDS.forEach(f => {
    const key = f[1].toLowerCase();
    // Hanya tambahkan kalau ada datanya di batch ini
    const used = rows.some(r => String(r[f[0]] == null ? '' : r[f[0]]).trim() !== '');
    if (idx[key] === undefined && used) {
      width++;
      sheet.getRange(1, width, 1, 1).setValue(f[1]);
      idx[key] = width - 1;
    }
  });

  const existing = _komplainExistingKeys();
  const matrix = [];
  let skipped = 0;
  rows.forEach(r => {
    if (!String(r.name || '').trim() || !String(r.store || '').trim()) { skipped++; return; }
    if (existing[_komplainKey(r)]) { skipped++; return; }
    existing[_komplainKey(r)] = true;   // cegah duplikat di dalam batch yang sama
    const line = new Array(width).fill('');
    KOMPLAIN_FIELDS.forEach(f => {
      const ci = idx[f[1].toLowerCase()];
      if (ci === undefined) return;
      const v = r[f[0]];
      line[ci] = v == null ? '' : String(v);
    });
    matrix.push(line);
  });
  if (matrix.length === 0) return { added: 0, skipped: skipped };

  const targetRow = sheet.getLastRow() + 1;
  // Paksa kolom tanggal jadi TEXT untuk seluruh blok baris baru
  KOMPLAIN_DATE_KEYS.forEach(k => {
    const header = (KOMPLAIN_FIELDS.filter(f => f[0] === k)[0] || [])[1];
    const ci = header ? idx[header.toLowerCase()] : undefined;
    if (ci !== undefined) sheet.getRange(targetRow, ci + 1, matrix.length, 1).setNumberFormat('@');
  });
  sheet.getRange(targetRow, 1, matrix.length, width).setValues(matrix);
  return { added: matrix.length, skipped: skipped };
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
  if (v instanceof Date) {
    // Pakai spreadsheet timezone (bukan script timezone) supaya konsisten dgn cara Sheets simpan
    const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  }
  if (typeof v === 'string') {
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + _pad(m[2]) + '-' + _pad(m[3]);
    m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return m[3] + '-' + _pad(m[2]) + '-' + _pad(m[1]);
    const d = new Date(v);
    if (!isNaN(d)) {
      const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
      return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
    }
  }
  return null;
}
function _pad(s) { return String(s).padStart(2, '0'); }
function _json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---- Sheet helper yang TIDAK memangkas kolom.
// Dipakai untuk Kegiatan/Komplain: sheet-nya boleh punya kolom tambahan
// (mis. Case Id, Tanggal Komplain, Area Manager) yang tidak boleh dihapus.
function _getSheetSoft(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
    return s;
  }
  if (s.getLastRow() === 0 || !String(s.getRange(1, 1).getValue()).trim()) {
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.setFrozenRows(1);
  }
  return s;
}

// Peta nama header (lowercase, trimmed) -> index kolom (0-based)
function _headerIndex(headerRow) {
  const map = {};
  (headerRow || []).forEach((h, i) => {
    const k = String(h == null ? '' : h).trim().toLowerCase();
    if (k && map[k] === undefined) map[k] = i;
  });
  return map;
}
function _at(row, idx, key) {
  const i = idx[key];
  return i === undefined ? '' : row[i];
}

// Append 1 baris dengan mencocokkan header sheet (bukan urutan tetap),
// supaya kolom ekstra di sheet tetap utuh & tidak bergeser.
// textCols = daftar header yang harus disimpan sebagai TEXT (tanggal).
function _appendByHeader(sheetName, defaultHeaders, valuesByHeader, textCols) {
  const sheet = _getSheetSoft(sheetName, defaultHeaders);
  const lastCol = Math.max(sheet.getLastColumn(), defaultHeaders.length);
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = _headerIndex(headerRow);

  // Header yang belum ada di sheet -> tambahkan di kolom paling kanan
  let width = lastCol;
  Object.keys(valuesByHeader).forEach(key => {
    if (idx[key] === undefined) {
      width++;
      const proper = defaultHeaders.filter(h => h.toLowerCase() === key)[0] || key;
      sheet.getRange(1, width, 1, 1).setValue(proper);
      idx[key] = width - 1;
    }
  });

  const line = new Array(width).fill('');
  Object.keys(valuesByHeader).forEach(key => { line[idx[key]] = valuesByHeader[key]; });

  const targetRow = sheet.getLastRow() + 1;
  // Paksa kolom tanggal jadi TEXT supaya tidak ada konversi timezone
  (textCols || []).forEach(key => {
    if (idx[key] !== undefined) sheet.getRange(targetRow, idx[key] + 1, 1, 1).setNumberFormat('@');
  });
  sheet.getRange(targetRow, 1, 1, width).setValues([line]);
  return { added: 1, row: targetRow };
}
