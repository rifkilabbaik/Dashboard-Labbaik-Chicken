// ============================================================================
// KONEKSI GOOGLE SHEETS via Apps Script — v4
// ============================================================================

const Sheets = {
  async _get(action, params) {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) {
      throw new Error('APPS_SCRIPT_URL belum dikonfigurasi.');
    }
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now());
    if (params) Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error('Response bukan JSON. Cek deployment Apps Script (Anyone access + New Version).'); }
    if (json.status !== 'ok') throw new Error(json.error || 'Fetch gagal');
    return json;
  },

  async _post(body) {
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch { throw new Error('Response upload bukan JSON.'); }
    if (json.status !== 'ok') throw new Error(json.error || 'Upload gagal');
    return json;
  },

  async fetchBills(from, to)    { return (await this._get('fetchBills', { from, to })).data; },
  async fetchMenu(from, to)     { return (await this._get('fetchMenu', { from, to })).data; },
  async fetchRegional()         { return (await this._get('fetchRegional')).data; },
  async status()                { return (await this._get('status')).data; },

  async checkDuplicate(info) {
    return (await this._post({ action: 'checkDuplicate', ...info })).data;
  },

  async uploadChunk(chunkType, payload) {
    return (await this._post({ action: 'uploadChunk', chunkType, ...payload })).data;
  },

  async archive(beforeDate) {
    return (await this._post({ action: 'archive', beforeDate })).data;
  }
};
