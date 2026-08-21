const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_KK7mrSBNIF4T2KmwfpcDv9Zs4iwaKgkUSJn5D1-m-JKih5INFTYHsX2ahYQTmPK_/exec',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1jRmD8TGihRC98Yo12ihwrWAm8Ah3MqY-ve_pr7s-xQA/edit',

  CHANNELS: ['DINE IN','TAKE AWAY','GRABFOOD','GOFOOD','SHOPEE FOOD','BAZAR','CATERING','ESB Order Delivery','ESB Order Pickup','PAKAR'],
  CHANNEL_DISPLAY: {
    'DINE IN':'Dine In','TAKE AWAY':'Take Away','GRABFOOD':'GrabFood','GOFOOD':'GoFood',
    'SHOPEE FOOD':'ShopeeFood','BAZAR':'Bazar','CATERING':'Catering',
    'ESB Order Delivery':'ESB Delivery','ESB Order Pickup':'ESB Pickup','PAKAR':'Pakar'
  },

  // Grouping channel untuk dashboard cards & analisa
  CHANNEL_GROUPS: [
    {
      key: 'offline', label: 'Offline',
      children: [
        { key: 'dine_in',   label: 'Dine In',    channels: ['DINE IN'] },
        { key: 'take_away', label: 'Take Away',  channels: ['TAKE AWAY'] },
        { key: 'lainnya',   label: 'Lainnya',    channels: ['ESB Order Delivery','ESB Order Pickup','PAKAR','BAZAR'] }
      ]
    },
    {
      key: 'online', label: 'Online',
      children: [
        { key: 'shopee', label: 'ShopeeFood', channels: ['SHOPEE FOOD'] },
        { key: 'gofood', label: 'GoFood',     channels: ['GOFOOD'] },
        { key: 'grab',   label: 'GrabFood',   channels: ['GRABFOOD'] }
      ]
    },
    {
      key: 'catering', label: 'Catering',
      children: [
        { key: 'catering', label: 'Catering', channels: ['CATERING'] }
      ]
    }
  ],

  MONEY_FORMATS: {
    auto: 'Otomatis (Rp 1,2 M / Rp 500 JT)',
    full: 'Penuh (Rp 1.200.000.000)'
  },
  THEME_OPTIONS: {
    auto:  'Otomatis (ikut sistem)',
    light: 'Terang',
    dark:  'Gelap'
  },
  FONT_OPTIONS: {
    default:   { label: 'Default (sistem)',    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif" },
    rounded:   { label: 'Rounded (bulat)',     stack: "'SF Pro Rounded', 'Nunito', 'Quicksand', ui-rounded, system-ui, sans-serif" },
    serif:     { label: 'Serif (klasik)',      stack: "'Iowan Old Style', 'Georgia', 'Times New Roman', serif" },
    mono:      { label: 'Monospace',            stack: "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace" },
    condensed: { label: 'Condensed (rapat)',    stack: "'Roboto Condensed', 'PT Sans Narrow', 'Segoe UI', system-ui, sans-serif" }
  }
};
