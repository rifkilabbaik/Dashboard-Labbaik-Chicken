// ============================================================================
// UPLOAD & PARSE FILE .xlsx dari ESB
// ============================================================================
// Format asal: Sales Recapitulation Detail Report (header di baris 11, data mulai 12)
// Transform: agregat per Bill (untuk sheet Data) + per (Date, Branch, Menu) untuk sheet MenuData
// ============================================================================

const UploadParser = {
  /**
   * Parse file .xlsx dan hasilkan bills[] + menuData[] + metadata untuk cek duplikat.
   * @param {File} file
   * @param {(msg:string, pct:number)=>void} progress
   */
  async parse(file, progress) {
    progress && progress('Membaca file...', 5);
    const buf = await file.arrayBuffer();
    progress && progress('Parsing spreadsheet...', 15);
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    // Cari baris header
    progress && progress('Mencari header...', 25);
    let headerRow = -1;
    for (let i = 0; i < Math.min(aoa.length, 30); i++) {
      const row = aoa[i] || [];
      const hasBill = row.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'bill number');
      const hasDate = row.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'sales date');
      if (hasBill && hasDate) { headerRow = i; break; }
    }
    if (headerRow === -1) throw new Error('Format file tidak dikenali. Header "Bill Number" atau "Sales Date" tidak ditemukan.');

    const header = aoa[headerRow].map(c => (c == null ? '' : String(c).trim()));
    const idx = {};
    Object.entries(CONFIG.XLSX_COLUMNS).forEach(([k, name]) => {
      idx[k] = header.findIndex(h => h.toLowerCase() === name.toLowerCase());
    });

    // Kolom mandatory
    ['billNumber', 'salesDate', 'branch', 'subtotal', 'qty'].forEach(k => {
      if (idx[k] < 0) throw new Error('Kolom "' + CONFIG.XLSX_COLUMNS[k] + '" tidak ditemukan di file.');
    });

    // Iterate data
    progress && progress('Menghitung agregat...', 40);
    const billsMap = {};          // bill -> { total, items, meta }
    const menuMap = {};           // date|branch|menu -> { qty, subtotal, category, subCategory }
    const branchSet = new Set();
    let dateMin = null, dateMax = null;
    let firstBill = null, lastBill = null;
    let itemCount = 0;

    for (let i = headerRow + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r) continue;
      const bill = r[idx.billNumber];
      const date = this._normalizeDate(r[idx.salesDate]);
      const branch = r[idx.branch];
      if (!bill || !date || !branch) continue;

      const billStr = String(bill).trim();
      const branchStr = String(branch).trim();
      const subtotal = Number(r[idx.subtotal]) || 0;
      const qty = Number(r[idx.qty]) || 0;
      const menu = r[idx.menu] ? String(r[idx.menu]).trim() : '';
      const category = idx.menuCategory >= 0 && r[idx.menuCategory] ? this._cleanNumberPrefix(String(r[idx.menuCategory])) : '';
      const subCat = idx.menuCategoryDetail >= 0 && r[idx.menuCategoryDetail] ? this._cleanNumberPrefix(String(r[idx.menuCategoryDetail])) : '';
      const purpose = idx.visitPurpose >= 0 && r[idx.visitPurpose] ? String(r[idx.visitPurpose]).trim() : '';
      const timeVal = idx.salesDateIn >= 0 ? r[idx.salesDateIn] : null;

      // Agregat per bill
      if (!billsMap[billStr]) {
        billsMap[billStr] = {
          bill: billStr, date, time: this._normalizeTime(timeVal),
          branch: branchStr, purpose,
          total: 0, items: 0
        };
        if (!firstBill) firstBill = billStr;
        lastBill = billStr;
      }
      billsMap[billStr].total += subtotal;
      billsMap[billStr].items += qty;

      // Agregat per menu (per date+branch+menu)
      if (menu) {
        const key = date + '|' + branchStr + '|' + menu;
        if (!menuMap[key]) {
          menuMap[key] = { date, branch: branchStr, category, subCategory: subCat, menu, qty: 0, subtotal: 0 };
        }
        menuMap[key].qty += qty;
        menuMap[key].subtotal += subtotal;
      }

      branchSet.add(branchStr);
      if (!dateMin || date < dateMin) dateMin = date;
      if (!dateMax || date > dateMax) dateMax = date;
      itemCount++;
    }

    progress && progress('Menyusun hasil...', 70);
    const bills = Object.values(billsMap);
    const menuData = Object.values(menuMap);

    if (bills.length === 0) throw new Error('Tidak ada baris data valid ditemukan di file.');

    return {
      bills, menuData,
      meta: {
        fileName: file.name,
        firstBill, lastBill,
        dateStart: dateMin, dateEnd: dateMax,
        branches: Array.from(branchSet),
        billCount: bills.length,
        menuRowCount: menuData.length,
        itemCount
      }
    };
  },

  _normalizeDate(v) {
    if (v instanceof Date) {
      return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
    }
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
    }
    if (typeof v === 'string') {
      let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
      m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      const d = new Date(v);
      if (!isNaN(d)) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    return null;
  },

  _normalizeTime(v) {
    if (v instanceof Date) {
      return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
    }
    if (typeof v === 'number') {
      // Excel time: fraction of a day
      const totalMin = Math.round(v * 24 * 60);
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    if (typeof v === 'string') {
      const m = v.match(/(\d{1,2}):(\d{2})/);
      if (m) return m[1].padStart(2, '0') + ':' + m[2];
    }
    return '';
  },

  _cleanNumberPrefix(s) {
    // "1. ALA CARTE (SATUAN)" → "ALA CARTE (SATUAN)"
    return s.replace(/^\s*\d+\.\s*/, '').trim();
  }
};

