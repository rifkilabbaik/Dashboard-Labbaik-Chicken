// ============================================================================
// APLIKASI UTAMA
// ============================================================================

const App = {
  data: [],        // Semua data dari Google Sheets
  filtered: [],    // Data setelah filter
  branches: [],    // List branch unik
  trendChart: null,

  async init() {
    this._bindUI();
    this._setDefaultDates();
    await this.loadData();
  },

  _bindUI() {
    document.getElementById('btnUpload').addEventListener('click', () => this._openModal());
    document.getElementById('btnRefresh').addEventListener('click', () => this.loadData());
    document.getElementById('btnExport').addEventListener('click', () => this.exportCSV());

    // Modal close
    document.querySelectorAll('#uploadModal [data-close]').forEach(el => {
      el.addEventListener('click', () => this._closeModal());
    });

    // Upload UI
    document.getElementById('btnPickFile').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) this._handleFile(e.target.files[0]);
    });
    document.getElementById('btnSendSheet').addEventListener('click', () => this._sendToSheet());

    // Drag & drop
    const dz = document.getElementById('dropzone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]);
    });

    // Filters
    ['fPeriode', 'fBranch', 'fChannel', 'fFrom', 'fTo'].forEach(id => {
      document.getElementById(id).addEventListener('change', () => this._applyFilters());
    });
    document.getElementById('fPeriode').addEventListener('change', (e) => {
      this._setPeriode(e.target.value);
      this._applyFilters();
    });

    // Bottom nav
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'upload') this._openModal();
        else if (nav === 'refresh') this.loadData();
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Footer sheet link
    const link = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) {
      link.href = CONFIG.SHEET_URL;
    } else {
      link.style.display = 'none';
    }
  },

  _setDefaultDates() {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('fFrom').value = this._toDateInput(first);
    document.getElementById('fTo').value = this._toDateInput(now);
  },

  _setPeriode(mode) {
    const now = new Date();
    let from, to = now;
    if (mode === 'current') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (mode === 'last') {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (mode === 'last7') {
      from = new Date(now); from.setDate(from.getDate() - 6);
    } else if (mode === 'last30') {
      from = new Date(now); from.setDate(from.getDate() - 29);
    } else {
      return; // custom, biarkan user pilih
    }
    document.getElementById('fFrom').value = this._toDateInput(from);
    document.getElementById('fTo').value = this._toDateInput(to);
  },

  _toDateInput(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  async loadData() {
    document.getElementById('lastUpdate').textContent = 'Memuat data...';
    this._hideDiagnostic();
    try {
      this.data = await Sheets.fetchAll();
      this._populateBranches();
      this._populateChannels();
      this._autoAdjustFilter();
      this._applyFilters();

      if (this.data.length === 0) {
        document.getElementById('lastUpdate').textContent = 'Fetch berhasil tapi data kosong';
        this._showDiagnostic('empty');
      } else {
        const latest = this._latestDate();
        const dateCount = new Set(this.data.map(r => r.date)).size;
        document.getElementById('lastUpdate').textContent =
          'Data terakhir · ' + this._formatDateID(latest) +
          ' · ' + this.data.length.toLocaleString('id-ID') + ' baris · ' +
          this.branches.length + ' branch · ' + dateCount + ' tanggal';
      }
    } catch (e) {
      document.getElementById('lastUpdate').textContent = 'Gagal memuat: ' + e.message;
      this._showDiagnostic('error', e.message);
    }
  },

  _showDiagnostic(type, msg) {
    let banner = document.getElementById('diagBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'diagBanner';
      banner.style.cssText = 'background:#FFF4E6;border:0.5px solid #E8C88C;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:13px;color:#5B4A20;';
      const container = document.querySelector('.container');
      container.insertBefore(banner, container.firstChild);
    }
    const testUrl = CONFIG.APPS_SCRIPT_URL + '?action=fetch&_t=' + Date.now();
    if (type === 'empty') {
      banner.innerHTML =
        '<div style="font-weight:500;margin-bottom:6px;">Data tidak muncul?</div>' +
        '<div style="margin-bottom:8px;">Fetch ke Apps Script berhasil tapi return 0 baris. Kemungkinan:</div>' +
        '<ul style="margin:0 0 10px 20px;padding:0;">' +
        '<li>Sheet tab-nya bukan bernama <code>Sales</code> (harus huruf besar-kecil persis)</li>' +
        '<li>Apps Script belum di-<b>redeploy versi baru</b> setelah update Code.gs</li>' +
        '<li>Data ditulis ke sheet lain (bukan "Sales")</li>' +
        '</ul>' +
        '<a href="' + testUrl + '" target="_blank" rel="noopener" style="color:#4A90B8;">Buka Apps Script URL untuk lihat raw response &rarr;</a>';
    } else {
      banner.innerHTML =
        '<div style="font-weight:500;margin-bottom:6px;">Error: ' + this._escape(msg) + '</div>' +
        '<a href="' + testUrl + '" target="_blank" rel="noopener" style="color:#4A90B8;">Test Apps Script URL langsung &rarr;</a>';
    }
  },

  _hideDiagnostic() {
    const b = document.getElementById('diagBanner');
    if (b) b.remove();
  },

  /**
   * Jika filter default (bulan berjalan) tidak punya data,
   * otomatis geser ke bulan terbaru yang punya data.
   */
  _autoAdjustFilter() {
    if (this.data.length === 0) return;
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const inRange = this.data.some(r => r.date >= from && r.date <= to);
    if (inRange) return;

    // Fallback: gunakan bulan dari tanggal terbaru di data
    const latest = this._latestDate();
    const [y, m] = latest.split('-');
    const firstOfMonth = y + '-' + m + '-01';
    document.getElementById('fFrom').value = firstOfMonth;
    document.getElementById('fTo').value = latest;
    document.getElementById('fPeriode').value = 'custom';
  },

  _populateBranches() {
    const set = new Set(this.data.map(r => r.branch));
    this.branches = Array.from(set).sort();
    const sel = document.getElementById('fBranch');
    sel.innerHTML = '<option value="all">Semua branch (' + this.branches.length + ')</option>' +
      this.branches.map(b => '<option value="' + this._escape(b) + '">' + this._escape(b) + '</option>').join('');
  },

  _populateChannels() {
    const sel = document.getElementById('fChannel');
    sel.innerHTML = '<option value="all">Semua channel</option>' +
      CONFIG.CHANNELS.map(c => {
        const label = CONFIG.CHANNEL_DISPLAY[c] || c;
        return '<option value="' + this._escape(c) + '">' + this._escape(label) + '</option>';
      }).join('');
  },

  _applyFilters() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const branch = document.getElementById('fBranch').value;
    const channel = document.getElementById('fChannel').value;

    this.filtered = this.data.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (branch !== 'all' && r.branch !== branch) return false;
      return true;
    });

    // Jika channel dipilih, override total per baris jadi hanya channel itu
    if (channel !== 'all') {
      this.filtered = this.filtered.map(r => ({
        ...r,
        total: r.channels[channel] || 0
      })).filter(r => r.total > 0);
    }

    this._render();
  },

  _render() {
    this._renderMetrics();
    this._renderChannel();
    this._renderRanks();
    this._renderTrend();
  },

  _renderMetrics() {
    const total = this.filtered.reduce((s, r) => s + r.total, 0);
    const days = new Set(this.filtered.map(r => r.date)).size;
    const branchCount = new Set(this.filtered.map(r => r.branch)).size;
    const totalBranchAll = this.branches.length;
    const avg = days > 0 ? total / days : 0;

    // Growth vs bulan lalu (perbandingan rata-rata per hari)
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    let growthTxt = '—', growthColor = null;
    if (from && to) {
      const fromD = new Date(from);
      const toD = new Date(to);
      const dayCount = Math.round((toD - fromD) / 86400000) + 1;
      const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
      const prevFromStr = this._toDateInput(prevFrom);
      const prevToStr = this._toDateInput(prevTo);
      const branch = document.getElementById('fBranch').value;
      const channel = document.getElementById('fChannel').value;
      const prev = this.data.filter(r =>
        r.date >= prevFromStr && r.date <= prevToStr &&
        (branch === 'all' || r.branch === branch)
      );
      const prevTotal = prev.reduce((s, r) => s + (channel === 'all' ? r.total : (r.channels[channel] || 0)), 0);
      const prevDays = new Set(prev.map(r => r.date)).size;
      const prevAvg = prevDays > 0 ? prevTotal / prevDays : 0;
      if (prevAvg > 0) {
        const g = ((avg - prevAvg) / prevAvg) * 100;
        growthTxt = (g >= 0 ? '+' : '') + g.toFixed(1) + '%';
        growthColor = g >= 0 ? 'var(--sea)' : 'var(--danger)';
      }
    }

    document.getElementById('mSales').textContent = this._fmtRp(total);
    document.getElementById('mSalesSub').textContent = days + ' hari · ' + this._formatRange();
    document.getElementById('mGrowth').textContent = growthTxt;
    if (growthColor) document.getElementById('mGrowth').style.color = growthColor;
    document.getElementById('mAvg').textContent = this._fmtRp(avg);
    document.getElementById('mAvgSub').textContent = days + ' hari aktif';
    document.getElementById('mBranch').innerHTML = branchCount + ' <span style="font-size:13px;color:var(--ink-3);font-weight:400;">/ ' + totalBranchAll + '</span>';
    document.getElementById('mBranchSub').textContent = (totalBranchAll - branchCount) + ' tanpa transaksi';
  },

  _renderChannel() {
    // Total per channel (dari filtered data — tapi sebelum override channel)
    // Kita hitung ulang dari data asli dengan filter periode + branch (bukan channel)
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const branch = document.getElementById('fBranch').value;

    const base = this.data.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (branch !== 'all' && r.branch !== branch) return false;
      return true;
    });

    const totals = {};
    let grand = 0;
    for (const ch of CONFIG.CHANNELS) {
      totals[ch] = base.reduce((s, r) => s + (r.channels[ch] || 0), 0);
      grand += totals[ch];
    }

    const list = document.getElementById('channelList');
    if (grand === 0) {
      list.innerHTML = '<div style="color:var(--ink-3);font-size:13px;">Tidak ada data pada periode ini.</div>';
      return;
    }

    // Sort desc
    const sorted = CONFIG.CHANNELS.map(ch => ({ ch, val: totals[ch] })).sort((a, b) => b.val - a.val);
    const max = sorted[0].val;

    list.innerHTML = sorted.map(({ ch, val }) => {
      if (val === 0) return '';
      const pct = grand > 0 ? (val / grand * 100) : 0;
      const barW = max > 0 ? (val / max * 100) : 0;
      const label = CONFIG.CHANNEL_DISPLAY[ch] || ch;
      const lightClass = pct < 10 ? 'light' : '';
      return `
        <div class="channel-row">
          <div class="channel-name">${this._escape(label)}</div>
          <div class="channel-bar"><div class="channel-bar-fill ${lightClass}" style="width:${barW.toFixed(1)}%"></div></div>
          <div class="channel-amount">${this._fmtRp(val)}</div>
          <div class="channel-pct">${pct.toFixed(1)}%</div>
        </div>
      `;
    }).join('');
  },

  _renderRanks() {
    // Agregat per branch dari filtered
    const map = {};
    for (const r of this.filtered) {
      map[r.branch] = (map[r.branch] || 0) + r.total;
    }
    const arr = Object.entries(map).map(([branch, val]) => ({ branch, val }));
    arr.sort((a, b) => b.val - a.val);

    const top = arr.slice(0, 5);
    const low = arr.filter(x => x.val > 0).slice(-5).reverse();

    const render = (rows) => rows.length === 0
      ? '<div style="color:var(--ink-3);font-size:13px;">—</div>'
      : rows.map((r, i) => `
        <div class="rank-row">
          <div class="rank-left">
            <span class="rank-num">${i + 1}</span>
            <span class="rank-name">${this._escape(this._shortBranch(r.branch))}</span>
          </div>
          <div class="rank-amount">${this._fmtRp(r.val)}</div>
        </div>
      `).join('');

    document.getElementById('topList').innerHTML = render(top);
    document.getElementById('lowList').innerHTML = render(low);
  },

  _renderTrend() {
    // Agregat per tanggal
    const map = {};
    for (const r of this.filtered) {
      map[r.date] = (map[r.date] || 0) + r.total;
    }
    const dates = Object.keys(map).sort();
    const values = dates.map(d => map[d]);
    const labels = dates.map(d => {
      const [y, m, day] = d.split('-');
      return parseInt(day) + '/' + parseInt(m);
    });

    const ctx = document.getElementById('trendChart').getContext('2d');
    if (this.trendChart) this.trendChart.destroy();

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#4A90B8',
          backgroundColor: 'rgba(74, 144, 184, 0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointBackgroundColor: '#4A90B8'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1F2937',
            padding: 10,
            titleFont: { size: 12 },
            bodyFont: { size: 13 },
            callbacks: {
              label: (ctx) => 'Rp ' + ctx.parsed.y.toLocaleString('id-ID')
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8A93A0', font: { size: 11 } }
          },
          y: {
            grid: { color: '#E8E2D3', drawBorder: false },
            ticks: {
              color: '#8A93A0',
              font: { size: 11 },
              callback: (v) => {
                if (v >= 1e9) return (v / 1e9).toFixed(1) + ' M';
                if (v >= 1e6) return (v / 1e6).toFixed(0) + ' jt';
                if (v >= 1e3) return (v / 1e3).toFixed(0) + ' rb';
                return v;
              }
            }
          }
        }
      }
    });
  },

  // === UPLOAD FLOW ===
  _openModal() {
    document.getElementById('uploadModal').hidden = false;
    document.getElementById('filePreview').hidden = true;
    document.getElementById('uploadStatus').hidden = true;
    document.getElementById('btnSendSheet').disabled = true;
    document.getElementById('fileInput').value = '';
    this._pendingUpload = null;
  },
  _closeModal() {
    document.getElementById('uploadModal').hidden = true;
  },

  async _handleFile(file) {
    const status = document.getElementById('uploadStatus');
    status.hidden = false;
    status.className = 'upload-status info';
    status.textContent = 'Memproses file...';
    try {
      const parsed = await ExcelParser.parse(file);
      this._pendingUpload = parsed;
      document.getElementById('filePreview').hidden = false;
      document.getElementById('fpName').textContent = file.name;
      document.getElementById('fpMeta').textContent =
        parsed.meta.branches + ' branch · ' +
        parsed.meta.dates + ' tanggal · ' +
        parsed.meta.rowCount + ' baris · ' +
        this._fmtRp(parsed.meta.total);
      document.getElementById('fpStatus').textContent = 'Siap';
      document.getElementById('fpStatus').className = 'fp-status';
      document.getElementById('btnSendSheet').disabled = false;
      status.hidden = true;
    } catch (e) {
      status.className = 'upload-status error';
      status.textContent = e.message;
      document.getElementById('btnSendSheet').disabled = true;
    }
  },

  async _sendToSheet() {
    if (!this._pendingUpload) return;
    const mode = document.querySelector('input[name="uploadMode"]:checked').value;
    const btn = document.getElementById('btnSendSheet');
    const status = document.getElementById('uploadStatus');
    btn.disabled = true;
    status.hidden = false;
    status.className = 'upload-status info';
    status.textContent = 'Mengirim ke Google Sheets...';
    try {
      const result = await Sheets.pushRows(this._pendingUpload.rows, mode);
      status.className = 'upload-status success';
      status.textContent = 'Berhasil. ' + (result.added || 0) + ' baris ditambahkan' +
        (result.updated ? ', ' + result.updated + ' diperbarui' : '') + '.';
      setTimeout(() => {
        this._closeModal();
        this.loadData();
      }, 1200);
    } catch (e) {
      status.className = 'upload-status error';
      status.textContent = 'Gagal: ' + e.message;
      btn.disabled = false;
    }
  },

  // === EXPORT ===
  exportCSV() {
    if (this.filtered.length === 0) {
      this._toast('Tidak ada data untuk diexport');
      return;
    }
    const header = ['Sales Date', 'Branch Name', ...CONFIG.CHANNELS, 'Total'];
    const lines = [header.join(',')];
    for (const r of this.filtered) {
      const cells = [
        r.date,
        '"' + r.branch.replace(/"/g, '""') + '"',
        ...CONFIG.CHANNELS.map(ch => r.channels[ch] || 0),
        r.total
      ];
      lines.push(cells.join(','));
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales_export_' + this._toDateInput(new Date()) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  // === HELPERS ===
  _fmtRp(v) {
    if (v == null || isNaN(v)) return 'Rp 0';
    if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(2).replace('.', ',') + ' M';
    if (v >= 1e6) return 'Rp ' + Math.round(v / 1e6) + ' jt';
    if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3) + ' rb';
    return 'Rp ' + Math.round(v);
  },
  _formatRange() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    if (!from || !to) return '';
    return this._formatDateShort(from) + ' – ' + this._formatDateShort(to);
  },
  _formatDateShort(s) {
    const [y, m, d] = s.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1];
  },
  _formatDateID(s) {
    const [y, m, d] = s.split('-');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1] + ' ' + y;
  },
  _latestDate() {
    if (this.data.length === 0) return null;
    return this.data.reduce((max, r) => r.date > max ? r.date : max, '');
  },
  _shortBranch(b) {
    // "Labbaik Chicken - Nama Cabang" -> "Nama Cabang"
    const m = b.match(/^[^-]+-\s*(.+)$/);
    return m ? m[1].trim() : b;
  },
  _escape(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  },
  _toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.hidden = true, 3000);
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
