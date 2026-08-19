// ============================================================================
// APLIKASI UTAMA — v2
// ============================================================================

const App = {
  data: [],           // Data sales
  regional: [],       // Data regional/area/branch mapping
  filtered: [],       // Data setelah filter
  branchMeta: {},     // branch -> {regional, area}
  activeBranches: [], // Branches yang ada di sheet Regional (aktif)
  trendChart: null,
  trendDates: [],     // ISO date strings untuk tooltip chart
  moneyFormat: 'auto',
  topGroup: 'branch', topCount: 5,
  lowGroup: 'branch', lowCount: 5,
  dd: {}, // dropdown instances

  async init() {
    this._loadSettings();
    this._bindTopbar();
    this._bindDateInputs();
    this._bindSettingsModal();
    this._bindPullToRefresh();
    this._bindWindowFocus();
    this._initDropdowns();
    this._setPeriode('current', /*silent*/ true);
    await this.loadData();
  },

  // ==========================================================================
  // SETTINGS PERSISTENCE
  // ==========================================================================
  _loadSettings() {
    this.moneyFormat = localStorage.getItem('moneyFormat') || 'auto';
    this.topCount = parseInt(localStorage.getItem('topCount')) || 5;
    this.lowCount = parseInt(localStorage.getItem('lowCount')) || 5;
    this.topGroup = localStorage.getItem('topGroup') || 'branch';
    this.lowGroup = localStorage.getItem('lowGroup') || 'branch';
  },
  _saveSetting(k, v) { localStorage.setItem(k, v); },

  // ==========================================================================
  // TOPBAR & INTERACTIONS
  // ==========================================================================
  _bindTopbar() {
    document.getElementById('topbarLeft').addEventListener('click', () => this.loadData());
    document.getElementById('btnSettings').addEventListener('click', () => this._openSettings());

    const link = document.getElementById('linkSheet');
    if (CONFIG.SHEET_URL && !CONFIG.SHEET_URL.startsWith('PASTE')) {
      link.href = CONFIG.SHEET_URL;
    } else {
      link.style.display = 'none';
    }
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

  _bindPullToRefresh() {
    const indicator = document.getElementById('ptrIndicator');
    let startY = 0, pulling = false;
    const threshold = 70;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].pageY;
        pulling = true;
      } else {
        pulling = false;
      }
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
      pulling = false;
      startY = 0;
    });
  },

  _bindWindowFocus() {
    let lastLoad = Date.now();
    window.addEventListener('focus', () => {
      // Auto-refresh kalau tab tidak aktif > 30 detik
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
      onChange: (v) => { this._updateAreaOptions(); this._updateBranchOptions(); this._applyFilters(); }
    });
    this.dd.area = new Dropdown(document.getElementById('ddArea'), {
      items: [], value: '', allLabel: 'Semua Area', placeholder: 'Cari area...',
      onChange: (v) => { this._updateBranchOptions(); this._applyFilters(); }
    });
    this.dd.branch = new Dropdown(document.getElementById('ddBranch'), {
      items: [], value: '', allLabel: 'Semua Toko', placeholder: 'Cari nama toko...',
      onChange: () => this._applyFilters()
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
      onChange: (v) => {
        this._setPeriode(v, /*silent*/ false);
        this._applyFilters();
      }
    });

    // Top/Low controls
    const countItems = [3, 5, 10, 20].map(n => ({ value: String(n), label: 'Top ' + n }));
    const countItemsLow = [3, 5, 10, 20].map(n => ({ value: String(n), label: 'Low ' + n }));
    const groupItems = [
      { value: 'branch', label: 'Per toko' },
      { value: 'area', label: 'Per area' },
      { value: 'regional', label: 'Per regional' }
    ];

    this.dd.topGroup = new Dropdown(document.getElementById('ddTopGroup'), {
      items: groupItems, value: this.topGroup, allLabel: 'Per toko',
      onChange: (v) => { this.topGroup = v; this._saveSetting('topGroup', v); this._renderRanks(); }
    });
    this.dd.topCount = new Dropdown(document.getElementById('ddTopCount'), {
      items: countItems, value: String(this.topCount), allLabel: 'Top 5',
      onChange: (v) => { this.topCount = parseInt(v); this._saveSetting('topCount', v); this._renderRanks(); }
    });
    this.dd.lowGroup = new Dropdown(document.getElementById('ddLowGroup'), {
      items: groupItems, value: this.lowGroup, allLabel: 'Per toko',
      onChange: (v) => { this.lowGroup = v; this._saveSetting('lowGroup', v); this._renderRanks(); }
    });
    this.dd.lowCount = new Dropdown(document.getElementById('ddLowCount'), {
      items: countItemsLow, value: String(this.lowCount), allLabel: 'Low 5',
      onChange: (v) => { this.lowCount = parseInt(v); this._saveSetting('lowCount', v); this._renderRanks(); }
    });
  },

  // ==========================================================================
  // PERIODE ↔ DATES
  // ==========================================================================
  _setPeriode(mode, silent) {
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

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================
  async loadData() {
    document.getElementById('lastUpdate').textContent = 'Memuat data...';
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

      if (this.data.length === 0) {
        document.getElementById('lastUpdate').textContent = 'Sheet Sales kosong · isi data di spreadsheet';
      } else {
        const latest = this._latestDate();
        const dateCount = new Set(this.data.map(r => r.date)).size;
        const regionalNote = regional.length > 0
          ? ' · ' + regional.length + ' toko aktif'
          : ' · Regional belum diisi (buka Pengaturan)';
        document.getElementById('lastUpdate').textContent =
          this._formatDateID(latest) + ' · ' + this.data.length.toLocaleString('id-ID') + ' baris' + regionalNote;
      }
    } catch (e) {
      document.getElementById('lastUpdate').textContent = 'Gagal: ' + e.message;
      this._toast(e.message);
    }
  },

  _buildBranchMeta() {
    this.branchMeta = {};
    this.activeBranches = [];
    this.regional.forEach(r => {
      this.branchMeta[r.branch] = { regional: r.regional, area: r.area };
      this.activeBranches.push(r.branch);
    });
  },

  // ==========================================================================
  // POPULATE FILTERS
  // ==========================================================================
  _populateFilters() {
    // Regional
    const regionals = Array.from(new Set(this.regional.map(r => r.regional))).sort();
    this.dd.regional.setItems(regionals.map(r => ({ value: r, label: r })));
    this._updateAreaOptions();
    this._updateBranchOptions();
  },

  _updateAreaOptions() {
    const selectedReg = this.dd.regional.getValue();
    let areas = this.regional;
    if (selectedReg) areas = areas.filter(r => r.regional === selectedReg);
    const uniq = Array.from(new Set(areas.map(r => r.area))).sort();
    this.dd.area.setItems(uniq.map(a => ({ value: a, label: a })));
  },

  _updateBranchOptions() {
    const selectedReg = this.dd.regional.getValue();
    const selectedArea = this.dd.area.getValue();
    let branches;
    if (this.regional.length > 0) {
      branches = this.regional
        .filter(r => !selectedReg || r.regional === selectedReg)
        .filter(r => !selectedArea || r.area === selectedArea)
        .map(r => r.branch);
    } else {
      // Fallback: dari data sales kalau Regional belum diisi
      branches = Array.from(new Set(this.data.map(r => r.branch)));
    }
    const uniq = Array.from(new Set(branches)).sort();
    this.dd.branch.setItems(uniq.map(b => ({ value: b, label: this._shortBranch(b) })));
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
    const channels = this.dd.channel.getValue(); // array

    this.filtered = this.data.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;

      // Filter regional/area/branch (jika ada mapping)
      if (branch) {
        if (r.branch !== branch) return false;
      } else if (this.regional.length > 0) {
        // Kalau ada mapping, filter berdasarkan branch yang ada di Regional
        const meta = this.branchMeta[r.branch];
        if (reg || area) {
          if (!meta) return false;
          if (reg && meta.regional !== reg) return false;
          if (area && meta.area !== area) return false;
        }
      }
      return true;
    });

    // Hitung total sesuai channel yang dipilih
    if (channels && channels.length > 0 && channels.length < CONFIG.CHANNELS.length) {
      this.filtered = this.filtered.map(r => ({
        ...r,
        total: channels.reduce((s, ch) => s + (r.channels[ch] || 0), 0)
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

  // ==========================================================================
  // RENDER
  // ==========================================================================
  _renderMetrics() {
    const total = this.filtered.reduce((s, r) => s + r.total, 0);
    const days = new Set(this.filtered.map(r => r.date)).size;
    const branchCount = new Set(this.filtered.map(r => r.branch)).size;
    const totalBranchAll = this.activeBranches.length || new Set(this.data.map(r => r.branch)).size;
    const avg = days > 0 ? total / days : 0;

    // Growth vs periode sebelumnya
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
      const reg = this.dd.regional.getValue();
      const area = this.dd.area.getValue();
      const branch = this.dd.branch.getValue();
      const channels = this.dd.channel.getValue();
      const prev = this.data.filter(r => {
        if (r.date < prevFromStr || r.date > prevToStr) return false;
        if (branch) return r.branch === branch;
        if (this.regional.length > 0 && (reg || area)) {
          const meta = this.branchMeta[r.branch];
          if (!meta) return false;
          if (reg && meta.regional !== reg) return false;
          if (area && meta.area !== area) return false;
        }
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
    document.getElementById('mBranch').innerHTML = branchCount + ' <span style="font-size:13px;color:var(--ink-3);font-weight:400;">/ ' + totalBranchAll + '</span>';
    document.getElementById('mBranchSub').textContent = totalBranchAll > 0
      ? (totalBranchAll - branchCount) + ' tanpa transaksi'
      : 'Total toko dalam filter';
  },

  _renderChannel() {
    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;
    const reg = this.dd.regional.getValue();
    const area = this.dd.area.getValue();
    const branch = this.dd.branch.getValue();

    // Base: apply semua filter kecuali channel
    const base = this.data.filter(r => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (branch) return r.branch === branch;
      if (this.regional.length > 0 && (reg || area)) {
        const meta = this.branchMeta[r.branch];
        if (!meta) return false;
        if (reg && meta.regional !== reg) return false;
        if (area && meta.area !== area) return false;
      }
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

  _renderRanks() {
    const buildRanks = (group, count, isLow) => {
      // Aggregate berdasarkan group (branch/area/regional)
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
      arr = arr.slice(0, count);
      return arr;
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
    document.getElementById('btnSeedRegional').addEventListener('click', () => this._runSeedRegional());
  },

  _openSettings() {
    document.getElementById('settingsModal').hidden = false;
    document.getElementById('seedStatus').hidden = true;
    this._renderMoneyOptions();
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

  async _runSeedRegional() {
    const status = document.getElementById('seedStatus');
    const btn = document.getElementById('btnSeedRegional');
    btn.disabled = true;
    status.hidden = false;
    status.className = 'setting-status';
    status.textContent = 'Memproses...';
    try {
      const result = await Sheets.seedRegional();
      status.className = 'setting-status success';
      status.textContent = result.message || 'Berhasil.';
      await this.loadData();
    } catch (e) {
      status.className = 'setting-status error';
      status.textContent = 'Gagal: ' + e.message;
    }
    btn.disabled = false;
  },

  // ==========================================================================
  // FORMATTING
  // ==========================================================================
  _fmtRp(v) {
    if (v == null || isNaN(v)) return 'Rp 0';
    const f = this.moneyFormat;
    if (f === 'full') {
      return 'Rp ' + Math.round(v).toLocaleString('id-ID');
    }
    if (f === 'million') {
      return 'Rp ' + Math.round(v / 1e6).toLocaleString('id-ID') + ' JT';
    }
    if (f === 'thousand') {
      return 'Rp ' + Math.round(v / 1e3).toLocaleString('id-ID') + ' Rb';
    }
    // auto
    if (v >= 1e9) return 'Rp ' + (v / 1e9).toFixed(2).replace('.', ',') + ' M';
    if (v >= 1e6) return 'Rp ' + Math.round(v / 1e6).toLocaleString('id-ID') + ' JT';
    if (v >= 1e3) return 'Rp ' + Math.round(v / 1e3).toLocaleString('id-ID') + ' Rb';
    return 'Rp ' + Math.round(v);
  },
  _fmtShort(v) {
    // Untuk axis chart — selalu kompak
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
    const [, m, d] = s.split('-');
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return parseInt(d) + ' ' + months[parseInt(m) - 1];
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

// Alias untuk backward compat (dipakai di _renderChannel)
const CHANNELS_ORDER = ['DINE IN','TAKE AWAY','GRABFOOD','GOFOOD','SHOPEE FOOD','BAZAR','CATERING','ESB Order Delivery','ESB Order Pickup','PAKAR'];

document.addEventListener('DOMContentLoaded', () => App.init());