// ============================================================================
// UPLOAD FLOW — dengan chunking
// ============================================================================
const UploadFlow = {
  async run(parsed, callbacks) {
    const { onStep, onError, onDone } = callbacks || {};
    const step = (msg, pct) => onStep && onStep(msg, pct);

    try {
      // 1. Cek duplikat di server
      step('Cek duplikat...', 5);
      const dup = await Sheets.checkDuplicate({
        firstBill: parsed.meta.firstBill,
        dateStart: parsed.meta.dateStart,
        dateEnd:   parsed.meta.dateEnd,
        branches:  parsed.meta.branches
      });
      if (dup.duplicate) {
        onError && onError('File sudah tersedia: ' + dup.reason);
        return;
      }

      // 2. Upload bills (chunked)
      const chunkSize = CONFIG.UPLOAD_CHUNK_SIZE;
      const bills = parsed.bills;
      const menu = parsed.menuData;
      const totalChunks = Math.ceil(bills.length / chunkSize) + Math.ceil(menu.length / chunkSize) + 1;
      let done = 0;

      for (let i = 0; i < bills.length; i += chunkSize) {
        const slice = bills.slice(i, i + chunkSize);
        step('Upload bills ' + (i + slice.length) + ' / ' + bills.length, 10 + Math.round((done / totalChunks) * 80));
        await Sheets.uploadChunk('bills', { rows: slice });
        done++;
      }

      // 3. Upload menu data (chunked)
      for (let i = 0; i < menu.length; i += chunkSize) {
        const slice = menu.slice(i, i + chunkSize);
        step('Upload menu ' + (i + slice.length) + ' / ' + menu.length, 10 + Math.round((done / totalChunks) * 80));
        await Sheets.uploadChunk('menu', { rows: slice });
        done++;
      }

      // 4. Catat riwayat upload
      step('Menyimpan riwayat...', 95);
      await Sheets.uploadChunk('record', {
        fileName:  parsed.meta.fileName,
        firstBill: parsed.meta.firstBill,
        lastBill:  parsed.meta.lastBill,
        dateStart: parsed.meta.dateStart,
        dateEnd:   parsed.meta.dateEnd,
        branches:  parsed.meta.branches,
        billCount: parsed.meta.billCount
      });

      step('Selesai', 100);
      onDone && onDone({ bills: bills.length, menu: menu.length });
    } catch (e) {
      onError && onError(e.message);
    }
  }
};
