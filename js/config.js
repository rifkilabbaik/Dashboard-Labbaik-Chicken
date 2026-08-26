// ============================================================================
// Sales Dashboard v8 — palettes, i18n (id/en), Kegiatan & Komplain
// ============================================================================

const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz_KK7mrSBNIF4T2KmwfpcDv9Zs4iwaKgkUSJn5D1-m-JKih5INFTYHsX2ahYQTmPK_/exec',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1jRmD8TGihRC98Yo12ihwrWAm8Ah3MqY-ve_pr7s-xQA/edit',

  CHANNELS: ['DINE IN','TAKE AWAY','GRABFOOD','GOFOOD','SHOPEE FOOD','BAZAR','CATERING','ESB Order Delivery','ESB Order Pickup','PAKAR'],

  // ---- Dashboard grouping (Offline/Online/Catering)
  // "always": always visible in group detail
  // "conditional": shown only if value > 0
  CHANNEL_GROUPS: [
    {
      key: 'offline', label: { id: 'Offline', en: 'Offline' },
      always: [
        { key: 'dine_in',   label: { id: 'Dine In',   en: 'Dine In' },   channels: ['DINE IN'] },
        { key: 'take_away', label: { id: 'Take Away', en: 'Take Away' }, channels: ['TAKE AWAY'] }
      ],
      conditional: [
        { key: 'esb_delivery', label: { id: 'ESB Order Delivery', en: 'ESB Order Delivery' }, channels: ['ESB Order Delivery'] },
        { key: 'esb_pickup',   label: { id: 'ESB Order Pickup',   en: 'ESB Order Pickup' },   channels: ['ESB Order Pickup'] },
        { key: 'bazar',        label: { id: 'Bazar',              en: 'Bazaar' },              channels: ['BAZAR'] },
        { key: 'pakar',        label: { id: 'Pakar',              en: 'Pakar' },               channels: ['PAKAR'] }
      ]
    },
    {
      key: 'online', label: { id: 'Online', en: 'Online' },
      always: [
        { key: 'shopee', label: { id: 'ShopeeFood', en: 'ShopeeFood' }, channels: ['SHOPEE FOOD'] },
        { key: 'gofood', label: { id: 'GoFood',     en: 'GoFood' },     channels: ['GOFOOD'] },
        { key: 'grab',   label: { id: 'GrabFood',   en: 'GrabFood' },   channels: ['GRABFOOD'] }
      ],
      conditional: []
    },
    {
      key: 'catering', label: { id: 'Catering', en: 'Catering' },
      always: [
        { key: 'catering', label: { id: 'Catering', en: 'Catering' }, channels: ['CATERING'] }
      ],
      conditional: []
    }
  ],

  // Urutan channel untuk row-detail modal (Toko/Area/Regional click).
  // Hanya tampil kalau nilainya > 0.
  ALL_CHANNELS_ORDER: [
    { key: 'DINE IN',            label: { id: 'Dine In',   en: 'Dine In' } },
    { key: 'TAKE AWAY',          label: { id: 'Take Away', en: 'Take Away' } },
    { key: 'SHOPEE FOOD',        label: { id: 'ShopeeFood', en: 'ShopeeFood' } },
    { key: 'GOFOOD',             label: { id: 'GoFood',    en: 'GoFood' } },
    { key: 'GRABFOOD',           label: { id: 'GrabFood',  en: 'GrabFood' } },
    { key: 'CATERING',           label: { id: 'Catering',  en: 'Catering' } },
    { key: 'ESB Order Delivery', label: { id: 'ESB Order Delivery', en: 'ESB Order Delivery' } },
    { key: 'ESB Order Pickup',   label: { id: 'ESB Order Pickup',   en: 'ESB Order Pickup' } },
    { key: 'PAKAR',              label: { id: 'Pakar',     en: 'Pakar' } },
    { key: 'BAZAR',              label: { id: 'Bazar',     en: 'Bazaar' } }
  ],

  // ---- KEGIATAN (activity log) -> sheet "Kegiatan"
  // Sheet columns: Tanggal | Nama | Nama Toko | Kegiatan | Keterangan 1 | Keterangan 2
  ACTIVITY_SHEET_HEADERS: ['Tanggal', 'Nama', 'Nama Toko', 'Kegiatan', 'Keterangan 1', 'Keterangan 2'],
  ACTIVITY_TYPES: [
    {
      key: 'FLD', label: { id: 'FLD', en: 'FLD' }, color: '#3B82C4',
      fields: [
        { slot: 'k1', type: 'text',   max: 80, label: { id: 'Nama TK',         en: 'Kindergarten name' } },
        { slot: 'k2', type: 'number', max: 6,  label: { id: 'Jumlah Peserta',  en: 'Participants' } }
      ]
    },
    {
      key: 'GCOM', label: { id: 'GCOM', en: 'GCOM' }, color: '#C9853A',
      fields: [
        { slot: 'k1', type: 'text',   max: 80, label: { id: 'Nama Komunitas',  en: 'Community name' } },
        { slot: 'k2', type: 'number', max: 6,  label: { id: 'Jumlah Peserta',  en: 'Participants' } }
      ]
    },
    {
      key: 'CX', label: { id: 'CX', en: 'CX' }, color: '#4F9E76',
      fields: [
        // 140 karakter: cukup untuk 1-2 kalimat tujuan kunjungan, tetap ringkas di spreadsheet
        { slot: 'k1', type: 'textarea', max: 140, label: { id: 'Tujuan Kunjungan', en: 'Visit purpose' } }
      ]
    }
  ],

  // ---- KOMPLAIN -> sheet "Komplain"
  // Hanya kolom ini yang diinput dari aplikasi.
  COMPLAINT_SHEET_HEADERS: ['Nama', 'Kontak', 'Alamat', 'Nama Store', 'Media Komplain', 'Kategori', 'Tanggal Transaksi', 'Isi Komplain'],
  COMPLAINT_MEDIA: ['WhatsApp', 'Instagram', 'Google Review', 'Aplikasi GoFood', 'Aplikasi GrabFood', 'Aplikasi ShopeeFood'],
  COMPLAINT_CATEGORIES: ['Kualitas Produk', 'Kurang Produk', 'Salah Produk', 'Kualitas Pelayanan', 'Kualitas Peralatan', 'Produk Kosong', 'Tidak Terima Struk'],
  COMPLAINT_LIMITS: { nama: 80, kontak: 40, alamat: 200, isi: 2000 },

  // Kolom yang dikenali saat UPLOAD file komplain (.xlsx).
  // key  = nama field internal (dipakai juga oleh Apps Script)
  // header = nama kolom di file / sheet (dicocokkan case-insensitive)
  // Form input manual hanya mengisi 8 kolom (lihat COMPLAINT_SHEET_HEADERS),
  // tapi file export biasanya membawa kolom lain — kolom itu tetap dibaca
  // supaya data yang sudah ada tidak hilang saat diupload.
  COMPLAINT_UPLOAD_COLUMNS: [
    { key: 'caseId',      header: 'Case Id',           type: 'text' },
    { key: 'name',        header: 'Nama',              type: 'text' },
    { key: 'contact',     header: 'Kontak',            type: 'text' },
    { key: 'address',     header: 'Alamat',            type: 'text' },
    { key: 'store',       header: 'Nama Store',        type: 'text' },
    { key: 'media',       header: 'Media Komplain',    type: 'text' },
    { key: 'category',    header: 'Kategori',          type: 'text' },
    { key: 'trxDate',     header: 'Tanggal Transaksi', type: 'datetime' },
    { key: 'cmpDate',     header: 'Tanggal Komplain',  type: 'datetime' },
    { key: 'body',        header: 'Isi Komplain',      type: 'text' },
    { key: 'inputDate',   header: 'Tanggal Input',     type: 'datetime' },
    { key: 'areaMgr',     header: 'Area Manager',      type: 'text' },
    { key: 'regionalMgr', header: 'Regional Manager',  type: 'text' }
  ],

  // ---- Penyelarasan nama toko
  // Data komplain memakai nama pendek ("LC Cipasir"), sedangkan data penjualan
  // memakai nama panjang ("Labbaik Chicken - Cipasir"). Peta ini menyamakan
  // keduanya supaya satu toko tidak terhitung dua kali.
  STORE_ALIASES: {
    'LC Cipasir': 'Labbaik Chicken - Cipasir',
    'LC Cileunyi': 'Labbaik Chicken - Cileunyi',
    'LC Pandan Wangi': 'Labbaik Chicken - Pandanwangi',
    'LC Jatos': 'Labbaik Chicken - Jatos',
    'LC Simpang Lima': 'Labbaik Chicken - Simpang Lima',
    'LC Cimanuk': 'Labbaik Chicken - Cimanuk',
    'LC Indihiang': 'Labbaik Chicken - Indihiang',
    'LC Siliwangi': 'Labbaik Chicken - Siliwangi Tasik',
    'LC Singaparna': 'Labbaik Chicken - Singaparna',
    'LC Bulak Laut': 'Labbaik Chicken - Bulak Laut',
    'LC Margaasih': 'Labbaik Chicken - Margaasih',
    'LC Katapang': 'Labbaik Chicken - Katapang',
    'LC Gading Tutuka': 'Labbaik Chicken - Gading Tutuka',
    'LC Al Fathu': 'Labbaik Chicken - Al Fathu',
    'LC Ciwidey': 'Labbaik Chicken - Ciwidey',
    'LC Sukamenak': 'Labbaik Chicken - Sukamenak',
    'LC Rancamanyar': 'Labbaik Chicken - Rancamanyar',
    'LC Baleendah': 'Labbaik Chicken - Baleendah',
    'LC Bojongsoang': 'Labbaik Chicken - Bojongsoang',
    'LC Perumnas': 'Labbaik Chicken - Perumnas Cirebon',
    'LC Perjuangan': 'Labbaik Chicken - Perjuangan',
    'LC Sumber': 'Labbaik Chicken - Sumber',
    'LC Weru': 'Labbaik Chicken - Weru',
    'LC Sudirman': 'Labbaik Chicken - Sudirman Indramayu',
    'LC Majalengka': 'Labbaik Chicken - Majalengka',
    'LC Angkrek': 'Labbaik Chicken - Angkrek',
    'LC Tegal': 'Labbaik Chicken - Tegal',
    'LC Cibaraja Cibatu': 'Labbaik Chicken - Cibaraja',
    'LC Palabuhan Ratu': 'Labbaik Chicken - Palabuhan Ratu',
    'LC Caringin': 'Labbaik Chicken - Caringin',
    'LC Cidahu': 'Labbaik Chicken - Cidahu',
    'LC Cimanggu': 'Labbaik Chicken - Cimanggu',
    'LC Cibinong': 'Labbaik Chicken - Cibinong',
    'LC Cagar Alam': 'Labbaik Chicken - Cagar Alam',
    'LC Antapani': 'Labbaik Chicken - Antapani',
    'LC Babakan Sari': 'Labbaik Chicken - Babakan Sari',
    'LC Derwati': 'Labbaik Chicken - Derwati',
    'LC Batununggal': 'Labbaik Chicken - Batununggal',
    'LC Sukagalih': 'Labbaik Chicken - Sukagalih',
    'LC Tubagus Ismail': 'Labbaik Chicken - Tubagus Ismail',
    'LC Ujung Berung': 'Labbaik Chicken - Ujung Berung',
    'LC Margahayu': 'Labbaik Chicken - Margahayu',
    'LC Banteng': 'Labbaik Chicken - Banteng',
    'LC Ahmad Yani': 'Labbaik Chicken - Ahmad Yani',
    'LC Munjul': 'Labbaik Chicken - Munjul',
    'LC Galuh Mas': 'Labbaik Chicken - Galuhmas',
    'LC Mega Regency Cikarang': 'Labbaik Chicken - Mega Regency',
    'LC Cihampelas Cililin': 'Labbaik Chicken - Cihampelas',
    'LC Permata Cimahi': 'Labbaik Chicken - Permata Cimahi',
    'LC Sarimanah': 'Labbaik Chicken - Sarimanah',
    'LC Geger Kalong': 'Labbaik Chicken - Gegerkalong',
    'LC Bhayangkara': 'Labbaik Chicken - Bhayangkara',
    'LC Lopang': 'Labbaik Chicken - Lopang',
    'LC Cipocok': 'Labbaik Chicken - Cipocok',
    'LC Ciwaru': 'Labbaik Chicken - Ciwaru',
    'LC Kaligandu': 'Labbaik Chicken - Kaligandu',
    'LC Pakupatan': 'Labbaik Chicken - Pakupatan',
    'LC Ciruas': 'Labbaik Chicken - Ciruas',
    'LC Pipitan': 'Labbaik Chicken - Pipitan',
    'LC Kragilan': 'Labbaik Chicken - Kragilan',
    'LC Cikande': 'Labbaik Chicken - Cikande',
    'LC Kasemen': 'Labbaik Chicken - Kasemen',
    'LC Ciracas': 'Labbaik Chicken - Ciracas',
    'LC Legok': 'Labbaik Chicken - Legok',
    'LC Kelapa Dua': 'Labbaik Chicken - Kelapa Dua',
    'LC Baros': 'Labbaik Chicken - Baros',
    'LC Petir': 'Labbaik Chicken - Petir',
    'LC Warung Gunung': 'Labbaik Chicken - Warung Gunung',
    'LC Multatuli': 'Labbaik Chicken - Multatuli',
    'LC Juanda': 'Labbaik Chicken - Juanda',
    'LC Ona Siliwangi': 'Labbaik Chicken - Ona Siliwangi',
    'LC Gardu Tanjak': 'Labbaik Chicken - Gardu Tanjak',
    'LC Majasari': 'Labbaik Chicken - Majasari',
    'LC Taktakan': 'Labbaik Chicken - Taktakan',
    'LC PCI': 'Labbaik Chicken - Pci',
    'LC TCI Cilegon': 'Labbaik Chicken - Taman Cilegon Indah',
    'LC Cibeber': 'Labbaik Chicken - Cibeber',
    'LC Kalitimbang': 'Labbaik Chicken - Kalitimbang',
    'LC Serdang': 'Labbaik Chicken - Serdang',
    'LC Waringin Kurung': 'Labbaik Chicken - Waringin',
    'LC Lebak Indah': 'Labbaik Chicken - Lebak Indah',
    'LC Seneja': 'Labbaik Chicken - Seneja',
    'LC Anyer': 'Labbaik Chicken - Anyer',
    'LC BBS': 'Labbaik Chicken - Bbs',
    'LC Kramatwatu': 'Labbaik Chicken - Kramatwatu',
    'LC Warnasari': 'Labbaik Chicken - Warnasari',
    'LC Krenceng': 'Labbaik Chicken - Krenceng',
    'LC Kebon Dalem': 'Labbaik Chicken - Kebon Dalem',
    'LC Jombang': 'Labbaik Chicken - Jombang',
    'LC Bojonegara': 'Labbaik Chicken - Bojonegara',
    'LC Merak': 'Labbaik Chicken - Merak',
    'LC Grogol': 'Labbaik Chicken - Grogol',
    'LC Temu Putih': 'Labbaik Chicken - Temu Putih',
    'LC Tegal Cabe': 'Labbaik Chicken - Tegal Cabe',
    'LC Menes': 'Labbaik Chicken - Menes',
    'LC Labuan': 'Labbaik Chicken - Labuan',
    'LC Panimbang': 'Labbaik Chicken - Panimbang',
    'LC Bukit Barisan': 'Labbaik Chicken - Bukit Barisan',
    'LC Rumbai': 'Labbaik Chicken - Rumbai',
    'LC Simpang Satria (Panam)': 'Labbaik Chicken - Panam Simpang Satria',
  },

  MONEY_FORMATS: {
    auto: { id: 'Otomatis', en: 'Auto' },
    full: { id: 'Penuh',    en: 'Full' }
  },

  LANGUAGES: {
    id: { id: 'Indonesia', en: 'Indonesian' },
    en: { id: 'Inggris',   en: 'English' }
  },

  // 3 palet 2-warna + 3 palet 3-warna
  PALETTES: {
    // ---- 2 warna
    krem_biru: {
      type: 2, label: { id: 'Krem Biru', en: 'Cream Blue' }, themeColor: '#F7F4EC',
      vars: {
        '--bone':'#F7F4EC','--bone-2':'#FFFDF7','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#E8E2D3','--line-2':'#D8D2C3',
        '--sea':'#4A90B8','--sea-hover':'#3A7A9E','--sea-2':'#E6F0F6','--sea-3':'#C7DDEA',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#4A90B8','--accent-2':'#4A90B8',
        '--profit':'#1E9E57','--loss':'#D33B2C'
      }
    },
    putih_hijau: {
      type: 2, label: { id: 'Putih Hijau', en: 'White Green' }, themeColor: '#FAFAF7',
      vars: {
        '--bone':'#FAFAF7','--bone-2':'#FFFFFF','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#EBEBE5','--line-2':'#D8D8D2',
        '--sea':'#4A9B7F','--sea-hover':'#3A7E67','--sea-2':'#EAF3EF','--sea-3':'#C6DFD3',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#4A9B7F','--accent-2':'#4A9B7F',
        '--profit':'#1E9E57','--loss':'#D33B2C'
      }
    },
    gelap_biru: {
      type: 2, label: { id: 'Gelap Biru', en: 'Dark Blue' }, themeColor: '#1A1D21',
      vars: {
        '--bone':'#1A1D21','--bone-2':'#22262B','--ink':'#E8E6E0','--ink-2':'#A0A5AD','--ink-3':'#6C7178',
        '--line':'#2E3238','--line-2':'#3A3F46',
        '--sea':'#6BB0D9','--sea-hover':'#7CBFE6','--sea-2':'#1E3A4A','--sea-3':'#2A5570',
        '--danger':'#D97565','--danger-bg':'#3A1E1A','--danger-fg':'#F0A090',
        '--warn-bg':'#3A2F1A','--warn-fg':'#E8C888',
        '--success':'#6BB0D9','--accent-2':'#6BB0D9',
        '--profit':'#4ED18A','--loss':'#FF6F5E'
      }
    },
    // ---- 3 warna
    krem_biru_koral: {
      type: 3, label: { id: 'Krem Biru Koral', en: 'Cream Blue Coral' }, themeColor: '#F7F4EC',
      vars: {
        '--bone':'#F7F4EC','--bone-2':'#FFFDF7','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#E8E2D3','--line-2':'#D8D2C3',
        '--sea':'#4A90B8','--sea-hover':'#3A7A9E','--sea-2':'#E6F0F6','--sea-3':'#C7DDEA',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#D08B6C','--accent-2':'#D08B6C',
        '--profit':'#1E9E57','--loss':'#D33B2C'
      }
    },
    putih_sage_emas: {
      type: 3, label: { id: 'Putih Sage Emas', en: 'White Sage Gold' }, themeColor: '#FAFAF7',
      vars: {
        '--bone':'#FAFAF7','--bone-2':'#FFFFFF','--ink':'#1F2937','--ink-2':'#5B6472','--ink-3':'#8A93A0',
        '--line':'#EBEBE5','--line-2':'#D8D8D2',
        '--sea':'#7A9B8B','--sea-hover':'#5F8272','--sea-2':'#EAF1ED','--sea-3':'#CFDDD5',
        '--danger':'#B85A4A','--danger-bg':'#FBEAE8','--danger-fg':'#8B3A2B',
        '--warn-bg':'#FFF4E6','--warn-fg':'#8B6A20',
        '--success':'#C9A96E','--accent-2':'#C9A96E',
        '--profit':'#1E9E57','--loss':'#D33B2C'
      }
    },
    gelap_teal_salmon: {
      type: 3, label: { id: 'Gelap Teal Salmon', en: 'Dark Teal Salmon' }, themeColor: '#1E2226',
      vars: {
        '--bone':'#1E2226','--bone-2':'#262B30','--ink':'#E8E6E0','--ink-2':'#A0A5AD','--ink-3':'#6C7178',
        '--line':'#2E3238','--line-2':'#3A3F46',
        '--sea':'#5DB5B5','--sea-hover':'#6EC4C4','--sea-2':'#1E3A3A','--sea-3':'#2A5555',
        '--danger':'#D97565','--danger-bg':'#3A1E1A','--danger-fg':'#F0A090',
        '--warn-bg':'#3A2F1A','--warn-fg':'#E8C888',
        '--success':'#E8998C','--accent-2':'#E8998C',
        '--profit':'#4ED18A','--loss':'#FF6F5E'
      }
    }
  },

  FONT_OPTIONS: {
    default:   { label: { id: 'Default (sistem)', en: 'Default (system)' }, stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', system-ui, sans-serif" },
    rounded:   { label: { id: 'Bulat',            en: 'Rounded' },          stack: "'SF Pro Rounded', 'Nunito', 'Quicksand', ui-rounded, system-ui, sans-serif" },
    serif:     { label: { id: 'Klasik',           en: 'Serif' },            stack: "'Iowan Old Style', 'Georgia', 'Times New Roman', serif" },
    mono:      { label: { id: 'Monospace',        en: 'Monospace' },        stack: "'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace" },
    condensed: { label: { id: 'Rapat',            en: 'Condensed' },        stack: "'Roboto Condensed', 'PT Sans Narrow', 'Segoe UI', system-ui, sans-serif" }
  },

  I18N: {
    id: {
      nav_dashboard: 'Dasbor', nav_sales: 'Penjualan', nav_activity: 'Kegiatan', nav_complaint: 'Komplain',
      nav_upload: 'Upload data', nav_settings: 'Pengaturan',
      close: 'Tutup', cancel: 'Batal', reset: 'Reset', ok: 'OK', save: 'Simpan', saving: 'Menyimpan...',
      search_placeholder: 'Cari...', no_result: 'Tidak ada hasil',
      required_field: 'Wajib diisi', chars_left: '{n} karakter lagi',

      loading: 'Memuat data',

      total_sales: 'Total penjualan', click_for_detail: 'Klik untuk detail', prev_month: 'bulan lalu',

      sales_regional: 'Penjualan Regional', sales_area: 'Penjualan Area', sales_store: 'Penjualan Toko',

      sort_name: 'Nama ▾', sort_largest: 'Terbesar ▾', sort_smallest: 'Terkecil ▾',

      // Chip kolom tabel penjualan: ringkas (grup) vs semua channel
      view_simple: 'Simpel ▾', view_full: 'Penuh ▾',

      trend_daily: 'Harian', trend_weekly: 'Mingguan', trend_monthly: 'Bulanan',
      trend_title: 'Tren', trend_current: 'Periode ini', trend_prev: 'Bulan lalu',
      trend_prev_year: 'Tahun lalu',
      trend_compare_hint: 'Ketuk grafik untuk perbandingan',
      trend_compare_title: 'Perbandingan',
      trend_week_prefix: 'M', trend_month_prefix: '',

      top10: '10 Toko penjualan tertinggi', low10: '10 Toko penjualan terendah',

      // 10 toko komplain tertinggi (dasbor)
      top10_cmp: '10 Toko komplain tertinggi', cmp_unit: 'komplain',

      // Filter periode kontekstual (kegiatan & komplain)
      filter_more: 'Filter lanjutan',

      // Multi-pilih toko
      dd_all_stores: 'Semua toko', dd_n_selected: '{n} toko dipilih',
      dd_select_all: 'Pilih semua', dd_clear: 'Kosongkan',

      // Tren di dalam pop up detail
      trend_yearly: 'Tahunan',

      // Tabel komplain per toko
      cmp_per_store: 'Komplain per toko', cmp_other_cat: 'Lainnya',
      tbl_scroll_hint: 'Geser tabel ke samping untuk melihat semua kolom',
      cmp_store_title: 'Komplain {store}',
      sort_most: 'Terbanyak ▾', sort_least: 'Tersedikit ▾',

      tbl_name: 'Nama', tbl_offline: 'Offline', tbl_online: 'Online', tbl_catering: 'Catering',
      tbl_total: 'Total', tbl_growth: 'Pertumbuhan',

      regional: 'Regional', area: 'Area', store: 'Toko', all: 'Semua',

      detail: 'Detail', difference: 'Selisih', growth: 'Pertumbuhan',
      tap_row_for_detail: 'Ketuk baris untuk detail', no_data: 'Tidak ada data.',

      filter_period: 'Filter periode', date_range: 'Rentang tanggal',
      pick_date_placeholder: 'Pilih tanggal...', pick_range: 'Pilih rentang tanggal',
      click_first_date: 'Klik tanggal pertama untuk "Dari"',
      from_prefix: 'Dari: ', click_to_date: ' — Klik tanggal untuk "Sampai"',

      setting_theme: 'Tema', setting_language: 'Bahasa', setting_money: 'Format uang',
      setting_text: 'Format text', setting_info: 'Info data', setting_storage: 'Penyimpanan',
      setting_source: 'Sumber data', setting_app: 'Aplikasi', setting_version: 'Versi',
      setting_cache_app: 'Cache app', setting_status: 'Status', setting_last_date: 'Data terakhir',
      setting_row_count: 'Total baris', setting_days: 'Hari tersimpan', setting_active_stores: 'Toko aktif',
      setting_cache: 'Cache', setting_reload: 'Muat ulang data', setting_open_sheet: 'Buka Spreadsheet',
      setting_clear_cache: 'Bersihkan', setting_connected: 'Terhubung', setting_not_connected: 'Belum terhubung',
      days_suffix: 'hari', stores_suffix: 'toko',

      upload_title: 'Upload data', upload_drag: 'Tarik file ke sini', upload_or: 'atau',
      upload_pick: 'Pilih file .xlsx', upload_processing: 'Memproses...',
      upload_all_new_msg: 'Semua baru: {n} baris siap diupload.',
      upload_all_dup_title: 'Semua data sudah ada',
      upload_all_dup_msg: '{n} baris sudah ada di spreadsheet.',
      upload_partial_title: 'Sebagian data sudah ada:',
      upload_partial_new: '{n} baru', upload_partial_dup: '{n} duplikat',
      upload_which: 'Mau upload yang mana?',
      upload_all: 'Upload semua', upload_new_only: 'Upload {n} baru saja',
      upload_filtering: 'Filter duplikat...',
      upload_progress: 'Upload {a} / {b}',
      upload_done: 'Selesai. {n} baris ditambahkan.',
      upload_success: 'Upload berhasil', upload_fail_title: 'Upload gagal',
      upload_fail_process: 'Gagal memproses file',
      upload_no_new_row: 'Tidak ada baris baru.',
      upload_kind: 'Jenis data', upload_kind_sales: 'Penjualan', upload_kind_complaint: 'Komplain',
      upload_detected: 'Terdeteksi file {k}',
      upload_skipped_rows: '{n} baris dilewati karena datanya tidak lengkap/tidak valid.',
      upload_complaints_suffix: 'komplain',
      upload_ready_complaint: '{n} baris siap diupload. Baris yang sudah ada otomatis dilewati.',
      upload_done_complaint: '{n} komplain ditambahkan.',
      upload_dup_skipped: '{n} duplikat dilewati.',
      upload_none_added: 'Tidak ada data baru — semua baris sudah ada di spreadsheet.',
      upload_redeploy_hint: 'Apps Script masih versi lama. Copy ulang Code.gs, lalu Deploy → Manage deployments → Version: New version → Deploy.',

      toast_cache_cleared: 'Cache dibersihkan. Refresh halaman.',
      toast_cache_loading: 'Data cache · memuat versi terbaru...',
      toast_load_failed: 'Gagal update: {msg}',
      splash_failed: 'Gagal: {msg}',

      health_critical: 'Kritis', health_warn: 'Mendekati batas',
      health_ok: 'Sehat', health_great: 'Sangat sehat',
      pct_used: '{p}% terpakai',

      // ---- Kegiatan
      act_add: 'Tambahkan kegiatan', act_calendar: 'Kalender kegiatan', act_list: 'Daftar kegiatan',
      act_form_title: 'Tambahkan kegiatan', act_name: 'Nama', act_date: 'Tanggal',
      act_store: 'Toko', act_type: 'Kegiatan',
      act_pick_store: 'Pilih toko', act_pick_type: 'Pilih kegiatan',
      act_saved: 'Kegiatan tersimpan', act_save_failed: 'Gagal menyimpan kegiatan',
      act_filter: 'Filter kegiatan', act_result: 'Hasil',
      act_count: '{n} kegiatan', act_none: 'Belum ada kegiatan pada filter ini.',
      act_day_title: 'Kegiatan {date}', act_legend: 'Keterangan',
      act_reload: 'Muat ulang kegiatan',
      act_err_name: 'Nama wajib diisi.', act_err_date: 'Tanggal wajib diisi.',
      act_err_store: 'Toko wajib dipilih.', act_err_type: 'Kegiatan wajib dipilih.',
      act_err_field: '{f} wajib diisi.',

      // ---- Komplain
      cmp_add: 'Tambahkan komplain', cmp_list: 'Daftar komplain', cmp_form_title: 'Tambahkan komplain',
      cmp_name: 'Nama', cmp_contact: 'Kontak', cmp_address: 'Alamat', cmp_store: 'Nama Store',
      cmp_media: 'Media Komplain', cmp_category: 'Kategori',
      cmp_trx_date: 'Tanggal Transaksi', cmp_body: 'Isi Komplain',
      cmp_pick_media: 'Pilih media', cmp_pick_category: 'Pilih kategori',
      cmp_saved: 'Komplain tersimpan', cmp_save_failed: 'Gagal menyimpan komplain',
      cmp_filter: 'Filter komplain', cmp_count: '{n} komplain',
      cmp_none: 'Belum ada komplain pada filter ini.',
      cmp_reload: 'Muat ulang komplain',
      cmp_err_name: 'Nama wajib diisi.', cmp_err_store: 'Nama Store wajib dipilih.',
      cmp_err_media: 'Media Komplain wajib dipilih.', cmp_err_category: 'Kategori wajib dipilih.',
      cmp_err_date: 'Tanggal Transaksi wajib diisi.', cmp_err_body: 'Isi Komplain wajib diisi.',

      months_short: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
      months_full:  ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
      days_short:   ['Sen','Sel','Rab','Kam','Jum','Sab','Min']
    },
    en: {
      nav_dashboard: 'Dashboard', nav_sales: 'Sales', nav_activity: 'Activity', nav_complaint: 'Complaint',
      nav_upload: 'Upload data', nav_settings: 'Settings',
      close: 'Close', cancel: 'Cancel', reset: 'Reset', ok: 'OK', save: 'Save', saving: 'Saving...',
      search_placeholder: 'Search...', no_result: 'No result',
      required_field: 'Required', chars_left: '{n} characters left',

      loading: 'Loading data',

      total_sales: 'Total sales', click_for_detail: 'Tap for detail', prev_month: 'last month',

      sales_regional: 'Regional sales', sales_area: 'Area sales', sales_store: 'Store sales',

      sort_name: 'Name ▾', sort_largest: 'Largest ▾', sort_smallest: 'Smallest ▾',

      view_simple: 'Simple ▾', view_full: 'Full ▾',

      trend_daily: 'Daily', trend_weekly: 'Weekly', trend_monthly: 'Monthly',
      trend_title: 'Trend', trend_current: 'This period', trend_prev: 'Last month',
      trend_prev_year: 'Last year',
      trend_compare_hint: 'Tap chart to compare',
      trend_compare_title: 'Comparison',
      trend_week_prefix: 'W', trend_month_prefix: '',

      top10: 'Top 10 stores by sales', low10: 'Bottom 10 stores by sales',

      top10_cmp: 'Top 10 stores by complaints', cmp_unit: 'complaints',

      filter_more: 'More filters',

      dd_all_stores: 'All stores', dd_n_selected: '{n} stores selected',
      dd_select_all: 'Select all', dd_clear: 'Clear',

      trend_yearly: 'Yearly',

      cmp_per_store: 'Complaints per store', cmp_other_cat: 'Other',
      tbl_scroll_hint: 'Swipe the table sideways to see all columns',
      cmp_store_title: 'Complaints · {store}',
      sort_most: 'Most ▾', sort_least: 'Fewest ▾',

      tbl_name: 'Name', tbl_offline: 'Offline', tbl_online: 'Online', tbl_catering: 'Catering',
      tbl_total: 'Total', tbl_growth: 'Growth',

      regional: 'Regional', area: 'Area', store: 'Store', all: 'All',

      detail: 'Detail', difference: 'Difference', growth: 'Growth',
      tap_row_for_detail: 'Tap a row for detail', no_data: 'No data.',

      filter_period: 'Filter period', date_range: 'Date range',
      pick_date_placeholder: 'Pick a date...', pick_range: 'Pick date range',
      click_first_date: 'Click the first date for "From"',
      from_prefix: 'From: ', click_to_date: ' — Click a date for "To"',

      setting_theme: 'Theme', setting_language: 'Language', setting_money: 'Money format',
      setting_text: 'Text style', setting_info: 'Data info', setting_storage: 'Storage',
      setting_source: 'Data source', setting_app: 'Application', setting_version: 'Version',
      setting_cache_app: 'App cache', setting_status: 'Status', setting_last_date: 'Last data',
      setting_row_count: 'Total rows', setting_days: 'Days stored', setting_active_stores: 'Active stores',
      setting_cache: 'Cache', setting_reload: 'Reload data', setting_open_sheet: 'Open Spreadsheet',
      setting_clear_cache: 'Clear', setting_connected: 'Connected', setting_not_connected: 'Not connected',
      days_suffix: 'days', stores_suffix: 'stores',

      upload_title: 'Upload data', upload_drag: 'Drag file here', upload_or: 'or',
      upload_pick: 'Pick .xlsx file', upload_processing: 'Processing...',
      upload_all_new_msg: 'All new: {n} rows ready to upload.',
      upload_all_dup_title: 'All data already exists',
      upload_all_dup_msg: '{n} rows already exist in the spreadsheet.',
      upload_partial_title: 'Some data already exists:',
      upload_partial_new: '{n} new', upload_partial_dup: '{n} duplicate',
      upload_which: 'Which do you want to upload?',
      upload_all: 'Upload all', upload_new_only: 'Upload {n} new only',
      upload_filtering: 'Filtering duplicates...',
      upload_progress: 'Uploading {a} / {b}',
      upload_done: 'Done. {n} rows added.',
      upload_success: 'Upload successful', upload_fail_title: 'Upload failed',
      upload_fail_process: 'Failed to process file',
      upload_no_new_row: 'No new rows.',
      upload_kind: 'Data type', upload_kind_sales: 'Sales', upload_kind_complaint: 'Complaint',
      upload_detected: 'Detected {k} file',
      upload_skipped_rows: '{n} rows skipped because the data was incomplete/invalid.',
      upload_complaints_suffix: 'complaints',
      upload_ready_complaint: '{n} rows ready to upload. Existing rows are skipped automatically.',
      upload_done_complaint: '{n} complaints added.',
      upload_dup_skipped: '{n} duplicates skipped.',
      upload_none_added: 'No new data — every row already exists in the spreadsheet.',
      upload_redeploy_hint: 'The Apps Script is still an old version. Re-copy Code.gs, then Deploy → Manage deployments → Version: New version → Deploy.',

      toast_cache_cleared: 'Cache cleared. Refresh the page.',
      toast_cache_loading: 'Cached data · loading latest...',
      toast_load_failed: 'Update failed: {msg}',
      splash_failed: 'Failed: {msg}',

      health_critical: 'Critical', health_warn: 'Near limit',
      health_ok: 'Healthy', health_great: 'Very healthy',
      pct_used: '{p}% used',

      // ---- Activity
      act_add: 'Add activity', act_calendar: 'Activity calendar', act_list: 'Activity list',
      act_form_title: 'Add activity', act_name: 'Name', act_date: 'Date',
      act_store: 'Store', act_type: 'Activity',
      act_pick_store: 'Pick a store', act_pick_type: 'Pick an activity',
      act_saved: 'Activity saved', act_save_failed: 'Failed to save activity',
      act_filter: 'Filter activities', act_result: 'Results',
      act_count: '{n} activities', act_none: 'No activity matches this filter.',
      act_day_title: 'Activities on {date}', act_legend: 'Legend',
      act_reload: 'Reload activities',
      act_err_name: 'Name is required.', act_err_date: 'Date is required.',
      act_err_store: 'Store is required.', act_err_type: 'Activity is required.',
      act_err_field: '{f} is required.',

      // ---- Complaint
      cmp_add: 'Add complaint', cmp_list: 'Complaint list', cmp_form_title: 'Add complaint',
      cmp_name: 'Name', cmp_contact: 'Contact', cmp_address: 'Address', cmp_store: 'Store name',
      cmp_media: 'Complaint media', cmp_category: 'Category',
      cmp_trx_date: 'Transaction date', cmp_body: 'Complaint detail',
      cmp_pick_media: 'Pick media', cmp_pick_category: 'Pick category',
      cmp_saved: 'Complaint saved', cmp_save_failed: 'Failed to save complaint',
      cmp_filter: 'Filter complaints', cmp_count: '{n} complaints',
      cmp_none: 'No complaint matches this filter.',
      cmp_reload: 'Reload complaints',
      cmp_err_name: 'Name is required.', cmp_err_store: 'Store name is required.',
      cmp_err_media: 'Complaint media is required.', cmp_err_category: 'Category is required.',
      cmp_err_date: 'Transaction date is required.', cmp_err_body: 'Complaint detail is required.',

      months_short: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      months_full:  ['January','February','March','April','May','June','July','August','September','October','November','December'],
      days_short:   ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    }
  }
};
