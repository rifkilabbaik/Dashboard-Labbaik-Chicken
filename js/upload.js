// ============================================================================
// PARSE FILE UPLOAD
//  - Penjualan : "Sales Summary By Branch Report"  (Sales Date + Branch Name)
//  - Komplain  : export sheet Komplain             (Nama Store + Media Komplain)
// Jenis file dideteksi otomatis dari baris headernya.
// ============================================================================
const UploadParser = {
  // Entry point: baca workbook sekali, deteksi jenisnya, lalu delegasikan.
  async parse(file, progress) {
    const step = (m, p) => progress && progress(m, p);
    step('Membaca file...', 10);
    const buf = await file.arrayBuffer();
    step('Parsing spreadsheet...', 25);
    // cellDates:false supaya date jadi number serial (bukan Date object) — hindari bug timezone XLSX library
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

    const det = this._detect(aoa);
    if (det.kind === 'komplain') return this._parseComplaint(file, aoa, det.headerRow, step);
    return this._parseSales(file, aoa, det.headerRow, step);
  },

  // Cari baris header + tentukan jenis file
  _detect(aoa) {
    const has = (row, name) => row.some(c => typeof c === 'string' && c.trim().toLowerCase() === name);
    for (let i = 0; i < Math.min(aoa.length, 25); i++) {
      const r = aoa[i] || [];
      if (has(r, 'sales date') && has(r, 'branch name')) return { kind: 'sales', headerRow: i };
      // File komplain: cukup dikenali dari Nama Store + Media Komplain
      if (has(r, 'nama store') && has(r, 'media komplain')) return { kind: 'komplain', headerRow: i };
    }
    throw new Error('Format file tidak dikenali. Untuk penjualan butuh header "Sales Date" & "Branch Name"; untuk komplain butuh "Nama Store" & "Media Komplain".');
  },

  // ==========================================================================
  // KOMPLAIN
  // ==========================================================================
  _parseComplaint(file, aoa, headerRow, step) {
    const header = aoa[headerRow].map(c => String(c || '').trim());
    const lower = header.map(h => h.toLowerCase());
    const cols = CONFIG.COMPLAINT_UPLOAD_COLUMNS
      .map(c => ({ ...c, idx: lower.indexOf(c.header.toLowerCase()) }))
      .filter(c => c.idx >= 0);

    const need = ['name', 'store', 'media', 'category', 'trxDate', 'body'];
    const missing = need.filter(k => !cols.some(c => c.key === k));
    if (missing.length) {
      const labels = CONFIG.COMPLAINT_UPLOAD_COLUMNS.filter(c => missing.includes(c.key)).map(c => c.header);
      throw new Error('Kolom wajib tidak ada di file: ' + labels.join(', '));
    }

    step('Membaca data komplain...', 45);
    const rows = [];
    let skipped = 0;
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r) continue;
      const row = {};
      cols.forEach(c => {
        const raw = r[c.idx];
        row[c.key] = c.type === 'datetime' ? this._normalizeDateTime(raw) : this._text(raw);
      });
      // Baris kosong -> lewati tanpa dihitung
      if (!row.name && !row.store && !row.body) continue;
      // Baris tidak lengkap / tanggal tidak valid (mis. typo tahun "20026-08-15")
      if (!row.name || !row.store || !row.trxDate || !row.body) { skipped++; continue; }
      row.dedupKey = this.complaintKey(row);
      rows.push(row);
    }

    step('Menghitung...', 70);
    if (rows.length === 0) throw new Error('Tidak ada baris komplain yang valid di file ini.');

    const storeSet = new Set(rows.map(r => r.store));
    const dates = rows.map(r => String(r.trxDate).slice(0, 10)).sort();
    return {
      kind: 'komplain',
      rows,
      meta: {
        fileName: file.name,
        rowCount: rows.length,
        skipped,
        branches: Array.from(storeSet),
        dateStart: dates[0],
        dateEnd: dates[dates.length - 1]
      }
    };
  },

  // Kunci duplikat komplain. HARUS sama dengan _komplainKey() di Code.gs.
  complaintKey(row) {
    const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
    if (norm(row.caseId)) return 'id:' + norm(row.caseId);
    return 'x:' + [norm(row.name), norm(row.store), String(row.trxDate || '').slice(0, 10), norm(row.body)].join('|');
  },

  _text(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v);
    return String(v).replace(/\r\n/g, '\n').trim();
  },

  // Simpan tanggal+jam apa adanya (yyyy-MM-dd atau yyyy-MM-ddTHH:mm)
  // supaya format di sheet tetap sama dengan data yang sudah ada.
  _normalizeDateTime(v) {
    if (v == null || v === '') return '';
    const p = (n) => String(n).padStart(2, '0');
    if (v instanceof Date) {
      const base = v.getFullYear() + '-' + p(v.getMonth() + 1) + '-' + p(v.getDate());
      return (v.getHours() || v.getMinutes()) ? base + 'T' + p(v.getHours()) + ':' + p(v.getMinutes()) : base;
    }
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (!d) return '';
      const base = d.y + '-' + p(d.m) + '-' + p(d.d);
      return (d.H || d.M) ? base + 'T' + p(d.H) + ':' + p(d.M) : base;
    }
    const str = String(v).trim();
    // yyyy-MM-dd[THH:mm] — tahun HARUS tepat 4 digit, jadi "20026-08-15" ditolak
    let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?$/);
    if (m) {
      const base = m[1] + '-' + p(m[2]) + '-' + p(m[3]);
      return m[4] ? base + 'T' + p(m[4]) + ':' + m[5] : base;
    }
    m = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:[T ](\d{1,2}):(\d{2}))?$/);
    if (m) {
      const base = m[3] + '-' + p(m[2]) + '-' + p(m[1]);
      return m[4] ? base + 'T' + p(m[4]) + ':' + m[5] : base;
    }
    return '';
  },

  // ==========================================================================
  // PENJUALAN
  // ==========================================================================
  _parseSales(file, aoa, headerRow, step) {
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
      kind: 'sales',
      rows,
      meta: {
        fileName: file.name,
        rowCount: rows.length,
        skipped: 0,
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
