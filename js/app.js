// ============================================================================
// APLIKASI UTAMA — v3
// ============================================================================

const CHANNELS_ORDER = ['DINE IN','TAKE AWAY','GRABFOOD','GOFOOD','SHOPEE FOOD','BAZAR','CATERING','ESB Order Delivery','ESB Order Pickup','PAKAR'];

const App = {
  data: [],
  regional: [],
  filtered: [],
  branchMeta: {},        // branch -> {regional, area}
  activeBranches: [],    // Semua branch di sheet Regional
  areaToRegional: {},    // area -> regional
  regionalToAreas: {},   // regional -> [areas]
  regionalToBranches: {},// regional -> [branches]
  areaToBranches: {},    // area -> [branches]
  trendChart: null,
  trendDates: [],
  moneyFormat: 'auto',
  topGroup: 'branch', topCount: 5,
  lowGroup: 'branch', lowCount: 5,
  dd: {},
  _suppressCascade: false,

  async init() {
    this._loadSettings();
    this._bindTopbar();
    this._bindDateInputs();
    this._bindSettingsModal();
    this._bindPullToRefresh();
    this._bindWindowFocus();
    this._bindTopLowInputs();
    this._initDropdowns();
    this._setPeriode('current');
    await this.loadData();
  },

  // ==========================================================================
  // SETTINGS PERSISTENCE
  // ==========================================================================
  _loadSettings() {
    this.moneyFormat = localStorage.getItem('moneyFormat') || 'auto';
    // Legacy formats fallback ke auto
    if (this.moneyFormat !== 'auto' && this.moneyFormat !== 'full') this.moneyFormat = 'auto';
    this.topCount = parseInt(localStorage.getItem('topCount')) || 5;
    this.lowCount = parseInt(localStorage.getItem('lowCount')) || 5;
    this.topGroup = localStorage.getItem('topGroup') || 'branch';
    this.lowGroup = localStorage.getItem('lowGroup') || 'branch';
  },
  _saveSetting(k, v) { localStorage.setItem(k, v); },

  // ==========================================================================
  // TOPBAR
  // ==========================================================================
  _bindTopbar() {
    document.getElementById('topbarLeft').addEventListener('click', () => this.loadData());
    document.getElementById('btnSettings').addEventListener('click', () => this._openSettings());
  },

  _bindDateInputs() {
    const from = document.getElementById('fFrom');
    const to = document.getElementById('fTo');
    from.addEventListener('change', () => {
      this.dd.periode.setValue('custom');
      this._applyFilters();
    });
    to.addEventListener('change', () => {
      this.dd.periode.setValue('custom');
      this._applyFilters();
    });
  },

  _bindTopLowInputs() {
    const numTop = document.getElementById('numTopCount');
    const numLow = document.getElementById('numLowCount');
    numTop.value = this.topCount;
    numLow.value = this.lowCount;
    const handler = (input, isTop) => {
      let v = parseInt(input.value) || 5;
      if (v < 1) v = 1;
      if (v > 100) v = 100;
      input.value = v;
      if (isTop) { this.topCount = v; this._saveSetting('topCount', v); }
      else { this.lowCount = v; this._saveSetting('lowCount', v); }
      this._renderRanks();
    };
    numTop.addEventListener('change', () => handler(numTop, true));
    numLow.addEventListener('change', () => handler(numLow, false));
  },

  _bindPullToRefresh() {
    const indicator = document.getElementById('ptrIndicator');
    let startY = 0, pulling = false;
    const threshold = 70;
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) { startY = e.touches[0].pageY; pulling = true; }
      else pulling = false;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!pulling) return;
      const delta = e.touches[0].pageY - startY;
      if (delta > 0 && window.scrollY === 0) {
        const h = Math.min(delta * 0.5, 60);
        indicator.style.height = h + 'px';
        indicator.querySelector('span').textContent = delta > threshold
          ? 'Lepas untuk refresh' : 'Tarik untuk refresh';
      }
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!pulling) return;
      const delta = (e.changedTouches[0].pageY - startY);
      if (delta > threshold && window.scrollY === 0) {
        indicator.style.height = '40px';
        indicator.querySelector('span').textContent = 'Memuat...';
        this.loadData().finally(() => {
          setTimeout(() => { indicator.style.height = '0'; }, 400);
        });
      } else {
        indicator.style.height = '0';
      }
      pulling = false; startY = 0;
    });
  },

  _bindWindowFocus() {
    let lastLoad = Date.now();
    window.addEventListener('focus', () => {
      if (Date.now() - lastLoad > 30000) {
        this.loadData();
        lastLoad = Date.now();
      }
    });
  },

  // ==========================================================================
  // DROPDOWNS
  // ==========================================================================
  _initDropdowns() {
    this.dd.regional = new Dropdown(document.getElementById('ddRegional'), {
      items: [], value: '', allLabel: 'Semua Regional', placeholder: 'Cari regional...',
      onChange: (v) => this._onRegionalChange(v)
    });
    this.dd.area = new Dropdown(document.getElementById('ddArea'), {
      items: [], value: '', allLabel: 'Semua Area', placeholder: 'Cari area...',
      onChange: (v) => this._onAreaChange(v)
    });
    this.dd.branch = new Dropdown(document.getElementById('ddBranch'), {
      items: [], value: '', allLabel: 'Semua Toko', placeholder: 'Cari nama toko...',
      onChange: (v) => this._onBranchChange(v)
    });
    this.dd.channel = new Dropdown(document.getElementById('ddChannel'), {
      items: CONFIG.CHANNELS.map(c => ({ value: c, label: CONFIG.CHANNEL_DISPLAY[c] || c })),
      value: [], multi: true, allLabel: 'Semua channel', placeholder: 'Cari channel...',
      onChange: () => this._applyFilters()
    });
    this.dd.periode = new Dropdown(document.getElementById('ddPeriode'), {
      items: [
        { value: 'current', label: 'Bulan berjalan' },
        { value: 'last', label: 'Bulan lalu' },
        { value: 'last7', label: '7 hari terakhir' },
        { value: 'last30', label: '30 hari terakhir' },
        { value: 'custom', label: 'Rentang khusus' }
      ],
      value: 'current', allLabel: 'Bulan berjalan',
      onChange: (v) => { this._setPeriode(v); this._applyFilters(); }
    });

    // Top/Low group — items dinamis, akan di-update saat filter berubah
    this.dd.topGroup = new Dropdown(document.getElementById('ddTopGroup'), {
      items: [], value: this.topGroup, allLabel: 'Per toko',
      onChange: (v) => { this.topGroup = v; this._saveSetting('topGroup', v); this._renderRanks(); }
    });
    this.dd.lowGroup = new Dropdown(document.getElementById('ddLowGroup'), {
      items: [], value: this.lowGroup, allLabel: 'Per toko',
      onChange: (v) => { this.lowGroup = v; this._saveSetting('lowGroup', v); this._renderRanks(); }
    });
  },

  // ==========================================================================
  // CASCADING FILTER LOGIC
  // ==========================================================================
  _onRegionalChange(v) {
    if (this._suppressCascade) return;
    if (!v) {
      // Semua Regional → reset area & branch ke semua
      this._suppressCascade = true;
      this.dd.area.setValue('');
      this.dd.branch.setValue('');
      this._suppressCascade = false;
    } else {
      // Kalau area/branch yang dipilih tidak dalam regional baru, reset
      const area = this.dd.area.getValue();
      const branch = this.dd.branch.getValue();
      this._suppressCascade = true;
      if (area && this.areaToRegional[area] !== v) this.dd.area.setValue('');
      if (branch) {
        const meta = this.branchMeta[branch];
        if (!meta || meta.regional !== v) this.dd.branch.setValue('');
      }
      this._suppressCascade = false;
    }
    this._refreshDropdownOptions();
    this._applyFilters();
  },

  _onAreaChange(v) {
    if (this._suppressCascade) return;
    if (v) {
      // Auto-set regional ke regional area ini
      const parentRegional = this.areaToRegional[v];
      this._suppressCascade = true;
      if (parentRegional && this.dd.regional.getValue() !== parentRegional) {
        this.dd.regional.setValue(parentRegional);
      }
      // Kalau branch yang dipilih tidak dalam area baru, reset
      const branch = this.dd.branch.getValue();
      if (branch) {
        const meta = this.branchMeta[branch];
        if (!meta || meta.area !== v) this.dd.branch.setValue('');
      }
      this._suppressCascade = false;
    }
    this._refreshDropdownOptions();
    this._applyFilters();
  },

  _onBranchChange(v) {
    if (this._suppressCascade) return;
    if (v) {
      // Auto-set regional & area ke milik branch ini
      const meta = this.branchMeta[v];
      if (meta) {
        this._suppressCascade = true;
        if (this.dd.regional.getValue() !== meta.regional) this.dd.regional.setValue(meta.regional);
        if (this.dd.area.getValue() !== meta.area) this.dd.area.setValue(meta.area);
        this._suppressCascade = false;
      }
    }
    this._refreshDropdownOptions();
    this._applyFilters();
  },

  _refreshDropdownOptions() {
    // Update area & branch options berdasarkan pilihan sekarang
    const reg = this.dd.regional.getValue();
    const area = this.dd.area.getValue();

    let areas = Object.keys(this.regionalToAreas).reduce((acc, r) => {
      if (!reg || r === reg) acc.push(...this.regionalToAreas[r]);
      return acc;
    }, []);
    areas = Array.from(new Set(areas)).sort();
    this._suppressCascade = true;
    this.dd.area.setItems(areas.map(a => ({ value: a, label: a })));
    this._suppressCascade = false;

    let branches;
    if (this.regional.length > 0) {
      branches = this.regional
        .filter(r => !reg || r.regional === reg)
        .filter(r => !area || r.area === area)
        .map(r => r.branch);
    } else {
      branches = Array.from(new Set(this.data.map(r => r.branch)));
    }
    branches = Array.from(new Set(branches)).sort();
    this._suppressCascade = true;
    this.dd.branch.setItems(branches.map(b => ({ value: b, label: this._shortBranch(b) })));
    this._suppressCascade = false;
  },

  // ==========================================================================
  // TOP/LOW GROUP OPTIONS (dinamis)
  // ==========================================================================
  _updateTopLowControls() {
    const reg = this.dd.regional.getValue();
    const area = this.dd.area.getValue();
    const branch = this.dd.branch.getValue();

    const wrap = document.getElementById('topLowWrap');
    const note = document.getElementById('singleBranchNote');

    // Kalau 1 toko dipilih → sembunyikan top/low
    if (branch) {
      wrap.hidden = true;
      note.hidden = false;
      return;
    }
    wrap.hidden = false;
    note.hidden = true;

    // Build options
    const groupItems = [];
    if (!reg && !area) {
      groupItems.push({ value: 'regional', label: 'Per regional' });
      groupItems.push({ value: 'area', label: 'Per area' });
      groupItems.push({ value: 'branch', label: 'Per toko' });
    } else if (reg && !area) {
      // Regional spesifik → hanya area & toko
      groupItems.push({ value: 'area', label: 'Per area' });
      groupItems.push({ value: 'branch', label: 'Per toko' });
    } else {
      // Area spesifik (atau regional+area) → hanya toko
      groupItems.push({ value: 'branch', label: 'Per toko' });
    }

    const validVals = groupItems.map(x => x.value);
    if (!validVals.includes(this.topGroup)) this.topGroup = groupItems[groupItems.length - 1].value;
    if (!validVals.includes(this.lowGroup)) this.lowGroup = groupItems[groupItems.length - 1].value;

    this.dd.topGroup.setItems(groupItems);
    this.dd.topGroup.setValue(this.topGroup);
    this.dd.lowGroup.setItems(groupItems);
    this.dd.lowGroup.setValue(this.lowGroup);
  },

  // ==========================================================================
  // PERIODE
  // ==========================================================================
  _setPeriode(mode) {
    const now = new Date();
    let from, to = now;
    if (mode === 'current') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (mode === 'last') { from = new Date(now.getFullYear(), now.getMonth() - 1, 1); to = new Date(now.getFullYear(), now.getMonth(), 0); }
    else if (mode === 'last7') { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (mode === 'last30') { from = new Date(now); from.setDate(from.getDate() - 29); }
    else return;
    document.getElementById('fFrom').value = this._toDateInput(from);
    document.getElementById('fTo').value = this._toDateInput(to);
  },

  _toDateInput(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================
  async loadData() {
    this._showStatus('Memuat data...');
    try {
      const [sales, regional] = await Promise.all([
        Sheets.fetchAll(),
        Sheets.fetchRegional().catch(() => [])
      ]);
      this.data = sales;
      this.regional = regional;
      this._buildBranchMeta();
      this._populateFilters();
      this._autoAdjustFilter();
      this._applyFilters();
      this._hideStatus();
      this._updateInfoPanel(/*ok*/ true);
    } catch (e) {
      this._showStatus('Gagal: ' + e.message);
      this._updateInfoPanel(/*ok*/ false, e.message);
    }
  },

  _showStatus(msg) {
    const el = document.getElementById('lastUpdate');
    el.textContent = msg;
    el.hidden = false;
  },
  _hideStatus() {
    document.getElementById('lastUpdate').hidden = true;
  },

  _buildBranchMeta() {
    this.branchMeta = {};
    this.activeBranches = [];
    this.areaToRegional = {};
    this.regionalToAreas = {};
    this.regionalToBranches = {};
    this.areaToBranches = {};
    this.regional.forEach(r => {
      this.branchMeta[r.branch] = { regional: r.regional, area: r.area };
      this.activeBranches.push(r.branch);
      this.areaToRegional[r.area] = r.regional;
      (this.regionalToAreas[r.regional] = this.regionalToAreas[r.regional] || []).push(r.area);
      (this.regionalToBranches[r.regional] = this.regionalToBranches[r.regional] || []).push(r.branch);
      (this.areaToBranches[r.area] = this.areaToBranches[r.area] || []).push(r.branch);
    });
    // Dedupe areas per regional
    Object.keys(this.regionalToAreas).forEach(k => {
      this.regionalToAreas[k] = Array.from(new Set(this.regionalToAreas[k]));
    });
  },

  _populateFilters() {
    const regionals = Array.from(new Set(this.regional.map(r => r.regional))).sort();
    this._suppressCascade = true;
    this.dd.regional.setItems(regionals.map(r => ({ value: r, label: r })));
    this._suppressCascade = false;
    this._refreshDropdownOptions();
  },

  _autoAdjustFilter() {
    if (this.data.length === 0) return;
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const inRange = this.data.some(r => r.date >= from && r.date <= to);
    if (inRange) return;
    const latest = this._latestDate();
    const [y, m] = latest.split('-');
    document.getElementById('fFrom').value = y + '-' + m + '-01';
    document.getElementById('fTo').value = latest;
    this.dd.periode.setValue('custom');
  },

  // ==========================================================================
  // APPLY FILTERS
  // ==========================================================================
  _applyFilters() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const reg = this.dd.regional.getValue();
    const area = this.dd.area.getValue();
    const branch = this.dd.branch.getValue();
    const channels = this.dd.channel.getValue();

    // Set scope toko yang dianggap "dalam filter" (dari regional mapping)
    const scopedBranches = this._getScopedBranches();
    const scopedSet = new Set(scopedBranches);
    const useMapping = this.regional.length > 0;

    this.filtered = this.data.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (branch) return r.branch === branch;
      // Kalau ada mapping regional: hanya toko dalam scope yang lolos
      if (useMapping && (reg || area)) {
        if (!scopedSet.has(r.branch)) return false;
      }
      return true;
    });

    if (channels && channels.length > 0 && channels.length < CONFIG.CHANNELS.length) {
      this.filtered = this.filtered.map(r => ({
        ...r,
        total: channels.reduce((s, ch) => s + (r.channels[ch] || 0), 0)
      })).filter(r => r.total > 0);
    }

    this._updateTopLowControls();
    this._render();
  },

  _getScopedBranches() {
    const reg = this.dd.regional.getValue();
    const area = this.dd.area.getValue();
    const branch = this.dd.branch.getValue();
    if (branch) return [branch];
    if (this.regional.length === 0) return Array.from(new Set(this.data.map(r => r.branch)));
    return this.regional
      .filter(r => !reg || r.regional === reg)
      .filter(r => !area || r.area === area)
      .map(r => r.branch);
  },

  _render() {
    this._renderMetrics();
    this._renderChannel();
    this._renderRanks();
    this._renderTrend();
  },

  // ==========================================================================
  // METRICS
  // ==========================================================================
  _renderMetrics() {
    const total = this.filtered.reduce((s, r) => s + r.total, 0);
    const days = new Set(this.filtered.map(r => r.date)).size;
    const branchCount = new Set(this.filtered.map(r => r.branch)).size;
    const scopedBranches = this._getScopedBranches();
    const totalBranchScoped = scopedBranches.length;
    const avg = days > 0 ? total / days : 0;

    // Growth
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    let growthTxt = '—', growthColor = null, growthSub = 'Dibanding periode sebelumnya';
    if (from && to) {
      const fromD = new Date(from);
      const toD = new Date(to);
      const dayCount = Math.round((toD - fromD) / 86400000) + 1;
      const prevTo = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
      const prevFromStr = this._toDateInput(prevFrom);
      const prevToStr = this._toDateInput(prevTo);
      const branch = this.dd.branch.getValue();
      const channels = this.dd.channel.getValue();
      const scopedSet = new Set(scopedBranches);
      const useMapping = this.regional.length > 0;
      const reg = this.dd.regional.getValue();
      const area = this.dd.area.getValue();

      const prev = this.data.filter(r => {
        if (r.date < prevFromStr || r.date > prevToStr) return false;
        if (branch) return r.branch === branch;
        if (useMapping && (reg || area)) return scopedSet.has(r.branch);
        return true;
      });
      const prevTotal = prev.reduce((s, r) => {
        if (channels && channels.length > 0 && channels.length < CONFIG.CHANNELS.length) {
          return s + channels.reduce((c, ch) => c + (r.channels[ch] || 0), 0);
        }
        return s + r.total;
      }, 0);
      const prevDays = new Set(prev.map(r => r.date)).size;
      const prevAvg = prevDays > 0 ? prevTotal / prevDays : 0;
      if (prevAvg > 0) {
        const g = ((avg - prevAvg) / prevAvg) * 100;
        growthTxt = (g >= 0 ? '+' : '') + g.toFixed(1) + '%';
        growthColor = g >= 0 ? 'var(--sea)' : 'var(--danger)';
        growthSub = 'vs ' + this._formatDateShort(prevFromStr) + ' – ' + this._formatDateShort(prevToStr);
      }
    }

    document.getElementById('mSales').textContent = this._fmtRp(total);
    document.getElementById('mSalesSub').textContent = days + ' hari · ' + this._formatRange();
    document.getElementById('mGrowth').textContent = growthTxt;
    document.getElementById('mGrowth').style.color = growthColor || 'var(--sea)';
    document.getElementById('mGrowthSub').textContent = growthSub;
    document.getElementById('mAvg').textContent = this._fmtRp(avg);
    document.getElementById('mAvgSub').textContent = days + ' hari aktif';
    document.getElementById('mBranch').innerHTML = branchCount + ' <span style="font-size:13px;color:var(--ink-3);font-weight:400;">/ ' + totalBranchScoped + '</span>';
    document.getElementById('mBranchSub').textContent = totalBranchScoped > 0
      ? (totalBranchScoped - branchCount) + ' tanpa transaksi'
      : 'Total toko dalam filter';
  },

  // ==========================================================================
  // CHANNEL
  // ==========================================================================
  _renderChannel() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const branch = this.dd.branch.getValue();
    const reg = this.dd.regional.getValue();
    const area = this.dd.area.getValue();
    const scopedSet = new Set(this._getScopedBranches());
    const useMapping = this.regional.length > 0;

    const base = this.data.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (branch) return r.branch === branch;
      if (useMapping && (reg || area)) return scopedSet.has(r.branch);
      return true;
    });

    const totals = {};
    let grand = 0;
    CHANNELS_ORDER.forEach(ch => {
      totals[ch] = base.reduce((s, r) => s + (r.channels[ch] || 0), 0);
      grand += totals[ch];
    });

    const list = document.getElementById('channelList');
    if (grand === 0) {
      list.innerHTML = '<div style="color:var(--ink-3);font-size:13px;">Tidak ada data pada periode ini.</div>';
      return;
    }
    const sorted = CHANNELS_ORDER.map(ch => ({ ch, val: totals[ch] })).sort((a, b) => b.val - a.val);
    const max = sorted[0].val;

    list.innerHTML = sorted.map(({ ch, val }) => {
      if (val === 0) return '';
      const pct = grand > 0 ? (val / grand * 100) : 0;
      const barW = max > 0 ? (val / max * 100) : 0;
      const label = CONFIG.CHANNEL_DISPLAY[ch] || ch;
      const lightClass = pct < 10 ? 'light' : '';
      return `<div class="channel-row">
        <div class="channel-name">${this._escape(label)}</div>
        <div class="channel-bar"><div class="channel-bar-fill ${lightClass}" style="width:${barW.toFixed(1)}%"></div></div>
        <div class="channel-amount">${this._fmtRp(val)}</div>
        <div class="channel-pct">${pct.toFixed(1)}%</div>
      </div>`;
    }).join('');
  },

  // ==========================================================================
  // TOP & LOW
  // ==========================================================================
  _renderRanks() {
    const branch = this.dd.branch.getValue();
    if (branch) return; // panel disembunyikan

    const buildRanks = (group, count, isLow) => {
      const map = {};
      for (const r of this.filtered) {
        let key;
        if (group === 'branch') key = r.branch;
        else if (group === 'area') key = (this.branchMeta[r.branch] || {}).area || 'Tanpa area';
        else key = (this.branchMeta[r.branch] || {}).regional || 'Tanpa regional';
        map[key] = (map[key] || 0) + r.total;
      }
      let arr = Object.entries(map).map(([k, v]) => ({ key: k, val: v }));
      arr = arr.filter(x => x.val > 0);
      arr.sort((a, b) => isLow ? a.val - b.val : b.val - a.val);
      return arr.slice(0, count);
    };

    const render = (rows, group) => rows.length === 0
      ? '<div style="color:var(--ink-3);font-size:13px;padding:8px 0;">—</div>'
      : rows.map((r, i) => `<div class="rank-row">
          <div class="rank-left">
            <span class="rank-num">${i + 1}</span>
            <span class="rank-name">${this._escape(group === 'branch' ? this._shortBranch(r.key) : r.key)}</span>
          </div>
          <div class="rank-amount">${this._fmtRp(r.val)}</div>
        </div>`).join('');

    document.getElementById('topList').innerHTML = render(buildRanks(this.topGroup, this.topCount, false), this.topGroup);
    document.getElementById('lowList').innerHTML = render(buildRanks(this.lowGroup, this.lowCount, true), this.lowGroup);
  },

  // ==========================================================================
  // TREND
  // ==========================================================================
  _renderTrend() {
    const map = {};
    for (const r of this.filtered) {
      map[r.date] = (map[r.date] || 0) + r.total;
    }
    const dates = Object.keys(map).sort();
    const values = dates.map(d => map[d]);
    this.trendDates = dates;
    const labels = dates.map(d => {
      const [, m, day] = d.split('-');
      return parseInt(day) + '/' + parseInt(m);
    });

    const ctx = document.getElementById('trendChart').getContext('2d');
    if (this.trendChart) this.trendChart.destroy();

    const self = this;
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
            padding: 12,
            titleFont: { size: 13, weight: '500' },
            bodyFont: { size: 13 },
            displayColors: false,
            callbacks: {
              title: (items) => self._formatDateID(self.trendDates[items[0].dataIndex]),
              label: (ctx) => self._fmtRp(ctx.parsed.y)
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A93A0', font: { size: 11 } } },
          y: {
            grid: { color: '#E8E2D3' },
            ticks: {
              color: '#8A93A0',
              font: { size: 11 },
              callback: (v) => self._fmtShort(v)
            }
          }
        }
      }
    });
  },

  // ==========================================================================
  // SETTINGS MODAL
  // ==========================================================================
  _bindSettingsModal() {
    document.querySelectorAll('#settingsModal [data-close]').forEach(el => {
      el.addEventListener('click', () => this._closeSettings());
    });
    // Sheet link
    const link = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) {
      link.href = CONFIG.SHEET_URL;
    } else {
      link.parentElement.style.display = 'none';
    }
  },

  _openSettings() {
    document.getElementById('settingsModal').hidden = false;
    this._renderMoneyOptions();
    this._updateInfoPanel(this.data.length > 0);
  },
  _closeSettings() {
    document.getElementById('settingsModal').hidden = true;
  },

  _renderMoneyOptions() {
    const box = document.getElementById('moneyFormatOptions');
    box.innerHTML = Object.entries(CONFIG.MONEY_FORMATS).map(([k, v]) =>
      `<label>
        <input type="radio" name="moneyFormat" value="${k}" ${this.moneyFormat === k ? 'checked' : ''}/>
        <span>${this._escape(v.label)}</span>
      </label>`
    ).join('');
    box.querySelectorAll('input[name="moneyFormat"]').forEach(inp => {
      inp.addEventListener('change', () => {
        this.moneyFormat = inp.value;
        this._saveSetting('moneyFormat', inp.value);
        this._render();
      });
    });
  },

  _updateInfoPanel(ok, errorMsg) {
    const status = document.getElementById('infoStatus');
    const lastUp = document.getElementById('infoLastUpdate');
    const rows = document.getElementById('infoRows');
    const active = document.getElementById('infoActive');
    const range = document.getElementById('infoRange');
    if (!ok) {
      status.textContent = 'Gagal · ' + (errorMsg || 'tidak diketahui');
      status.style.color = 'var(--danger)';
      return;
    }
    status.textContent = 'Terhubung';
    status.style.color = 'var(--sea)';
    if (this.data.length === 0) {
      lastUp.textContent = 'Belum ada data';
      rows.textContent = '0';
      active.textContent = '0';
      range.textContent = '—';
      return;
    }
    const latest = this._latestDate();
    const earliest = this.data.reduce((min, r) => r.date < min ? r.date : min, latest);
    const dateCount = new Set(this.data.map(r => r.date)).size;
    lastUp.textContent = this._formatDateID(latest);
    rows.textContent = this.data.length.toLocaleString('id-ID');
    active.textContent = this.activeBranches.length + ' toko';
    range.textContent = this._formatDateShort(earliest) + ' – ' + this._formatDateShort(latest) + ' (' + dateCount + ' hari)';
  },

  // ==========================================================================
  // FORMATTING
  // ==========================================================================
  _fmtRp(v) {
    if (v == null || isNaN(v)) return 'Rp 0';
    if (this.moneyFormat === 'full') {
      return 'Rp ' + Math.round(v).toLocaleString('id-ID');
    }
    // auto
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
  _formatRange() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    if (!from || !to) return '';
    return this._formatDateShort(from) + ' – ' + this._formatDateShort(to);
  },
  _formatDateShort(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1] + ' ' + y.slice(2);
  },
  _formatDateID(s) {
    if (!s) return '';
    const [y, m, d] = s.split('-');
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1] + ' ' + y;
  },
  _latestDate() {
    if (this.data.length === 0) return null;
    return this.data.reduce((max, r) => r.date > max ? r.date : max, '');
  },
  _shortBranch(b) {
    const m = b.match(/^[^-]+-\s*(.+)$/);
    return m ? m[1].trim() : b;
  },
  _escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
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
