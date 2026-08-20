# Sales Dashboard

Progressive Web App (PWA) untuk memantau penjualan multi-branch dengan Google Sheets sebagai database. Dashboard responsif untuk desktop dan mobile, dengan filter interaktif hingga level regional, area, dan channel.

## Fitur

- Dashboard responsif untuk desktop & mobile
- Filter searchable: Regional, Area, Nama Toko, Channel (multi-select), Periode
- Filter periode: bulan berjalan, bulan lalu, 7/30 hari terakhir, rentang khusus (sinkron dua arah dengan input tanggal)
- Metrik: sales periode, growth vs periode sebelumnya, rata-rata harian, jumlah toko aktif
- Grafik tren harian dengan tooltip tanggal lengkap
- Top & Low sales — jumlah bisa diatur (3/5/10/20), level agregasi bisa per toko/area/regional
- Pengaturan format uang: Otomatis, Juta, Ribuan, Penuh
- Pull-to-refresh mobile & auto-refresh saat kembali ke tab
- Installable sebagai PWA
- Filter otomatis menyaring toko aktif dari sheet Regional

## Struktur Folder

```
sales-dashboard/
├── index.html
├── manifest.json
├── service-worker.js
├── css/style.css
├── js/
│   ├── config.js
│   ├── sheets.js
│   ├── dropdown.js
│   └── app.js
├── icons/
├── apps-script/Code.gs
└── README.md
```

## Setup Ulang (untuk perubahan besar ini)

### 1. Update Apps Script

- Buka spreadsheet → Extensions → Apps Script
- Ganti seluruh isi Code.gs dengan versi baru
- Save
- Deploy → Manage deployments → edit deployment yang ada → Version: New version → Deploy

### 2. Update file di GitHub

Upload/replace file-file ini di repo:
- `index.html`
- `service-worker.js` (versi bump ke v3)
- `css/style.css`
- `js/config.js`
- `js/sheets.js`
- `js/dropdown.js` (baru)
- `js/app.js`
- Hapus `js/upload.js` yang lama (sudah tidak dipakai)

### 3. Isi sheet Regional

Buka aplikasi → klik ikon gear kanan atas → klik "Isi ulang sheet Regional". Sheet baru bernama `Regional` akan otomatis dibuat dengan 98 toko aktif (Regional, Area, Nama Toko).

### 4. Hard refresh

Ctrl+Shift+R di browser supaya service worker versi baru diambil.

## Cara Pakai

### Input Data
Input data langsung di spreadsheet Google Sheets, tab `Sales`. Kolom yang wajib:
`Sales Date | Branch Name | DINE IN | TAKE AWAY | GRABFOOD | GOFOOD | SHOPEE FOOD | BAZAR | CATERING | ESB Order Delivery | ESB Order Pickup | PAKAR | Total`

Untuk bulk input, paste dari Excel atau pakai File → Import di Google Sheets.

### Filter
- **Regional / Area / Nama Toko** — searchable dropdown, dependent (pilih Regional 1 → Area otomatis terbatas ke area Regional 1)
- **Channel** — multi-select, klik OK untuk apply. Kosong = semua.
- **Periode** — preset atau custom. Edit Dari/Sampai langsung set ke "Rentang khusus"

### Top & Low
Kedua panel bisa disetting:
- Level: per toko / per area / per regional
- Jumlah: 3, 5, 10, atau 20

### Format Uang
Pengaturan → pilih format. Tersimpan per device di browser.

### Refresh
- Mobile: tarik dari atas
- Desktop: klik "Sales Dashboard" di kiri atas
- Otomatis: saat kembali ke tab

## Troubleshooting

**Data tidak muncul**
Cek URL debug: `https://script.google.com/macros/s/xxx/exec?action=debug`

**Response bukan JSON**
Deployment access belum "Anyone". Deploy ulang.

**Filter Nama Toko kosong**
Sheet Regional belum diisi. Pengaturan → Isi ulang sheet Regional.
