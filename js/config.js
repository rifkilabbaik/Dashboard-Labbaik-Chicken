// ============================================================================
// KONFIGURASI APLIKASI
// ============================================================================

const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_KK7mrSBNIF4T2KmwfpcDv9Zs4iwaKgkUSJn5D1-m-JKih5INFTYHsX2ahYQTmPK_/exec',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1jRmD8TGihRC98Yo12ihwrWAm8Ah3MqY-ve_pr7s-xQA/edit?gid=0#gid=0',

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
  },

  MONEY_FORMATS: {
    auto: { label: 'Otomatis (Rp 1,2 M / 500 JT)', short: 'Otomatis' },
    full: { label: 'Penuh (Rp 1.200.000.000)', short: 'Penuh' }
  }
};
