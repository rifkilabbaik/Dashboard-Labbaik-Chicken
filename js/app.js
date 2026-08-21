// ============================================================================
// SALES DASHBOARD v7 — i18n (id/en), palettes, revamped dashboard/sales,
// trend tabs (daily/weekly/monthly) + compare-vs-prev-month
// ============================================================================

const App = {
  data: [], regional: [], status: null,
  branchMeta: {}, activeBranches: [], areaToRegional: {}, regionalToAreas: {},

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
    const titleMap = { dashboard: this.t('nav_dashboard'), sales: this.t('nav_sales'), upload: this.t('nav_upload'), settings: this.t('nav_settings') };
    document.getElementById('pageTitle').textContent = titleMap[page] || '';
    document.getElementById('btnFilter').style.display = (page === 'settings' || page === 'upload') ? 'none' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'sales') this._renderSales();
    if (page === 'upload') this._resetUploadUi();
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

  // Default = bulan berjalan
  _setDefaultRange() {
    let now;
    const latest = this._latestDate();
    if (latest) {
      const [ly, lm, ld] = latest.split('-').map(Number);
      now = new Date(ly, lm - 1, ld);
    } else now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = now;
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

  // Range picker
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
    modal.querySelectorAll('[data-close-modal]').forEach(el => el.onclick = () => modal.hidden = true);
    document.getElementById('rangeOk').onclick = () => {
      if (this._rangeFrom && this._rangeTo) {
        if (this._rangeFrom > this._rangeTo) { const t = this._rangeFrom; this._rangeFrom = this._rangeTo; this._rangeTo = t; }
        document.getElementById('fFrom').value = this._rangeFrom;
        document.getElementById('fTo').value = this._rangeTo;
        this._updateRangeLabel();
        this._updateCancelResetBtn();
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
      // If range still using default (bulan berjalan), re-anchor to latest data
      if (this.applied && this.applied.from) {
        // keep applied unless empty
      } else {
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
      gEl.textContent = (gr >= 0 ? '+' : '') + gr.toFixed(1) + '% ' + this.t('vs_prev_month');
      gEl.style.color = gr >= 0 ? 'var(--success)' : 'var(--danger)';
    }
    document.querySelector('#mcTotal .metric-hero-hint').textContent = this.t('click_for_detail');

    this._renderMetricGroups();
    this._renderRegionalList();
    this._renderAreaList();

    // Active trend tab reflection
    document.querySelectorAll('.trend-tab').forEach(b => b.classList.toggle('active', b.dataset.trend === this.trendView));
    this._renderTrend();

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
    this._drawTrend(t.labels, t.values, t.dates);
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
    // monthly: 12 months of currentYear (or previous year if isPrev)
    const year = new Date().getFullYear() - (isPrev ? 1 : 0);
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

  _drawTrend(labels, values, dates) {
    const ctx = document.getElementById('dTrendChart').getContext('2d');
    if (this.charts.trend) this.charts.trend.destroy();
    const cs = getComputedStyle(document.documentElement);
    const seaColor = cs.getPropertyValue('--sea').trim() || '#4A90B8';
    const inkColor = cs.getPropertyValue('--ink-3').trim() || '#8A93A0';
    const gridColor = cs.getPropertyValue('--line').trim() || '#E8E2D3';
    const maxV = Math.max.apply(null, values.length ? values : [0]);
    this.charts.trend = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ data: values, borderColor: seaColor, backgroundColor: this._hexToRgba(seaColor, 0.1), borderWidth: 2, fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: seaColor }] },
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
    setTimeout(() => this._drawTrendCompare(labels, cur.values, prevValues), 30);
  },

  _drawTrendCompare(labels, cur, prev) {
    const ctx = document.getElementById('trendCompareChart').getContext('2d');
    if (this.charts.compare) this.charts.compare.destroy();
    const cs = getComputedStyle(document.documentElement);
    const seaColor = cs.getPropertyValue('--sea').trim() || '#4A90B8';
    const accent2 = cs.getPropertyValue('--accent-2').trim() || seaColor;
    const inkColor = cs.getPropertyValue('--ink-3').trim() || '#8A93A0';
    const gridColor = cs.getPropertyValue('--line').trim() || '#E8E2D3';
    const maxV = Math.max.apply(null, [...cur, ...prev, 0]);
    this.charts.compare = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: this.t('trend_current'), data: cur, borderColor: seaColor, backgroundColor: this._hexToRgba(seaColor, 0.1), borderWidth: 2, tension: 0.3, pointRadius: 2, pointHoverRadius: 5, fill: false },
          { label: this.t('trend_prev'),    data: prev, borderColor: accent2, backgroundColor: this._hexToRgba(accent2, 0.08), borderWidth: 2, tension: 0.3, pointRadius: 2, pointHoverRadius: 5, borderDash: [4, 4], fill: false }
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
        html += `<td class="ta-r"><span class="rp-num">${this._fmtRp(v)}</span></td>`;
      });
      html += `<td class="ta-r"><b><span class="rp-num">${this._fmtRp(r.total)}</span></b></td>`;
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
      const titleMap = { dashboard: this.t('nav_dashboard'), sales: this.t('nav_sales'), upload: this.t('nav_upload'), settings: this.t('nav_settings') };
      document.getElementById('pageTitle').textContent = titleMap[this.currentPage] || '';
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
  _initDropdown(key, options, current, onChange) {
    const wrap = document.querySelector(`.dropdown-select[data-key="${key}"]`);
    if (!wrap) return;
    wrap.dataset.current = current == null ? '' : current;
    wrap._options = options; wrap._onChange = onChange;
    const items = Object.entries(options);
    const cur = items.find(([k]) => k === (current == null ? '' : String(current)));
    const curLabel = cur ? (typeof cur[1] === 'string' ? cur[1] : cur[1].label) : (Object.values(options)[0] && (typeof Object.values(options)[0] === 'string' ? Object.values(options)[0] : Object.values(options)[0].label)) || '—';
    wrap.innerHTML = `<button type="button" class="dd-btn">${this._esc(curLabel)}<span class="dd-arrow">▾</span></button>
      <div class="dd-menu" hidden>
        ${items.map(([k, v]) => {
          const label = typeof v === 'string' ? v : v.label;
          const stack = typeof v === 'object' && v.stack ? v.stack : '';
          return `<div class="dd-opt${k === (current == null ? '' : String(current)) ? ' active' : ''}" data-v="${this._esc(k)}"${stack ? ` style="font-family:${stack}"` : ''}>${this._esc(label)}</div>`;
        }).join('')}
      </div>`;
    const btn = wrap.querySelector('.dd-btn');
    const menu = wrap.querySelector('.dd-menu');
    btn.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.dd-menu').forEach(m => { if (m !== menu) m.hidden = true; }); menu.hidden = !menu.hidden; };
    wrap.querySelectorAll('.dd-opt').forEach(el => {
      el.onclick = (e) => { e.stopPropagation(); wrap.dataset.current = el.dataset.v; menu.hidden = true; onChange(el.dataset.v); };
    });
    // Global outside close
    if (!App._ddOutsideBound) {
      App._ddOutsideBound = true;
      document.addEventListener('click', () => document.querySelectorAll('.dd-menu').forEach(m => m.hidden = true));
    }
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
      const pairs = parsed.rows.map(r => ({ date: r.date, branch: r.branch }));
      const dup = await Sheets.checkDuplicate(pairs);
      this._uploadCtx = { parsed, dup };
      const meta = parsed.meta;
      preview.innerHTML = `<div class="file-preview">
        <div class="file-preview-name">${this._esc(file.name)}</div>
        <div class="file-preview-meta">${this._formatShort(meta.dateStart)}${meta.dateStart !== meta.dateEnd ? ' – ' + this._formatShort(meta.dateEnd) : ''} · ${meta.branches.length} ${this.t('stores_suffix')} · ${meta.rowCount.toLocaleString(this._locale())} · ${this._fmtRp(meta.totalSales)}</div>
      </div>`;
      res.hidden = false;
      if (dup.duplicates === 0) {
        res.innerHTML = `<div class="info-box"><b>${this._esc(this.t('upload_all_new_msg', { n: dup.newOnes.toLocaleString(this._locale()) }))}</b></div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" id="uCancel">${this._esc(this.t('cancel'))}</button><button class="btn btn-primary" id="btnUploadInner">${this._esc(this.t('upload_all'))}</button>`;
        document.getElementById('btnUploadInner').onclick = () => this._doUpload(false);
      } else if (dup.newOnes === 0) {
        res.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">${this._esc(this.t('upload_all_dup_title'))}</div><div class="error-box-msg">${this._esc(this.t('upload_all_dup_msg', { n: dup.duplicates.toLocaleString(this._locale()) }))}</div></div></div>`;
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
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">${this._esc(this.t('upload_fail_process'))}</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
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
        setStatus(this.t('upload_filtering'), 10);
        const full = await Sheets.fetchAll();
        const existing = new Set(full.map(r => r.date + '|' + r.branch));
        rows = rows.filter(r => !existing.has(r.date + '|' + r.branch));
      }
      if (rows.length === 0) { setStatus(this.t('upload_no_new_row'), 100); setTimeout(() => this._resetUploadUi(), 1200); return; }
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        setStatus(this.t('upload_progress', { a: Math.min(i + CHUNK, rows.length).toLocaleString(this._locale()), b: rows.length.toLocaleString(this._locale()) }), 10 + Math.round(i / rows.length * 85));
        await Sheets.upload(slice);
      }
      setStatus(this.t('upload_done', { n: rows.length.toLocaleString(this._locale()) }), 100);
      this._toast(this.t('upload_success'));
      Sheets.clearCache();
      setTimeout(() => this._resetUploadUi(), 1200);
      await this.loadAll();
    } catch (e) {
      const err = document.getElementById('uploadError');
      err.hidden = false;
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">${this._esc(this.t('upload_fail_title'))}</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
      actions.querySelectorAll('button').forEach(b => b.disabled = false);
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
