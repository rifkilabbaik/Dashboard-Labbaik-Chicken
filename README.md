# Sales Dashboard

Progressive Web App (PWA) untuk memantau penjualan multi-branch dengan Google Sheets sebagai database. Dashboard responsif untuk desktop dan mobile, dengan filter interaktif hingga level regional, area, dan channel.

## Fitur

- Dashboard responsif untuk desktop & mobile
- Periode default: **tanggal 1 bulan berjalan s/d tanggal data penjualan terakhir**
- Filter periode: rentang tanggal bebas (kalender)
- Metrik: total penjualan + grup Offline/Online/Catering, penjualan Regional & Area
- Grafik tren: **Harian = garis, Mingguan & Bulanan = bar chart**. Ketuk grafik untuk
  popup perbandingan (Harian/Mingguan vs bulan lalu, Bulanan vs **tahun lalu**)
- Top & Low 10 toko
- **Kegiatan** — catat kegiatan FLD / GCOM / CX, kalender kegiatan, filter & daftar
- **Komplain** — input komplain pelanggan langsung ke sheet `Komplain`
- Pengaturan: tema (6 palet), bahasa (ID/EN), format uang, format text
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
│   ├── upload.js
│   └── app.js
├── icons/
├── apps-script/Code.gs
└── README.md
```

## Setup Ulang (untuk perubahan besar ini)

> **Penting untuk versi ini:** Apps Script harus di-deploy ulang, karena ada
> action baru (`fetchKegiatan`, `fetchKomplain`, `addKegiatan`, `addKomplain`).
> Sheet `Kegiatan` dibuat otomatis saat kegiatan pertama disimpan.

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
- `js/app.js`

### 3. Isi sheet Regional

Buka aplikasi → klik ikon gear kanan atas → klik "Isi ulang sheet Regional". Sheet baru bernama `Regional` akan otomatis dibuat dengan 98 toko aktif (Regional, Area, Nama Toko).

### 4. Hard refresh

Ctrl+Shift+R di browser supaya service worker versi baru diambil.

## Cara Pakai

### Input Data Penjualan
Input data langsung di spreadsheet Google Sheets, tab `Sales`. Kolom yang wajib:
`Sales Date | Branch Name | DINE IN | TAKE AWAY | GRABFOOD | GOFOOD | SHOPEE FOOD | BAZAR | CATERING | ESB Order Delivery | ESB Order Pickup | PAKAR | Total`

Untuk bulk input, paste dari Excel atau pakai File → Import di Google Sheets.

### Kegiatan

Menu **Kegiatan** (di bawah Penjualan) punya dua tombol:

**Tambahkan kegiatan** — popup form:

| Field | Keterangan |
|---|---|
| Nama | nama petugas |
| Tanggal | date picker |
| Toko | dropdown dengan kotak cari |
| Kegiatan | dropdown `FLD` / `GCOM` / `CX` |

Kolom tambahan muncul mengikuti jenis kegiatan:

| Kegiatan | Keterangan 1 | Keterangan 2 |
|---|---|---|
| FLD | Nama TK (maks 80 karakter) | Jumlah Peserta |
| GCOM | Nama Komunitas (maks 80 karakter) | Jumlah Peserta |
| CX | Tujuan Kunjungan (maks **140 karakter**) | — |

> Batas 140 karakter untuk Tujuan Kunjungan dipilih supaya cukup untuk 1–2 kalimat
> tujuan datang, tapi tetap ringkas dibaca di spreadsheet. Sisa karakter tampil
> di bawah kolomnya saat mengetik.

Data otomatis masuk ke sheet **`Kegiatan`** dengan format:

```
Tanggal | Nama | Nama Toko | Kegiatan | Keterangan 1 | Keterangan 2
```

**Kalender kegiatan** — kalender bulanan; setiap tanggal yang ada kegiatannya
diberi tag. Walau kegiatannya banyak, **tiap kategori hanya muncul 1 tag** sebagai
penanda. Klik tanggalnya untuk melihat popup berisi nama, toko, kegiatan, dan
detail keterangan semua kegiatan di tanggal tersebut.

**Filter** — rentang tanggal, Nama, Toko, Kegiatan (semuanya punya opsi "Semua";
tombol "Semua" di kalender rentang tanggal untuk menghapus filter tanggal).
Hasilnya berupa daftar:

```
20/08/2026  Rifki  LC LOPANG  FLD
            Nama TK: TK Anyer · Jumlah Peserta: 18
```

### Komplain

Menu **Komplain** → **Tambahkan komplain**. Hanya field berikut yang diinput,
dan langsung dicatat ke sheet **`Komplain`**:

```
Nama | Kontak | Alamat | Nama Store | Media Komplain | Kategori | Tanggal Transaksi | Isi Komplain
```

- **Media Komplain**: WhatsApp, Instagram, Google Review, Aplikasi GoFood, Aplikasi GrabFood, Aplikasi ShopeeFood
- **Kategori**: Kualitas Produk, Kurang Produk, Salah Produk, Kualitas Pelayanan, Kualitas Peralatan, Produk Kosong, Tidak Terima Struk

Kalau sheet `Komplain` sudah punya kolom lain (`Case Id`, `Tanggal Komplain`,
`Tanggal Input`, `Area Manager`, `Regional Manager`), kolom itu **tidak diisi dan
tidak dihapus** — Apps Script menulis berdasarkan nama header, bukan urutan kolom,
jadi kolom ekstra tetap utuh.

Halaman Komplain juga punya filter (rentang tanggal, Nama Store, Media, Kategori)
dan daftar komplain; klik satu baris untuk melihat detail lengkapnya.

### Filter penjualan
- **Regional / Area** — dropdown pada bagian Penjualan Toko
- **Periode** — tombol tanggal di kanan atas (kalender rentang)

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

**Dropdown Toko di form Kegiatan/Komplain kosong**
Daftar toko diambil dari sheet `Regional`. Kalau sheet itu kosong, aplikasi
memakai daftar toko dari data penjualan sebagai cadangan.

**Kegiatan/Komplain gagal disimpan**
Apps Script belum di-deploy ulang setelah `Code.gs` diperbarui. Deploy → Manage
deployments → Version: New version → Deploy.
