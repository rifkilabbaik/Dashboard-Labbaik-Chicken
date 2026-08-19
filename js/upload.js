// ============================================================================
// PARSING EXCEL — Sales Summary By Branch Report
// ============================================================================
// Struktur file (dari ESB):
//   Baris 1-12  : metadata (Generated, Period, dst)
//   Baris 13    : kosong
//   Baris 14    : header (Sales Date, Branch Name, DINE IN, TAKE AWAY, ...)
//   Baris 15+   : data
// ============================================================================

const ExcelParser = {
  /**
   * Parse file Excel dan kembalikan array baris data.
   * @param {File} file
   * @returns {Promise<{rows: Array, meta: {branches: number, dates: number, total: number}}>}
   */
  async parse(file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    // Cari baris header (yang mengandung "Sales Date" dan "Branch Name")
    let headerRow = -1;
    for (let i = 0; i < Math.min(aoa.length, 30); i++) {
      const row = aoa[i] || [];
      const hasDate = row.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'sales date');
      const hasBranch = row.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'branch name');
      if (hasDate && hasBranch) { headerRow = i; break; }
    }
    if (headerRow === -1) {
      throw new Error('Format file tidak dikenali. Header "Sales Date" dan "Branch Name" tidak ditemukan.');
    }

    const header = aoa[headerRow].map(c => (c == null ? '' : String(c).trim()));
    const dateIdx = header.findIndex(h => h.toLowerCase() === 'sales date');
    const branchIdx = header.findIndex(h => h.toLowerCase() === 'branch name');

    // Petakan setiap channel di config ke index kolom
    const channelIdx = {};
    for (const ch of CONFIG.CHANNELS) {
      const idx = header.findIndex(h => h.toLowerCase() === ch.toLowerCase());
      channelIdx[ch] = idx; // -1 jika tidak ada
    }

    // Parse data rows
    const rows = [];
    const branchSet = new Set();
    const dateSet = new Set();
    let grandTotal = 0;

    for (let i = headerRow + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r || r.length === 0) continue;
      const dateVal = r[dateIdx];
      const branchVal = r[branchIdx];
      if (!dateVal || !branchVal) continue;

      const dateStr = this._normalizeDate(dateVal);
      if (!dateStr) continue;

      const branch = String(branchVal).trim();
      if (!branch) continue;

      // Kumpulkan nilai channel
      const channels = {};
      let rowTotal = 0;
      let hasAnyValue = false;
      for (const ch of CONFIG.CHANNELS) {
        const idx = channelIdx[ch];
        let val = 0;
        if (idx >= 0 && r[idx] != null && r[idx] !== '') {
          val = Number(r[idx]) || 0;
          if (val > 0) hasAnyValue = true;
        }
        channels[ch] = val;
        rowTotal += val;
      }

      // Lewati branch yang kosong sepenuhnya (non-aktif)
      if (!hasAnyValue) continue;

      rows.push({ date: dateStr, branch, channels, total: rowTotal });
      branchSet.add(branch);
      dateSet.add(dateStr);
      grandTotal += rowTotal;
    }

    if (rows.length === 0) {
      throw new Error('Tidak ada baris data valid ditemukan di file.');
    }

    return {
      rows,
      meta: {
        branches: branchSet.size,
        dates: dateSet.size,
        total: grandTotal,
        rowCount: rows.length
      }
    };
  },

  /**
   * Normalisasi tanggal ke format YYYY-MM-DD.
   */
  _normalizeDate(v) {
    if (v instanceof Date) {
      return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
    }
    if (typeof v === 'number') {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0');
    }
    if (typeof v === 'string') {
      const s = v.trim();
      // Match YYYY-MM-DD
      let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
      // Match DD-MM-YYYY or DD/MM/YYYY
      m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      // Fallback
      const d = new Date(s);
      if (!isNaN(d)) return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    return null;
  }
};
