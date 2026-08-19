// ============================================================================
// KONEKSI GOOGLE SHEETS via Apps Script
// ============================================================================

const Sheets = {
  /**
   * Ambil semua data sales dari Google Sheets.
   * @returns {Promise<Array<{date: string, branch: string, channels: object, total: number}>>}
   */
  async fetchAll() {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) {
      throw new Error('APPS_SCRIPT_URL belum dikonfigurasi. Buka js/config.js dan isi URL Apps Script Anda.');
    }
    // Cache-buster supaya browser & Google tidak return cached response
    const url = CONFIG.APPS_SCRIPT_URL + '?action=fetch&_t=' + Date.now();
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) throw new Error('Gagal terhubung ke Google Sheets (HTTP ' + res.status + ')');
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // Response bukan JSON — kemungkinan HTML login page atau error page
      console.error('Response bukan JSON:', text.substring(0, 500));
      throw new Error('Response dari Apps Script bukan JSON. Cek deployment access = "Anyone" dan sudah re-deploy versi baru.');
    }
    if (json.status !== 'ok') throw new Error(json.error || 'Gagal ambil data');
    console.log('Sheets fetch OK:', (json.data || []).length, 'baris diterima');
    return json.data || [];
  },

  /**
   * Kirim data baru ke Google Sheets.
   * @param {Array} rows - Array of {date, branch, channels: {...}}
   * @param {string} mode - 'append' | 'upsert'
   * @returns {Promise<{added: number, updated: number}>}
   */
  async pushRows(rows, mode) {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) {
      throw new Error('APPS_SCRIPT_URL belum dikonfigurasi.');
    }
    const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      // Content-Type text/plain menghindari CORS preflight (Apps Script tidak dukung OPTIONS)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'push',
        mode: mode || 'append',
        rows: rows,
        channels: CONFIG.CHANNELS
      })
    });
    if (!res.ok) throw new Error('Gagal kirim data (HTTP ' + res.status + ')');
    const json = await res.json();
    if (json.status !== 'ok') throw new Error(json.error || 'Gagal simpan');
    return json;
  }
};
