const Sheets = {
  async _get(action, params) {
    if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL.startsWith('PASTE')) throw new Error('APPS_SCRIPT_URL belum dikonfigurasi.');
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('_t', Date.now());
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let j; try { j = JSON.parse(text); } catch { throw new Error('Response bukan JSON. Cek Apps Script deployment access.'); }
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
  async upload(rows)          { return (await this._post({ action: 'upload', rows })).data; }
};
