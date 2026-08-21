// ============================================================================
// SALES DASHBOARD v6 — filter cuma tanggal, dashboard baru, cache untuk speed
// ============================================================================

const App = {
  data: [],
  regional: [],
  status: null,
  branchMeta: {},
  activeBranches: [],
  areaToRegional: {},
  regionalToAreas: {},

  // Filter cuma tanggal
  filter: { periode: 'current', from: '', to: '' },
  applied: null,

  filtered: [],
  charts: {},

  // Settings
  moneyFormat: 'auto',
  theme: 'auto',
  fontFamily: 'default',

  // Sort mode untuk dashboard regional & area: 'name' | 'desc' | 'asc'
  regionalSort: 'name',
  areaSort: 'name',

  // Sales page state
  salesMetric: 'total',        // total | channel | contribution
  salesLevel: 'regional',      // regional | area | branch
  salesSort: 'salesDesc',      // salesDesc | salesAsc | growthDesc | growthAsc
  tokoRegional: '',
  tokoArea: '',

  currentPage: 'dashboard',

  async init() {
    this._loadSettings();
    this._applyTheme();
    this._bindSidebar();
    this._bindTopbar();
    this._bindFilterModal();
    this._bindUploadModal();
    this._bindSettingsPage();
    this._bindDashboardEvents();
    this._bindSalesPage();
    this._bindModals();

    // Load dari cache dulu untuk instant show
    const cached = Sheets.loadCache();
    if (cached && cached.data && cached.data.length > 0) {
      this.data = cached.data;
      this.regional = cached.regional || [];
      this.status = cached.status;
      this._buildBranchMeta();
      this._setPeriodePreset('current');
      this._captureFilter();
      this.applied = { ...this.filter };
      this._computeFiltered();
      this._renderAll();
      this._splashHide();
      this._toast('Data cache · memuat versi terbaru...');
      // Background refresh
      this.loadAll(true);
    } else {
      this._setPeriodePreset('current');
      this._captureFilter();
      this.applied = { ...this.filter };
      await this.loadAll();
    }
  },

  _loadSettings() {
    this.moneyFormat = localStorage.getItem('moneyFormat') || 'auto';
    if (!['auto','full'].includes(this.moneyFormat)) this.moneyFormat = 'auto';
    this.theme = localStorage.getItem('theme') || 'auto';
    if (!['auto','light','dark'].includes(this.theme)) this.theme = 'auto';
    this.fontFamily = localStorage.getItem('fontFamily') || 'default';
    this.regionalSort = localStorage.getItem('regionalSort') || 'name';
    this.areaSort = localStorage.getItem('areaSort') || 'name';
  },
  _save(k, v) { localStorage.setItem(k, v); },

  _applyTheme() {
    const root = document.documentElement;
    if (this.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this.theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const isDark = this.theme === 'dark' || (this.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.content = isDark ? '#1A1D21' : '#F7F4EC';
    }
    const font = CONFIG.FONT_OPTIONS[this.fontFamily] || CONFIG.FONT_OPTIONS.default;
    root.style.setProperty('--font-sans', font.stack);
  },

  // ==========================================================================
  // NAV
  // ==========================================================================
  _bindSidebar() {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebarBackdrop');
    const open = () => { sb.classList.add('open'); bd.classList.add('open'); };
    const close = () => { sb.classList.remove('open'); bd.classList.remove('open'); };
    document.getElementById('btnMenu').addEventListener('click', open);
    document.getElementById('sidebarClose').addEventListener('click', close);
    bd.addEventListener('click', close);
    document.querySelectorAll('.sidebar-item').forEach(btn => {
      btn.addEventListener('click', () => { this._goToPage(btn.dataset.page); close(); });
    });
    document.getElementById('sidebarUpload').addEventListener('click', () => { close(); this._openUpload(); });
  },
  _goToPage(page) {
    this.currentPage = page;
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
    document.getElementById('pageTitle').textContent = { dashboard: 'Dasbor', sales: 'Penjualan', settings: 'Pengaturan' }[page] || '';
    document.getElementById('btnFilter').style.display = page === 'settings' ? 'none' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'sales') this._renderSales();
  },
  _bindTopbar() {
    document.getElementById('btnFilter').addEventListener('click', () => this._openFilterModal());
  },

  // ==========================================================================
  // FILTER (PERIODE ONLY)
  // ==========================================================================
  _bindFilterModal() {
    const modal = document.getElementById('filterModal');
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => modal.hidden = true));
    document.getElementById('filterOk').addEventListener('click', () => this._applyFilter());
    document.getElementById('filterReset').addEventListener('click', () => {
      document.getElementById('fPeriode').value = 'current';
      this._setPeriodePreset('current');
      this._updateRangeLabel();
    });
    document.getElementById('fPeriode').addEventListener('change', (e) => {
      this._setPeriodePreset(e.target.value);
      this._updateRangeLabel();
    });
    document.getElementById('fRangeTrigger').addEventListener('click', () => this._openRangePicker());
  },
  _openFilterModal() {
    document.getElementById('fPeriode').value = this.filter.periode;
    document.getElementById('fFrom').value = this.filter.from;
    document.getElementById('fTo').value = this.filter.to;
    this._updateRangeLabel();
    document.getElementById('filterModal').hidden = false;
  },
  _applyFilter() {
    this._captureFilter();
    this.applied = { ...this.filter };
    document.getElementById('filterModal').hidden = true;
    this._computeFiltered();
    this._renderAll();
    this._updatePeriodLabel();
  },
  _captureFilter() {
    this.filter = {
      periode: document.getElementById('fPeriode').value,
      from: document.getElementById('fFrom').value,
      to: document.getElementById('fTo').value
    };
  },

  _setPeriodePreset(mode) {
    let now;
    const latest = this._latestDate();
    if (latest) {
      const [ly, lm, ld] = latest.split('-').map(Number);
      now = new Date(ly, lm - 1, ld);
    } else now = new Date();
    let from, to = now;
    if (mode === 'current') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (mode === 'last') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (mode === 'last7') { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (mode === 'last30') { from = new Date(now); from.setDate(from.getDate() - 29); }
    else if (mode === 'last90') { from = new Date(now); from.setDate(from.getDate() - 89); }
    else return;
    document.getElementById('fFrom').value = this._toDateStr(from);
    document.getElementById('fTo').value = this._toDateStr(to);
    this._updateRangeLabel();
  },

  _latestDate() {
    if (this.data.length === 0) return null;
    return this.data.reduce((max, r) => r.date > max ? r.date : max, '');
  },

  _updatePeriodLabel() {
    const el = document.getElementById('periodLabel');
    if (!this.applied || !this.applied.from) { el.textContent = '—'; return; }
    if (this.applied.from === this.applied.to) el.textContent = this._formatShort(this.applied.from);
    else el.textContent = this._formatShort(this.applied.from) + ' – ' + this._formatShort(this.applied.to);
  },

  _updateRangeLabel() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const label = document.getElementById('fRangeLabel');
    if (!from || !to) { label.textContent = 'Pilih tanggal...'; return; }
    if (from === to) label.textContent = this._formatShort(from) + ' ' + from.split('-')[0];
    else label.textContent = this._formatShort(from) + ' – ' + this._formatShort(to) + ' ' + to.split('-')[0];
  },

  // Range picker (unchanged from v5)
  _openRangePicker() {
    this._rangeFrom = document.getElementById('fFrom').value || null;
    this._rangeTo = document.getElementById('fTo').value || null;
    this._rangeStep = 0;
    const anchor = this._rangeFrom || this._latestDate() || this._toDateStr(new Date());
    const [ay, am] = anchor.split('-').map(Number);
    this._rangeViewYear = ay;
    this._rangeViewMonth = am - 1;
    this._renderRangeCalendar();
    const modal = document.getElementById('rangeModal');
    modal.hidden = false;
    modal.querySelectorAll('[data-close]').forEach(el => el.onclick = () => modal.hidden = true);
    document.getElementById('rangeOk').onclick = () => {
      if (this._rangeFrom && this._rangeTo) {
        if (this._rangeFrom > this._rangeTo) { const t = this._rangeFrom; this._rangeFrom = this._rangeTo; this._rangeTo = t; }
        document.getElementById('fFrom').value = this._rangeFrom;
        document.getElementById('fTo').value = this._rangeTo;
        document.getElementById('fPeriode').value = 'custom';
        this._updateRangeLabel();
      }
      modal.hidden = true;
    };
  },
  _renderRangeCalendar() {
    const y = this._rangeViewYear, m = this._rangeViewMonth;
    const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const dowNames = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let html = `<div class="cal-nav"><button class="cal-nav-btn" id="calPrev">‹</button><div class="cal-title">${monthNames[m]} ${y}</div><button class="cal-nav-btn" id="calNext">›</button></div><div class="cal-mini"><div class="cal-mini-head">${dowNames.map(n => `<div>${n}</div>`).join('')}</div><div class="cal-mini-grid">`;
    for (let i = 0; i < startOffset; i++) html += '<div class="cal-mini-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      let cls = 'cal-mini-cell';
      if (this._rangeFrom && this._rangeTo) {
        const [lo, hi] = this._rangeFrom < this._rangeTo ? [this._rangeFrom, this._rangeTo] : [this._rangeTo, this._rangeFrom];
        if (ds === lo) cls += ' range-start';
        else if (ds === hi) cls += ' range-end';
        else if (ds > lo && ds < hi) cls += ' range-mid';
      } else if (this._rangeFrom && ds === this._rangeFrom) cls += ' range-start';
      html += `<div class="${cls}" data-d="${ds}">${d}</div>`;
    }
    html += '</div></div>';
    const info = document.getElementById('rangeInfo');
    if (!this._rangeFrom) info.textContent = 'Klik tanggal pertama untuk "Dari"';
    else if (!this._rangeTo) info.textContent = 'Dari: ' + this._formatFull(this._rangeFrom) + ' — Klik tanggal untuk "Sampai"';
    else {
      const [lo, hi] = this._rangeFrom < this._rangeTo ? [this._rangeFrom, this._rangeTo] : [this._rangeTo, this._rangeFrom];
      info.innerHTML = this._formatFull(lo) + ' <b>—</b> ' + this._formatFull(hi);
    }
    document.getElementById('rangeCalendar').innerHTML = html;
    document.getElementById('calPrev').onclick = () => { if (--this._rangeViewMonth < 0) { this._rangeViewMonth = 11; this._rangeViewYear--; } this._renderRangeCalendar(); };
    document.getElementById('calNext').onclick = () => { if (++this._rangeViewMonth > 11) { this._rangeViewMonth = 0; this._rangeViewYear++; } this._renderRangeCalendar(); };
    document.querySelectorAll('#rangeCalendar .cal-mini-cell[data-d]').forEach(cell => {
      cell.onclick = () => {
        const ds = cell.dataset.d;
        if (this._rangeStep === 0) { this._rangeFrom = ds; this._rangeTo = null; this._rangeStep = 1; }
        else { this._rangeTo = ds; this._rangeStep = 0; }
        this._renderRangeCalendar();
      };
    });
  },

  // ==========================================================================
  // LOAD
  // ==========================================================================
  async loadAll(silent) {
    if (!silent) this._splash('Memuat data dari Google Sheets...');
    try {
      const [data, regional, status] = await Promise.all([
        Sheets.fetchAll(),
        Sheets.fetchRegional().catch(() => []),
        Sheets.status().catch(() => null)
      ]);
      this.data = data;
      this.regional = regional;
      this.status = status;
      Sheets.saveCache(data, regional, status);
      this._buildBranchMeta();
      if (this.applied && this.applied.periode && this.applied.periode !== 'custom') {
        this._setPeriodePreset(this.applied.periode);
        this.applied.from = document.getElementById('fFrom').value;
        this.applied.to = document.getElementById('fTo').value;
        this.filter.from = this.applied.from;
        this.filter.to = this.applied.to;
      }
      this._computeFiltered();
      this._renderAll();
      this._updatePeriodLabel();
      this._splashHide();
    } catch (e) {
      if (!silent) this._splash('Gagal: ' + e.message);
      else this._toast('Gagal update: ' + e.message);
    }
  },

  _buildBranchMeta() {
    this.branchMeta = {};
    this.activeBranches = [];
    this.areaToRegional = {};
    this.regionalToAreas = {};
    this.regional.forEach(r => {
      this.branchMeta[r.branch] = { regional: r.regional, area: r.area };
      this.activeBranches.push(r.branch);
      this.areaToRegional[r.area] = r.regional;
      (this.regionalToAreas[r.regional] = this.regionalToAreas[r.regional] || []).push(r.area);
    });
  },

  _computeFiltered() {
    const a = this.applied;
    this.filtered = this.data.filter(r => {
      if (a.from && r.date < a.from) return false;
      if (a.to && r.date > a.to) return false;
      return true;
    });
    // Precompute periode sebelumnya (bulan lalu tanggal sama)
    const prev = this._prevMonthRange(a.from, a.to);
    this.filteredPrev = this.data.filter(r => r.date >= prev.from && r.date <= prev.to);
    this._prevRange = prev;
  },

  _prevMonthRange(fromStr, toStr) {
    if (!fromStr || !toStr) return { from: '', to: '' };
    const [fy, fm, fd] = fromStr.split('-').map(Number);
    const [ty, tm, td] = toStr.split('-').map(Number);
    const shift = (y, m, d) => {
      let ny = y, nm = m - 1;
      if (nm < 1) { nm = 12; ny--; }
      const daysInMonth = new Date(ny, nm, 0).getDate();
      const nd = Math.min(d, daysInMonth);
      return ny + '-' + String(nm).padStart(2,'0') + '-' + String(nd).padStart(2,'0');
    };
    return { from: shift(fy, fm, fd), to: shift(ty, tm, td) };
  },

  // ==========================================================================
  // AGGREGATION HELPERS
  // ==========================================================================
  _sumChannels(rows, channels) {
    let s = 0;
    for (const r of rows) for (const c of channels) s += (r.channels[c] || 0);
    return s;
  },
  _sumTotal(rows) { let s = 0; for (const r of rows) s += r.total; return s; },
  _growthPct(cur, prev) { if (prev === 0) return null; return ((cur - prev) / prev) * 100; },

  // ==========================================================================
  // RENDER ALL
  // ==========================================================================
  _renderAll() {
    this._renderDashboard();
    if (this.currentPage === 'sales') this._renderSales();
    this._renderSettings();
  },

  // ==========================================================================
  // DASHBOARD
  // ==========================================================================
  _bindDashboardEvents() {
    document.getElementById('mcTotal').addEventListener('click', () => this._openTotalDetail());
    document.getElementById('sortRegional').addEventListener('click', () => {
      this.regionalSort = this._nextSort(this.regionalSort);
      this._save('regionalSort', this.regionalSort);
      this._renderRegionalList();
    });
    document.getElementById('sortArea').addEventListener('click', () => {
      this.areaSort = this._nextSort(this.areaSort);
      this._save('areaSort', this.areaSort);
      this._renderAreaList();
    });
  },
  _nextSort(mode) {
    if (mode === 'name') return 'desc';
    if (mode === 'desc') return 'asc';
    return 'name';
  },
  _sortLabel(mode) {
    if (mode === 'name') return 'Nama ▾';
    if (mode === 'desc') return 'Terbesar ▾';
    return 'Terkecil ▾';
  },

  _renderDashboard() {
    // Total
    const total = this._sumTotal(this.filtered);
    const totalPrev = this._sumTotal(this.filteredPrev);
    const gr = this._growthPct(total, totalPrev);
    document.getElementById('mvTotal').textContent = this._fmtRp(total);
    const gEl = document.getElementById('mvTotalGrowth');
    if (gr === null) { gEl.textContent = '—'; gEl.style.color = 'var(--ink-2)'; }
    else {
      gEl.textContent = (gr >= 0 ? '+' : '') + gr.toFixed(1) + '% vs bulan lalu';
      gEl.style.color = gr >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    // Groups: Offline, Online, Catering
    this._renderMetricGroups();

    // Regional/Area sorted lists
    this._renderRegionalList();
    this._renderAreaList();

    // Trend
    this._renderTrend();

    // Top / Low 10
    const branchTotals = {};
    this.filtered.forEach(r => { branchTotals[r.branch] = (branchTotals[r.branch] || 0) + r.total; });
    const arr = Object.entries(branchTotals).map(([b, v]) => ({ key: b, val: v })).filter(x => x.val > 0);
    const top10 = [...arr].sort((a, b) => b.val - a.val).slice(0, 10);
    const low10 = [...arr].sort((a, b) => a.val - b.val).slice(0, 10);
    document.getElementById('dTop10').innerHTML = this._renderRank(top10, true);
    document.getElementById('dLow10').innerHTML = this._renderRank(low10, true);
  },

  _renderMetricGroups() {
    const wrap = document.getElementById('metricGroups');
    let html = '';
    CONFIG.CHANNEL_GROUPS.forEach(g => {
      const allChannels = g.children.flatMap(c => c.channels);
      const total = this._sumChannels(this.filtered, allChannels);
      const prev = this._sumChannels(this.filteredPrev, allChannels);
      const growth = this._growthPct(total, prev);
      const growthTxt = growth === null ? '—' : ((growth >= 0 ? '+' : '') + growth.toFixed(1) + '%');
      const growthColor = growth === null ? 'var(--ink-2)' : (growth >= 0 ? 'var(--success)' : 'var(--danger)');

      html += `<div class="metric-group-card" data-group="${g.key}">
        <div class="mg-head">
          <div class="mg-label">${this._esc(g.label)}</div>
          <div class="mg-growth" style="color:${growthColor}">${growthTxt}</div>
        </div>
        <div class="mg-value">${this._fmtRp(total)}</div>
        <div class="mg-children">`;
      g.children.forEach(c => {
        const cVal = this._sumChannels(this.filtered, c.channels);
        html += `<div class="mg-child"><span class="mg-child-label">${this._esc(c.label)}</span><span class="mg-child-val">${this._fmtRp(cVal)}</span></div>`;
      });
      html += `</div><div class="mg-hint">Klik untuk detail</div></div>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.metric-group-card').forEach(card => {
      card.addEventListener('click', () => this._openGroupDetail(card.dataset.group));
    });
  },

  _renderRegionalList() {
    const totals = {};
    this.filtered.forEach(r => {
      const meta = this.branchMeta[r.branch];
      if (!meta || !meta.regional) return;
      totals[meta.regional] = (totals[meta.regional] || 0) + r.total;
    });
    let arr = Object.entries(totals).map(([k, v]) => ({ key: k, val: v }));
    arr = this._sortArr(arr, this.regionalSort);
    document.getElementById('regionalList').innerHTML = this._renderRank(arr, false);
    document.getElementById('sortRegional').textContent = this._sortLabel(this.regionalSort);
  },
  _renderAreaList() {
    const totals = {};
    this.filtered.forEach(r => {
      const meta = this.branchMeta[r.branch];
      if (!meta || !meta.area) return;
      totals[meta.area] = (totals[meta.area] || 0) + r.total;
    });
    let arr = Object.entries(totals).map(([k, v]) => ({ key: k, val: v }));
    arr = this._sortArr(arr, this.areaSort);
    document.getElementById('areaList').innerHTML = this._renderRank(arr, false);
    document.getElementById('sortArea').textContent = this._sortLabel(this.areaSort);
  },
  _sortArr(arr, mode) {
    if (mode === 'name') return arr.sort((a, b) => a.key.localeCompare(b.key));
    if (mode === 'desc') return arr.sort((a, b) => b.val - a.val);
    return arr.sort((a, b) => a.val - b.val);
  },

  _renderTrend() {
    const map = {};
    this.filtered.forEach(r => { map[r.date] = (map[r.date] || 0) + r.total; });
    const dates = Object.keys(map).sort();
    const values = dates.map(d => map[d]);
    const labels = dates.map(d => { const [, m, day] = d.split('-'); return parseInt(day) + '/' + parseInt(m); });
    const ctx = document.getElementById('dTrendChart').getContext('2d');
    if (this.charts.trend) this.charts.trend.destroy();
    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: '#4A90B8', backgroundColor: 'rgba(74,144,184,0.08)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#4A90B8' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1F2937', padding: 12, callbacks: { title: (i) => this._formatFull(dates[i[0].dataIndex]), label: (c) => this._fmtRp(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 } },
          y: { grid: { color: 'rgba(232,226,211,0.5)' }, ticks: { color: '#8A93A0', font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  // ==========================================================================
  // METRIC DETAIL MODAL
  // ==========================================================================
  _openTotalDetail() {
    const cur = this._sumTotal(this.filtered);
    const prev = this._sumTotal(this.filteredPrev);
    const diff = cur - prev;
    const growth = this._growthPct(cur, prev);
    this._showDetail('Total penjualan', [
      { label: this._rangeText(this.applied), val: cur },
      { label: this._rangeText(this._prevRange) + ' (bulan lalu)', val: prev },
      { label: 'Selisih', val: diff, isDiff: true },
      { label: 'Pertumbuhan', val: growth, isGrowth: true }
    ]);
  },

  _openGroupDetail(groupKey) {
    const g = CONFIG.CHANNEL_GROUPS.find(x => x.key === groupKey);
    if (!g) return;
    const allChannels = g.children.flatMap(c => c.channels);
    const cur = this._sumChannels(this.filtered, allChannels);
    const prev = this._sumChannels(this.filteredPrev, allChannels);
    const diff = cur - prev;
    const growth = this._growthPct(cur, prev);
    const rows = [
      { label: this._rangeText(this.applied), val: cur },
      { label: this._rangeText(this._prevRange) + ' (bulan lalu)', val: prev },
      { label: 'Selisih', val: diff, isDiff: true },
      { label: 'Pertumbuhan', val: growth, isGrowth: true },
      { section: 'Detail per sub-channel' }
    ];
    g.children.forEach(c => {
      const cCur = this._sumChannels(this.filtered, c.channels);
      const cPrev = this._sumChannels(this.filteredPrev, c.channels);
      const cGr = this._growthPct(cCur, cPrev);
      rows.push({
        label: c.label,
        val: cCur,
        sub: cGr === null ? '—' : ((cGr >= 0 ? '+' : '') + cGr.toFixed(1) + '%'),
        subColor: cGr === null ? 'var(--ink-2)' : (cGr >= 0 ? 'var(--success)' : 'var(--danger)')
      });
    });
    this._showDetail(g.label, rows);
  },

  _showDetail(title, rows) {
    document.getElementById('detailTitle').textContent = title;
    let html = '<div class="detail-list">';
    rows.forEach(r => {
      if (r.section) {
        html += `<div class="detail-section">${this._esc(r.section)}</div>`;
        return;
      }
      let valStr;
      if (r.isGrowth) {
        valStr = r.val === null ? '—' : ((r.val >= 0 ? '+' : '') + r.val.toFixed(1) + '%');
      } else if (r.isDiff) {
        valStr = (r.val >= 0 ? '+' : '') + this._fmtRp(Math.abs(r.val));
      } else {
        valStr = this._fmtRp(r.val);
      }
      let color = '';
      if (r.isGrowth || r.isDiff) {
        color = r.val === null ? 'var(--ink-2)' : (r.val >= 0 ? 'var(--success)' : 'var(--danger)');
      }
      html += `<div class="detail-row">
        <div class="detail-label">${this._esc(r.label)}</div>
        <div class="detail-val" style="color:${color}">${valStr}${r.sub ? `<div class="detail-sub" style="color:${r.subColor}">${r.sub}</div>` : ''}</div>
      </div>`;
    });
    html += '</div>';
    document.getElementById('detailBody').innerHTML = html;
    document.getElementById('detailModal').hidden = false;
  },

  _rangeText(r) {
    if (!r || !r.from) return '—';
    if (r.from === r.to) return this._formatShort(r.from);
    return this._formatShort(r.from) + ' – ' + this._formatShort(r.to);
  },

  // ==========================================================================
  // SALES PAGE
  // ==========================================================================
  _bindSalesPage() {
    document.querySelectorAll('[data-metric]').forEach(b => {
      b.addEventListener('click', () => {
        this.salesMetric = b.dataset.metric;
        document.querySelectorAll('[data-metric]').forEach(x => x.classList.toggle('active', x === b));
        this._renderSales();
      });
    });
    document.querySelectorAll('[data-level]').forEach(b => {
      b.addEventListener('click', () => {
        this.salesLevel = b.dataset.level;
        document.querySelectorAll('[data-level]').forEach(x => x.classList.toggle('active', x === b));
        document.getElementById('tokoSubFilter').hidden = this.salesLevel !== 'branch';
        this._renderSales();
      });
    });
    document.querySelectorAll('[data-sort]').forEach(b => {
      b.addEventListener('click', () => {
        this.salesSort = b.dataset.sort;
        document.querySelectorAll('[data-sort]').forEach(x => x.classList.toggle('active', x === b));
        this._renderSales();
      });
    });
    document.getElementById('tsRegional').addEventListener('change', (e) => {
      this.tokoRegional = e.target.value;
      // Update area options
      const areas = this.tokoRegional
        ? Array.from(new Set(this.regional.filter(r => r.regional === this.tokoRegional).map(r => r.area))).sort()
        : Array.from(new Set(this.regional.map(r => r.area))).sort();
      const areaSel = document.getElementById('tsArea');
      const cur = areaSel.value;
      areaSel.innerHTML = '<option value="">Semua</option>' + areas.map(a => `<option value="${this._esc(a)}">${this._esc(a)}</option>`).join('');
      if (areas.includes(cur)) areaSel.value = cur; else { areaSel.value = ''; this.tokoArea = ''; }
      this._renderSales();
    });
    document.getElementById('tsArea').addEventListener('change', (e) => {
      this.tokoArea = e.target.value;
      // Auto-set regional dari area
      if (this.tokoArea) {
        const parent = (this.regional.find(r => r.area === this.tokoArea) || {}).regional;
        if (parent && !this.tokoRegional) { document.getElementById('tsRegional').value = parent; this.tokoRegional = parent; }
      }
      this._renderSales();
    });
  },

  _renderSales() {
    // Populate toko sub-filter dropdowns
    if (this.salesLevel === 'branch') {
      const regs = Array.from(new Set(this.regional.map(r => r.regional))).sort();
      const rSel = document.getElementById('tsRegional');
      if (!rSel.dataset.populated) {
        rSel.innerHTML = '<option value="">Semua</option>' + regs.map(r => `<option value="${this._esc(r)}">${this._esc(r)}</option>`).join('');
        const areas = Array.from(new Set(this.regional.map(r => r.area))).sort();
        document.getElementById('tsArea').innerHTML = '<option value="">Semua</option>' + areas.map(a => `<option value="${this._esc(a)}">${this._esc(a)}</option>`).join('');
        rSel.dataset.populated = '1';
      }
    }

    // Build rows
    const rows = this._buildSalesRows();

    // Sort
    if (this.salesSort === 'salesDesc') rows.sort((a, b) => b.total - a.total);
    else if (this.salesSort === 'salesAsc') rows.sort((a, b) => a.total - b.total);
    else if (this.salesSort === 'growthDesc') rows.sort((a, b) => (b.growth ?? -Infinity) - (a.growth ?? -Infinity));
    else if (this.salesSort === 'growthAsc') rows.sort((a, b) => (a.growth ?? Infinity) - (b.growth ?? Infinity));

    this._renderSalesTable(rows);
  },

  _buildSalesRows() {
    const level = this.salesLevel;
    const groupBy = (rec) => {
      const meta = this.branchMeta[rec.branch];
      if (level === 'branch') return rec.branch;
      if (level === 'area') return meta ? meta.area : null;
      return meta ? meta.regional : null;
    };
    const filterBranch = (rec) => {
      if (level !== 'branch') return true;
      const meta = this.branchMeta[rec.branch];
      if (this.tokoRegional && (!meta || meta.regional !== this.tokoRegional)) return false;
      if (this.tokoArea && (!meta || meta.area !== this.tokoArea)) return false;
      return true;
    };

    const groups = {};
    this.filtered.forEach(r => {
      if (!filterBranch(r)) return;
      const k = groupBy(r);
      if (!k) return;
      if (!groups[k]) groups[k] = { key: k, total: 0, prev: 0, channels: {} };
      groups[k].total += r.total;
      CONFIG.CHANNELS.forEach(c => { groups[k].channels[c] = (groups[k].channels[c] || 0) + (r.channels[c] || 0); });
    });
    this.filteredPrev.forEach(r => {
      if (!filterBranch(r)) return;
      const k = groupBy(r);
      if (!k) return;
      if (!groups[k]) groups[k] = { key: k, total: 0, prev: 0, channels: {} };
      groups[k].prev += r.total;
    });

    return Object.values(groups).map(g => ({
      ...g,
      growth: this._growthPct(g.total, g.prev)
    }));
  },

  _renderSalesTable(rows) {
    const container = document.getElementById('salesTable');
    if (rows.length === 0) {
      container.innerHTML = '<div style="color:var(--ink-3);font-size:13px;text-align:center;padding:20px;">Tidak ada data.</div>';
      return;
    }
    const isBranch = this.salesLevel === 'branch';
    let html = '<div class="stbl-wrap"><table class="stbl">';

    if (this.salesMetric === 'total') {
      html += '<thead><tr><th>Nama</th><th class="ta-r">Sales</th><th class="ta-r">Growth</th></tr></thead><tbody>';
      rows.forEach(r => {
        const gr = r.growth;
        const grTxt = gr === null ? '—' : ((gr >= 0 ? '+' : '') + gr.toFixed(1) + '%');
        const grCol = gr === null ? 'var(--ink-2)' : (gr >= 0 ? 'var(--success)' : 'var(--danger)');
        html += `<tr><td class="stbl-name">${this._esc(isBranch ? this._short(r.key) : r.key)}</td><td class="ta-r">${this._fmtRp(r.total)}</td><td class="ta-r" style="color:${grCol}">${grTxt}</td></tr>`;
      });
      html += '</tbody></table></div>';
    } else if (this.salesMetric === 'channel') {
      // Compact: tampilkan per group besar (offline/online/catering) + growth
      html += '<thead><tr><th>Nama</th>';
      CONFIG.CHANNEL_GROUPS.forEach(g => { html += `<th class="ta-r">${this._esc(g.label)}</th>`; });
      html += '<th class="ta-r">Total</th><th class="ta-r">Growth</th></tr></thead><tbody>';
      rows.forEach(r => {
        const gr = r.growth;
        const grTxt = gr === null ? '—' : ((gr >= 0 ? '+' : '') + gr.toFixed(1) + '%');
        const grCol = gr === null ? 'var(--ink-2)' : (gr >= 0 ? 'var(--success)' : 'var(--danger)');
        html += `<tr><td class="stbl-name">${this._esc(isBranch ? this._short(r.key) : r.key)}</td>`;
        CONFIG.CHANNEL_GROUPS.forEach(g => {
          const allC = g.children.flatMap(c => c.channels);
          const v = allC.reduce((s, c) => s + (r.channels[c] || 0), 0);
          html += `<td class="ta-r">${this._fmtRp(v)}</td>`;
        });
        html += `<td class="ta-r"><b>${this._fmtRp(r.total)}</b></td><td class="ta-r" style="color:${grCol}">${grTxt}</td></tr>`;
      });
      html += '</tbody></table></div>';
    } else {
      // contribution — percentage per group
      html += '<thead><tr><th>Nama</th>';
      CONFIG.CHANNEL_GROUPS.forEach(g => { html += `<th class="ta-r">${this._esc(g.label)}</th>`; });
      html += '<th class="ta-r">Total</th></tr></thead><tbody>';
      rows.forEach(r => {
        html += `<tr><td class="stbl-name">${this._esc(isBranch ? this._short(r.key) : r.key)}</td>`;
        CONFIG.CHANNEL_GROUPS.forEach(g => {
          const allC = g.children.flatMap(c => c.channels);
          const v = allC.reduce((s, c) => s + (r.channels[c] || 0), 0);
          const pct = r.total > 0 ? (v / r.total * 100) : 0;
          const bar = `<div class="pct-bar"><div class="pct-fill" style="width:${pct.toFixed(0)}%"></div></div>`;
          html += `<td class="ta-r">${bar}<div class="pct-txt">${pct.toFixed(1)}%</div></td>`;
        });
        html += `<td class="ta-r"><b>${this._fmtRp(r.total)}</b></td></tr>`;
      });
      html += '</tbody></table></div>';
    }
    container.innerHTML = html;
  },

  // ==========================================================================
  // SETTINGS PAGE
  // ==========================================================================
  _bindSettingsPage() {
    const bind = (key, options, current, onChange) => {
      const wrap = document.querySelector(`.dropdown-select[data-key="${key}"]`);
      const items = Object.entries(options);
      const build = () => {
        const cur = items.find(([k]) => k === wrap.dataset.current);
        const curLabel = cur ? (typeof cur[1] === 'string' ? cur[1] : cur[1].label) : '—';
        wrap.innerHTML = `<button class="dd-btn">${this._esc(curLabel)}<span class="dd-arrow">▾</span></button>
          <div class="dd-menu" hidden>
            ${items.map(([k, v]) => {
              const label = typeof v === 'string' ? v : v.label;
              const stack = typeof v === 'object' && v.stack ? v.stack : '';
              return `<div class="dd-opt${k === wrap.dataset.current ? ' active' : ''}" data-v="${k}"${stack ? ` style="font-family:${stack}"` : ''}>${this._esc(label)}</div>`;
            }).join('')}
          </div>`;
        const btn = wrap.querySelector('.dd-btn');
        const menu = wrap.querySelector('.dd-menu');
        btn.onclick = () => menu.hidden = !menu.hidden;
        wrap.querySelectorAll('.dd-opt').forEach(el => {
          el.onclick = () => {
            wrap.dataset.current = el.dataset.v;
            menu.hidden = true;
            onChange(el.dataset.v);
            build();
          };
        });
        // Close on outside click
        setTimeout(() => {
          const outside = (e) => { if (!wrap.contains(e.target)) menu.hidden = true; };
          document.addEventListener('click', outside, { once: true });
        }, 100);
      };
      wrap.dataset.current = current;
      build();
    };

    bind('theme', CONFIG.THEME_OPTIONS, this.theme, (v) => {
      this.theme = v; this._save('theme', v); this._applyTheme();
    });
    bind('money', CONFIG.MONEY_FORMATS, this.moneyFormat, (v) => {
      this.moneyFormat = v; this._save('moneyFormat', v); this._renderAll();
    });
    bind('font', CONFIG.FONT_OPTIONS, this.fontFamily, (v) => {
      this.fontFamily = v; this._save('fontFamily', v); this._applyTheme();
    });

    // Sheet link
    const sl = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) sl.href = CONFIG.SHEET_URL;
    else sl.parentElement.hidden = true;

    document.getElementById('btnClearCache').addEventListener('click', async () => {
      Sheets.clearCache();
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
      if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
      this._toast('Cache dibersihkan. Refresh halaman.');
    });
    document.getElementById('btnReload').addEventListener('click', () => this.loadAll());
  },

  _renderSettings() {
    if (this.status) {
      document.getElementById('stStatus').textContent = 'Terhubung';
      document.getElementById('stStatus').style.color = 'var(--success)';
      document.getElementById('stLastDate').textContent = this.status.lastDate ? this._formatFull(this.status.lastDate) : '—';
      document.getElementById('stRowCount').textContent = (this.status.rowCount || 0).toLocaleString('id-ID');
      document.getElementById('stDays').textContent = (this.status.distinctDates || 0) + ' hari';
      document.getElementById('stActive').textContent = this.activeBranches.length + ' toko';
      const c = Sheets.loadCache();
      document.getElementById('stCache').textContent = c ? new Date(c.cachedAt).toLocaleString('id-ID') : '—';

      const pct = (this.status.usage * 100).toFixed(2);
      const fill = document.getElementById('stCapFill');
      fill.style.width = pct + '%';
      fill.className = 'capacity-fill';
      let msg;
      if (this.status.usage >= 0.95) { fill.classList.add('critical'); msg = 'Kritis'; }
      else if (this.status.usage >= 0.8) { fill.classList.add('warn'); msg = 'Mendekati batas'; }
      else if (this.status.usage >= 0.5) { msg = 'Sehat'; }
      else { msg = 'Sangat sehat'; }
      document.getElementById('stCapText').textContent = pct + '% terpakai · ' + msg;
      if (this.status.distinctDates > 0 && this.status.usage > 0) {
        const perDay = this.status.usage / this.status.distinctDates;
        const daysLeft = Math.round((1 - this.status.usage) / perDay);
        document.getElementById('stCapNote').textContent = `Proyeksi: cukup untuk ~${daysLeft.toLocaleString('id-ID')} hari data lagi`;
      }
    } else {
      document.getElementById('stStatus').textContent = 'Belum terhubung';
    }
  },

  // ==========================================================================
  // MODALS
  // ==========================================================================
  _bindModals() {
    document.querySelectorAll('#detailModal [data-close]').forEach(el => {
      el.addEventListener('click', () => document.getElementById('detailModal').hidden = true);
    });
  },

  // ==========================================================================
  // UPLOAD (unchanged from v5, kept minimal)
  // ==========================================================================
  _bindUploadModal() {
    document.querySelectorAll('#uploadModal [data-close]').forEach(el => el.addEventListener('click', () => this._closeUpload()));
    document.getElementById('btnPickFile').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._handleFile(e.target.files[0]); });
    const dz = document.getElementById('dropzone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]); });
  },
  _openUpload() {
    document.getElementById('uploadModal').hidden = false;
    document.getElementById('filePreview').hidden = true;
    document.getElementById('uploadError').hidden = true;
    document.getElementById('uploadResult').hidden = true;
    document.getElementById('uploadActions').hidden = true;
    document.getElementById('fileInput').value = '';
    this._uploadCtx = null;
  },
  _closeUpload() { document.getElementById('uploadModal').hidden = true; },
  async _handleFile(file) {
    const preview = document.getElementById('filePreview');
    const err = document.getElementById('uploadError');
    const res = document.getElementById('uploadResult');
    const actions = document.getElementById('uploadActions');
    err.hidden = true; res.hidden = true; actions.hidden = true;
    preview.hidden = false;
    preview.innerHTML = `<div class="file-preview"><div class="file-preview-name">${this._esc(file.name)}</div><div class="file-preview-meta" id="upMsg">Memproses...</div><div class="upload-progress"><div class="upload-progress-fill" id="upFill" style="width:5%"></div></div></div>`;
    try {
      const parsed = await UploadParser.parse(file, (msg, pct) => {
        const m = document.getElementById('upMsg'); if (m) m.textContent = msg;
        const f = document.getElementById('upFill'); if (f) f.style.width = pct + '%';
      });
      const pairs = parsed.rows.map(r => ({ date: r.date, branch: r.branch }));
      const dup = await Sheets.checkDuplicate(pairs);
      this._uploadCtx = { parsed, dup };
      const meta = parsed.meta;
      preview.innerHTML = `<div class="file-preview">
        <div class="file-preview-name">${this._esc(file.name)}</div>
        <div class="file-preview-meta">${this._formatShort(meta.dateStart)}${meta.dateStart !== meta.dateEnd ? ' – ' + this._formatShort(meta.dateEnd) : ''} · ${meta.branches.length} toko · ${meta.rowCount.toLocaleString('id-ID')} baris · ${this._fmtRp(meta.totalSales)}</div>
      </div>`;
      res.hidden = false;
      if (dup.duplicates === 0) {
        res.innerHTML = `<div class="info-box"><b>Semua baru:</b> ${dup.newOnes.toLocaleString('id-ID')} baris siap diupload.</div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" data-close>Batal</button><button class="btn btn-primary" id="btnUploadInner">Upload semua</button>`;
        document.getElementById('btnUploadInner').onclick = () => this._doUpload(false);
      } else if (dup.newOnes === 0) {
        res.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Semua data sudah ada</div><div class="error-box-msg">${dup.duplicates.toLocaleString('id-ID')} baris sudah ada di spreadsheet.</div></div></div>`;
      } else {
        res.innerHTML = `<div class="warn-box"><b>Sebagian data sudah ada:</b><br>• ${dup.newOnes.toLocaleString('id-ID')} <b>baru</b><br>• ${dup.duplicates.toLocaleString('id-ID')} <b>duplikat</b></div><div style="font-size:12px; color:var(--ink-2); margin-bottom:8px;">Mau upload yang mana?</div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" data-close>Batal</button><button class="btn btn-primary" id="btnUploadInner">Upload ${dup.newOnes} baru saja</button>`;
        document.getElementById('btnUploadInner').onclick = () => this._doUpload(true);
      }
      actions.querySelectorAll('[data-close]').forEach(el => el.onclick = () => this._closeUpload());
    } catch (e) {
      preview.hidden = true;
      err.hidden = false;
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Gagal memproses file</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
    }
  },
  async _doUpload(filterDupes) {
    if (!this._uploadCtx) return;
    const actions = document.getElementById('uploadActions');
    actions.querySelectorAll('button').forEach(b => b.disabled = true);
    const preview = document.getElementById('filePreview');
    const setStatus = (msg, pct) => {
      preview.innerHTML = `<div class="file-preview"><div class="file-preview-name">${this._esc(this._uploadCtx.parsed.meta.fileName)}</div><div class="file-preview-meta">${this._esc(msg)}</div><div class="upload-progress"><div class="upload-progress-fill" style="width:${pct}%"></div></div></div>`;
    };
    try {
      let rows = this._uploadCtx.parsed.rows;
      if (filterDupes) {
        setStatus('Filter duplikat...', 10);
        const full = await Sheets.fetchAll();
        const existing = new Set(full.map(r => r.date + '|' + r.branch));
        rows = rows.filter(r => !existing.has(r.date + '|' + r.branch));
      }
      if (rows.length === 0) { setStatus('Tidak ada baris baru.', 100); setTimeout(() => this._closeUpload(), 1200); return; }
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        setStatus(`Upload ${Math.min(i + CHUNK, rows.length).toLocaleString('id-ID')} / ${rows.length.toLocaleString('id-ID')}`, 10 + Math.round(i / rows.length * 85));
        await Sheets.upload(slice);
      }
      setStatus(`Selesai. ${rows.length.toLocaleString('id-ID')} baris ditambahkan.`, 100);
      this._toast('Upload berhasil');
      Sheets.clearCache();
      setTimeout(() => this._closeUpload(), 1000);
      await this.loadAll();
    } catch (e) {
      const err = document.getElementById('uploadError');
      err.hidden = false;
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Upload gagal</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
      actions.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  },

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  _renderRank(items, isBranch) {
    if (items.length === 0) return '<div style="color:var(--ink-3);font-size:13px;padding:8px 0;">—</div>';
    return items.map((it, i) => `<div class="rank-row">
      <div class="rank-left"><span class="rank-num">${i + 1}</span><span class="rank-name">${this._esc(isBranch ? this._short(it.key) : it.key)}</span></div>
      <span class="rank-amount">${this._fmtRp(it.val)}</span>
    </div>`).join('');
  },
  _fmtRp(v) {
    if (v == null || isNaN(v)) return 'Rp 0';
    if (this.moneyFormat === 'full') return 'Rp ' + Math.round(v).toLocaleString('id-ID');
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (abs >= 1e9) return sign + 'Rp ' + (abs / 1e9).toFixed(2).replace('.', ',') + ' M';
    if (abs >= 1e6) return sign + 'Rp ' + Math.round(abs / 1e6).toLocaleString('id-ID') + ' JT';
    if (abs >= 1e3) return sign + 'Rp ' + Math.round(abs / 1e3).toLocaleString('id-ID') + ' Rb';
    return sign + 'Rp ' + Math.round(abs);
  },
  _fmtShort(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e6) return Math.round(v / 1e6) + 'jt';
    if (v >= 1e3) return Math.round(v / 1e3) + 'rb';
    return v;
  },
  _toDateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _formatShort(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1];
  },
  _formatFull(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1] + ' ' + y;
  },
  _short(b) { const m = String(b || '').match(/^[^-]+-\s*(.+)$/); return m ? m[1].trim() : String(b || ''); },
  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
  _splash(msg) { const s = document.getElementById('splash'); s.classList.remove('hidden'); if (msg) document.getElementById('splashSub').textContent = msg; },
  _splashHide() { setTimeout(() => document.getElementById('splash').classList.add('hidden'), 200); },
  _toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.hidden = true, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
