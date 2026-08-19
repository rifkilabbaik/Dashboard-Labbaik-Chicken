// ============================================================================
// KONEKSI GOOGLE SHEETS via Apps Script
// ============================================================================

const Sheets = {
  async fetchAll() {
    return this._get('fetch');
  },
  async fetchRegional() {
    return this._get('fetchRegional');
  },
  async seedRegional() {
    return this._get('seedRegional');
  },
  async _get(action) {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) {
      throw new Error('APPS_SCRIPT_URL belum dikonfigurasi.');
    }
    const url = CONFIG.APPS_SCRIPT_URL + '?action=' + action + '&_t=' + Date.now();
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); }
    catch (e) {
      console.error('Response bukan JSON:', text.substring(0, 500));
      throw new Error('Response bukan JSON. Cek deployment access = "Anyone".');
    }
    if (json.status !== 'ok') throw new Error(json.error || 'Request gagal');
    return json.data !== undefined ? json.data : json.result;
  }
};
