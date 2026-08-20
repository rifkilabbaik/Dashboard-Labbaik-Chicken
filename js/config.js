// ============================================================================
// KONFIGURASI APLIKASI — v4
// ============================================================================

const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_KK7mrSBNIF4T2KmwfpcDv9Zs4iwaKgkUSJn5D1-m-JKih5INFTYHsX2ahYQTmPK_/exec',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1jRmD8TGihRC98Yo12ihwrWAm8Ah3MqY-ve_pr7s-xQA/edit',

  MONEY_FORMATS: {
    auto: { label: 'Otomatis (Rp 1,2 M / Rp 500 JT)', short: 'Otomatis' },
    full: { label: 'Penuh (Rp 1.200.000.000)', short: 'Penuh' }
  },

  THEME_OPTIONS: {
    auto:  { label: 'Otomatis (ikut sistem)' },
    light: { label: 'Terang' },
    dark:  { label: 'Gelap' }
  },

  // Kolom yang diambil dari file .xlsx ESB
  XLSX_COLUMNS: {
    billNumber:  'Bill Number',
    salesDate:   'Sales Date',
    salesDateIn: 'Sales Date In',
    branch:      'Branch',
    visitPurpose:'Visit Purpose',
    menuCategory:'Menu Category',
    menuCategoryDetail: 'Menu Category Detail',
    menu:        'Menu',
    qty:         'Qty',
    subtotal:    'Subtotal'
  },

  // Batasan upload
  UPLOAD_CHUNK_SIZE: 500,  // baris per request
  CAPACITY_LEVELS: {
    warn: 0.6,      // 60% → informasi
    alert: 0.8,     // 80% → tampil banner
    critical: 0.95  // 95% → wajib arsip
  }
};
