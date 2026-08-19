// ============================================================================
// KONFIGURASI APLIKASI
// ============================================================================
// Ganti nilai APPS_SCRIPT_URL dengan URL Web App dari Google Apps Script Anda.
// Cara mendapatkan URL: lihat README.md bagian "Setup Google Apps Script".
// ============================================================================

const CONFIG = {
  // URL Web App Google Apps Script (WAJIB DIGANTI)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_KK7mrSBNIF4T2KmwfpcDv9Zs4iwaKgkUSJn5D1-m-JKih5INFTYHsX2ahYQTmPK_/exec',

  // URL Google Sheet (untuk tombol "Buka spreadsheet" di footer)
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1jRmD8TGihRC98Yo12ihwrWAm8Ah3MqY-ve_pr7s-xQA/edit?gid=0#gid=0',

  // Nama channel sesuai kolom di Excel. Urutan menentukan urutan tampil.
  CHANNELS: [
    'DINE IN',
    'TAKE AWAY',
    'GRABFOOD',
    'GOFOOD',
    'SHOPEE FOOD',
    'BAZAR',
    'CATERING',
    'ESB Order Delivery',
    'ESB Order Pickup',
    'PAKAR'
  ],

  // Format tampilan nama channel (opsional, untuk kapitalisasi yang lebih rapi)
  CHANNEL_DISPLAY: {
    'DINE IN': 'Dine In',
    'TAKE AWAY': 'Take Away',
    'GRABFOOD': 'GrabFood',
    'GOFOOD': 'GoFood',
    'SHOPEE FOOD': 'Shopee Food',
    'BAZAR': 'Bazar',
    'CATERING': 'Catering',
    'ESB Order Delivery': 'ESB Delivery',
    'ESB Order Pickup': 'ESB Pickup',
    'PAKAR': 'Pakar'
  }
};
