// ============================================================================
// PARSE FILE Sales Summary By Branch Report
// ============================================================================
const UploadParser = {
  async parse(file, progress) {
    const step = (m, p) => progress && progress(m, p);
    step('Membaca file...', 10);
    const buf = await file.arrayBuffer();
    step('Parsing spreadsheet...', 25);
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    // Cari header row (Sales Date & Branch Name)
    let headerRow = -1;
    for (let i = 0; i < Math.min(aoa.length, 25); i++) {
      const r = aoa[i] || [];
      const hasDate = r.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'sales date');
      const hasBranch = r.some(c => typeof c === 'string' && c.trim().toLowerCase() === 'branch name');
      if (hasDate && hasBranch) { headerRow = i; break; }
    }
    if (headerRow < 0) throw new Error('Format file tidak dikenali. Header "Sales Date" & "Branch Name" tidak ditemukan.');
    const header = aoa[headerRow].map(c => String(c || '').trim());
    const dateIdx = header.findIndex(h => h.toLowerCase() === 'sales date');
    const branchIdx = header.findIndex(h => h.toLowerCase() === 'branch name');
    const chIdx = {};
    CONFIG.CHANNELS.forEach(c => {
      chIdx[c] = header.findIndex(h => h.toLowerCase() === c.toLowerCase());
    });

    step('Membaca data...', 45);
    const rows = [];
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r || r[dateIdx] == null || r[branchIdx] == null) continue;
      const date = this._normalizeDate(r[dateIdx]);
      if (!date) continue;
      const branch = String(r[branchIdx]).trim();
      if (!branch) continue;

      const channels = {};
      let total = 0, hasValue = false;
      CONFIG.CHANNELS.forEach(c => {
        const idx = chIdx[c];
        let v = 0;
        if (idx >= 0 && r[idx] != null && r[idx] !== '') {
          v = Number(r[idx]) || 0;
          if (v > 0) hasValue = true;
        }
        channels[c] = v;
        total += v;
      });

      // ➤ hapus branch tanpa sales
      if (!hasValue || total === 0) continue;
      rows.push({ date, branch, channels, total });
    }

    step('Menghitung...', 70);
    if (rows.length === 0) throw new Error('Tidak ada baris data valid dengan sales > 0.');

    const branchSet = new Set(rows.map(r => r.branch));
    const dateSet = new Set(rows.map(r => r.date));
    const grand = rows.reduce((s, r) => s + r.total, 0);

    return {
      rows,
      meta: {
        fileName: file.name,
        rowCount: rows.length,
        branches: Array.from(branchSet),
        dates: Array.from(dateSet).sort(),
        totalSales: grand,
        dateStart: Array.from(dateSet).sort()[0],
        dateEnd: Array.from(dateSet).sort().slice(-1)[0]
      }
    };
  },

  _normalizeDate(v) {
    if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth()+1).padStart(2,'0') + '-' + String(v.getDate()).padStart(2,'0');
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return d.y + '-' + String(d.m).padStart(2,'0') + '-' + String(d.d).padStart(2,'0');
    }
    if (typeof v === 'string') {
      let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (m) return m[1] + '-' + m[2].padStart(2,'0') + '-' + m[3].padStart(2,'0');
      m = v.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (m) return m[3] + '-' + m[2].padStart(2,'0') + '-' + m[1].padStart(2,'0');
      const d = new Date(v);
      if (!isNaN(d)) return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    return null;
  }
};
