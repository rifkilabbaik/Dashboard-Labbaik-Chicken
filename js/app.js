// ============================================================================
// SALES DASHBOARD v8 — i18n (id/en), palettes, dashboard/sales,
// trend tabs (daily line / weekly+monthly bar) + compare popup,
// Kegiatan (activity log + calendar) & Komplain (complaint intake)
// ============================================================================

const App = {
  data: [], regional: [], status: null,
  branchMeta: {}, activeBranches: [], areaToRegional: {}, regionalToAreas: {},

  // Kegiatan & Komplain
  activities: [], complaints: [],
  actFilter: { from: '', to: '', name: '', store: '', type: '' },
  cmpFilter: { from: '', to: '', store: '', media: '', category: '' },
  _actCalYear: null, _actCalMonth: null,

  filter: { from: '', to: '' },  // no more preset
  applied: null,
  filtered: [], filteredPrev: [], _prevRange: { from:'', to:'' },
  charts: {},

  // Settings
  moneyFormat: 'auto',
  palette: 'krem_biru',
  fontFamily: 'default',
  lang: 'id',

  // Dashboard state
  regionalSort: 'name',
  areaSort: 'name',
  trendView: 'daily',       // 'daily' | 'weekly' | 'monthly'

  // Sales page state
  salesRegionalSort: 'desc',
  salesAreaSort:     'desc',
  salesTokoSort:     'desc',
  tokoRegional: '',
  tokoArea: '',

  // Filter modal
  _filterOrig: null,

  currentPage: 'dashboard',

  async init() {
    this._loadSettings();
    this._applyPalette();
    this._applyFont();
    this._applyI18nStatic();
    this._bindSidebar();
    this._bindTopbar();
    this._bindFilterModal();
    this._bindDashboardEvents();
    this._bindSalesPage();
    this._bindActivityPage();
    this._bindComplaintPage();
    this._bindSettingsPage();
    this._bindUploadPage();
    this._bindModals();

    const cached = Sheets.loadCache();
    if (cached && cached.data && cached.data.length > 0) {
      this.data = cached.data;
      this.regional = cached.regional || [];
      this.status = cached.status;
      this._buildBranchMeta();
      this._setDefaultRange();
      this.applied = { ...this.filter };
      this._computeFiltered();
      this._renderAll();
      this._splashHide();
      this._toast(this.t('toast_cache_loading'));
      this.loadAll(true);
    } else {
      this._setDefaultRange();
      this.applied = { ...this.filter };
      await this.loadAll();
    }
  },

  // ==========================================================================
  // SETTINGS I/O
  // ==========================================================================
  _loadSettings() {
    this.moneyFormat = localStorage.getItem('moneyFormat') || 'auto';
    if (!['auto','full'].includes(this.moneyFormat)) this.moneyFormat = 'auto';
    this.palette = localStorage.getItem('palette') || 'krem_biru';
    if (!CONFIG.PALETTES[this.palette]) this.palette = 'krem_biru';
    this.fontFamily = localStorage.getItem('fontFamily') || 'default';
    if (!CONFIG.FONT_OPTIONS[this.fontFamily]) this.fontFamily = 'default';
    this.lang = localStorage.getItem('lang') || 'id';
    if (!CONFIG.I18N[this.lang]) this.lang = 'id';
    this.regionalSort = localStorage.getItem('regionalSort') || 'name';
    this.areaSort = localStorage.getItem('areaSort') || 'name';
    this.trendView = localStorage.getItem('trendView') || 'daily';
    if (!['daily','weekly','monthly'].includes(this.trendView)) this.trendView = 'daily';
    this.salesRegionalSort = localStorage.getItem('salesRegionalSort') || 'desc';
    this.salesAreaSort     = localStorage.getItem('salesAreaSort')     || 'desc';
    this.salesTokoSort     = localStorage.getItem('salesTokoSort')     || 'desc';
  },
  _save(k, v) { localStorage.setItem(k, v); },

  // ==========================================================================
  // i18n
  // ==========================================================================
  t(key, params) {
    const dict = CONFIG.I18N[this.lang] || CONFIG.I18N.id;
    let val = dict[key];
    if (val == null) return key;
    if (Array.isArray(val)) return val;
    if (params) {
      Object.keys(params).forEach(k => {
        val = String(val).replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
      });
    }
    return val;
  },
  _applyI18nStatic() {
    document.documentElement.lang = this.lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
  },

  // ==========================================================================
  // PALETTE / FONT
  // ==========================================================================
  _applyPalette() {
    const p = CONFIG.PALETTES[this.palette] || CONFIG.PALETTES.krem_biru;
    const root = document.documentElement;
    Object.entries(p.vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = p.themeColor;
  },
  _applyFont() {
    const font = CONFIG.FONT_OPTIONS[this.fontFamily] || CONFIG.FONT_OPTIONS.default;
    document.documentElement.style.setProperty('--font-sans', font.stack);
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
  },
  _goToPage(page) {
    this.currentPage = page;
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.dataset.page === page));
    document.getElementById('pageTitle').textContent = this._pageTitle(page);
    // Filter periode hanya relevan untuk halaman penjualan
    document.getElementById('btnFilter').style.display = (page === 'dashboard' || page === 'sales') ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'sales') this._renderSales();
    if (page === 'upload') this._resetUploadUi();
    if (page === 'activity') this.loadActivities(true);
    if (page === 'complaint') this.loadComplaints(true);
  },
  _pageTitle(page) {
    const titleMap = {
      dashboard: this.t('nav_dashboard'), sales: this.t('nav_sales'),
      activity: this.t('nav_activity'), complaint: this.t('nav_complaint'),
      upload: this.t('nav_upload'), settings: this.t('nav_settings')
    };
    return titleMap[page] || '';
  },
  _bindTopbar() {
    document.getElementById('btnFilter').addEventListener('click', () => this._openFilterModal());
  },

  // ==========================================================================
  // FILTER (PERIODE ONLY — no more presets)
  // ==========================================================================
  _bindFilterModal() {
    const modal = document.getElementById('filterModal');
    // Backdrop close (no X, only OK & Batal/Reset)
    modal.querySelector('[data-close-modal]').addEventListener('click', () => modal.hidden = true);
    document.getElementById('filterOk').addEventListener('click', () => this._applyFilter());
    document.getElementById('filterCancelReset').addEventListener('click', () => this._filterCancelOrReset());
    document.getElementById('fRangeTrigger').addEventListener('click', () => this._openRangePicker());
  },
  _openFilterModal() {
    document.getElementById('fFrom').value = this.applied ? this.applied.from : this.filter.from;
    document.getElementById('fTo').value   = this.applied ? this.applied.to   : this.filter.to;
    this._filterOrig = { from: document.getElementById('fFrom').value, to: document.getElementById('fTo').value };
    this._updateRangeLabel();
    this._updateCancelResetBtn();
    document.getElementById('filterModal').hidden = false;
  },
  _updateCancelResetBtn() {
    const btn = document.getElementById('filterCancelReset');
    const f = document.getElementById('fFrom').value;
    const t = document.getElementById('fTo').value;
    const changed = this._filterOrig && (f !== this._filterOrig.from || t !== this._filterOrig.to);
    btn.textContent = changed ? this.t('reset') : this.t('cancel');
    btn.dataset.mode = changed ? 'reset' : 'cancel';
  },
  _filterCancelOrReset() {
    const btn = document.getElementById('filterCancelReset');
    if (btn.dataset.mode === 'reset') {
      // restore original
      document.getElementById('fFrom').value = this._filterOrig.from;
      document.getElementById('fTo').value   = this._filterOrig.to;
      this._updateRangeLabel();
      this._updateCancelResetBtn();
    } else {
      document.getElementById('filterModal').hidden = true;
    }
  },
  _applyFilter() {
    this._captureFilter();
    this._rangeIsDefault = false;
    this.applied = { ...this.filter };
    document.getElementById('filterModal').hidden = true;
    this._computeFiltered();
    this._renderAll();
    this._updatePeriodLabel();
  },
  _captureFilter() {
    this.filter = {
      from: document.getElementById('fFrom').value,
      to:   document.getElementById('fTo').value
    };
  },

  // Default = tanggal 1 bulan berjalan s/d tanggal data penjualan terakhir
  _setDefaultRange() {
    this._rangeIsDefault = true;
    let now;
    const latest = this._latestDate();
    if (latest) {
      const [ly, lm, ld] = latest.split('-').map(Number);
      now = new Date(ly, lm - 1, ld);
    } else now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = latest ? new Date(latest + 'T00:00:00') : now;
    this.filter.from = this._toDateStr(from);
    this.filter.to = this._toDateStr(to);
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
    if (!from || !to) { label.textContent = this.t('pick_date_placeholder'); return; }
    if (from === to) label.textContent = this._formatShort(from) + ' ' + from.split('-')[0];
    else label.textContent = this._formatShort(from) + ' – ' + this._formatShort(to) + ' ' + to.split('-')[0];
  },

  // Range picker — dipakai filter periode penjualan, kegiatan, & komplain.
  // opts: { from, to, allowClear, onApply(from, to) }
  _openRangePicker(opts) {
    opts = opts || {};
    const isPeriod = opts.onApply == null;
    const from = isPeriod ? document.getElementById('fFrom').value : opts.from;
    const to   = isPeriod ? document.getElementById('fTo').value   : opts.to;
    this._rangeFrom = from || null;
    this._rangeTo = to || null;
    this._rangeStep = 0;
    const anchor = this._rangeFrom || this._latestDate() || this._toDateStr(new Date());
    const [ay, am] = anchor.split('-').map(Number);
    this._rangeViewYear = ay;
    this._rangeViewMonth = am - 1;
    this._renderRangeCalendar();
    const modal = document.getElementById('rangeModal');
    modal.hidden = false;
    modal.querySelectorAll('[data-close-modal]').forEach(el => el.onclick = () => modal.hidden = true);

    const apply = opts.onApply || ((f, t) => {
      document.getElementById('fFrom').value = f;
      document.getElementById('fTo').value = t;
      this._updateRangeLabel();
      this._updateCancelResetBtn();
    });

    const clearBtn = document.getElementById('rangeClear');
    clearBtn.hidden = !opts.allowClear;
    clearBtn.textContent = this.t('all');
    clearBtn.onclick = () => { modal.hidden = true; apply('', ''); };

    document.getElementById('rangeOk').onclick = () => {
      if (this._rangeFrom) {
        let f = this._rangeFrom, t = this._rangeTo || this._rangeFrom;
        if (f > t) { const tmp = f; f = t; t = tmp; }
        modal.hidden = true;
        apply(f, t);
        return;
      }
      modal.hidden = true;
    };
  },
  _renderRangeCalendar() {
    const y = this._rangeViewYear, m = this._rangeViewMonth;
    const monthNames = this.t('months_full');
    const dowNames = this.t('days_short');
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
    if (!this._rangeFrom) info.textContent = this.t('click_first_date');
    else if (!this._rangeTo) info.textContent = this.t('from_prefix') + this._formatFull(this._rangeFrom) + this.t('click_to_date');
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
    if (!silent) this._splash();
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
      // Selama user belum mengubah filter, re-anchor ke data terbaru
      // (awal bulan -> tanggal data penjualan paling update).
      if (this._rangeIsDefault || !this.applied || !this.applied.from) {
        this._setDefaultRange();
        this.applied = { ...this.filter };
      }
      this._computeFiltered();
      this._renderAll();
      this._updatePeriodLabel();
      this._splashHide();
    } catch (e) {
      if (!silent) this._splash(this.t('splash_failed', { msg: e.message }));
      else this._toast(this.t('toast_load_failed', { msg: e.message }));
    }
  },

  _buildBranchMeta() {
    this.branchMeta = {}; this.activeBranches = [];
    this.areaToRegional = {}; this.regionalToAreas = {};
    this.regional.forEach(r => {
      this.branchMeta[r.branch] = { regional: r.regional, area: r.area };
      this.activeBranches.push(r.branch);
      this.areaToRegional[r.area] = r.regional;
      (this.regionalToAreas[r.regional] = this.regionalToAreas[r.regional] || []).push(r.area);
    });
  },

  _computeFiltered() {
    const a = this.applied;
    this.filtered = this.data.filter(r => (!a.from || r.date >= a.from) && (!a.to || r.date <= a.to));
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

  _nextSort(mode) { return mode === 'name' ? 'desc' : mode === 'desc' ? 'asc' : 'name'; },
  _sortLabel(mode) {
    return mode === 'name' ? this.t('sort_name') : mode === 'desc' ? this.t('sort_largest') : this.t('sort_smallest');
  },
  _sortArr(arr, mode) {
    if (mode === 'name') return arr.slice().sort((a, b) => a.key.localeCompare(b.key));
    if (mode === 'desc') return arr.slice().sort((a, b) => b.val - a.val);
    return arr.slice().sort((a, b) => a.val - b.val);
  },

  // ==========================================================================
  // RENDER ALL
  // ==========================================================================
  // Setiap bagian dibungkus supaya satu error tidak menggagalkan render bagian lain
  // (dulu error di grafik tren membuat Info data di Pengaturan tidak pernah terisi).
  _safe(name, fn) {
    try { fn(); } catch (e) { console.error('Render ' + name + ' gagal:', e); }
  },
  _renderAll() {
    this._safe('dashboard', () => this._renderDashboard());
    if (this.currentPage === 'sales') this._safe('sales', () => this._renderSales());
    this._safe('settings', () => this._renderSettings());
    if (this.currentPage === 'activity')  this._safe('activity',  () => this._renderActivityPage());
    if (this.currentPage === 'complaint') this._safe('complaint', () => this._renderComplaintPage());
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
    document.querySelectorAll('.trend-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.trendView = btn.dataset.trend;
        this._save('trendView', this.trendView);
        document.querySelectorAll('.trend-tab').forEach(b => b.classList.toggle('active', b === btn));
        this._renderTrend();
      });
    });
    // Click chart wrap → open compare modal
    document.getElementById('dTrendWrap').addEventListener('click', () => this._openTrendCompare());
  },

  _renderDashboard() {
    const total = this._sumTotal(this.filtered);
    const totalPrev = this._sumTotal(this.filteredPrev);
    const gr = this._growthPct(total, totalPrev);
    document.getElementById('mvTotal').textContent = this._fmtRp(total);
    const gEl = document.getElementById('mvTotalGrowth');
    if (gr === null) { gEl.textContent = '—'; gEl.style.color = 'var(--ink-2)'; }
    else {
      gEl.textContent = (gr >= 0 ? '+' : '') + gr.toFixed(1) + '%';
      gEl.style.color = gr >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    document.querySelector('#mcTotal .metric-hero-hint').textContent = this.t('click_for_detail');

    this._safe('metricGroups', () => this._renderMetricGroups());
    this._safe('regionalList', () => this._renderRegionalList());
    this._safe('areaList',     () => this._renderAreaList());

    // Active trend tab reflection
    document.querySelectorAll('.trend-tab').forEach(b => b.classList.toggle('active', b.dataset.trend === this.trendView));
    this._safe('trend', () => this._renderTrend());

    // Top / Low 10
    const branchTotals = {};
    this.filtered.forEach(r => { branchTotals[r.branch] = (branchTotals[r.branch] || 0) + r.total; });
    const arr = Object.entries(branchTotals).map(([b, v]) => ({ key: b, val: v })).filter(x => x.val > 0);
    const top10 = [...arr].sort((a, b) => b.val - a.val).slice(0, 10);
    const low10 = [...arr].sort((a, b) => a.val - b.val).slice(0, 10);
    document.getElementById('dTop10').innerHTML = this._renderRank(top10, true);
    document.getElementById('dLow10').innerHTML = this._renderRank(low10, true);
    // Also bind clicks
    document.querySelectorAll('#dTop10 .rank-row, #dLow10 .rank-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const key = row.dataset.key;
        if (key) this._openEntityDetail('branch', key);
      });
    });
  },

  _renderMetricGroups() {
    const wrap = document.getElementById('metricGroups');
    let html = '';
    CONFIG.CHANNEL_GROUPS.forEach(g => {
      const allChannels = [...g.always, ...g.conditional].flatMap(c => c.channels);
      const total = this._sumChannels(this.filtered, allChannels);
      const prev = this._sumChannels(this.filteredPrev, allChannels);
      const growth = this._growthPct(total, prev);
      const growthTxt = growth === null ? '—' : ((growth >= 0 ? '+' : '') + growth.toFixed(1) + '%');
      const growthColor = growth === null ? 'var(--ink-2)' : (growth >= 0 ? 'var(--success)' : 'var(--danger)');
      const label = this._loc(g.label);

      html += `<div class="metric-group-card" data-group="${g.key}">
        <div class="mg-head">
          <div class="mg-label">${this._esc(label)}</div>
          <div class="mg-growth" style="color:${growthColor}">${growthTxt}</div>
        </div>
        <div class="mg-value">${this._fmtRp(total)}</div>
        <div class="mg-children">`;
      // Only "always" children shown on card
      g.always.forEach(c => {
        const cVal = this._sumChannels(this.filtered, c.channels);
        html += `<div class="mg-child"><span class="mg-child-label">${this._esc(this._loc(c.label))}</span><span class="mg-child-val">${this._fmtRp(cVal)}</span></div>`;
      });
      // Conditional children (Lainnya expanded): only if >0 on card too
      g.conditional.forEach(c => {
        const cVal = this._sumChannels(this.filtered, c.channels);
        if (cVal > 0) {
          html += `<div class="mg-child"><span class="mg-child-label">${this._esc(this._loc(c.label))}</span><span class="mg-child-val">${this._fmtRp(cVal)}</span></div>`;
        }
      });
      html += `</div><div class="mg-hint">${this._esc(this.t('click_for_detail'))}</div></div>`;
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
    document.querySelectorAll('#regionalList .rank-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => this._openEntityDetail('regional', row.dataset.key));
    });
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
    document.querySelectorAll('#areaList .rank-row').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => this._openEntityDetail('area', row.dataset.key));
    });
  },

  // ==========================================================================
  // TREND (daily / weekly / monthly)
  // ==========================================================================
  _renderTrend() {
    const t = this._buildTrendSeries(this.trendView, false);
    this._drawTrend(t.labels, t.values, t.dates, this.trendView);
    const hint = document.getElementById('trendHint');
    hint.textContent = this.t('trend_compare_hint');
  },

  _buildTrendSeries(view, isPrev) {
    // For each view: return { labels, values, dates? }
    if (view === 'daily') {
      const src = isPrev ? this.filteredPrev : this.filtered;
      const range = isPrev ? this._prevRange : this.applied;
      const map = {};
      src.forEach(r => { map[r.date] = (map[r.date] || 0) + r.total; });
      // Fill all dates in range for consistent x-axis
      const dates = this._enumerateDates(range.from, range.to);
      const values = dates.map(d => map[d] || 0);
      const labels = dates.map(d => { const [, m, day] = d.split('-'); return parseInt(day) + '/' + parseInt(m); });
      return { labels, values, dates };
    }
    if (view === 'weekly') {
      // 7-day chunks starting from range.from
      const src = isPrev ? this.filteredPrev : this.filtered;
      const range = isPrev ? this._prevRange : this.applied;
      if (!range.from || !range.to) return { labels: [], values: [], dates: [] };
      const totals = {};
      src.forEach(r => { totals[r.date] = (totals[r.date] || 0) + r.total; });
      const dates = this._enumerateDates(range.from, range.to);
      const bins = []; // { label, val, start, end }
      let idx = 0, w = 1;
      while (idx < dates.length) {
        const chunk = dates.slice(idx, idx + 7);
        const val = chunk.reduce((s, d) => s + (totals[d] || 0), 0);
        bins.push({ label: this.t('trend_week_prefix') + w, val, start: chunk[0], end: chunk[chunk.length - 1] });
        idx += 7; w++;
      }
      return {
        labels: bins.map(b => b.label),
        values: bins.map(b => b.val),
        dates:  bins.map(b => b.start + ' — ' + b.end)
      };
    }
    // monthly: 12 bulan dari tahun periode aktif (atau tahun sebelumnya kalau isPrev)
    const anchor = (this.applied && this.applied.to) || this._latestDate() || this._toDateStr(new Date());
    const year = parseInt(anchor.split('-')[0], 10) - (isPrev ? 1 : 0);
    const totals = new Array(12).fill(0);
    this.data.forEach(r => {
      const [y, m] = r.date.split('-').map(Number);
      if (y === year) totals[m - 1] += r.total;
    });
    const monthNames = this.t('months_short');
    return {
      labels: monthNames.map(n => n),
      values: totals,
      dates: monthNames.map((n, i) => n + ' ' + year)
    };
  },

  _enumerateDates(from, to) {
    if (!from || !to) return [];
    const out = [];
    const cur = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (cur <= end) { out.push(this._toDateStr(cur)); cur.setDate(cur.getDate() + 1); }
    return out;
  },

  _drawTrend(labels, values, dates, view) {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('dTrendChart').getContext('2d');
    if (this.charts.trend) this.charts.trend.destroy();
    const cs = getComputedStyle(document.documentElement);
    const seaColor = cs.getPropertyValue('--sea').trim() || '#4A90B8';
    const inkColor = cs.getPropertyValue('--ink-3').trim() || '#8A93A0';
    const gridColor = cs.getPropertyValue('--line').trim() || '#E8E2D3';
    const maxV = Math.max.apply(null, values.length ? values : [0]);
    // Daily = line chart; weekly & monthly = bar chart
    const isLine = view === 'daily';
    const type = isLine ? 'line' : 'bar';
    this.charts.trend = new Chart(ctx, {
      type,
      data: { labels, datasets: [{
        data: values,
        borderColor: seaColor,
        backgroundColor: isLine ? this._hexToRgba(seaColor, 0.1) : seaColor,
        borderWidth: isLine ? 2 : 0,
        fill: isLine,
        tension: isLine ? 0.3 : 0,
        pointRadius: isLine ? 3 : 0,
        pointHoverRadius: isLine ? 5 : 0,
        pointBackgroundColor: seaColor,
        borderRadius: isLine ? 0 : 4,
        maxBarThickness: 42
      }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1F2937', padding: 12, callbacks: { title: (i) => dates[i[0].dataIndex] || labels[i[0].dataIndex], label: (c) => this._fmtRp(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: inkColor, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 } },
          y: { min: 0, max: maxV > 0 ? maxV * 1.05 : undefined, grid: { color: gridColor }, ticks: { color: inkColor, font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  _openTrendCompare() {
    const cur = this._buildTrendSeries(this.trendView, false);
    const prev = this._buildTrendSeries(this.trendView, true);
    // Align labels to current
    const labels = cur.labels;
    const prevValues = new Array(labels.length).fill(0);
    for (let i = 0; i < Math.min(labels.length, prev.values.length); i++) prevValues[i] = prev.values[i];
    const titleMap = {
      daily:   this.t('trend_daily'),
      weekly:  this.t('trend_weekly'),
      monthly: this.t('trend_monthly')
    };
    document.getElementById('trendModalTitle').textContent = titleMap[this.trendView] + ' · ' + this.t('trend_compare_title');
    document.getElementById('trendModal').hidden = false;
    const view = this.trendView;
    setTimeout(() => this._drawTrendCompare(labels, cur.values, prevValues, view), 30);
  },

  _drawTrendCompare(labels, cur, prev, view) {
    if (typeof Chart === 'undefined') return;
    const ctx = document.getElementById('trendCompareChart').getContext('2d');
    if (this.charts.compare) this.charts.compare.destroy();
    const cs = getComputedStyle(document.documentElement);
    const seaColor = cs.getPropertyValue('--sea').trim() || '#4A90B8';
    const accent2 = cs.getPropertyValue('--accent-2').trim() || seaColor;
    const inkColor = cs.getPropertyValue('--ink-3').trim() || '#8A93A0';
    const gridColor = cs.getPropertyValue('--line').trim() || '#E8E2D3';
    const maxV = Math.max.apply(null, [...cur, ...prev, 0]);
    // Monthly membandingkan 12 bulan tahun ini vs tahun lalu -> "Tahun lalu".
    // Daily & weekly membandingkan rentang periode vs rentang bulan lalu -> "Bulan lalu".
    const prevLabel = view === 'monthly' ? this.t('trend_prev_year') : this.t('trend_prev');
    const isLine = view === 'daily';
    this.charts.compare = new Chart(ctx, {
      type: isLine ? 'line' : 'bar',
      data: {
        labels,
        datasets: [
          { label: this.t('trend_current'), data: cur, borderColor: seaColor, backgroundColor: isLine ? this._hexToRgba(seaColor, 0.1) : seaColor, borderWidth: isLine ? 2 : 0, tension: isLine ? 0.3 : 0, pointRadius: isLine ? 2 : 0, pointHoverRadius: isLine ? 5 : 0, fill: false, borderRadius: isLine ? 0 : 3, maxBarThickness: 28 },
          { label: prevLabel, data: prev, borderColor: accent2, backgroundColor: isLine ? this._hexToRgba(accent2, 0.08) : this._hexToRgba(accent2, 0.45), borderWidth: isLine ? 2 : 0, tension: isLine ? 0.3 : 0, pointRadius: isLine ? 2 : 0, pointHoverRadius: isLine ? 5 : 0, borderDash: isLine ? [4, 4] : undefined, fill: false, borderRadius: isLine ? 0 : 3, maxBarThickness: 28 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: inkColor, font: { size: 11 }, boxWidth: 10 } },
          tooltip: { backgroundColor: '#1F2937', padding: 12, callbacks: { label: (c) => c.dataset.label + ': ' + this._fmtRp(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: inkColor, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 } },
          y: { min: 0, max: maxV > 0 ? maxV * 1.05 : undefined, grid: { color: gridColor }, ticks: { color: inkColor, font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  // ==========================================================================
  // DETAIL MODAL (group & entity)
  // ==========================================================================
  _openTotalDetail() {
    const cur = this._sumTotal(this.filtered);
    const prev = this._sumTotal(this.filteredPrev);
    const diff = cur - prev;
    const growth = this._growthPct(cur, prev);
    this._showDetail(this.t('total_sales'), [
      { label: this._rangeText(this.applied), val: cur },
      { label: this._rangeText(this._prevRange) + ' (' + this.t('prev_month') + ')', val: prev },
      { label: this.t('difference'), val: diff, isDiff: true },
      { label: this.t('growth'), val: growth, isGrowth: true }
    ]);
  },

  _openGroupDetail(groupKey) {
    const g = CONFIG.CHANNEL_GROUPS.find(x => x.key === groupKey);
    if (!g) return;
    const allChildren = [...g.always, ...g.conditional];
    const allChannels = allChildren.flatMap(c => c.channels);
    const cur = this._sumChannels(this.filtered, allChannels);
    const prev = this._sumChannels(this.filteredPrev, allChannels);
    const diff = cur - prev;
    const growth = this._growthPct(cur, prev);
    const rows = [
      { label: this._rangeText(this.applied), val: cur },
      { label: this._rangeText(this._prevRange) + ' (' + this.t('prev_month') + ')', val: prev },
      { label: this.t('difference'), val: diff, isDiff: true },
      { label: this.t('growth'), val: growth, isGrowth: true }
    ];
    // Catering: no sub-channel section
    // Offline/Online: show "Detail" section with children (only >0 for conditional)
    if (g.key !== 'catering') {
      rows.push({ section: this.t('detail') });
      // always children
      g.always.forEach(c => {
        const cCur = this._sumChannels(this.filtered, c.channels);
        const cPrev = this._sumChannels(this.filteredPrev, c.channels);
        const cGr = this._growthPct(cCur, cPrev);
        rows.push({
          label: this._loc(c.label), val: cCur,
          sub: cGr === null ? '—' : ((cGr >= 0 ? '+' : '') + cGr.toFixed(1) + '%'),
          subColor: cGr === null ? 'var(--ink-2)' : (cGr >= 0 ? 'var(--success)' : 'var(--danger)')
        });
      });
      // conditional children (only if >0)
      g.conditional.forEach(c => {
        const cCur = this._sumChannels(this.filtered, c.channels);
        if (cCur <= 0) return;
        const cPrev = this._sumChannels(this.filteredPrev, c.channels);
        const cGr = this._growthPct(cCur, cPrev);
        rows.push({
          label: this._loc(c.label), val: cCur,
          sub: cGr === null ? '—' : ((cGr >= 0 ? '+' : '') + cGr.toFixed(1) + '%'),
          subColor: cGr === null ? 'var(--ink-2)' : (cGr >= 0 ? 'var(--success)' : 'var(--danger)')
        });
      });
    }
    this._showDetail(this._loc(g.label), rows);
  },

  // Row detail (regional/area/branch clicked in dashboard or sales page)
  _openEntityDetail(level, key) {
    const displayName = level === 'branch' ? this._short(key) : key;
    const curRows = this._filterEntity(this.filtered, level, key);
    const prevRows = this._filterEntity(this.filteredPrev, level, key);
    const cur = this._sumTotal(curRows);
    const prev = this._sumTotal(prevRows);
    const diff = cur - prev;
    const growth = this._growthPct(cur, prev);
    const rows = [
      { label: this._rangeText(this.applied), val: cur },
      { label: this._rangeText(this._prevRange) + ' (' + this.t('prev_month') + ')', val: prev },
      { label: this.t('difference'), val: diff, isDiff: true },
      { label: this.t('growth'), val: growth, isGrowth: true },
      { section: this.t('detail') }
    ];
    CONFIG.ALL_CHANNELS_ORDER.forEach(ch => {
      const cCur = this._sumChannels(curRows, [ch.key]);
      if (cCur <= 0) return;  // hanya yang ada datanya
      const cPrev = this._sumChannels(prevRows, [ch.key]);
      const cGr = this._growthPct(cCur, cPrev);
      rows.push({
        label: this._loc(ch.label), val: cCur,
        sub: cGr === null ? '—' : ((cGr >= 0 ? '+' : '') + cGr.toFixed(1) + '%'),
        subColor: cGr === null ? 'var(--ink-2)' : (cGr >= 0 ? 'var(--success)' : 'var(--danger)')
      });
    });
    this._showDetail(displayName, rows);
  },

  _filterEntity(rows, level, key) {
    return rows.filter(r => {
      if (level === 'branch') return r.branch === key;
      const m = this.branchMeta[r.branch];
      if (!m) return false;
      if (level === 'area') return m.area === key;
      return m.regional === key;
    });
  },

  _showDetail(title, rows) {
    document.getElementById('detailTitle').textContent = title;
    let html = '<div class="detail-list">';
    rows.forEach(r => {
      if (r.section) { html += `<div class="detail-section">${this._esc(r.section)}</div>`; return; }
      let valStr;
      if (r.isGrowth) valStr = r.val === null ? '—' : ((r.val >= 0 ? '+' : '') + r.val.toFixed(1) + '%');
      else if (r.isDiff) valStr = (r.val >= 0 ? '+' : '') + this._fmtRp(Math.abs(r.val));
      else valStr = this._fmtRp(r.val);
      let color = '';
      if (r.isGrowth || r.isDiff) color = r.val === null ? 'var(--ink-2)' : (r.val >= 0 ? 'var(--success)' : 'var(--danger)');
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
  // SALES PAGE (3 sections stacked)
  // ==========================================================================
  _bindSalesPage() {
    document.getElementById('sortSalesRegional').addEventListener('click', () => {
      this.salesRegionalSort = this._nextSort(this.salesRegionalSort);
      this._save('salesRegionalSort', this.salesRegionalSort);
      this._renderSalesRegional();
    });
    document.getElementById('sortSalesArea').addEventListener('click', () => {
      this.salesAreaSort = this._nextSort(this.salesAreaSort);
      this._save('salesAreaSort', this.salesAreaSort);
      this._renderSalesArea();
    });
    document.getElementById('sortSalesToko').addEventListener('click', () => {
      this.salesTokoSort = this._nextSort(this.salesTokoSort);
      this._save('salesTokoSort', this.salesTokoSort);
      this._renderSalesToko();
    });
  },

  _renderSales() {
    this._renderSalesRegional();
    this._renderSalesArea();
    this._renderTokoDropdowns();
    this._renderSalesToko();
  },

  _renderSalesRegional() {
    const rows = this._buildSalesRows('regional');
    this._sortAndRender(rows, this.salesRegionalSort, 'salesRegionalTable', 'regional');
    document.getElementById('sortSalesRegional').textContent = this._sortLabel(this.salesRegionalSort);
  },
  _renderSalesArea() {
    const rows = this._buildSalesRows('area');
    this._sortAndRender(rows, this.salesAreaSort, 'salesAreaTable', 'area');
    document.getElementById('sortSalesArea').textContent = this._sortLabel(this.salesAreaSort);
  },
  _renderSalesToko() {
    const rows = this._buildSalesRows('branch').filter(r => {
      const m = this.branchMeta[r.key];
      if (this.tokoRegional && (!m || m.regional !== this.tokoRegional)) return false;
      if (this.tokoArea && (!m || m.area !== this.tokoArea)) return false;
      return true;
    });
    this._sortAndRender(rows, this.salesTokoSort, 'salesTokoTable', 'branch');
    document.getElementById('sortSalesToko').textContent = this._sortLabel(this.salesTokoSort);
  },

  _buildSalesRows(level) {
    const getKey = (rec) => {
      const m = this.branchMeta[rec.branch];
      if (level === 'branch') return rec.branch;
      if (level === 'area') return m ? m.area : null;
      return m ? m.regional : null;
    };
    const groups = {};
    this.filtered.forEach(r => {
      const k = getKey(r);
      if (!k) return;
      if (!groups[k]) groups[k] = { key: k, total: 0, prev: 0, channels: {} };
      groups[k].total += r.total;
      CONFIG.CHANNELS.forEach(c => { groups[k].channels[c] = (groups[k].channels[c] || 0) + (r.channels[c] || 0); });
    });
    this.filteredPrev.forEach(r => {
      const k = getKey(r);
      if (!k) return;
      if (!groups[k]) groups[k] = { key: k, total: 0, prev: 0, channels: {} };
      groups[k].prev += r.total;
    });
    return Object.values(groups).map(g => ({ ...g, growth: this._growthPct(g.total, g.prev), val: g.total }));
  },

  _sortAndRender(rows, sortMode, containerId, level) {
    let arr;
    if (sortMode === 'name') arr = rows.slice().sort((a, b) => String(a.key).localeCompare(String(b.key)));
    else if (sortMode === 'desc') arr = rows.slice().sort((a, b) => b.total - a.total);
    else arr = rows.slice().sort((a, b) => a.total - b.total);
    this._renderSalesTable(containerId, arr, level);
  },

  _renderSalesTable(containerId, rows, level) {
    const container = document.getElementById(containerId);
    if (rows.length === 0) {
      container.innerHTML = `<div class="empty-note">${this._esc(this.t('no_data'))}</div>`;
      return;
    }
    const groups = CONFIG.CHANNEL_GROUPS;  // 3 groups
    let html = '<div class="stbl-wrap"><table class="stbl">';
    html += '<thead><tr>';
    html += `<th>${this._esc(this.t('tbl_name'))}</th>`;
    groups.forEach(g => { html += `<th class="ta-r">${this._esc(this._loc(g.label))}</th>`; });
    html += `<th class="ta-r">${this._esc(this.t('tbl_total'))}</th>`;
    html += `<th class="ta-r">${this._esc(this.t('tbl_growth'))}</th>`;
    html += '</tr></thead><tbody>';
    const isBranch = level === 'branch';
    rows.forEach(r => {
      const gr = r.growth;
      const grTxt = gr === null ? '—' : ((gr >= 0 ? '+' : '') + gr.toFixed(1) + '%');
      const grCol = gr === null ? 'var(--ink-2)' : (gr >= 0 ? 'var(--success)' : 'var(--danger)');
      const name = isBranch ? this._short(r.key) : r.key;
      html += `<tr class="stbl-clickable" data-level="${level}" data-key="${this._esc(r.key)}"><td class="stbl-name">${this._esc(name)}</td>`;
      groups.forEach(g => {
        const chans = [...g.always, ...g.conditional].flatMap(c => c.channels);
        const v = chans.reduce((s, c) => s + (r.channels[c] || 0), 0);
        html += `<td class="ta-r rp-num">${this._fmtRp(v)}</td>`;
      });
      html += `<td class="ta-r rp-num"><b>${this._fmtRp(r.total)}</b></td>`;
      html += `<td class="ta-r" style="color:${grCol}">${grTxt}</td></tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    container.querySelectorAll('.stbl-clickable').forEach(tr => {
      tr.addEventListener('click', () => this._openEntityDetail(tr.dataset.level, tr.dataset.key));
    });
  },

  _renderTokoDropdowns() {
    if (!this.regional || this.regional.length === 0) return;
    const regs = Array.from(new Set(this.regional.map(r => r.regional))).sort();
    const regOpts = { '': this.t('all') };
    regs.forEach(r => { regOpts[r] = r; });
    this._initDropdown('tokoRegional', regOpts, this.tokoRegional, (v) => {
      this.tokoRegional = v;
      // reset area if not compatible
      if (v && this.tokoArea) {
        const areas = Array.from(new Set(this.regional.filter(x => x.regional === v).map(x => x.area)));
        if (!areas.includes(this.tokoArea)) this.tokoArea = '';
      }
      this._renderTokoDropdowns();
      this._renderSalesToko();
    });
    const areas = (this.tokoRegional
      ? Array.from(new Set(this.regional.filter(r => r.regional === this.tokoRegional).map(r => r.area)))
      : Array.from(new Set(this.regional.map(r => r.area)))
    ).sort();
    const areaOpts = { '': this.t('all') };
    areas.forEach(a => { areaOpts[a] = a; });
    this._initDropdown('tokoArea', areaOpts, this.tokoArea, (v) => {
      this.tokoArea = v;
      if (v && !this.tokoRegional) {
        const parent = (this.regional.find(r => r.area === v) || {}).regional;
        if (parent) { this.tokoRegional = parent; this._renderTokoDropdowns(); }
      }
      this._renderSalesToko();
    });
  },

  // ==========================================================================
  // SETTINGS PAGE
  // ==========================================================================
  _bindSettingsPage() {
    const sl = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) sl.href = CONFIG.SHEET_URL;
    else sl.parentElement.hidden = true;

    document.getElementById('btnClearCache').addEventListener('click', async () => {
      Sheets.clearCache();
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
      if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
      this._toast(this.t('toast_cache_cleared'));
    });
    document.getElementById('btnReload').addEventListener('click', () => this.loadAll());

    // Build dropdowns
    this._buildSettingDropdowns();
  },
  _buildSettingDropdowns() {
    const paletteOpts = {};
    Object.entries(CONFIG.PALETTES).forEach(([k, v]) => { paletteOpts[k] = this._loc(v.label); });
    this._initDropdown('palette', paletteOpts, this.palette, (v) => {
      this.palette = v; this._save('palette', v); this._applyPalette();
      // Recolor charts too
      if (this.currentPage === 'dashboard') this._renderTrend();
    });
    const langOpts = {};
    Object.entries(CONFIG.LANGUAGES).forEach(([k, v]) => { langOpts[k] = this._loc(v); });
    this._initDropdown('lang', langOpts, this.lang, (v) => {
      this.lang = v; this._save('lang', v);
      this._applyI18nStatic();
      this._buildSettingDropdowns();  // re-label dropdown options
      this._renderAll();
      this._updatePeriodLabel();
      // update current page title
      document.getElementById('pageTitle').textContent = this._pageTitle(this.currentPage);
      // Re-render toko dropdowns to update "Semua"
      this._renderTokoDropdowns();
    });
    const moneyOpts = {};
    Object.entries(CONFIG.MONEY_FORMATS).forEach(([k, v]) => { moneyOpts[k] = this._loc(v); });
    this._initDropdown('money', moneyOpts, this.moneyFormat, (v) => {
      this.moneyFormat = v; this._save('moneyFormat', v); this._renderAll();
    });
    const fontOpts = {};
    Object.entries(CONFIG.FONT_OPTIONS).forEach(([k, v]) => { fontOpts[k] = { label: this._loc(v.label), stack: v.stack }; });
    this._initDropdown('font', fontOpts, this.fontFamily, (v) => {
      this.fontFamily = v; this._save('fontFamily', v); this._applyFont();
    });
  },

  _renderSettings() {
    if (this.status) {
      document.getElementById('stStatus').textContent = this.t('setting_connected');
      document.getElementById('stStatus').style.color = 'var(--success)';
      document.getElementById('stLastDate').textContent = this.status.lastDate ? this._formatFull(this.status.lastDate) : '—';
      document.getElementById('stRowCount').textContent = (this.status.rowCount || 0).toLocaleString(this._locale());
      document.getElementById('stDays').textContent = (this.status.distinctDates || 0) + ' ' + this.t('days_suffix');
      document.getElementById('stActive').textContent = this.activeBranches.length + ' ' + this.t('stores_suffix');
      const c = Sheets.loadCache();
      document.getElementById('stCache').textContent = c ? new Date(c.cachedAt).toLocaleString(this._locale()) : '—';

      const pct = (this.status.usage * 100).toFixed(2);
      const fill = document.getElementById('stCapFill');
      fill.style.width = pct + '%';
      fill.className = 'capacity-fill';
      if (this.status.usage >= 0.95) fill.classList.add('critical');
      else if (this.status.usage >= 0.8) fill.classList.add('warn');
      document.getElementById('stCapText').textContent = this.t('pct_used', { p: pct });
    } else {
      document.getElementById('stStatus').textContent = this.t('setting_not_connected');
    }
  },

  // ==========================================================================
  // MODALS
  // ==========================================================================
  _bindModals() {
    // Detail modal close via any [data-close-modal] inside
    document.querySelectorAll('#detailModal [data-close-modal]').forEach(el => {
      el.addEventListener('click', () => document.getElementById('detailModal').hidden = true);
    });
    document.querySelectorAll('#trendModal [data-close-modal]').forEach(el => {
      el.addEventListener('click', () => document.getElementById('trendModal').hidden = true);
    });
  },

  // ==========================================================================
  // DROPDOWN COMPONENT
  // ==========================================================================
  // opts: { search: true, placeholder: '...' }
  //  - search   : tampilkan kotak cari di dalam menu (untuk daftar panjang, mis. toko)
  //  - placeholder: label saat belum ada pilihan (value '' tidak ada di options)
  _initDropdown(key, options, current, onChange, opts) {
    const wrap = document.querySelector(`.dropdown-select[data-key="${key}"]`);
    if (!wrap) return;
    opts = opts || {};
    const curVal = current == null ? '' : String(current);
    wrap.dataset.current = curVal;
    wrap._options = options; wrap._onChange = onChange;
    const items = Object.entries(options);
    const labelOf = (v) => (typeof v === 'string' ? v : v.label);
    const cur = items.find(([k]) => k === curVal);
    let curLabel;
    if (cur) curLabel = labelOf(cur[1]);
    else if (opts.placeholder) curLabel = opts.placeholder;
    else curLabel = items.length ? labelOf(items[0][1]) : '—';

    const optsHtml = items.map(([k, v]) => {
      const label = labelOf(v);
      const stack = typeof v === 'object' && v.stack ? v.stack : '';
      return `<div class="dd-opt${k === curVal ? ' active' : ''}" data-v="${this._esc(k)}" data-s="${this._esc(String(label).toLowerCase())}"${stack ? ` style="font-family:${stack}"` : ''}>${this._esc(label)}</div>`;
    }).join('');

    wrap.innerHTML = `<button type="button" class="dd-btn${cur ? '' : (opts.placeholder ? ' dd-btn-empty' : '')}">${this._esc(curLabel)}<span class="dd-arrow">▾</span></button>
      <div class="dd-menu${opts.search ? ' dd-menu-search' : ''}" hidden>
        ${opts.search ? `<div class="dd-search"><input type="text" class="dd-search-input" placeholder="${this._esc(this.t('search_placeholder'))}" /></div>` : ''}
        <div class="dd-opts">${optsHtml}</div>
        ${opts.search ? `<div class="dd-empty" hidden>${this._esc(this.t('no_result'))}</div>` : ''}
      </div>`;

    const btn = wrap.querySelector('.dd-btn');
    const menu = wrap.querySelector('.dd-menu');
    const input = wrap.querySelector('.dd-search-input');
    // Klik di dalam menu tidak menutup menu (penting untuk kotak cari)
    menu.onclick = (e) => e.stopPropagation();
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll('.dd-menu').forEach(m => { if (m !== menu) m.hidden = true; });
      menu.hidden = !menu.hidden;
      if (!menu.hidden && input) { input.value = ''; this._ddFilter(wrap, ''); input.focus(); }
    };
    if (input) input.oninput = () => this._ddFilter(wrap, input.value);
    wrap.querySelectorAll('.dd-opt').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        wrap.dataset.current = el.dataset.v;
        menu.hidden = true;
        // Perbarui label tombol + state aktif
        btn.classList.remove('dd-btn-empty');
        // firstChild = text node label; sisipkan kalau belum ada
        if (btn.firstChild && btn.firstChild.nodeType === 3) btn.firstChild.textContent = el.textContent;
        else btn.insertBefore(document.createTextNode(el.textContent), btn.firstChild);
        wrap.querySelectorAll('.dd-opt').forEach(o => o.classList.toggle('active', o === el));
        onChange(el.dataset.v);
      };
    });
    // Global outside close
    if (!App._ddOutsideBound) {
      App._ddOutsideBound = true;
      document.addEventListener('click', () => document.querySelectorAll('.dd-menu').forEach(m => m.hidden = true));
    }
  },
  _ddFilter(wrap, q) {
    const needle = String(q || '').trim().toLowerCase();
    let shown = 0;
    wrap.querySelectorAll('.dd-opt').forEach(el => {
      const hit = !needle || el.dataset.s.indexOf(needle) !== -1;
      el.hidden = !hit;
      if (hit) shown++;
    });
    const empty = wrap.querySelector('.dd-empty');
    if (empty) empty.hidden = shown > 0;
  },

  // ==========================================================================
  // UPLOAD PAGE
  // ==========================================================================
  _bindUploadPage() {
    document.getElementById('btnPickFile').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', (e) => { if (e.target.files[0]) this._handleFile(e.target.files[0]); });
    const dz = document.getElementById('dropzone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]); });
  },
  _resetUploadUi() {
    document.getElementById('filePreview').hidden = true;
    document.getElementById('uploadError').hidden = true;
    document.getElementById('uploadResult').hidden = true;
    document.getElementById('uploadActions').hidden = true;
    document.getElementById('fileInput').value = '';
    this._uploadCtx = null;
  },
  async _handleFile(file) {
    const preview = document.getElementById('filePreview');
    const err = document.getElementById('uploadError');
    const res = document.getElementById('uploadResult');
    const actions = document.getElementById('uploadActions');
    err.hidden = true; res.hidden = true; actions.hidden = true;
    preview.hidden = false;
    preview.innerHTML = `<div class="file-preview"><div class="file-preview-name">${this._esc(file.name)}</div><div class="file-preview-meta" id="upMsg">${this._esc(this.t('upload_processing'))}</div><div class="upload-progress"><div class="upload-progress-fill" id="upFill" style="width:5%"></div></div></div>`;
    try {
      const parsed = await UploadParser.parse(file, (msg, pct) => {
        const m = document.getElementById('upMsg'); if (m) m.textContent = msg;
        const f = document.getElementById('upFill'); if (f) f.style.width = pct + '%';
      });
      const isComplaint = parsed.kind === 'komplain';
      // Komplain: tidak perlu tanya duplikat dulu. Semua baris dikirim, server
      // yang melewati baris yang sudah ada, supaya data lain tetap masuk.
      const dup = isComplaint ? null
        : await Sheets.checkDuplicate(parsed.rows.map(r => ({ date: r.date, branch: r.branch })));
      this._uploadCtx = { parsed, dup };
      const meta = parsed.meta;
      const kindLabel = this.t(isComplaint ? 'upload_kind_complaint' : 'upload_kind_sales');
      const y1 = String(meta.dateStart || '').slice(0, 4);
      const y2 = String(meta.dateEnd || '').slice(0, 4);
      const showYear = y1 !== y2;
      const d1 = this._formatShort(meta.dateStart) + (showYear ? ' ' + y1 : '');
      const d2 = this._formatShort(meta.dateEnd) + (showYear ? ' ' + y2 : '');
      const bits = [
        d1 + (meta.dateStart !== meta.dateEnd ? ' – ' + d2 : ''),
        meta.branches.length + ' ' + this.t('stores_suffix'),
        meta.rowCount.toLocaleString(this._locale()) + (isComplaint ? ' ' + this.t('upload_complaints_suffix') : '')
      ];
      if (!isComplaint) bits.push(this._fmtRp(meta.totalSales));
      preview.innerHTML = `<div class="file-preview">
        <div class="file-preview-name">${this._esc(file.name)}</div>
        <div class="file-preview-kind">${this._esc(this.t('upload_detected', { k: kindLabel }))}</div>
        <div class="file-preview-meta">${bits.map(b => this._esc(b)).join(' · ')}</div>
        ${meta.skipped ? `<div class="file-preview-warn">${this._esc(this.t('upload_skipped_rows', { n: meta.skipped }))}</div>` : ''}
      </div>`;
      res.hidden = false;
      if (isComplaint) {
        res.innerHTML = `<div class="info-box"><b>${this._esc(this.t('upload_ready_complaint', { n: meta.rowCount.toLocaleString(this._locale()) }))}</b></div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" id="uCancel">${this._esc(this.t('cancel'))}</button><button class="btn btn-primary" id="btnUploadInner">${this._esc(this.t('upload_all'))}</button>`;
        document.getElementById('btnUploadInner').onclick = () => this._doUpload(false);
        const cc = document.getElementById('uCancel');
        if (cc) cc.onclick = () => this._resetUploadUi();
        return;
      }
      if (dup.duplicates === 0) {
        res.innerHTML = `<div class="info-box"><b>${this._esc(this.t('upload_all_new_msg', { n: dup.newOnes.toLocaleString(this._locale()) }))}</b></div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" id="uCancel">${this._esc(this.t('cancel'))}</button><button class="btn btn-primary" id="btnUploadInner">${this._esc(this.t('upload_all'))}</button>`;
        document.getElementById('btnUploadInner').onclick = () => this._doUpload(false);
      } else if (dup.newOnes === 0) {
        res.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">${this._esc(this.t('upload_all_dup_title'))}</div><div class="error-box-msg">${this._esc(this.t('upload_all_dup_msg', { n: dup.duplicates.toLocaleString(this._locale()) }))}</div></div></div>`;
        actions.innerHTML = '';   // buang tombol dari file sebelumnya
      } else {
        res.innerHTML = `<div class="warn-box"><b>${this._esc(this.t('upload_partial_title'))}</b><br>• ${this._esc(this.t('upload_partial_new', { n: dup.newOnes.toLocaleString(this._locale()) }))}<br>• ${this._esc(this.t('upload_partial_dup', { n: dup.duplicates.toLocaleString(this._locale()) }))}</div><div style="font-size:12px; color:var(--ink-2); margin-bottom:8px;">${this._esc(this.t('upload_which'))}</div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" id="uCancel">${this._esc(this.t('cancel'))}</button><button class="btn btn-primary" id="btnUploadInner">${this._esc(this.t('upload_new_only', { n: dup.newOnes }))}</button>`;
        document.getElementById('btnUploadInner').onclick = () => this._doUpload(true);
      }
      const c = document.getElementById('uCancel');
      if (c) c.onclick = () => this._resetUploadUi();
    } catch (e) {
      preview.hidden = true;
      err.hidden = false;
      err.innerHTML = this._errorBox(this.t('upload_fail_process'), e.message);
    }
  },

  // "Unknown action: xxx" = Apps Script masih versi lama -> beri petunjuk jelas
  _errorBox(title, msg) {
    const stale = /unknown action/i.test(String(msg || ''));
    return `<div class="error-box"><div class="error-box-icon">!</div><div>
      <div class="error-box-title">${this._esc(title)}</div>
      <div class="error-box-msg">${this._esc(msg)}</div>
      ${stale ? `<div class="error-box-hint">${this._esc(this.t('upload_redeploy_hint'))}</div>` : ''}
    </div></div>`;
  },
  async _doUpload(filterDupes) {
    if (!this._uploadCtx) return;
    const actions = document.getElementById('uploadActions');
    actions.querySelectorAll('button').forEach(b => b.disabled = true);
    const preview = document.getElementById('filePreview');
    const setStatus = (msg, pct) => {
      preview.innerHTML = `<div class="file-preview"><div class="file-preview-name">${this._esc(this._uploadCtx.parsed.meta.fileName)}</div><div class="file-preview-meta">${this._esc(msg)}</div><div class="upload-progress"><div class="upload-progress-fill" style="width:${pct}%"></div></div></div>`;
    };
    const isComplaint = this._uploadCtx.parsed.kind === 'komplain';
    try {
      let rows = this._uploadCtx.parsed.rows;
      if (filterDupes && !isComplaint) {
        setStatus(this.t('upload_filtering'), 10);
        const full = await Sheets.fetchAll();
        const existing = new Set(full.map(r => r.date + '|' + r.branch));
        rows = rows.filter(r => !existing.has(r.date + '|' + r.branch));
      }
      if (rows.length === 0) { setStatus(this.t('upload_no_new_row'), 100); setTimeout(() => this._resetUploadUi(), 1200); return; }
      // Komplain: server yang menyaring duplikat (pakai Case Id / kombinasi kolom),
      // jadi "upload semua" vs "upload yang baru" sama-sama aman.
      const CHUNK = isComplaint ? 200 : 500;
      let added = 0, skippedDup = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        setStatus(this.t('upload_progress', { a: Math.min(i + CHUNK, rows.length).toLocaleString(this._locale()), b: rows.length.toLocaleString(this._locale()) }), 10 + Math.round(i / rows.length * 85));
        const res = isComplaint ? await Sheets.uploadComplaints(slice) : await Sheets.upload(slice);
        added += (res && res.added) || 0;
        skippedDup += (res && res.skipped) || 0;
      }
      if (isComplaint) {
        const parts = [];
        if (added > 0) parts.push(this.t('upload_done_complaint', { n: added.toLocaleString(this._locale()) }));
        else parts.push(this.t('upload_none_added'));
        if (skippedDup > 0) parts.push(this.t('upload_dup_skipped', { n: skippedDup.toLocaleString(this._locale()) }));
        setStatus(parts.join(' '), 100);
      } else {
        setStatus(this.t('upload_done', { n: rows.length.toLocaleString(this._locale()) }), 100);
      }
      this._toast(this.t('upload_success'));
      Sheets.clearCache();
      setTimeout(() => this._resetUploadUi(), 1200);
      if (isComplaint) { this._cmpLoaded = false; await this.loadComplaints(false, true); }
      else await this.loadAll();
    } catch (e) {
      const err = document.getElementById('uploadError');
      err.hidden = false;
      err.innerHTML = this._errorBox(this.t('upload_fail_title'), e.message);
      actions.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  },

  // ==========================================================================
  // KEGIATAN & KOMPLAIN — shared helpers
  // ==========================================================================
  // Daftar toko untuk dropdown: dari sheet Regional, fallback ke data penjualan.
  _storeList() {
    let list = (this.activeBranches || []).slice();
    if (list.length === 0) list = Array.from(new Set(this.data.map(r => r.branch)));
    return list.filter(Boolean).sort((a, b) => this._short(a).localeCompare(this._short(b)));
  },
  _storeOptions(withAll) {
    const opts = {};
    if (withAll) opts[''] = this.t('all');
    this._storeList().forEach(b => { opts[b] = this._short(b); });
    return opts;
  },
  _activityType(key) {
    return CONFIG.ACTIVITY_TYPES.find(t => t.key === key) || null;
  },
  _typeColor(key) {
    const t = this._activityType(key);
    return t ? t.color : 'var(--ink-3)';
  },
  // dd/mm/yyyy — format daftar sesuai permintaan
  _formatDMY(s) {
    if (!s) return '';
    const [y, m, d] = String(s).split('-');
    if (!y || !m || !d) return String(s);
    return d + '/' + m + '/' + y;
  },
  _inRange(date, from, to) {
    if (from && (!date || date < from)) return false;
    if (to && (!date || date > to)) return false;
    return true;
  },
  _formErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
  },

  // ==========================================================================
  // KEGIATAN — page
  // ==========================================================================
  _bindActivityPage() {
    document.getElementById('btnActAdd').addEventListener('click', () => this._openActivityForm());
    document.getElementById('btnActCal').addEventListener('click', () => this._openActivityCalendar());
    document.getElementById('btnActReset').addEventListener('click', () => {
      this.actFilter = { from: '', to: '', name: '', store: '', type: '' };
      this._renderActivityPage();
    });
    document.getElementById('actRangeTrigger').addEventListener('click', () => {
      this._openRangePicker({
        from: this.actFilter.from, to: this.actFilter.to, allowClear: true,
        onApply: (from, to) => { this.actFilter.from = from; this.actFilter.to = to; this._renderActivityPage(); }
      });
    });
    document.getElementById('actFormSave').addEventListener('click', () => this._saveActivity());
    document.querySelectorAll('#actFormModal [data-close-modal], #actCalModal [data-close-modal], #actDayModal [data-close-modal]')
      .forEach(el => el.addEventListener('click', () => { el.closest('.modal').hidden = true; }));
    document.getElementById('btnActReload').addEventListener('click', () => this.loadActivities(false, true));
  },

  async loadActivities(useCacheFirst, force) {
    if (useCacheFirst) {
      const cached = Sheets.loadList(Sheets.CACHE_KEY_ACTIVITY);
      if (cached) { this.activities = cached; this._renderActivityPage(); }
    }
    if (this._actLoading) return;
    if (!force && this._actLoaded) return;
    this._actLoading = true;
    const list = document.getElementById('actList');
    if (!this.activities.length) list.innerHTML = `<div class="empty-note">${this._esc(this.t('loading'))}...</div>`;
    try {
      this.activities = await Sheets.fetchActivities();
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.activities);
      this._actLoaded = true;
      this._renderActivityPage();
    } catch (e) {
      this._toast(this.t('toast_load_failed', { msg: e.message }));
      if (!this.activities.length) list.innerHTML = `<div class="empty-note">${this._esc(e.message)}</div>`;
    } finally { this._actLoading = false; }
  },

  _renderActivityPage() {
    this._renderActivityFilters();
    this._renderActivityList();
  },

  _renderActivityFilters() {
    // Rentang tanggal
    const rl = document.getElementById('actRangeLabel');
    const f = this.actFilter;
    if (!f.from && !f.to) rl.textContent = this.t('all');
    else if (f.from && f.to) rl.textContent = this._formatDMY(f.from) + ' – ' + this._formatDMY(f.to);
    else rl.textContent = this._formatDMY(f.from || f.to);

    // Nama (dari data kegiatan)
    const names = Array.from(new Set(this.activities.map(a => a.name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    const nameOpts = { '': this.t('all') };
    names.forEach(n => { nameOpts[n] = n; });
    if (f.name && !nameOpts[f.name]) nameOpts[f.name] = f.name;
    this._initDropdown('actFName', nameOpts, f.name, (v) => { f.name = v; this._renderActivityList(); }, { search: true });

    // Toko: hanya toko yang punya kegiatan + opsi semua
    const stores = Array.from(new Set(this.activities.map(a => a.store).filter(Boolean)))
      .sort((a, b) => this._short(a).localeCompare(this._short(b)));
    const storeOpts = { '': this.t('all') };
    stores.forEach(b => { storeOpts[b] = this._short(b); });
    if (f.store && !storeOpts[f.store]) storeOpts[f.store] = this._short(f.store);
    this._initDropdown('actFStore', storeOpts, f.store, (v) => { f.store = v; this._renderActivityList(); }, { search: true });

    // Kegiatan
    const typeOpts = { '': this.t('all') };
    CONFIG.ACTIVITY_TYPES.forEach(t => { typeOpts[t.key] = this._loc(t.label); });
    this._initDropdown('actFType', typeOpts, f.type, (v) => { f.type = v; this._renderActivityList(); });
  },

  _filteredActivities() {
    const f = this.actFilter;
    return this.activities.filter(a => {
      if (!this._inRange(a.date, f.from, f.to)) return false;
      if (f.name && a.name !== f.name) return false;
      if (f.store && a.store !== f.store) return false;
      if (f.type && a.type !== f.type) return false;
      return true;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(a.name).localeCompare(String(b.name)));
  },

  _activityDetailText(a) {
    const type = this._activityType(a.type);
    if (!type) return [a.k1, a.k2].filter(Boolean).join(' · ');
    return type.fields
      .map(fl => ({ label: this._loc(fl.label), val: fl.slot === 'k1' ? a.k1 : a.k2 }))
      .filter(x => x.val !== '' && x.val != null)
      .map(x => x.label + ': ' + x.val)
      .join(' · ');
  },

  _renderActivityList() {
    const rows = this._filteredActivities();
    document.getElementById('actCount').textContent = this.t('act_count', { n: rows.length });
    const el = document.getElementById('actList');
    if (rows.length === 0) {
      el.innerHTML = `<div class="empty-note">${this._esc(this.t('act_none'))}</div>`;
      return;
    }
    el.innerHTML = rows.map(a => {
      const detail = this._activityDetailText(a);
      return `<div class="act-row">
        <div class="act-row-main">
          <span class="act-date">${this._esc(this._formatDMY(a.date))}</span>
          <span class="act-name">${this._esc(a.name)}</span>
          <span class="act-store">${this._esc(this._short(a.store))}</span>
          <span class="act-tag" style="background:${this._typeColor(a.type)}">${this._esc(a.type)}</span>
        </div>
        ${detail ? `<div class="act-row-detail">${this._esc(detail)}</div>` : ''}
      </div>`;
    }).join('');
  },

  // ==========================================================================
  // KEGIATAN — form tambah
  // ==========================================================================
  _openActivityForm() {
    this._actDraft = { name: '', date: this._toDateStr(new Date()), store: '', type: '', k1: '', k2: '' };
    document.getElementById('actFName').value = '';
    document.getElementById('actFDate').value = this._actDraft.date;
    this._formErr('actFormError', '');
    this._initDropdown('actFormStore', this._storeOptions(false), '', (v) => {
      this._actDraft.store = v; this._formErr('actFormError', '');
    }, { search: true, placeholder: this.t('act_pick_store') });
    const typeOpts = {};
    CONFIG.ACTIVITY_TYPES.forEach(t => { typeOpts[t.key] = this._loc(t.label); });
    this._initDropdown('actFormType', typeOpts, '', (v) => {
      this._actDraft.type = v;
      this._formErr('actFormError', '');
      this._renderActivityTypeFields();
    }, { placeholder: this.t('act_pick_type') });
    this._renderActivityTypeFields();
    ['actFName', 'actFDate'].forEach(id => {
      document.getElementById(id).oninput = () => this._formErr('actFormError', '');
    });
    document.getElementById('actFormSave').disabled = false;
    document.getElementById('actFormSave').textContent = this.t('save');
    document.getElementById('actFormModal').hidden = false;
  },

  _renderActivityTypeFields() {
    const wrap = document.getElementById('actFormDynamic');
    const type = this._activityType(this._actDraft.type);
    if (!type) { wrap.innerHTML = ''; return; }
    wrap.innerHTML = type.fields.map(fl => {
      const label = this._esc(this._loc(fl.label));
      const id = 'actDyn_' + fl.slot;
      if (fl.type === 'textarea') {
        return `<div class="form-row">
          <label for="${id}">${label}</label>
          <textarea id="${id}" class="form-input" rows="3" maxlength="${fl.max}" data-slot="${fl.slot}"></textarea>
          <div class="char-hint" id="${id}_hint">${this._esc(this.t('chars_left', { n: fl.max }))}</div>
        </div>`;
      }
      const inputType = fl.type === 'number' ? 'number' : 'text';
      const extra = fl.type === 'number' ? `min="0" step="1"` : `maxlength="${fl.max}"`;
      return `<div class="form-row">
        <label for="${id}">${label}</label>
        <input id="${id}" class="form-input" type="${inputType}" ${extra} data-slot="${fl.slot}" />
      </div>`;
    }).join('');
    // Sinkron ke draft + counter karakter
    wrap.querySelectorAll('[data-slot]').forEach(inp => {
      const slot = inp.dataset.slot;
      inp.value = this._actDraft[slot] || '';
      inp.addEventListener('input', () => {
        this._actDraft[slot] = inp.value;
        this._formErr('actFormError', '');
        const hint = document.getElementById(inp.id + '_hint');
        if (hint) hint.textContent = this.t('chars_left', { n: Math.max(0, inp.maxLength - inp.value.length) });
      });
    });
  },

  async _saveActivity() {
    const d = this._actDraft;
    d.name = document.getElementById('actFName').value.trim();
    d.date = document.getElementById('actFDate').value;
    if (!d.name)  return this._formErr('actFormError', this.t('act_err_name'));
    if (!d.date)  return this._formErr('actFormError', this.t('act_err_date'));
    if (!d.store) return this._formErr('actFormError', this.t('act_err_store'));
    if (!d.type)  return this._formErr('actFormError', this.t('act_err_type'));
    const type = this._activityType(d.type);
    for (const fl of type.fields) {
      const val = String(d[fl.slot] == null ? '' : d[fl.slot]).trim();
      if (!val) return this._formErr('actFormError', this.t('act_err_field', { f: this._loc(fl.label) }));
    }
    this._formErr('actFormError', '');
    const btn = document.getElementById('actFormSave');
    btn.disabled = true; btn.textContent = this.t('saving');
    const row = {
      date: d.date, name: d.name, store: d.store, type: d.type,
      k1: String(d.k1 || '').trim(), k2: String(d.k2 || '').trim()
    };
    try {
      await Sheets.addActivity(row);
      this.activities = this.activities.concat([row]);
      Sheets.saveList(Sheets.CACHE_KEY_ACTIVITY, this.activities);
      document.getElementById('actFormModal').hidden = true;
      this._toast(this.t('act_saved'));
      this._renderActivityPage();
      this.loadActivities(false, true);
    } catch (e) {
      this._formErr('actFormError', this.t('act_save_failed') + ': ' + e.message);
      btn.disabled = false; btn.textContent = this.t('save');
    }
  },

  // ==========================================================================
  // KEGIATAN — kalender
  // ==========================================================================
  _openActivityCalendar() {
    const anchor = (this.activities[0] && this.activities[0].date) || this._toDateStr(new Date());
    const today = new Date();
    this._actCalYear  = this._actCalYear  != null ? this._actCalYear  : today.getFullYear();
    this._actCalMonth = this._actCalMonth != null ? this._actCalMonth : today.getMonth();
    void anchor;
    this._renderActivityCalendar();
    document.getElementById('actCalModal').hidden = false;
  },

  // Index: 'yyyy-mm-dd' -> { FLD: [..], GCOM: [..], CX: [..] }
  _activityByDate() {
    const map = {};
    this.activities.forEach(a => {
      if (!a.date) return;
      (map[a.date] = map[a.date] || []).push(a);
    });
    return map;
  },

  _renderActivityCalendar() {
    const y = this._actCalYear, m = this._actCalMonth;
    const byDate = this._activityByDate();
    const monthNames = this.t('months_full');
    const dowNames = this.t('days_short');
    const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    let html = `<div class="cal-nav">
      <button class="cal-nav-btn" id="actCalPrev">‹</button>
      <div class="cal-title">${monthNames[m]} ${y}</div>
      <button class="cal-nav-btn" id="actCalNext">›</button>
    </div>
    <div class="acal"><div class="acal-head">${dowNames.map(n => `<div>${n}</div>`).join('')}</div><div class="acal-grid">`;
    for (let i = 0; i < startOffset; i++) html += '<div class="acal-cell empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const items = byDate[ds] || [];
      // Satu tag per kategori saja, walaupun kegiatannya banyak
      const kinds = CONFIG.ACTIVITY_TYPES.filter(t => items.some(a => a.type === t.key));
      const tags = kinds.map(t => `<span class="acal-tag" style="background:${t.color}">${this._esc(t.key)}</span>`).join('');
      html += `<div class="acal-cell${items.length ? ' has' : ''}" data-d="${ds}">
        <div class="acal-day">${d}</div>
        <div class="acal-tags">${tags}</div>
      </div>`;
    }
    html += '</div></div>';
    document.getElementById('actCalendar').innerHTML = html;

    document.getElementById('actCalLegend').innerHTML = CONFIG.ACTIVITY_TYPES
      .map(t => `<span class="acal-legend-item"><span class="acal-dot" style="background:${t.color}"></span>${this._esc(this._loc(t.label))}</span>`).join('');

    document.getElementById('actCalPrev').onclick = () => {
      if (--this._actCalMonth < 0) { this._actCalMonth = 11; this._actCalYear--; }
      this._renderActivityCalendar();
    };
    document.getElementById('actCalNext').onclick = () => {
      if (++this._actCalMonth > 11) { this._actCalMonth = 0; this._actCalYear++; }
      this._renderActivityCalendar();
    };
    document.querySelectorAll('#actCalendar .acal-cell.has').forEach(cell => {
      cell.onclick = () => this._openActivityDay(cell.dataset.d);
    });
  },

  _openActivityDay(ds) {
    const items = this.activities.filter(a => a.date === ds)
      .sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name)));
    document.getElementById('actDayTitle').textContent = this.t('act_day_title', { date: this._formatFull(ds) });
    const body = document.getElementById('actDayBody');
    if (items.length === 0) { body.innerHTML = `<div class="empty-note">${this._esc(this.t('no_data'))}</div>`; }
    else {
      body.innerHTML = items.map(a => {
        const detail = this._activityDetailText(a);
        return `<div class="act-row">
          <div class="act-row-main">
            <span class="act-tag" style="background:${this._typeColor(a.type)}">${this._esc(a.type)}</span>
            <span class="act-name">${this._esc(a.name)}</span>
            <span class="act-store">${this._esc(this._short(a.store))}</span>
          </div>
          ${detail ? `<div class="act-row-detail">${this._esc(detail)}</div>` : ''}
        </div>`;
      }).join('');
    }
    document.getElementById('actDayModal').hidden = false;
  },

  // ==========================================================================
  // KOMPLAIN
  // ==========================================================================
  _bindComplaintPage() {
    document.getElementById('btnCmpAdd').addEventListener('click', () => this._openComplaintForm());
    document.getElementById('btnCmpReset').addEventListener('click', () => {
      this.cmpFilter = { from: '', to: '', store: '', media: '', category: '' };
      this._renderComplaintPage();
    });
    document.getElementById('cmpRangeTrigger').addEventListener('click', () => {
      this._openRangePicker({
        from: this.cmpFilter.from, to: this.cmpFilter.to, allowClear: true,
        onApply: (from, to) => { this.cmpFilter.from = from; this.cmpFilter.to = to; this._renderComplaintPage(); }
      });
    });
    document.getElementById('cmpFormSave').addEventListener('click', () => this._saveComplaint());
    document.querySelectorAll('#cmpFormModal [data-close-modal], #cmpDetailModal [data-close-modal]')
      .forEach(el => el.addEventListener('click', () => { el.closest('.modal').hidden = true; }));
    document.getElementById('btnCmpReload').addEventListener('click', () => this.loadComplaints(false, true));
  },

  async loadComplaints(useCacheFirst, force) {
    if (useCacheFirst) {
      const cached = Sheets.loadList(Sheets.CACHE_KEY_COMPLAINT);
      if (cached) { this.complaints = cached; this._renderComplaintPage(); }
    }
    if (this._cmpLoading) return;
    if (!force && this._cmpLoaded) return;
    this._cmpLoading = true;
    const list = document.getElementById('cmpList');
    if (!this.complaints.length) list.innerHTML = `<div class="empty-note">${this._esc(this.t('loading'))}...</div>`;
    try {
      this.complaints = await Sheets.fetchComplaints();
      Sheets.saveList(Sheets.CACHE_KEY_COMPLAINT, this.complaints);
      this._cmpLoaded = true;
      this._renderComplaintPage();
    } catch (e) {
      this._toast(this.t('toast_load_failed', { msg: e.message }));
      if (!this.complaints.length) list.innerHTML = `<div class="empty-note">${this._esc(e.message)}</div>`;
    } finally { this._cmpLoading = false; }
  },

  _renderComplaintPage() {
    this._renderComplaintFilters();
    this._renderComplaintList();
  },

  _renderComplaintFilters() {
    const f = this.cmpFilter;
    const rl = document.getElementById('cmpRangeLabel');
    if (!f.from && !f.to) rl.textContent = this.t('all');
    else if (f.from && f.to) rl.textContent = this._formatDMY(f.from) + ' – ' + this._formatDMY(f.to);
    else rl.textContent = this._formatDMY(f.from || f.to);

    const stores = Array.from(new Set(this.complaints.map(c => c.store).filter(Boolean)))
      .sort((a, b) => this._short(a).localeCompare(this._short(b)));
    const storeOpts = { '': this.t('all') };
    stores.forEach(b => { storeOpts[b] = this._short(b); });
    if (f.store && !storeOpts[f.store]) storeOpts[f.store] = this._short(f.store);
    this._initDropdown('cmpFStore', storeOpts, f.store, (v) => { f.store = v; this._renderComplaintList(); }, { search: true });

    const mediaOpts = { '': this.t('all') };
    CONFIG.COMPLAINT_MEDIA.forEach(m => { mediaOpts[m] = m; });
    if (f.media && !mediaOpts[f.media]) mediaOpts[f.media] = f.media;
    this._initDropdown('cmpFMedia', mediaOpts, f.media, (v) => { f.media = v; this._renderComplaintList(); });

    const catOpts = { '': this.t('all') };
    CONFIG.COMPLAINT_CATEGORIES.forEach(c => { catOpts[c] = c; });
    if (f.category && !catOpts[f.category]) catOpts[f.category] = f.category;
    this._initDropdown('cmpFCategory', catOpts, f.category, (v) => { f.category = v; this._renderComplaintList(); });
  },

  _filteredComplaints() {
    const f = this.cmpFilter;
    return this.complaints.filter(c => {
      if (!this._inRange(c.trxDate, f.from, f.to)) return false;
      if (f.store && c.store !== f.store) return false;
      if (f.media && c.media !== f.media) return false;
      if (f.category && c.category !== f.category) return false;
      return true;
    }).sort((a, b) => (b.trxDate || '').localeCompare(a.trxDate || ''));
  },

  _renderComplaintList() {
    const rows = this._filteredComplaints();
    document.getElementById('cmpCount').textContent = this.t('cmp_count', { n: rows.length });
    const el = document.getElementById('cmpList');
    if (rows.length === 0) {
      el.innerHTML = `<div class="empty-note">${this._esc(this.t('cmp_none'))}</div>`;
      return;
    }
    this._cmpVisible = rows;
    el.innerHTML = rows.map((c, i) => `<div class="act-row cmp-row" data-i="${i}">
      <div class="act-row-main">
        <span class="act-date">${this._esc(this._formatDMY(c.trxDate))}</span>
        <span class="act-name">${this._esc(c.name)}</span>
        <span class="act-store">${this._esc(this._short(c.store))}</span>
        <span class="act-tag act-tag-soft">${this._esc(c.category)}</span>
      </div>
      <div class="act-row-detail">${this._esc(c.media)}${c.body ? ' · ' + this._esc(c.body.slice(0, 90)) + (c.body.length > 90 ? '…' : '') : ''}</div>
    </div>`).join('');
    el.querySelectorAll('.cmp-row').forEach(row => {
      row.addEventListener('click', () => this._openComplaintDetail(this._cmpVisible[Number(row.dataset.i)]));
    });
  },

  _openComplaintDetail(c) {
    if (!c) return;
    document.getElementById('cmpDetailTitle').textContent = c.name || this.t('detail');
    const rows = [
      [this.t('cmp_name'), c.name],
      [this.t('cmp_contact'), c.contact],
      [this.t('cmp_address'), c.address],
      [this.t('cmp_store'), this._short(c.store)],
      [this.t('cmp_media'), c.media],
      [this.t('cmp_category'), c.category],
      [this.t('cmp_trx_date'), this._formatDMY(c.trxDate)],
      [this.t('cmp_body'), c.body]
    ];
    document.getElementById('cmpDetailBody').innerHTML = '<div class="detail-list">' + rows.map(([k, v]) =>
      `<div class="detail-row detail-row-stack">
        <div class="detail-label">${this._esc(k)}</div>
        <div class="detail-text">${this._esc(v || '—')}</div>
      </div>`).join('') + '</div>';
    document.getElementById('cmpDetailModal').hidden = false;
  },

  _openComplaintForm() {
    const L = CONFIG.COMPLAINT_LIMITS;
    this._cmpDraft = { store: '', media: '', category: '' };
    ['cmpFormName', 'cmpFormContact', 'cmpFormAddress', 'cmpFormBody'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cmpFormName').maxLength = L.nama;
    document.getElementById('cmpFormContact').maxLength = L.kontak;
    document.getElementById('cmpFormAddress').maxLength = L.alamat;
    document.getElementById('cmpFormBody').maxLength = L.isi;
    document.getElementById('cmpFormDate').value = this._toDateStr(new Date());
    this._formErr('cmpFormError', '');

    const clearErr = () => this._formErr('cmpFormError', '');
    this._initDropdown('cmpFormStore', this._storeOptions(false), '', (v) => {
      this._cmpDraft.store = v; clearErr();
    }, { search: true, placeholder: this.t('cmp_store') });
    const mediaOpts = {};
    CONFIG.COMPLAINT_MEDIA.forEach(m => { mediaOpts[m] = m; });
    this._initDropdown('cmpFormMedia', mediaOpts, '', (v) => { this._cmpDraft.media = v; clearErr(); }, { placeholder: this.t('cmp_pick_media') });
    const catOpts = {};
    CONFIG.COMPLAINT_CATEGORIES.forEach(c => { catOpts[c] = c; });
    this._initDropdown('cmpFormCategory', catOpts, '', (v) => { this._cmpDraft.category = v; clearErr(); }, { placeholder: this.t('cmp_pick_category') });
    ['cmpFormName', 'cmpFormContact', 'cmpFormAddress', 'cmpFormDate', 'cmpFormBody'].forEach(id => {
      document.getElementById(id).oninput = clearErr;
    });

    const save = document.getElementById('cmpFormSave');
    save.disabled = false; save.textContent = this.t('save');
    document.getElementById('cmpFormModal').hidden = false;
  },

  async _saveComplaint() {
    const d = this._cmpDraft;
    const row = {
      name:     document.getElementById('cmpFormName').value.trim(),
      contact:  document.getElementById('cmpFormContact').value.trim(),
      address:  document.getElementById('cmpFormAddress').value.trim(),
      store:    d.store,
      media:    d.media,
      category: d.category,
      trxDate:  document.getElementById('cmpFormDate').value,
      body:     document.getElementById('cmpFormBody').value.trim()
    };
    if (!row.name)     return this._formErr('cmpFormError', this.t('cmp_err_name'));
    if (!row.store)    return this._formErr('cmpFormError', this.t('cmp_err_store'));
    if (!row.media)    return this._formErr('cmpFormError', this.t('cmp_err_media'));
    if (!row.category) return this._formErr('cmpFormError', this.t('cmp_err_category'));
    if (!row.trxDate)  return this._formErr('cmpFormError', this.t('cmp_err_date'));
    if (!row.body)     return this._formErr('cmpFormError', this.t('cmp_err_body'));
    this._formErr('cmpFormError', '');
    const btn = document.getElementById('cmpFormSave');
    btn.disabled = true; btn.textContent = this.t('saving');
    try {
      await Sheets.addComplaint(row);
      this.complaints = this.complaints.concat([row]);
      Sheets.saveList(Sheets.CACHE_KEY_COMPLAINT, this.complaints);
      document.getElementById('cmpFormModal').hidden = true;
      this._toast(this.t('cmp_saved'));
      this._renderComplaintPage();
      this.loadComplaints(false, true);
    } catch (e) {
      this._formErr('cmpFormError', this.t('cmp_save_failed') + ': ' + e.message);
      btn.disabled = false; btn.textContent = this.t('save');
    }
  },

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  _renderRank(items, isBranch) {
    if (items.length === 0) return `<div class="empty-note">—</div>`;
    return items.map((it, i) => `<div class="rank-row" data-key="${this._esc(it.key)}">
      <div class="rank-left"><span class="rank-num">${i + 1}</span><span class="rank-name">${this._esc(isBranch ? this._short(it.key) : it.key)}</span></div>
      <span class="rank-amount">${this._fmtRp(it.val)}</span>
    </div>`).join('');
  },
  _fmtRp(v) {
    if (v == null || isNaN(v)) return 'Rp 0';
    if (this.moneyFormat === 'full') return 'Rp ' + Math.round(v).toLocaleString(this._locale());
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    const dec = this.lang === 'en' ? '.' : ',';
    const suffixes = this.lang === 'en'
      ? { b: ' B', m: ' M', k: ' K' }
      : { b: ' M', m: ' JT', k: ' Rb' };
    if (abs >= 1e9) return sign + 'Rp ' + (abs / 1e9).toFixed(2).replace('.', dec) + suffixes.b;
    if (abs >= 1e6) return sign + 'Rp ' + Math.round(abs / 1e6).toLocaleString(this._locale()) + suffixes.m;
    if (abs >= 1e3) return sign + 'Rp ' + Math.round(abs / 1e3).toLocaleString(this._locale()) + suffixes.k;
    return sign + 'Rp ' + Math.round(abs);
  },
  _fmtShort(v) {
    const dec = this.lang === 'en' ? '.' : ',';
    if (v >= 1e9) return (v / 1e9).toFixed(1).replace('.', dec) + (this.lang === 'en' ? 'B' : 'M');
    if (v >= 1e6) return Math.round(v / 1e6) + (this.lang === 'en' ? 'M' : 'jt');
    if (v >= 1e3) return Math.round(v / 1e3) + (this.lang === 'en' ? 'K' : 'rb');
    return v;
  },
  _locale() { return this.lang === 'en' ? 'en-US' : 'id-ID'; },
  _toDateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _formatShort(s) {
    if (!s) return '';
    const [, m, d] = s.split('-');
    const months = this.t('months_short');
    return parseInt(d) + ' ' + months[parseInt(m) - 1];
  },
  _formatFull(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = this.t('months_full');
    return parseInt(d) + ' ' + months[parseInt(m) - 1] + ' ' + y;
  },
  _loc(labelObj) {
    if (labelObj == null) return '';
    if (typeof labelObj === 'string') return labelObj;
    return labelObj[this.lang] || labelObj.id || labelObj.en || '';
  },
  _short(b) { const m = String(b || '').match(/^[^-]+-\s*(.+)$/); return m ? m[1].trim() : String(b || ''); },
  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); },
  _hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(bigint >> 16) & 255},${(bigint >> 8) & 255},${bigint & 255},${alpha})`;
  },
  _splash(msg) {
    const s = document.getElementById('splash');
    s.classList.remove('hidden');
    if (msg) {
      // Override with error msg (no dots animation while error shown)
      s.querySelector('.splash-sub').innerHTML = this._esc(msg);
    }
  },
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
