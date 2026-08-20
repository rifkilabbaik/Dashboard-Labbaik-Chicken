// ============================================================================
// SALES DASHBOARD v4 — APLIKASI UTAMA
// ============================================================================

const App = {
  // === STATE ===
  bills: [],       // {bill, date, time, branch, purpose, total, items}
  menuData: [],    // {date, branch, category, subCategory, menu, qty, subtotal}
  regional: [],    // {regional, area, branch}
  status: null,    // {lastDate, billCount, totalCells, cellLimit, usage, level}

  branchMeta: {},         // branch -> {regional, area}
  activeBranches: [],
  areaToRegional: {},
  regionalToAreas: {},

  // Filter (belum di-apply sampai user klik OK)
  filter: {
    periode: 'current', from: '', to: '',
    regional: '', area: '', branch: '', purpose: ''
  },
  filterTemp: null, // saat modal terbuka

  // Filter yang sudah di-apply → dipakai untuk render semua halaman
  applied: null,

  // Cache filtered
  fBills: [],
  fMenu: [],

  // Chart instances
  charts: {},

  // Settings
  moneyFormat: 'auto',
  theme: 'auto',

  // Top/Low state (per-user)
  topGroup: 'branch', topCount: 5,
  lowGroup: 'branch', lowCount: 5,

  // Menu tab
  menuTab: 'revenue',

  // Current page
  currentPage: 'dashboard',

  // ============================================================================
  // INIT
  // ============================================================================
  async init() {
    this._loadSettings();
    this._applyTheme();
    this._bindSidebar();
    this._bindTopbar();
    this._bindFilterModal();
    this._bindUploadModal();
    this._bindSettingsPage();
    this._bindMenuTabs();

    // Set default periode
    this._setPeriodePreset('current');
    this._captureFilterFromModal(); // simpan default filter
    this.applied = { ...this.filter };

    await this.loadAll();
  },

  _loadSettings() {
    this.moneyFormat = localStorage.getItem('moneyFormat') || 'auto';
    if (!['auto', 'full'].includes(this.moneyFormat)) this.moneyFormat = 'auto';
    this.theme = localStorage.getItem('theme') || 'auto';
    if (!['auto', 'light', 'dark'].includes(this.theme)) this.theme = 'auto';
    this.topGroup = localStorage.getItem('topGroup') || 'branch';
    this.lowGroup = localStorage.getItem('lowGroup') || 'branch';
    this.topCount = parseInt(localStorage.getItem('topCount')) || 5;
    this.lowCount = parseInt(localStorage.getItem('lowCount')) || 5;
  },

  _saveSetting(k, v) { localStorage.setItem(k, v); },

  _applyTheme() {
    const root = document.documentElement;
    if (this.theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this.theme);
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const isDark = this.theme === 'dark' ||
        (this.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.content = isDark ? '#1A1D21' : '#F7F4EC';
    }
  },

  // ============================================================================
  // SIDEBAR & NAV
  // ============================================================================
  _bindSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    const open = () => { sidebar.classList.add('open'); backdrop.classList.add('open'); };
    const close = () => { sidebar.classList.remove('open'); backdrop.classList.remove('open'); };
    document.getElementById('btnMenu').addEventListener('click', open);
    document.getElementById('sidebarClose').addEventListener('click', close);
    backdrop.addEventListener('click', close);

    document.querySelectorAll('.sidebar-item').forEach(btn => {
      btn.addEventListener('click', () => {
        this._goToPage(btn.dataset.page);
        close();
      });
    });
    document.getElementById('sidebarUpload').addEventListener('click', () => {
      close();
      this._openUpload();
    });
  },

  _goToPage(page) {
    this.currentPage = page;
    document.querySelectorAll('.sidebar-item').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.dataset.page === page);
    });
    const titles = { dashboard: 'Dasbor', sales: 'Penjualan', menu: 'Menu', settings: 'Pengaturan' };
    document.getElementById('pageTitle').textContent = titles[page] || '';
    // Hide filter button on settings page
    document.getElementById('btnFilter').style.display = page === 'settings' ? 'none' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _bindTopbar() {
    document.getElementById('btnFilter').addEventListener('click', () => this._openFilterModal());
  },

  // ============================================================================
  // FILTER MODAL
  // ============================================================================
  _bindFilterModal() {
    const modal = document.getElementById('filterModal');
    modal.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => this._closeFilterModal());
    });
    document.getElementById('filterOk').addEventListener('click', () => this._applyFilterAndClose());
    document.getElementById('filterReset').addEventListener('click', () => this._resetFilter());

    // Periode → sync dates
    document.getElementById('fPeriode').addEventListener('change', (e) => {
      this._setPeriodePreset(e.target.value);
    });
    // Date → set periode to custom
    document.getElementById('fFrom').addEventListener('change', () => {
      document.getElementById('fPeriode').value = 'custom';
    });
    document.getElementById('fTo').addEventListener('change', () => {
      document.getElementById('fPeriode').value = 'custom';
    });
    // Cascading regional → area → branch
    document.getElementById('fRegional').addEventListener('change', () => this._onFilterRegionalChange());
    document.getElementById('fArea').addEventListener('change', () => this._onFilterAreaChange());
    document.getElementById('fBranch').addEventListener('change', () => this._onFilterBranchChange());
  },

  _openFilterModal() {
    // Populate options
    this._populateFilterOptions();
    // Load current filter into modal
    document.getElementById('fPeriode').value = this.filter.periode;
    document.getElementById('fFrom').value = this.filter.from;
    document.getElementById('fTo').value = this.filter.to;
    document.getElementById('fRegional').value = this.filter.regional;
    this._onFilterRegionalChange(true);
    document.getElementById('fArea').value = this.filter.area;
    this._onFilterAreaChange(true);
    document.getElementById('fBranch').value = this.filter.branch;
    document.getElementById('fPurpose').value = this.filter.purpose;
    document.getElementById('filterModal').hidden = false;
  },

  _closeFilterModal() {
    document.getElementById('filterModal').hidden = true;
  },

  _populateFilterOptions() {
    // Regional
    const regs = Array.from(new Set(this.regional.map(r => r.regional))).sort();
    document.getElementById('fRegional').innerHTML =
      '<option value="">Semua Regional</option>' +
      regs.map(r => `<option value="${this._esc(r)}">${this._esc(r)}</option>`).join('');
    // Purpose
    const purposes = Array.from(new Set(this.bills.map(b => b.purpose).filter(Boolean))).sort();
    document.getElementById('fPurpose').innerHTML =
      '<option value="">Semua purpose</option>' +
      purposes.map(p => `<option value="${this._esc(p)}">${this._esc(p)}</option>`).join('');
  },

  _onFilterRegionalChange(silent) {
    const reg = document.getElementById('fRegional').value;
    // Filter areas
    let areas;
    if (reg) areas = Array.from(new Set(this.regional.filter(r => r.regional === reg).map(r => r.area))).sort();
    else areas = Array.from(new Set(this.regional.map(r => r.area))).sort();
    const areaSel = document.getElementById('fArea');
    const currentArea = areaSel.value;
    areaSel.innerHTML = '<option value="">Semua Area</option>' +
      areas.map(a => `<option value="${this._esc(a)}">${this._esc(a)}</option>`).join('');
    // Preserve selection if still valid
    if (!silent) {
      if (areas.includes(currentArea)) areaSel.value = currentArea;
      else areaSel.value = '';
    }
    this._onFilterAreaChange(silent);
  },

  _onFilterAreaChange(silent) {
    const reg = document.getElementById('fRegional').value;
    const area = document.getElementById('fArea').value;
    // If area picked, auto-set regional
    if (!silent && area && !reg) {
      const parentReg = (this.regional.find(r => r.area === area) || {}).regional;
      if (parentReg) {
        document.getElementById('fRegional').value = parentReg;
      }
    }
    // Filter branches
    let branches;
    const currentReg = document.getElementById('fRegional').value;
    branches = this.regional
      .filter(r => !currentReg || r.regional === currentReg)
      .filter(r => !area || r.area === area)
      .map(r => r.branch);
    branches = Array.from(new Set(branches)).sort();
    const brSel = document.getElementById('fBranch');
    const currentBranch = brSel.value;
    brSel.innerHTML = '<option value="">Semua toko</option>' +
      branches.map(b => `<option value="${this._esc(b)}">${this._esc(this._shortBranch(b))}</option>`).join('');
    if (!silent) {
      if (branches.includes(currentBranch)) brSel.value = currentBranch;
      else brSel.value = '';
    }
  },

  _onFilterBranchChange() {
    const branch = document.getElementById('fBranch').value;
    if (branch && this.branchMeta[branch]) {
      const meta = this.branchMeta[branch];
      document.getElementById('fRegional').value = meta.regional;
      document.getElementById('fArea').value = meta.area;
      // Re-populate area to be consistent
    }
  },

  _setPeriodePreset(mode) {
    const now = new Date();
    let from, to = now;
    if (mode === 'current') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (mode === 'last') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (mode === 'last7') { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (mode === 'last30') { from = new Date(now); from.setDate(from.getDate() - 29); }
    else return;
    document.getElementById('fFrom').value = this._toDateStr(from);
    document.getElementById('fTo').value = this._toDateStr(to);
  },

  _captureFilterFromModal() {
    this.filter = {
      periode: document.getElementById('fPeriode').value,
      from: document.getElementById('fFrom').value,
      to: document.getElementById('fTo').value,
      regional: document.getElementById('fRegional').value,
      area: document.getElementById('fArea').value,
      branch: document.getElementById('fBranch').value,
      purpose: document.getElementById('fPurpose').value
    };
  },

  async _applyFilterAndClose() {
    this._captureFilterFromModal();
    this.applied = { ...this.filter };
    this._closeFilterModal();
    // Fetch ulang bills & menu untuk range tanggal baru
    await this._fetchDataForRange();
    this._computeFiltered();
    this._renderAll();
    this._updateFilterSummary();
  },

  _resetFilter() {
    document.getElementById('fPeriode').value = 'current';
    this._setPeriodePreset('current');
    document.getElementById('fRegional').value = '';
    document.getElementById('fArea').value = '';
    document.getElementById('fBranch').value = '';
    document.getElementById('fPurpose').value = '';
    this._onFilterRegionalChange();
  },

  _updateFilterSummary() {
    const parts = [];
    if (this.applied.regional) parts.push(this.applied.regional);
    if (this.applied.area) parts.push(this.applied.area);
    if (this.applied.branch) parts.push(this._shortBranch(this.applied.branch));
    if (this.applied.purpose) parts.push(this.applied.purpose);
    const bar = document.getElementById('filterSummary');
    const countEl = document.getElementById('filterCount');
    if (parts.length > 0) {
      bar.hidden = false;
      bar.innerHTML = `<span><b>${parts.length} filter aktif:</b> ${parts.map(p => this._esc(p)).join(' · ')}</span><span class="reset" id="filterQuickReset">Reset</span>`;
      document.getElementById('filterQuickReset').addEventListener('click', () => {
        this._resetFilter();
        this._captureFilterFromModal();
        this.applied = { ...this.filter };
        this._fetchDataForRange().then(() => {
          this._computeFiltered();
          this._renderAll();
          this._updateFilterSummary();
        });
      });
      countEl.hidden = false;
      countEl.textContent = parts.length;
    } else {
      bar.hidden = true;
      countEl.hidden = true;
    }
  },

  // ============================================================================
  // LOAD DATA
  // ============================================================================
  async loadAll() {
    this._splash('Memuat data dari Google Sheets...');
    try {
      const [regional, status] = await Promise.all([
        Sheets.fetchRegional().catch(() => []),
        Sheets.status().catch(() => null)
      ]);
      this.regional = regional;
      this.status = status;
      this._buildBranchMeta();
      await this._fetchDataForRange();
      this._computeFiltered();
      this._populateFilterOptions();
      this._renderAll();
      this._splashHide();
    } catch (e) {
      this._splash('Gagal: ' + e.message);
    }
  },

  async _fetchDataForRange() {
    const { from, to } = this.applied;
    if (!from || !to) return;
    try {
      const [bills, menu] = await Promise.all([
        Sheets.fetchBills(from, to),
        Sheets.fetchMenu(from, to)
      ]);
      this.bills = bills;
      this.menuData = menu;
    } catch (e) {
      this._toast('Gagal fetch data: ' + e.message);
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

  // ============================================================================
  // FILTER APPLY
  // ============================================================================
  _computeFiltered() {
    const a = this.applied;
    const useMap = this.regional.length > 0;
    const scopeSet = useMap ? new Set(this._scopedBranches()) : null;

    this.fBills = this.bills.filter(b => {
      if (a.from && b.date < a.from) return false;
      if (a.to && b.date > a.to) return false;
      if (a.purpose && b.purpose !== a.purpose) return false;
      if (a.branch) return b.branch === a.branch;
      if (useMap && (a.regional || a.area)) return scopeSet.has(b.branch);
      return true;
    });

    this.fMenu = this.menuData.filter(m => {
      if (a.from && m.date < a.from) return false;
      if (a.to && m.date > a.to) return false;
      if (a.branch) return m.branch === a.branch;
      if (useMap && (a.regional || a.area)) return scopeSet.has(m.branch);
      // Purpose filter tidak berlaku untuk menu (menu tidak punya purpose)
      return true;
    });
  },

  _scopedBranches() {
    const a = this.applied;
    if (a.branch) return [a.branch];
    if (this.regional.length === 0) return Array.from(new Set(this.bills.map(b => b.branch)));
    return this.regional
      .filter(r => !a.regional || r.regional === a.regional)
      .filter(r => !a.area || r.area === a.area)
      .map(r => r.branch);
  },

  // ============================================================================
  // RENDER
  // ============================================================================
  _renderAll() {
    this._renderDashboard();
    this._renderSales();
    this._renderMenu();
    this._renderSettings();
  },

  // ---- DASHBOARD ----
  _renderDashboard() {
    const total = this.fBills.reduce((s, b) => s + b.total, 0);
    const bills = this.fBills.length;
    const days = new Set(this.fBills.map(b => b.date)).size;
    const aov = bills > 0 ? total / bills : 0;

    // Growth vs bulan lalu (perbandingan avg per day)
    const growth = this._computeGrowth();

    document.getElementById('dSales').textContent = this._fmtRp(total);
    document.getElementById('dSalesSub').textContent = days + ' hari · ' + this._formatDateShort(this.applied.from) + ' – ' + this._formatDateShort(this.applied.to);
    document.getElementById('dGrowth').textContent = growth.text;
    document.getElementById('dGrowth').style.color = growth.color;
    document.getElementById('dGrowthSub').textContent = growth.sub;
    document.getElementById('dBills').textContent = bills.toLocaleString('id-ID');
    document.getElementById('dAov').textContent = this._fmtRp(aov);

    // Highlights
    const highlights = this._computeHighlights();
    document.getElementById('dHighlights').innerHTML = highlights.map(h =>
      `<div class="info-row"><span class="info-key">${this._esc(h.key)}</span><span class="info-val">${this._esc(h.val)}</span></div>`
    ).join('');

    // Top 5 toko
    const topBranches = this._groupSum(this.fBills, b => b.branch, b => b.total);
    document.getElementById('dTopBranches').innerHTML = this._renderRank(topBranches.slice(0, 5), true);
    // Top 5 menu
    const topMenus = this._groupSum(this.fMenu, m => m.menu, m => m.subtotal);
    document.getElementById('dTopMenus').innerHTML = this._renderRank(topMenus.slice(0, 5), false);
    // Trend
    this._renderTrend('dTrendChart', this.fBills);
  },

  _computeGrowth() {
    const { from, to } = this.applied;
    if (!from || !to) return { text: '—', color: 'var(--sea)', sub: '—' };
    const fromD = new Date(from), toD = new Date(to);
    const dayCount = Math.round((toD - fromD) / 86400000) + 1;
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
    const prevFromStr = this._toDateStr(prevFrom);
    const prevToStr = this._toDateStr(prevTo);

    // Note: previous period data mungkin belum di-fetch (out of range). Kita approximate dari yang ada.
    const cur = this.fBills.reduce((s, b) => s + b.total, 0);
    const curDays = new Set(this.fBills.map(b => b.date)).size;
    const curAvg = curDays > 0 ? cur / curDays : 0;

    const prev = this.bills.filter(b => b.date >= prevFromStr && b.date <= prevToStr).reduce((s, b) => s + b.total, 0);
    const prevDays = new Set(this.bills.filter(b => b.date >= prevFromStr && b.date <= prevToStr).map(b => b.date)).size;
    const prevAvg = prevDays > 0 ? prev / prevDays : 0;

    if (prevAvg === 0) return { text: '—', color: 'var(--sea)', sub: 'Data periode sebelumnya belum tersedia' };
    const g = ((curAvg - prevAvg) / prevAvg) * 100;
    return {
      text: (g >= 0 ? '+' : '') + g.toFixed(1) + '%',
      color: g >= 0 ? 'var(--sea)' : 'var(--danger)',
      sub: 'vs ' + this._formatDateShort(prevFromStr) + ' – ' + this._formatDateShort(prevToStr)
    };
  },

  _computeHighlights() {
    const items = [];
    if (this.fBills.length === 0) return [{ key: 'Data', val: 'Belum ada data pada periode ini' }];
    // Peak hour
    const hourMap = {};
    this.fBills.forEach(b => {
      const h = (b.time || '').slice(0, 2);
      if (h) hourMap[h] = (hourMap[h] || 0) + b.total;
    });
    const peakHour = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];
    if (peakHour) items.push({ key: 'Jam sibuk', val: peakHour[0] + ':00 – ' + (parseInt(peakHour[0]) + 1) + ':00' });

    // Top menu
    const topMenu = this._groupSum(this.fMenu, m => m.menu, m => m.subtotal)[0];
    if (topMenu) items.push({ key: 'Menu terlaris', val: topMenu.key });

    // Top branch
    const topBranch = this._groupSum(this.fBills, b => b.branch, b => b.total)[0];
    if (topBranch) items.push({ key: 'Toko terlaris', val: this._shortBranch(topBranch.key) });

    // Top category
    const topCat = this._groupSum(this.fMenu, m => m.category || '(tanpa kategori)', m => m.subtotal)[0];
    if (topCat) items.push({ key: 'Kategori dominan', val: topCat.key });

    // Top purpose
    const topPur = this._groupSum(this.fBills, b => b.purpose || '(-)', b => b.total)[0];
    if (topPur) items.push({ key: 'Visit purpose dominan', val: topPur.key });

    return items;
  },

  // ---- SALES PAGE ----
  _renderSales() {
    const total = this.fBills.reduce((s, b) => s + b.total, 0);
    const bills = this.fBills.length;
    const aov = bills > 0 ? total / bills : 0;
    const branchCount = new Set(this.fBills.map(b => b.branch)).size;
    const scoped = this._scopedBranches().length;

    document.getElementById('sSales').textContent = this._fmtRp(total);
    document.getElementById('sBills').textContent = bills.toLocaleString('id-ID');
    document.getElementById('sAov').textContent = this._fmtRp(aov);
    document.getElementById('sActiveBranches').innerHTML = branchCount + ' <span style="font-size:12px;color:var(--ink-3);font-weight:400;">/ ' + scoped + '</span>';
    document.getElementById('sActiveSub').textContent = (scoped - branchCount) + ' tanpa transaksi';

    // Trend
    this._renderTrend('sTrendChart', this.fBills);
    // Hour chart
    this._renderHourChart();
    // Day of week chart
    this._renderDowChart();
    // Purpose list
    this._renderPurposeList();
    // Compare periods
    this._renderComparePeriods();
    // Top / Low
    this._renderTopLowControls();
    this._renderTopLow();
  },

  _renderHourChart() {
    const buckets = new Array(24).fill(0);
    this.fBills.forEach(b => {
      const h = parseInt((b.time || '').slice(0, 2));
      if (!isNaN(h) && h >= 0 && h < 24) buckets[h] += b.total;
    });
    const ctx = document.getElementById('sHourChart').getContext('2d');
    if (this.charts.hour) this.charts.hour.destroy();
    const max = Math.max(...buckets);
    const colors = buckets.map(v => v > max * 0.7 ? '#4A90B8' : (v > max * 0.4 ? '#85B7EB' : '#C7DDEA'));
    this.charts.hour = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: buckets.map((_, i) => String(i).padStart(2, '0')),
        datasets: [{ data: buckets, backgroundColor: colors, borderRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1F2937', padding: 10,
            callbacks: {
              title: (i) => i[0].label + ':00 – ' + (parseInt(i[0].label) + 1) + ':00',
              label: (c) => this._fmtRp(c.parsed.y)
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 9 }, maxRotation: 0, autoSkipPadding: 6 } },
          y: { grid: { color: 'rgba(232, 226, 211, 0.5)' }, ticks: { color: '#8A93A0', font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  _renderDowChart() {
    const dowNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const buckets = new Array(7).fill(0);
    this.fBills.forEach(b => {
      const d = new Date(b.date);
      buckets[d.getDay()] += b.total;
    });
    // Reorder Sen–Min
    const ordered = [...buckets.slice(1), buckets[0]];
    const orderedNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const ctx = document.getElementById('sDowChart').getContext('2d');
    if (this.charts.dow) this.charts.dow.destroy();
    const max = Math.max(...ordered);
    const colors = ordered.map(v => v > max * 0.7 ? '#4A90B8' : '#85B7EB');
    this.charts.dow = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: orderedNames,
        datasets: [{ data: ordered, backgroundColor: colors, borderRadius: 3 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1F2937', padding: 10, callbacks: { label: (c) => this._fmtRp(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 10 } } },
          y: { grid: { color: 'rgba(232, 226, 211, 0.5)' }, ticks: { color: '#8A93A0', font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  _renderPurposeList() {
    const totals = this._groupSum(this.fBills, b => b.purpose || '(-)', b => b.total);
    const grand = totals.reduce((s, x) => s + x.val, 0);
    const el = document.getElementById('sPurposeList');
    if (grand === 0) { el.innerHTML = '<div style="color:var(--ink-3);font-size:13px;">—</div>'; return; }
    const max = totals[0].val;
    el.innerHTML = totals.map(({ key, val }) => {
      const pct = grand > 0 ? (val / grand * 100) : 0;
      const barW = max > 0 ? (val / max * 100) : 0;
      return `<div class="channel-row">
        <div class="channel-name">${this._esc(key)}</div>
        <div class="channel-bar"><div class="channel-bar-fill${pct < 10 ? ' light' : ''}" style="width:${barW.toFixed(1)}%"></div></div>
        <div class="channel-amount">${this._fmtRp(val)}</div>
        <div class="channel-pct">${pct.toFixed(1)}%</div>
      </div>`;
    }).join('');
  },

  _renderComparePeriods() {
    const { from, to } = this.applied;
    if (!from || !to) return;
    const fromD = new Date(from), toD = new Date(to);
    const dayCount = Math.round((toD - fromD) / 86400000) + 1;
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
    const prevFromStr = this._toDateStr(prevFrom);
    const prevToStr = this._toDateStr(prevTo);

    const cur = this.fBills.reduce((s, b) => s + b.total, 0);
    const prev = this.bills.filter(b => b.date >= prevFromStr && b.date <= prevToStr).reduce((s, b) => s + b.total, 0);
    const max = Math.max(cur, prev, 1);
    const pctCur = (cur / max) * 100;
    const pctPrev = (prev / max) * 100;
    const growth = prev > 0 ? ((cur - prev) / prev * 100) : 0;
    const growthTxt = prev > 0 ? ((growth >= 0 ? '+' : '') + growth.toFixed(1) + '%') : 'Data periode sebelumnya belum tersedia';
    const growthColor = growth >= 0 ? 'var(--sea)' : 'var(--danger)';
    document.getElementById('sCompare').innerHTML = `
      <div style="font-size:11px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span style="color:var(--ink-2);">${this._formatDateShort(this.applied.from)} – ${this._formatDateShort(this.applied.to)} (${dayCount} hari)</span><span style="font-weight:500;">${this._fmtRp(cur)}</span></div>
        <div style="background:var(--bone); height:6px; border-radius:2px;"><div style="width:${pctCur}%; background:var(--sea); height:100%; border-radius:2px;"></div></div>
      </div>
      <div style="font-size:11px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span style="color:var(--ink-2);">${this._formatDateShort(prevFromStr)} – ${this._formatDateShort(prevToStr)} (${dayCount} hari)</span><span style="font-weight:500;">${this._fmtRp(prev)}</span></div>
        <div style="background:var(--bone); height:6px; border-radius:2px;"><div style="width:${pctPrev}%; background:var(--sea-3); height:100%; border-radius:2px;"></div></div>
      </div>
      <div style="font-size:12px; margin-top:10px; font-weight:500; color:${growthColor};">${growthTxt} growth</div>
    `;
  },

  _renderTopLowControls() {
    const a = this.applied;
    let levels;
    if (!a.regional && !a.area && !a.branch) levels = [['regional', 'Per regional'], ['area', 'Per area'], ['branch', 'Per toko']];
    else if (a.regional && !a.area && !a.branch) levels = [['area', 'Per area'], ['branch', 'Per toko']];
    else levels = [['branch', 'Per toko']];

    if (!levels.find(l => l[0] === this.topGroup)) this.topGroup = levels[levels.length - 1][0];
    if (!levels.find(l => l[0] === this.lowGroup)) this.lowGroup = levels[levels.length - 1][0];

    const build = (id, current, isTop) => {
      const container = document.getElementById(id);
      container.innerHTML = `
        <select class="btn" style="padding:6px 10px; font-size:12px;">
          ${levels.map(([v, l]) => `<option value="${v}"${v === current ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
        <input type="number" min="1" max="100" class="btn" value="${isTop ? this.topCount : this.lowCount}" style="width:60px; padding:6px 8px; font-size:12px; text-align:center;" />
      `;
      const sel = container.querySelector('select');
      const inp = container.querySelector('input');
      sel.addEventListener('change', () => {
        if (isTop) { this.topGroup = sel.value; this._saveSetting('topGroup', sel.value); }
        else { this.lowGroup = sel.value; this._saveSetting('lowGroup', sel.value); }
        this._renderTopLow();
      });
      inp.addEventListener('change', () => {
        let v = parseInt(inp.value) || 5;
        if (v < 1) v = 1; if (v > 100) v = 100;
        inp.value = v;
        if (isTop) { this.topCount = v; this._saveSetting('topCount', v); }
        else { this.lowCount = v; this._saveSetting('lowCount', v); }
        this._renderTopLow();
      });
    };
    build('sTopControls', this.topGroup, true);
    build('sLowControls', this.lowGroup, false);
  },

  _renderTopLow() {
    const buildData = (group) => {
      const map = {};
      this.fBills.forEach(b => {
        let key;
        if (group === 'branch') key = b.branch;
        else if (group === 'area') key = (this.branchMeta[b.branch] || {}).area || '(tanpa area)';
        else key = (this.branchMeta[b.branch] || {}).regional || '(tanpa regional)';
        map[key] = (map[key] || 0) + b.total;
      });
      return Object.entries(map).map(([k, v]) => ({ key: k, val: v })).filter(x => x.val > 0);
    };
    const top = buildData(this.topGroup).sort((a, b) => b.val - a.val).slice(0, this.topCount);
    const low = buildData(this.lowGroup).sort((a, b) => a.val - b.val).slice(0, this.lowCount);
    document.getElementById('sTopList').innerHTML = this._renderRank(top, this.topGroup === 'branch');
    document.getElementById('sLowList').innerHTML = this._renderRank(low, this.lowGroup === 'branch');
  },

  // ---- MENU PAGE ----
  _bindMenuTabs() {
    document.querySelectorAll('[data-menutab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-menutab]').forEach(b => b.classList.toggle('active', b === btn));
        this.menuTab = btn.dataset.menutab;
        this._renderMenu();
      });
    });
  },

  _renderMenu() {
    const uniqMenus = new Set(this.fMenu.map(m => m.menu));
    const totalQty = this.fMenu.reduce((s, m) => s + m.qty, 0);

    document.getElementById('mUniqueMenu').textContent = uniqMenus.size.toLocaleString('id-ID');
    document.getElementById('mTotalQty').textContent = totalQty.toLocaleString('id-ID');

    const topCat = this._groupSum(this.fMenu, m => m.category || '(tanpa kategori)', m => m.subtotal)[0];
    document.getElementById('mTopCategory').textContent = topCat ? topCat.key : '—';

    const topMenu = this._groupSum(this.fMenu, m => m.menu, m => m.subtotal)[0];
    document.getElementById('mTopMenu').textContent = topMenu ? topMenu.key : '—';

    // Top 10 menu — revenue or qty
    const metric = this.menuTab === 'qty' ? (m => m.qty) : (m => m.subtotal);
    const top10 = this._groupSum(this.fMenu, m => m.menu, metric).slice(0, 10);
    const menuRevMap = {};
    const menuQtyMap = {};
    this.fMenu.forEach(m => {
      menuRevMap[m.menu] = (menuRevMap[m.menu] || 0) + m.subtotal;
      menuQtyMap[m.menu] = (menuQtyMap[m.menu] || 0) + m.qty;
    });
    document.getElementById('mTopList').innerHTML = top10.map((it, i) => `
      <div class="rank-row">
        <div class="rank-left"><span class="rank-num">${i + 1}</span><span class="rank-name">${this._esc(it.key)}</span></div>
        <span class="rank-meta">${(menuQtyMap[it.key] || 0).toLocaleString('id-ID')}×</span>
        <span class="rank-amount">${this._fmtRp(menuRevMap[it.key] || 0)}</span>
      </div>`).join('') || '<div style="color:var(--ink-3);font-size:13px;">—</div>';

    // Top kategori
    const cats = this._groupSum(this.fMenu, m => m.category || '(tanpa kategori)', m => m.subtotal);
    const grandCat = cats.reduce((s, x) => s + x.val, 0);
    const maxCat = cats[0] ? cats[0].val : 1;
    document.getElementById('mCategoryList').innerHTML = cats.slice(0, 8).map(({ key, val }) => {
      const pct = grandCat > 0 ? (val / grandCat * 100) : 0;
      const barW = maxCat > 0 ? (val / maxCat * 100) : 0;
      return `<div class="channel-row">
        <div class="channel-name">${this._esc(key)}</div>
        <div class="channel-bar"><div class="channel-bar-fill${pct < 10 ? ' light' : ''}" style="width:${barW.toFixed(1)}%"></div></div>
        <div class="channel-amount">${this._fmtRp(val)}</div>
        <div class="channel-pct">${pct.toFixed(1)}%</div>
      </div>`;
    }).join('') || '<div style="color:var(--ink-3);font-size:13px;">—</div>';

    // Pareto — top 20% menu = berapa % dari total
    const allMenus = this._groupSum(this.fMenu, m => m.menu, m => m.subtotal);
    const totalRev = allMenus.reduce((s, x) => s + x.val, 0);
    const top20count = Math.max(1, Math.ceil(allMenus.length * 0.2));
    const top20rev = allMenus.slice(0, top20count).reduce((s, x) => s + x.val, 0);
    const paretoPct = totalRev > 0 ? (top20rev / totalRev * 100) : 0;
    document.getElementById('mPareto').innerHTML = allMenus.length === 0 ? '—' :
      `<div style="margin-bottom:6px;">Top 20% menu (<b style="color:var(--sea)">${top20count}</b> dari <b>${allMenus.length}</b> menu) menyumbang <b style="color:var(--sea)">${paretoPct.toFixed(1)}%</b> dari total revenue.</div>` +
      `<div style="font-size:11px; color:var(--ink-3);">Semakin dekat ke 80% = konsentrasi tinggi (ideal: fokus stok ke menu ini).</div>`;

    // Menu terlaris per toko
    const branches = Array.from(new Set(this.fMenu.map(m => m.branch))).sort();
    const perBranch = branches.slice(0, 10).map(br => {
      const menus = this.fMenu.filter(m => m.branch === br);
      const grouped = this._groupSum(menus, m => m.menu, m => m.subtotal);
      const top = grouped[0];
      return { branch: br, menu: top ? top.key : '—', val: top ? top.val : 0 };
    });
    document.getElementById('mPerBranch').innerHTML = perBranch.map(r => `
      <div class="rank-row">
        <div class="rank-left"><span class="rank-name" style="color:var(--ink-2);">${this._esc(this._shortBranch(r.branch))}</span></div>
        <span class="rank-amount">${this._esc(r.menu)}</span>
      </div>`).join('') || '<div style="color:var(--ink-3);font-size:13px;">—</div>';

    // Menu tidak laku (0 qty) — dari daftar semua menu yang pernah ada dikurangi yang terjual
    // Karena kita cuma punya data yang terjual, kita bandingkan dgn semua menu unik di sheet MenuData (fMenu)
    // "Tidak laku" = 0. Karena filter menu isinya cuma yang > 0 qty, ini tidak bisa 100% akurat tanpa master menu.
    // Kita hitung: menu yang ada di period lebih luas tapi 0 di period ini
    document.getElementById('mInactiveWarn').hidden = true;
  },

  // ---- SETTINGS PAGE ----
  _bindSettingsPage() {
    // Theme toggle
    document.querySelectorAll('#themeToggle button').forEach(b => {
      b.addEventListener('click', () => {
        this.theme = b.dataset.theme;
        this._saveSetting('theme', this.theme);
        this._applyTheme();
        this._renderSettings();
      });
    });
    // Money format options
    const mo = document.getElementById('moneyFormatOptions');
    mo.innerHTML = Object.entries(CONFIG.MONEY_FORMATS).map(([k, v]) =>
      `<label><input type="radio" name="mf" value="${k}"${this.moneyFormat === k ? ' checked' : ''}/><span>${this._esc(v.label)}</span></label>`
    ).join('');
    mo.querySelectorAll('input[name="mf"]').forEach(inp => {
      inp.addEventListener('change', () => {
        this.moneyFormat = inp.value;
        this._saveSetting('moneyFormat', inp.value);
        this._renderAll();
      });
    });
    // Sheet link
    const sl = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) {
      sl.href = CONFIG.SHEET_URL;
    } else {
      sl.parentElement.hidden = true;
    }
    // Clear cache
    document.getElementById('btnClearCache').addEventListener('click', async () => {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      this._toast('Cache dibersihkan. Refresh halaman.');
    });
    // Archive
    document.getElementById('btnArchive').addEventListener('click', () => this._openArchive());
  },

  _renderSettings() {
    // Theme toggle active state
    document.querySelectorAll('#themeToggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === this.theme);
    });
    // Info data
    if (this.status) {
      document.getElementById('stStatus').textContent = 'Terhubung';
      document.getElementById('stStatus').style.color = 'var(--sea)';
      document.getElementById('stLastUpdate').textContent = new Date(this.status.timestamp).toLocaleString('id-ID');
      document.getElementById('stBills').textContent = (this.status.billCount || 0).toLocaleString('id-ID');
      document.getElementById('stLastDate').textContent = this.status.lastDate ? this._formatDateFull(this.status.lastDate) : '—';
      document.getElementById('stActive').textContent = this.activeBranches.length + ' toko';

      // Capacity
      const pct = (this.status.usage * 100).toFixed(1);
      const fill = document.getElementById('stCapFill');
      fill.style.width = pct + '%';
      fill.className = 'capacity-fill';
      let note = '';
      if (this.status.level === 'critical') {
        fill.classList.add('critical');
        note = 'Kapasitas kritis. Segera arsipkan data lama.';
        document.getElementById('btnArchive').hidden = false;
      } else if (this.status.level === 'alert') {
        fill.classList.add('warn');
        note = 'Kapasitas mendekati batas. Pertimbangkan arsip data lama.';
        document.getElementById('btnArchive').hidden = false;
      } else if (this.status.level === 'warn') {
        note = 'Kapasitas sudah > 60%.';
        document.getElementById('btnArchive').hidden = false;
      } else {
        note = 'Kapasitas sehat.';
        document.getElementById('btnArchive').hidden = true;
      }
      document.getElementById('stCapText').textContent = pct + '% terpakai (' + (this.status.totalCells).toLocaleString('id-ID') + ' dari ' + this.status.cellLimit.toLocaleString('id-ID') + ' sel)';
      document.getElementById('stCapNote').textContent = note;
    } else {
      document.getElementById('stStatus').textContent = 'Belum terhubung';
    }
  },

  _openArchive() {
    const beforeDate = prompt('Arsipkan semua data SEBELUM tanggal (YYYY-MM-DD):', '');
    if (!beforeDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(beforeDate)) { this._toast('Format tanggal salah'); return; }
    if (!confirm('Data sebelum ' + beforeDate + ' akan dipindah ke sheet arsip. Lanjut?')) return;
    this._toast('Sedang mengarsipkan...');
    Sheets.archive(beforeDate).then(res => {
      this._toast('Arsip selesai: ' + res.bills.moved + ' bills, ' + res.menu.moved + ' menu rows');
      this.loadAll();
    }).catch(e => this._toast('Gagal arsip: ' + e.message));
  },

  // ============================================================================
  // TREND CHART (dipakai dashboard & sales)
  // ============================================================================
  _renderTrend(canvasId, bills) {
    const map = {};
    bills.forEach(b => { map[b.date] = (map[b.date] || 0) + b.total; });
    const dates = Object.keys(map).sort();
    const values = dates.map(d => map[d]);
    const labels = dates.map(d => {
      const [, m, day] = d.split('-');
      return parseInt(day) + '/' + parseInt(m);
    });
    const ctx = document.getElementById(canvasId).getContext('2d');
    const chartKey = 'trend_' + canvasId;
    if (this.charts[chartKey]) this.charts[chartKey].destroy();
    this.charts[chartKey] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values, borderColor: '#4A90B8', backgroundColor: 'rgba(74,144,184,0.08)',
          borderWidth: 2, fill: true, tension: 0.3, pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: '#4A90B8'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1F2937', padding: 12,
            callbacks: {
              title: (i) => this._formatDateFull(dates[i[0].dataIndex]),
              label: (c) => this._fmtRp(c.parsed.y)
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 } },
          y: { grid: { color: 'rgba(232, 226, 211, 0.5)' }, ticks: { color: '#8A93A0', font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  // ============================================================================
  // UPLOAD MODAL
  // ============================================================================
  _bindUploadModal() {
    document.querySelectorAll('#uploadModal [data-close]').forEach(el => {
      el.addEventListener('click', () => this._closeUpload());
    });
    document.getElementById('btnPickFile').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', (e) => {
      if (e.target.files[0]) this._handleFile(e.target.files[0]);
    });
    const dz = document.getElementById('dropzone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault(); dz.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this._handleFile(e.dataTransfer.files[0]);
    });
    document.getElementById('btnSendSheet').addEventListener('click', () => this._doUpload());
  },

  _openUpload() {
    document.getElementById('uploadModal').hidden = false;
    document.getElementById('filePreview').hidden = true;
    document.getElementById('uploadError').hidden = true;
    document.getElementById('btnSendSheet').disabled = true;
    document.getElementById('fileInput').value = '';
    this._parsed = null;
  },
  _closeUpload() { document.getElementById('uploadModal').hidden = true; },

  async _handleFile(file) {
    const preview = document.getElementById('filePreview');
    const err = document.getElementById('uploadError');
    err.hidden = true;
    preview.hidden = false;
    preview.innerHTML = `<div class="file-preview"><div class="file-preview-name">${this._esc(file.name)}</div><div class="file-preview-meta">Memproses...</div><div class="upload-progress"><div class="upload-progress-fill" id="upFill" style="width:5%"></div></div></div>`;
    try {
      this._parsed = await UploadParser.parse(file, (msg, pct) => {
        preview.querySelector('.file-preview-meta').textContent = msg;
        preview.querySelector('#upFill').style.width = pct + '%';
      });
      const m = this._parsed.meta;
      preview.innerHTML = `<div class="file-preview">
        <div class="file-preview-name">${this._esc(file.name)}</div>
        <div class="file-preview-meta">${m.dateStart}${m.dateStart !== m.dateEnd ? ' – ' + m.dateEnd : ''} · ${m.branches.length} toko · ${m.billCount.toLocaleString('id-ID')} bills · ${m.itemCount.toLocaleString('id-ID')} item</div>
      </div>`;
      document.getElementById('btnSendSheet').disabled = false;
    } catch (e) {
      preview.hidden = true;
      err.hidden = false;
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Gagal parsing</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
    }
  },

  async _doUpload() {
    if (!this._parsed) return;
    const btn = document.getElementById('btnSendSheet');
    btn.disabled = true;
    const preview = document.getElementById('filePreview');
    const err = document.getElementById('uploadError');
    err.hidden = true;
    const meta = this._parsed.meta;
    preview.innerHTML = `<div class="file-preview">
      <div class="file-preview-name">${this._esc(meta.fileName)}</div>
      <div class="file-preview-meta">Menyiapkan upload...</div>
      <div class="upload-progress"><div class="upload-progress-fill" id="upFill" style="width:0%"></div></div>
      <div class="upload-status-msg" id="upMsg">—</div>
    </div>`;

    UploadFlow.run(this._parsed, {
      onStep: (msg, pct) => {
        const f = document.getElementById('upFill');
        const m = document.getElementById('upMsg');
        if (f) f.style.width = pct + '%';
        if (m) m.textContent = msg;
      },
      onError: (msg) => {
        err.hidden = false;
        err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Upload gagal</div><div class="error-box-msg">${this._esc(msg)}</div></div></div>`;
        btn.disabled = false;
      },
      onDone: async (info) => {
        this._toast('Berhasil: ' + info.bills + ' bills, ' + info.menu + ' menu rows');
        setTimeout(() => this._closeUpload(), 1200);
        await this.loadAll();
      }
    });
  },

  // ============================================================================
  // HELPERS
  // ============================================================================
  _groupSum(arr, keyFn, valFn) {
    const map = {};
    arr.forEach(x => {
      const k = keyFn(x);
      map[k] = (map[k] || 0) + valFn(x);
    });
    return Object.entries(map).map(([key, val]) => ({ key, val })).sort((a, b) => b.val - a.val);
  },

  _renderRank(items, isBranch) {
    if (items.length === 0) return '<div style="color:var(--ink-3);font-size:13px;padding:8px 0;">—</div>';
    return items.map((it, i) => `
      <div class="rank-row">
        <div class="rank-left"><span class="rank-num">${i + 1}</span><span class="rank-name">${this._esc(isBranch ? this._shortBranch(it.key) : it.key)}</span></div>
        <span class="rank-amount">${this._fmtRp(it.val)}</span>
      </div>`).join('');
  },

  _fmtRp(v) {
    if (v == null || isNaN(v)) return 'Rp 0';
    if (this.moneyFormat === 'full') return 'Rp ' + Math.round(v).toLocaleString('id-ID');
    if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(2).replace('.', ',') + ' M';
    if (v >= 1e6) return 'Rp ' + Math.round(v / 1e6).toLocaleString('id-ID') + ' JT';
    if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3).toLocaleString('id-ID') + ' Rb';
    return 'Rp ' + Math.round(v);
  },
  _fmtShort(v) {
    if (v >= 1e9) return (v / 1e9).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1e6) return Math.round(v / 1e6) + 'jt';
    if (v >= 1e3) return Math.round(v / 1e3) + 'rb';
    return v;
  },

  _toDateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
  _formatDateShort(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1];
  },
  _formatDateFull(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1] + ' ' + y;
  },
  _shortBranch(b) {
    const m = String(b || '').match(/^[^-]+-\s*(.+)$/);
    return m ? m[1].trim() : String(b || '');
  },
  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  },

  _splash(msg) {
    const s = document.getElementById('splash');
    s.classList.remove('hidden');
    if (msg) document.getElementById('splashSub').textContent = msg;
  },
  _splashHide() {
    setTimeout(() => document.getElementById('splash').classList.add('hidden'), 200);
  },
  _toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.hidden = true, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
