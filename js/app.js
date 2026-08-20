// ============================================================================
// SALES DASHBOARD v5 — APLIKASI UTAMA (format lama, hemat & lengkap)
// ============================================================================

const App = {
  // === STATE ===
  data: [],          // {date, branch, channels: {...}, total}
  regional: [],      // {regional, area, branch}
  status: null,
  branchMeta: {},
  activeBranches: [],
  areaToRegional: {},
  regionalToAreas: {},

  filter: {
    periode: 'current', from: '', to: '',
    regional: '', area: '', branch: '', channels: []
  },
  applied: null,

  filtered: [],        // hasil filter
  charts: {},
  moneyFormat: 'auto',
  theme: 'auto',
  topGroup: 'branch', topCount: 5,
  lowGroup: 'branch', lowCount: 5,
  currentPage: 'dashboard',
  _uploadCtx: null,

  // ============================================================================
  async init() {
    this._loadSettings();
    this._applyTheme();
    this._bindSidebar();
    this._bindTopbar();
    this._bindFilterModal();
    this._bindUploadModal();
    this._bindSettingsPage();

    this._setPeriodePreset('current');
    this._captureFilter();
    this.applied = { ...this.filter };

    await this.loadAll();
  },

  _loadSettings() {
    this.moneyFormat = localStorage.getItem('moneyFormat') || 'auto';
    if (!['auto','full'].includes(this.moneyFormat)) this.moneyFormat = 'auto';
    this.theme = localStorage.getItem('theme') || 'auto';
    if (!['auto','light','dark'].includes(this.theme)) this.theme = 'auto';
    this.topGroup = localStorage.getItem('topGroup') || 'branch';
    this.lowGroup = localStorage.getItem('lowGroup') || 'branch';
    this.topCount = parseInt(localStorage.getItem('topCount')) || 5;
    this.lowCount = parseInt(localStorage.getItem('lowCount')) || 5;
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
    const titles = { dashboard: 'Dasbor', sales: 'Penjualan', settings: 'Pengaturan' };
    document.getElementById('pageTitle').textContent = titles[page] || '';
    document.getElementById('btnFilter').style.display = page === 'settings' ? 'none' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  _bindTopbar() {
    document.getElementById('btnFilter').addEventListener('click', () => this._openFilterModal());
  },

  // ==========================================================================
  // FILTER
  // ==========================================================================
  _bindFilterModal() {
    const modal = document.getElementById('filterModal');
    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => this._closeFilterModal()));
    document.getElementById('filterOk').addEventListener('click', () => this._applyFilterAndClose());
    document.getElementById('filterReset').addEventListener('click', () => this._resetFilter());
    document.getElementById('fPeriode').addEventListener('change', (e) => this._setPeriodePreset(e.target.value));
    ['fFrom','fTo'].forEach(id => document.getElementById(id).addEventListener('change', () => document.getElementById('fPeriode').value = 'custom'));
    document.getElementById('fRegional').addEventListener('change', () => this._onFilterRegionalChange());
    document.getElementById('fArea').addEventListener('change', () => this._onFilterAreaChange());
    document.getElementById('fBranch').addEventListener('change', () => this._onFilterBranchChange());
  },

  _openFilterModal() {
    this._populateFilterOptions();
    document.getElementById('fPeriode').value = this.filter.periode;
    document.getElementById('fFrom').value = this.filter.from;
    document.getElementById('fTo').value = this.filter.to;
    document.getElementById('fRegional').value = this.filter.regional;
    this._onFilterRegionalChange(true);
    document.getElementById('fArea').value = this.filter.area;
    this._onFilterAreaChange(true);
    document.getElementById('fBranch').value = this.filter.branch;
    // Channels
    document.querySelectorAll('#fChannelList input[type=checkbox]').forEach(cb => {
      cb.checked = this.filter.channels.length === 0 || this.filter.channels.includes(cb.value);
    });
    document.getElementById('filterModal').hidden = false;
  },
  _closeFilterModal() { document.getElementById('filterModal').hidden = true; },

  _populateFilterOptions() {
    const regs = Array.from(new Set(this.regional.map(r => r.regional))).sort();
    document.getElementById('fRegional').innerHTML = '<option value="">Semua Regional</option>' + regs.map(r => `<option value="${this._esc(r)}">${this._esc(r)}</option>`).join('');
    const cl = document.getElementById('fChannelList');
    cl.innerHTML = CONFIG.CHANNELS.map(c => `<label class="check-row"><input type="checkbox" value="${this._esc(c)}" checked/><span>${this._esc(CONFIG.CHANNEL_DISPLAY[c] || c)}</span></label>`).join('');
  },

  _onFilterRegionalChange(silent) {
    const reg = document.getElementById('fRegional').value;
    let areas = reg ? Array.from(new Set(this.regional.filter(r => r.regional === reg).map(r => r.area))).sort()
                    : Array.from(new Set(this.regional.map(r => r.area))).sort();
    const areaSel = document.getElementById('fArea');
    const cur = areaSel.value;
    areaSel.innerHTML = '<option value="">Semua Area</option>' + areas.map(a => `<option value="${this._esc(a)}">${this._esc(a)}</option>`).join('');
    if (!silent) { if (areas.includes(cur)) areaSel.value = cur; else areaSel.value = ''; }
    this._onFilterAreaChange(silent);
  },

  _onFilterAreaChange(silent) {
    const reg = document.getElementById('fRegional').value;
    const area = document.getElementById('fArea').value;
    if (!silent && area && !reg) {
      const parent = (this.regional.find(r => r.area === area) || {}).regional;
      if (parent) document.getElementById('fRegional').value = parent;
    }
    const curReg = document.getElementById('fRegional').value;
    const branches = Array.from(new Set(this.regional
      .filter(r => !curReg || r.regional === curReg)
      .filter(r => !area || r.area === area)
      .map(r => r.branch))).sort();
    const brSel = document.getElementById('fBranch');
    const cur = brSel.value;
    brSel.innerHTML = '<option value="">Semua toko</option>' + branches.map(b => `<option value="${this._esc(b)}">${this._esc(this._short(b))}</option>`).join('');
    if (!silent) { if (branches.includes(cur)) brSel.value = cur; else brSel.value = ''; }
  },

  _onFilterBranchChange() {
    const b = document.getElementById('fBranch').value;
    if (b && this.branchMeta[b]) {
      document.getElementById('fRegional').value = this.branchMeta[b].regional;
      document.getElementById('fArea').value = this.branchMeta[b].area;
    }
  },

  _setPeriodePreset(mode) {
    const now = new Date();
    let from, to = now;
    if (mode === 'current') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (mode === 'last') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (mode === 'last7') { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (mode === 'last30') { from = new Date(now); from.setDate(from.getDate() - 29); }
    else if (mode === 'last90') { from = new Date(now); from.setDate(from.getDate() - 89); }
    else return;
    document.getElementById('fFrom').value = this._toDateStr(from);
    document.getElementById('fTo').value = this._toDateStr(to);
  },

  _captureFilter() {
    const channels = Array.from(document.querySelectorAll('#fChannelList input[type=checkbox]:checked')).map(cb => cb.value);
    this.filter = {
      periode: document.getElementById('fPeriode').value,
      from: document.getElementById('fFrom').value,
      to: document.getElementById('fTo').value,
      regional: document.getElementById('fRegional').value,
      area: document.getElementById('fArea').value,
      branch: document.getElementById('fBranch').value,
      channels: (channels.length === CONFIG.CHANNELS.length) ? [] : channels
    };
  },

  _applyFilterAndClose() {
    this._captureFilter();
    this.applied = { ...this.filter };
    this._closeFilterModal();
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
    document.querySelectorAll('#fChannelList input[type=checkbox]').forEach(cb => cb.checked = true);
    this._onFilterRegionalChange();
  },

  _updateFilterSummary() {
    const parts = [];
    if (this.applied.regional) parts.push(this.applied.regional);
    if (this.applied.area) parts.push(this.applied.area);
    if (this.applied.branch) parts.push(this._short(this.applied.branch));
    if (this.applied.channels && this.applied.channels.length > 0) {
      parts.push(this.applied.channels.length + ' channel');
    }
    const bar = document.getElementById('filterSummary');
    const badge = document.getElementById('filterCount');
    if (parts.length > 0) {
      bar.hidden = false;
      bar.innerHTML = `<span><b>${parts.length} filter aktif:</b> ${parts.map(this._esc).join(' · ')}</span><span class="reset" id="fQuickReset">Reset</span>`;
      document.getElementById('fQuickReset').addEventListener('click', () => {
        this._resetFilter();
        this._captureFilter();
        this.applied = { ...this.filter };
        this._computeFiltered();
        this._renderAll();
        this._updateFilterSummary();
      });
      badge.hidden = false;
      badge.textContent = parts.length;
    } else {
      bar.hidden = true;
      badge.hidden = true;
    }
  },

  // ==========================================================================
  // LOAD
  // ==========================================================================
  async loadAll() {
    this._splash('Memuat data dari Google Sheets...');
    try {
      const [data, regional, status] = await Promise.all([
        Sheets.fetchAll(),
        Sheets.fetchRegional().catch(() => []),
        Sheets.status().catch(() => null)
      ]);
      this.data = data;
      this.regional = regional;
      this.status = status;
      this._buildBranchMeta();
      this._computeFiltered();
      this._populateFilterOptions();
      this._renderAll();
      this._splashHide();
    } catch (e) {
      this._splash('Gagal: ' + e.message);
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

  // ==========================================================================
  // FILTER APPLY
  // ==========================================================================
  _computeFiltered() {
    const a = this.applied;
    const useMap = this.regional.length > 0;
    const scoped = new Set(this._scopedBranches());
    const channelFilter = a.channels && a.channels.length > 0 && a.channels.length < CONFIG.CHANNELS.length;

    this.filtered = this.data.filter(r => {
      if (a.from && r.date < a.from) return false;
      if (a.to && r.date > a.to) return false;
      if (a.branch) return r.branch === a.branch;
      if (useMap && (a.regional || a.area)) return scoped.has(r.branch);
      return true;
    }).map(r => {
      if (channelFilter) {
        const t = a.channels.reduce((s, c) => s + (r.channels[c] || 0), 0);
        return { ...r, total: t };
      }
      return r;
    }).filter(r => r.total > 0);
  },

  _scopedBranches() {
    const a = this.applied;
    if (a.branch) return [a.branch];
    if (this.regional.length === 0) return Array.from(new Set(this.data.map(r => r.branch)));
    return this.regional
      .filter(r => !a.regional || r.regional === a.regional)
      .filter(r => !a.area || r.area === a.area)
      .map(r => r.branch);
  },

  // ==========================================================================
  // RENDER
  // ==========================================================================
  _renderAll() {
    this._renderDashboard();
    this._renderSales();
    this._renderSettings();
  },

  // ---- DASHBOARD ----
  _renderDashboard() {
    const total = this.filtered.reduce((s, r) => s + r.total, 0);
    const days = new Set(this.filtered.map(r => r.date)).size;
    const avg = days > 0 ? total / days : 0;
    const branchCount = new Set(this.filtered.map(r => r.branch)).size;
    const scoped = this._scopedBranches().length;
    const growth = this._computeGrowth();

    document.getElementById('dSales').textContent = this._fmtRp(total);
    document.getElementById('dSalesSub').textContent = days + ' hari · ' + this._formatShort(this.applied.from) + ' – ' + this._formatShort(this.applied.to);
    document.getElementById('dGrowth').textContent = growth.text;
    document.getElementById('dGrowth').style.color = growth.color;
    document.getElementById('dGrowthSub').textContent = growth.sub;
    document.getElementById('dAvg').textContent = this._fmtRp(avg);
    document.getElementById('dBranch').innerHTML = branchCount + ' <span style="font-size:13px;color:var(--ink-3);font-weight:400;">/ ' + scoped + '</span>';
    document.getElementById('dBranchSub').textContent = (scoped - branchCount) + ' tanpa transaksi';

    // Top 5 branches (compact)
    const topB = this._groupSum(this.filtered, r => r.branch, r => r.total).slice(0, 5);
    document.getElementById('dTopBranches').innerHTML = this._renderRank(topB, true);

    // Top channels (all in one bar list)
    this._renderChannelBreakdown('dChannels');

    // Insight otomatis
    document.getElementById('dInsight').innerHTML = this._computeInsights();

    // Trend
    this._renderTrend('dTrendChart');
  },

  _computeGrowth() {
    const { from, to } = this.applied;
    if (!from || !to) return { text: '—', color: 'var(--sea)', sub: '—' };
    const fromD = new Date(from), toD = new Date(to);
    const dayCount = Math.round((toD - fromD) / 86400000) + 1;
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
    const pFromS = this._toDateStr(prevFrom), pToS = this._toDateStr(prevTo);

    const useMap = this.regional.length > 0;
    const scoped = new Set(this._scopedBranches());
    const a = this.applied;
    const channelFilter = a.channels && a.channels.length > 0 && a.channels.length < CONFIG.CHANNELS.length;

    const prev = this.data.filter(r => {
      if (r.date < pFromS || r.date > pToS) return false;
      if (a.branch) return r.branch === a.branch;
      if (useMap && (a.regional || a.area)) return scoped.has(r.branch);
      return true;
    });
    const prevTotal = prev.reduce((s, r) => {
      if (channelFilter) return s + a.channels.reduce((x, c) => x + (r.channels[c] || 0), 0);
      return s + r.total;
    }, 0);
    const prevDays = new Set(prev.map(r => r.date)).size;
    const prevAvg = prevDays > 0 ? prevTotal / prevDays : 0;
    const curTotal = this.filtered.reduce((s, r) => s + r.total, 0);
    const curDays = new Set(this.filtered.map(r => r.date)).size;
    const curAvg = curDays > 0 ? curTotal / curDays : 0;
    if (prevAvg === 0) return { text: '—', color: 'var(--sea)', sub: 'Data periode sebelumnya belum tersedia' };
    const g = ((curAvg - prevAvg) / prevAvg) * 100;
    return {
      text: (g >= 0 ? '+' : '') + g.toFixed(1) + '%',
      color: g >= 0 ? 'var(--sea)' : 'var(--danger)',
      sub: 'vs ' + this._formatShort(pFromS) + ' – ' + this._formatShort(pToS)
    };
  },

  _computeInsights() {
    if (this.filtered.length === 0) return '<div style="color:var(--ink-3);font-size:13px;">Belum ada data untuk insight.</div>';

    const insights = [];
    // 1. Top channel growth (vs periode lalu)
    const { from, to } = this.applied;
    const fromD = new Date(from), toD = new Date(to);
    const dayCount = Math.round((toD - fromD) / 86400000) + 1;
    const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
    const pFromS = this._toDateStr(prevFrom), pToS = this._toDateStr(prevTo);
    const scoped = new Set(this._scopedBranches());
    const useMap = this.regional.length > 0;
    const a = this.applied;
    const prevRows = this.data.filter(r => {
      if (r.date < pFromS || r.date > pToS) return false;
      if (a.branch) return r.branch === a.branch;
      if (useMap && (a.regional || a.area)) return scoped.has(r.branch);
      return true;
    });

    // Growth per channel
    const chGrowth = CONFIG.CHANNELS.map(c => {
      const cur = this.filtered.reduce((s, r) => s + (r.channels[c] || 0), 0);
      const prev = prevRows.reduce((s, r) => s + (r.channels[c] || 0), 0);
      if (prev === 0) return { c, growth: null, cur, prev };
      return { c, growth: ((cur - prev) / prev) * 100, cur, prev };
    }).filter(x => x.growth !== null && x.cur > 0);
    chGrowth.sort((a, b) => b.growth - a.growth);
    if (chGrowth[0] && chGrowth[0].growth > 5) {
      insights.push({
        icon: '↗',
        color: 'var(--sea)',
        text: `<b>${this._esc(CONFIG.CHANNEL_DISPLAY[chGrowth[0].c] || chGrowth[0].c)}</b> tumbuh paling cepat (<b>+${chGrowth[0].growth.toFixed(1)}%</b> vs periode lalu)`
      });
    }
    if (chGrowth.length > 1 && chGrowth[chGrowth.length - 1].growth < -5) {
      const x = chGrowth[chGrowth.length - 1];
      insights.push({
        icon: '↘',
        color: 'var(--danger)',
        text: `<b>${this._esc(CONFIG.CHANNEL_DISPLAY[x.c] || x.c)}</b> turun paling dalam (<b>${x.growth.toFixed(1)}%</b> vs periode lalu)`
      });
    }

    // 2. Toko trending naik/turun (yang muncul di kedua periode)
    const branchGrowth = {};
    const branches = new Set([...this.filtered.map(r => r.branch), ...prevRows.map(r => r.branch)]);
    branches.forEach(b => {
      const cur = this.filtered.filter(r => r.branch === b).reduce((s, r) => s + r.total, 0);
      const prev = prevRows.filter(r => r.branch === b).reduce((s, r) => s + r.total, 0);
      if (prev > 0 && cur > 0) branchGrowth[b] = ((cur - prev) / prev) * 100;
    });
    const brGrowthArr = Object.entries(branchGrowth).sort((a, b) => b[1] - a[1]);
    if (brGrowthArr[0] && brGrowthArr[0][1] > 10) {
      insights.push({
        icon: '★',
        color: 'var(--sea)',
        text: `Toko trending naik: <b>${this._esc(this._short(brGrowthArr[0][0]))}</b> (<b>+${brGrowthArr[0][1].toFixed(1)}%</b>)`
      });
    }
    if (brGrowthArr.length > 1 && brGrowthArr[brGrowthArr.length - 1][1] < -15) {
      const [b, g] = brGrowthArr[brGrowthArr.length - 1];
      insights.push({
        icon: '!',
        color: 'var(--danger)',
        text: `Toko perlu perhatian: <b>${this._esc(this._short(b))}</b> (<b>${g.toFixed(1)}%</b>)`
      });
    }

    // 3. Regional terbaik (kalau ada regional data)
    if (useMap && !a.regional) {
      const regTotals = {};
      this.filtered.forEach(r => {
        const reg = (this.branchMeta[r.branch] || {}).regional;
        if (reg) regTotals[reg] = (regTotals[reg] || 0) + r.total;
      });
      const regSorted = Object.entries(regTotals).sort((a, b) => b[1] - a[1]);
      if (regSorted[0]) {
        insights.push({
          icon: '◆',
          color: 'var(--sea)',
          text: `Regional dengan sales terbesar: <b>${this._esc(regSorted[0][0])}</b> (${this._fmtRp(regSorted[0][1])})`
        });
      }
    }

    // 4. Weekend vs weekday
    const wkd = { weekend: 0, weekday: 0, weDays: new Set(), wdDays: new Set() };
    this.filtered.forEach(r => {
      const d = new Date(r.date).getDay();
      const isWe = d === 0 || d === 6;
      if (isWe) { wkd.weekend += r.total; wkd.weDays.add(r.date); }
      else { wkd.weekday += r.total; wkd.wdDays.add(r.date); }
    });
    if (wkd.weDays.size > 0 && wkd.wdDays.size > 0) {
      const weAvg = wkd.weekend / wkd.weDays.size;
      const wdAvg = wkd.weekday / wkd.wdDays.size;
      const diff = ((weAvg - wdAvg) / wdAvg) * 100;
      if (Math.abs(diff) > 5) {
        insights.push({
          icon: diff > 0 ? '☼' : '◐',
          color: 'var(--ink-2)',
          text: diff > 0
            ? `Weekend lebih ramai (<b>+${diff.toFixed(0)}%</b> vs hari kerja)`
            : `Hari kerja lebih ramai (<b>+${(-diff).toFixed(0)}%</b> vs weekend)`
        });
      }
    }

    if (insights.length === 0) return '<div style="color:var(--ink-3);font-size:13px;">Belum ada insight untuk periode ini.</div>';
    return insights.map(i => `<div class="insight-row"><span class="insight-icon" style="color:${i.color}">${i.icon}</span><span>${i.text}</span></div>`).join('');
  },

  // ---- SALES PAGE ----
  _renderSales() {
    const total = this.filtered.reduce((s, r) => s + r.total, 0);
    const days = new Set(this.filtered.map(r => r.date)).size;
    const avg = days > 0 ? total / days : 0;
    const branchCount = new Set(this.filtered.map(r => r.branch)).size;
    const scoped = this._scopedBranches().length;
    const growth = this._computeGrowth();

    document.getElementById('sSales').textContent = this._fmtRp(total);
    document.getElementById('sSalesSub').textContent = days + ' hari';
    document.getElementById('sGrowth').textContent = growth.text;
    document.getElementById('sGrowth').style.color = growth.color;
    document.getElementById('sGrowthSub').textContent = growth.sub;
    document.getElementById('sAvg').textContent = this._fmtRp(avg);
    document.getElementById('sBranch').innerHTML = branchCount + ' <span style="font-size:13px;color:var(--ink-3);font-weight:400;">/ ' + scoped + '</span>';
    document.getElementById('sBranchSub').textContent = (scoped - branchCount) + ' tanpa transaksi';

    this._renderTrend('sTrendChart');
    this._renderChannelBreakdown('sChannels');
    this._renderDowChart();
    this._renderMonthlyChart();
    this._renderCalendarHeatmap();
    this._renderTopLowControls();
    this._renderTopLow();
    this._renderChannelMatrix();
    this._renderConsistency();
  },

  _renderChannelBreakdown(elId) {
    const totals = {};
    let grand = 0;
    CONFIG.CHANNELS.forEach(c => { totals[c] = 0; });
    this.filtered.forEach(r => {
      CONFIG.CHANNELS.forEach(c => { totals[c] += (r.channels[c] || 0); });
    });
    grand = Object.values(totals).reduce((s, v) => s + v, 0);
    const el = document.getElementById(elId);
    if (grand === 0) { el.innerHTML = '<div style="color:var(--ink-3);font-size:13px;">—</div>'; return; }
    const sorted = CONFIG.CHANNELS.map(c => ({ c, v: totals[c] })).sort((a, b) => b.v - a.v);
    const max = sorted[0].v;
    el.innerHTML = sorted.map(({ c, v }) => {
      if (v === 0) return '';
      const pct = grand > 0 ? (v / grand * 100) : 0;
      const barW = max > 0 ? (v / max * 100) : 0;
      return `<div class="channel-row">
        <div class="channel-name">${this._esc(CONFIG.CHANNEL_DISPLAY[c] || c)}</div>
        <div class="channel-bar"><div class="channel-bar-fill${pct < 10 ? ' light' : ''}" style="width:${barW.toFixed(1)}%"></div></div>
        <div class="channel-amount">${this._fmtRp(v)}</div>
        <div class="channel-pct">${pct.toFixed(1)}%</div>
      </div>`;
    }).join('');
  },

  _renderDowChart() {
    const names = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
    const buckets = new Array(7).fill(0);
    const dayCount = new Array(7).fill(0);
    const dates = new Set();
    this.filtered.forEach(r => dates.add(r.date + '|' + new Date(r.date).getDay()));
    dates.forEach(k => {
      const [, d] = k.split('|');
      const idx = (parseInt(d) + 6) % 7; // Sen=0
      dayCount[idx]++;
    });
    this.filtered.forEach(r => {
      const d = new Date(r.date).getDay();
      const idx = (d + 6) % 7;
      buckets[idx] += r.total;
    });
    const avg = buckets.map((v, i) => dayCount[i] > 0 ? v / dayCount[i] : 0);
    const ctx = document.getElementById('sDowChart').getContext('2d');
    if (this.charts.dow) this.charts.dow.destroy();
    const max = Math.max(...avg);
    const colors = avg.map((v, i) => {
      const isWe = i >= 5;
      if (v > max * 0.7) return isWe ? '#F0A030' : '#4A90B8';
      return isWe ? '#F5C88C' : '#85B7EB';
    });
    this.charts.dow = new Chart(ctx, {
      type: 'bar',
      data: { labels: names, datasets: [{ data: avg, backgroundColor: colors, borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1F2937', padding: 10, callbacks: { title: (i) => 'Rata-rata ' + i[0].label, label: (c) => this._fmtRp(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 10 } } },
          y: { grid: { color: 'rgba(232,226,211,0.5)' }, ticks: { color: '#8A93A0', font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  _renderMonthlyChart() {
    // Ambil semua data (bukan cuma filtered) untuk 6-12 bulan terakhir
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthMap = {};
    const useMap = this.regional.length > 0;
    const scoped = new Set(this._scopedBranches());
    const a = this.applied;
    const channelFilter = a.channels && a.channels.length > 0 && a.channels.length < CONFIG.CHANNELS.length;

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      monthMap[k] = 0;
    }

    this.data.forEach(r => {
      const d = new Date(r.date);
      if (d < startMonth) return;
      if (a.branch && r.branch !== a.branch) return;
      if (!a.branch && useMap && (a.regional || a.area) && !scoped.has(r.branch)) return;
      const k = r.date.substring(0, 7);
      if (!(k in monthMap)) return;
      const v = channelFilter ? a.channels.reduce((s, c) => s + (r.channels[c] || 0), 0) : r.total;
      monthMap[k] += v;
    });

    const labels = Object.keys(monthMap).sort();
    const values = labels.map(k => monthMap[k]);
    const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const displayLabels = labels.map(k => {
      const [y, m] = k.split('-');
      return monthNames[parseInt(m) - 1] + ' ' + y.slice(2);
    });
    const currentMonth = this._toDateStr(now).substring(0, 7);
    const colors = labels.map(k => k === currentMonth ? '#4A90B8' : '#85B7EB');
    const ctx = document.getElementById('sMonthlyChart').getContext('2d');
    if (this.charts.monthly) this.charts.monthly.destroy();
    this.charts.monthly = new Chart(ctx, {
      type: 'bar',
      data: { labels: displayLabels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#1F2937', padding: 10, callbacks: { label: (c) => this._fmtRp(c.parsed.y) } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 10 } } },
          y: { grid: { color: 'rgba(232,226,211,0.5)' }, ticks: { color: '#8A93A0', font: { size: 10 }, callback: (v) => this._fmtShort(v) } }
        }
      }
    });
  },

  _renderCalendarHeatmap() {
    // Group filtered by date
    const dayMap = {};
    this.filtered.forEach(r => { dayMap[r.date] = (dayMap[r.date] || 0) + r.total; });
    const dates = Object.keys(dayMap).sort();
    if (dates.length === 0) {
      document.getElementById('sCalendar').innerHTML = '<div style="color:var(--ink-3);font-size:13px;">—</div>';
      return;
    }
    const values = Object.values(dayMap);
    const max = Math.max(...values);
    const min = Math.min(...values);
    // Build grid: minggu (row) × hari (col)
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    // Mulai dari Senin sebelum first date
    const start = new Date(first);
    start.setDate(start.getDate() - ((first.getDay() + 6) % 7));
    // Akhir di Minggu setelah last date
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const dowNames = ['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

    let html = '<div class="cal-wrap">';
    html += '<div class="cal-dow">' + dowNames.map(n => `<div>${n}</div>`).join('') + '</div>';
    html += '<div class="cal-grid">';
    let cur = new Date(start);
    let currentMonth = -1;
    while (cur <= end) {
      const dstr = this._toDateStr(cur);
      const v = dayMap[dstr] || 0;
      const inRange = cur >= first && cur <= last;
      let cls = 'cal-cell';
      let title = this._formatFull(dstr);
      if (v > 0) {
        const norm = max > min ? (v - min) / (max - min) : 1;
        let level = 0;
        if (norm > 0.75) level = 4;
        else if (norm > 0.5) level = 3;
        else if (norm > 0.25) level = 2;
        else level = 1;
        cls += ' l' + level;
        title += ' · ' + this._fmtRp(v);
      } else if (!inRange) {
        cls += ' empty';
      } else {
        cls += ' zero';
        title += ' · tidak ada data';
      }
      // Kalau tanggal 1, label bulan
      if (cur.getDate() === 1 && cur.getMonth() !== currentMonth) {
        currentMonth = cur.getMonth();
        html += `<div class="cal-cell cal-label" title="${monthNames[cur.getMonth()]} ${cur.getFullYear()}">${monthNames[cur.getMonth()].charAt(0)}</div>`;
      } else {
        html += `<div class="${cls}" title="${title}"></div>`;
      }
      cur.setDate(cur.getDate() + 1);
    }
    html += '</div></div>';
    html += '<div class="cal-legend"><span>Rendah</span><div class="cal-cell l1"></div><div class="cal-cell l2"></div><div class="cal-cell l3"></div><div class="cal-cell l4"></div><span>Tinggi</span></div>';
    document.getElementById('sCalendar').innerHTML = html;
  },

  _renderTopLowControls() {
    const a = this.applied;
    let levels;
    if (!a.regional && !a.area && !a.branch) levels = [['regional', 'Per regional'], ['area', 'Per area'], ['branch', 'Per toko']];
    else if (a.regional && !a.area && !a.branch) levels = [['area', 'Per area'], ['branch', 'Per toko']];
    else levels = [['branch', 'Per toko']];
    if (a.branch) {
      document.getElementById('sTopLowWrap').hidden = true;
      document.getElementById('sSingleNote').hidden = false;
      return;
    }
    document.getElementById('sTopLowWrap').hidden = false;
    document.getElementById('sSingleNote').hidden = true;

    if (!levels.find(l => l[0] === this.topGroup)) this.topGroup = levels[levels.length - 1][0];
    if (!levels.find(l => l[0] === this.lowGroup)) this.lowGroup = levels[levels.length - 1][0];

    const build = (id, current, count, isTop) => {
      document.getElementById(id).innerHTML = `
        <select class="btn" style="padding:6px 10px; font-size:12px;">
          ${levels.map(([v, l]) => `<option value="${v}"${v === current ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
        <input type="number" min="1" max="100" class="btn" value="${count}" style="width:56px; padding:6px 8px; font-size:12px; text-align:center;" />
      `;
      const c = document.getElementById(id);
      const sel = c.querySelector('select');
      const inp = c.querySelector('input');
      sel.addEventListener('change', () => {
        if (isTop) { this.topGroup = sel.value; this._save('topGroup', sel.value); }
        else { this.lowGroup = sel.value; this._save('lowGroup', sel.value); }
        this._renderTopLow();
      });
      inp.addEventListener('change', () => {
        let v = parseInt(inp.value) || 5;
        if (v < 1) v = 1; if (v > 100) v = 100;
        inp.value = v;
        if (isTop) { this.topCount = v; this._save('topCount', v); }
        else { this.lowCount = v; this._save('lowCount', v); }
        this._renderTopLow();
      });
    };
    build('sTopControls', this.topGroup, this.topCount, true);
    build('sLowControls', this.lowGroup, this.lowCount, false);
  },

  _renderTopLow() {
    if (this.applied.branch) return;
    const build = (group) => {
      const map = {};
      this.filtered.forEach(r => {
        let k;
        if (group === 'branch') k = r.branch;
        else if (group === 'area') k = (this.branchMeta[r.branch] || {}).area || '(tanpa area)';
        else k = (this.branchMeta[r.branch] || {}).regional || '(tanpa regional)';
        map[k] = (map[k] || 0) + r.total;
      });
      return Object.entries(map).map(([k, v]) => ({ key: k, val: v })).filter(x => x.val > 0);
    };
    const top = build(this.topGroup).sort((a, b) => b.val - a.val).slice(0, this.topCount);
    const low = build(this.lowGroup).sort((a, b) => a.val - b.val).slice(0, this.lowCount);
    document.getElementById('sTopList').innerHTML = this._renderRank(top, this.topGroup === 'branch');
    document.getElementById('sLowList').innerHTML = this._renderRank(low, this.lowGroup === 'branch');
  },

  _renderChannelMatrix() {
    // Table: rows = top 10 toko by total, cols = channels (sorted by total), cells = % kontribusi channel di toko itu
    const totals = {};
    this.filtered.forEach(r => { totals[r.branch] = (totals[r.branch] || 0) + r.total; });
    const topBranches = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([b]) => b);

    // Channel totals for column order
    const chTotals = {};
    CONFIG.CHANNELS.forEach(c => { chTotals[c] = 0; });
    this.filtered.forEach(r => CONFIG.CHANNELS.forEach(c => { chTotals[c] += (r.channels[c] || 0); }));
    const activeChannels = CONFIG.CHANNELS.filter(c => chTotals[c] > 0).sort((a, b) => chTotals[b] - chTotals[a]);

    if (topBranches.length === 0 || activeChannels.length === 0) {
      document.getElementById('sMatrix').innerHTML = '<div style="color:var(--ink-3);font-size:13px;">—</div>';
      return;
    }

    // Build data per branch per channel
    const cellMap = {};
    topBranches.forEach(b => {
      cellMap[b] = { total: 0 };
      activeChannels.forEach(c => { cellMap[b][c] = 0; });
    });
    this.filtered.forEach(r => {
      if (!cellMap[r.branch]) return;
      activeChannels.forEach(c => {
        cellMap[r.branch][c] += (r.channels[c] || 0);
        cellMap[r.branch].total += (r.channels[c] || 0);
      });
    });

    let html = '<div class="matrix-wrap"><table class="matrix"><thead><tr><th>Toko</th>';
    activeChannels.forEach(c => { html += `<th>${this._esc(CONFIG.CHANNEL_DISPLAY[c] || c)}</th>`; });
    html += '</tr></thead><tbody>';
    topBranches.forEach(b => {
      html += `<tr><td class="matrix-branch">${this._esc(this._short(b))}</td>`;
      activeChannels.forEach(c => {
        const v = cellMap[b][c];
        const pct = cellMap[b].total > 0 ? (v / cellMap[b].total * 100) : 0;
        let level = 0;
        if (pct > 40) level = 4;
        else if (pct > 25) level = 3;
        else if (pct > 10) level = 2;
        else if (pct > 0) level = 1;
        html += `<td class="matrix-cell l${level}" title="${this._esc(this._short(b))} · ${this._esc(CONFIG.CHANNEL_DISPLAY[c] || c)}: ${this._fmtRp(v)} (${pct.toFixed(1)}%)">${pct > 5 ? pct.toFixed(0) + '%' : ''}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    document.getElementById('sMatrix').innerHTML = html;
  },

  _renderConsistency() {
    // Untuk tiap toko dalam filter, hitung mean & std dev per hari
    const branchDays = {};
    this.filtered.forEach(r => {
      (branchDays[r.branch] = branchDays[r.branch] || []).push(r.total);
    });
    const arr = [];
    Object.entries(branchDays).forEach(([b, vals]) => {
      if (vals.length < 3) return;
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      const std = Math.sqrt(variance);
      const cv = mean > 0 ? (std / mean) * 100 : 0;
      arr.push({ branch: b, mean, cv });
    });
    if (arr.length === 0) {
      document.getElementById('sConsistency').innerHTML = '<div style="color:var(--ink-3);font-size:13px;">Perlu minimal 3 hari data per toko.</div>';
      return;
    }
    arr.sort((a, b) => a.cv - b.cv);
    const stable = arr.slice(0, 5);
    const fluct = arr.slice(-5).reverse();

    const renderList = (items) => items.map(x => `
      <div class="rank-row">
        <div class="rank-left"><span class="rank-name">${this._esc(this._short(x.branch))}</span></div>
        <span class="rank-meta">CV ${x.cv.toFixed(1)}%</span>
        <span class="rank-amount">${this._fmtRp(x.mean)}/hari</span>
      </div>
    `).join('');

    document.getElementById('sConsistency').innerHTML = `
      <div style="margin-bottom:12px;">
        <div style="font-size:11px; color:var(--ink-3); margin-bottom:6px; letter-spacing:0.06em; text-transform:uppercase;">Paling stabil (CV rendah)</div>
        ${renderList(stable)}
      </div>
      <div>
        <div style="font-size:11px; color:var(--ink-3); margin-bottom:6px; letter-spacing:0.06em; text-transform:uppercase;">Paling fluktuatif (CV tinggi)</div>
        ${renderList(fluct)}
      </div>
      <div style="font-size:11px; color:var(--ink-3); margin-top:10px;">CV = koefisien variasi. Semakin rendah = sales harian semakin konsisten.</div>
    `;
  },

  // ---- SETTINGS ----
  _bindSettingsPage() {
    document.querySelectorAll('#themeToggle button').forEach(b => {
      b.addEventListener('click', () => {
        this.theme = b.dataset.theme;
        this._save('theme', this.theme);
        this._applyTheme();
        this._renderSettings();
      });
    });
    const mo = document.getElementById('moneyFormatOptions');
    mo.innerHTML = Object.entries(CONFIG.MONEY_FORMATS).map(([k, v]) =>
      `<label><input type="radio" name="mf" value="${k}"${this.moneyFormat === k ? ' checked' : ''}/><span>${this._esc(v.label)}</span></label>`
    ).join('');
    mo.querySelectorAll('input[name="mf"]').forEach(inp => {
      inp.addEventListener('change', () => {
        this.moneyFormat = inp.value;
        this._save('moneyFormat', inp.value);
        this._renderAll();
      });
    });
    const sl = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) sl.href = CONFIG.SHEET_URL;
    else sl.parentElement.hidden = true;
    document.getElementById('btnClearCache').addEventListener('click', async () => {
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
      if ('serviceWorker' in navigator) { const r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(x => x.unregister())); }
      this._toast('Cache dibersihkan. Refresh halaman.');
    });
    document.getElementById('btnReload').addEventListener('click', () => this.loadAll());
  },

  _renderSettings() {
    document.querySelectorAll('#themeToggle button').forEach(b => b.classList.toggle('active', b.dataset.theme === this.theme));
    if (this.status) {
      document.getElementById('stStatus').textContent = 'Terhubung';
      document.getElementById('stStatus').style.color = 'var(--sea)';
      document.getElementById('stLastUpdate').textContent = new Date(this.status.timestamp).toLocaleString('id-ID');
      document.getElementById('stRowCount').textContent = (this.status.rowCount || 0).toLocaleString('id-ID');
      document.getElementById('stLastDate').textContent = this.status.lastDate ? this._formatFull(this.status.lastDate) : '—';
      document.getElementById('stDays').textContent = (this.status.distinctDates || 0) + ' hari';
      document.getElementById('stActive').textContent = this.activeBranches.length + ' toko';

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
      // Proyeksi umur
      if (this.status.distinctDates > 0 && this.status.usage > 0) {
        const perDay = this.status.usage / this.status.distinctDates;
        const daysLeft = Math.round((1 - this.status.usage) / perDay);
        document.getElementById('stCapNote').textContent = `Proyeksi: cukup untuk ~${daysLeft.toLocaleString('id-ID')} hari data lagi (dengan pola saat ini)`;
      }
    } else {
      document.getElementById('stStatus').textContent = 'Belum terhubung';
    }
  },

  // ==========================================================================
  // TREND CHART
  // ==========================================================================
  _renderTrend(canvasId) {
    const map = {};
    this.filtered.forEach(r => { map[r.date] = (map[r.date] || 0) + r.total; });
    const dates = Object.keys(map).sort();
    const values = dates.map(d => map[d]);
    const labels = dates.map(d => { const [, m, day] = d.split('-'); return parseInt(day) + '/' + parseInt(m); });
    const ctx = document.getElementById(canvasId).getContext('2d');
    const key = 'trend_' + canvasId;
    if (this.charts[key]) this.charts[key].destroy();
    this.charts[key] = new Chart(ctx, {
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
  // UPLOAD
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
      // Cek duplikat
      const pairs = parsed.rows.map(r => ({ date: r.date, branch: r.branch }));
      const dup = await Sheets.checkDuplicate(pairs);
      this._uploadCtx = { parsed, dup };
      const meta = parsed.meta;
      preview.innerHTML = `<div class="file-preview">
        <div class="file-preview-name">${this._esc(file.name)}</div>
        <div class="file-preview-meta">${this._formatShort(meta.dateStart)}${meta.dateStart !== meta.dateEnd ? ' – ' + this._formatShort(meta.dateEnd) : ''} · ${meta.branches.length} toko · ${meta.rowCount.toLocaleString('id-ID')} baris · ${this._fmtRp(meta.totalSales)}</div>
      </div>`;
      // Tampilkan info duplikat
      res.hidden = false;
      if (dup.duplicates === 0) {
        res.innerHTML = `<div class="info-box"><b>Semua baru:</b> ${dup.newOnes.toLocaleString('id-ID')} baris siap diupload.</div>`;
        actions.hidden = false;
        actions.innerHTML = `<button class="btn" data-close>Batal</button><button class="btn btn-primary" id="btnUploadNewInner">Upload semua</button>`;
        document.getElementById('btnUploadNewInner').addEventListener('click', () => this._doUploadAll());
      } else if (dup.newOnes === 0) {
        res.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Semua data sudah ada</div><div class="error-box-msg">${dup.duplicates.toLocaleString('id-ID')} baris di file ini sudah ada di spreadsheet. Tidak ada yang perlu diupload.</div></div></div>`;
      } else {
        res.innerHTML = `<div class="warn-box">
          <b>Sebagian data sudah ada:</b><br>
          • ${dup.newOnes.toLocaleString('id-ID')} baris <b>baru</b> (tanggal + toko belum ada di spreadsheet)<br>
          • ${dup.duplicates.toLocaleString('id-ID')} baris <b>duplikat</b> (sudah ada)
        </div>
        <div style="font-size:12px; color:var(--ink-2); margin-bottom:8px;">Mau upload yang mana?</div>`;
        actions.hidden = false;
        actions.innerHTML = `
          <button class="btn" data-close>Batal</button>
          <button class="btn btn-primary" id="btnUploadNewInner">Upload ${dup.newOnes} baris baru saja</button>
        `;
        document.getElementById('btnUploadNewInner').addEventListener('click', () => this._doUploadNewOnly());
      }
      // Re-bind close
      actions.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => this._closeUpload()));
    } catch (e) {
      preview.hidden = true;
      err.hidden = false;
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Gagal memproses file</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
    }
  },

  async _doUploadNewOnly() {
    if (!this._uploadCtx) return;
    const dupSet = new Set(this._uploadCtx.dup.duplicatePairs.map(p => p.date + '|' + p.branch));
    // Karena backend cuma return sampling 20 duplikat, kita perlu recompute local
    // Tapi karena backend sudah bilang X duplicates, kita filter dari full list
    // Cara aman: query ulang dengan full pairs
    const allPairs = this._uploadCtx.parsed.rows.map(r => ({ date: r.date, branch: r.branch }));
    this._setUploadStatus('Mengecek ulang duplikat...', 20);
    const fullCheck = await Sheets.checkDuplicate(allPairs);
    // Backend return duplicatePairs.slice(0,20) — jadi kita tidak dapat semua. Solusi: filter di server side.
    // Untuk itu, kita cek local dari duplicatePairs SEMUA (perlu backend return semua)
    // WORKAROUND: kirim ke server semua rows, dan minta server yang filter
    await this._doUploadWithFilter(true);
  },

  async _doUploadAll() {
    await this._doUploadWithFilter(false);
  },

  async _doUploadWithFilter(filterDupes) {
    if (!this._uploadCtx) return;
    const actions = document.getElementById('uploadActions');
    actions.querySelectorAll('button').forEach(b => b.disabled = true);
    this._setUploadStatus('Menyiapkan upload...', 5);
    try {
      let rowsToUpload = this._uploadCtx.parsed.rows;
      if (filterDupes) {
        // Query semua duplikat dulu (perlu semua, bukan cuma 20)
        // Solusi cepat: kita panggil checkDuplicate dan asumsikan duplicatePairs return semua
        // Karena backend cap ke 20, kita re-implement filter di frontend dengan pair by pair
        // Cara paling clean: kita filter di frontend dengan re-fetch semua data existing
        this._setUploadStatus('Filter duplikat...', 15);
        // Panggil server untuk cek semua, tapi karena payload 20 tidak cukup, kita cek berdasar
        // duplicatePairs yang sudah ada + fetch full data
        const full = await Sheets.fetchAll();
        const existing = new Set(full.map(r => r.date + '|' + r.branch));
        rowsToUpload = rowsToUpload.filter(r => !existing.has(r.date + '|' + r.branch));
      }
      if (rowsToUpload.length === 0) {
        this._setUploadStatus('Tidak ada baris baru untuk diupload.', 100);
        setTimeout(() => this._closeUpload(), 1200);
        return;
      }
      // Chunk upload (500 per batch)
      const CHUNK = 500;
      const total = rowsToUpload.length;
      let done = 0;
      for (let i = 0; i < total; i += CHUNK) {
        const slice = rowsToUpload.slice(i, i + CHUNK);
        this._setUploadStatus(`Upload ${Math.min(i + CHUNK, total).toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')}`, 15 + Math.round((i / total) * 80));
        await Sheets.upload(slice);
        done += slice.length;
      }
      this._setUploadStatus(`Selesai. ${done.toLocaleString('id-ID')} baris ditambahkan.`, 100);
      this._toast('Upload berhasil: ' + done + ' baris');
      setTimeout(() => this._closeUpload(), 1200);
      await this.loadAll();
    } catch (e) {
      const err = document.getElementById('uploadError');
      err.hidden = false;
      err.innerHTML = `<div class="error-box"><div class="error-box-icon">!</div><div><div class="error-box-title">Upload gagal</div><div class="error-box-msg">${this._esc(e.message)}</div></div></div>`;
      actions.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  },

  _setUploadStatus(msg, pct) {
    const preview = document.getElementById('filePreview');
    if (preview) {
      let m = preview.querySelector('#upMsg');
      let f = preview.querySelector('#upFill');
      if (!m || !f) {
        const meta = this._uploadCtx && this._uploadCtx.parsed && this._uploadCtx.parsed.meta;
        preview.innerHTML = `<div class="file-preview">
          <div class="file-preview-name">${this._esc(meta ? meta.fileName : '')}</div>
          <div class="file-preview-meta" id="upMsg">${this._esc(msg)}</div>
          <div class="upload-progress"><div class="upload-progress-fill" id="upFill" style="width:${pct}%"></div></div>
        </div>`;
      } else {
        m.textContent = msg;
        f.style.width = pct + '%';
      }
    }
  },

  // ==========================================================================
  // HELPERS
  // ==========================================================================
  _groupSum(arr, kf, vf) {
    const m = {};
    arr.forEach(x => { const k = kf(x); m[k] = (m[k] || 0) + vf(x); });
    return Object.entries(m).map(([key, val]) => ({ key, val })).sort((a, b) => b.val - a.val);
  },
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
