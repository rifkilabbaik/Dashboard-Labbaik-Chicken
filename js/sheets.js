const Sheets = {
  CACHE_KEY_DATA: 'cache_data_v1',
  CACHE_KEY_REGIONAL: 'cache_regional_v1',
  CACHE_KEY_STATUS: 'cache_status_v1',
  CACHE_KEY_ACTIVITY: 'cache_activity_v1',
  CACHE_KEY_COMPLAINT: 'cache_complaint_v1',

  async _get(action, params) {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) throw new Error('APPS_SCRIPT_URL belum dikonfigurasi.');
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now());
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error('Response bukan JSON. Cek Apps Script deployment.'); }
    if (j.status !== 'ok') throw new Error(j.error || 'Fetch gagal');
    return j;
  },
  async _post(body) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error('Response upload bukan JSON.'); }
    if (j.status !== 'ok') throw new Error(j.error || 'Upload gagal');
    return j;
  },
  async fetchAll()      { return (await this._get('fetchAll')).data; },
  async fetchRegional() { return (await this._get('fetchRegional')).data; },
  async status()        { return (await this._get('status')).data; },
  async checkDuplicate(pairs) { return (await this._post({ action: 'checkDuplicate', pairs })).data; },
  async upload(rows)          { return (await this._post({ action: 'upload', rows })).data; },

  // ===== Kegiatan =====
  async fetchActivities()  { return (await this._get('fetchKegiatan')).data; },
  async addActivity(row)   { return (await this._post({ action: 'addKegiatan', row })).data; },

  // ===== Komplain =====
  async fetchComplaints()  { return (await this._get('fetchKomplain')).data; },
  async addComplaint(row)  { return (await this._post({ action: 'addKomplain', row })).data; },

  // ===== Cache helpers =====
  saveCache(data, regional, status) {
    try {
      localStorage.setItem(this.CACHE_KEY_DATA, JSON.stringify({ ts: Date.now(), data }));
      localStorage.setItem(this.CACHE_KEY_REGIONAL, JSON.stringify({ ts: Date.now(), data: regional }));
      if (status) localStorage.setItem(this.CACHE_KEY_STATUS, JSON.stringify({ ts: Date.now(), data: status }));
    } catch (e) { console.warn('Cache save failed:', e); }
  },
  loadCache() {
    try {
      const d = localStorage.getItem(this.CACHE_KEY_DATA);
      const r = localStorage.getItem(this.CACHE_KEY_REGIONAL);
      const s = localStorage.getItem(this.CACHE_KEY_STATUS);
      if (!d || !r) return null;
      return {
        data: JSON.parse(d).data,
        regional: JSON.parse(r).data,
        status: s ? JSON.parse(s).data : null,
        cachedAt: JSON.parse(d).ts
      };
    } catch { return null; }
  },
  clearCache() {
    localStorage.removeItem(this.CACHE_KEY_DATA);
    localStorage.removeItem(this.CACHE_KEY_REGIONAL);
    localStorage.removeItem(this.CACHE_KEY_STATUS);
    localStorage.removeItem(this.CACHE_KEY_ACTIVITY);
    localStorage.removeItem(this.CACHE_KEY_COMPLAINT);
  },

  // ===== Generic list cache (kegiatan / komplain) =====
  saveList(key, rows) {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: rows })); }
    catch (e) { console.warn('Cache save failed:', e); }
  },
  loadList(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const j = JSON.parse(raw);
      return Array.isArray(j.data) ? j.data : null;
    } catch { return null; }
  }
};
