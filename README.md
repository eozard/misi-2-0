# Sistem Absensi PKL dan Pendaftaran

Aplikasi full-stack untuk mengelola absensi PKL, izin, logbook harian, dan pendaftaran peserta. Backend menggunakan Express.js dan Supabase, frontend menggunakan React + Vite + Tailwind CSS.

## Fitur Utama

- Login berbasis JWT untuk admin, mahasiswa, dan anak SMK.
- Device binding berbasis fingerprint browser untuk membatasi perangkat user.
- Validasi absensi dari jaringan kampus dengan whitelist IP `103.209.9.*`.
- Absensi sesi pagi dan sore dengan aturan waktu, anti-duplikat, dan jeda minimal.
- Pengajuan izin oleh mahasiswa, lengkap dengan status approval admin.
- Logbook harian mahasiswa dengan status draft/submitted.
- Dashboard admin untuk statistik, user, device, laporan absensi, izin, dan logbook.
- Form pendaftaran publik dengan upload PDF CV, transkrip, dan surat persetujuan.
- Dashboard admin pendaftaran untuk melihat pendaftar, assign divisi, dan mengelola akun admin pendaftaran.
- Penyimpanan data dan file menggunakan Supabase Database + Supabase Storage.

## Teknologi

- Frontend: React 18, Vite, Tailwind CSS, React Router, Axios, Lucide React.
- Backend: Node.js, Express.js, JWT, bcryptjs, Multer.
- Database dan storage: Supabase PostgreSQL dan Supabase Storage.
- Runtime: Node.js 20+.

## Struktur Project

```text
.
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── package.json
│   └── server.js
├── database.sql
├── add_izin_columns_to_attendances.sql
├── create_izin_table.sql
├── create_logbook_supabase.sql
├── table_pendaftaran_supabase.sql
├── fix_device_bindings_rls.sql
├── package.json
└── README.md
```

## Halaman Aplikasi

- `/` - login user absensi.
- `/dashboard` - dashboard mahasiswa/anak SMK.
- `/admin` - dashboard admin absensi.
- `/pendaftaran` - form pendaftaran publik.
- `/admin_pendaftaran` - dashboard admin pendaftaran.

## Persiapan Environment

Buat file `.env` di root project atau di folder `server/`.

```env
PORT=5000
NODE_ENV=development

SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

JWT_SECRET=your-minimum-32-character-secret
PENDAFTARAN_BUCKET=pendaftaran-files

BYPASS_WIFI_CHECK=true
# BYPASS_TIME_CHECK=true
# BYPASS_PAGI_ONLY=true
# BYPASS_JEDA_CHECK=true
```

Untuk frontend development, buat `client/.env` jika perlu:

```env
VITE_API_URL=http://localhost:5000/api
```

Catatan:

- `SUPABASE_SERVICE_ROLE_KEY` disarankan untuk backend karena beberapa fitur admin perlu akses penuh.
- `BYPASS_WIFI_CHECK=true` hanya untuk development. Untuk production gunakan `false`.
- `PENDAFTARAN_BUCKET` default-nya `pendaftaran-files`.

## Setup Database dan Storage

Jalankan file SQL berikut di Supabase SQL Editor sesuai kebutuhan:

1. `database.sql` untuk tabel utama user, absensi, dan device binding.
2. `add_izin_columns_to_attendances.sql` atau `create_izin_table.sql` untuk fitur izin.
3. `create_logbook_supabase.sql` untuk fitur logbook.
4. `table_pendaftaran_supabase.sql` untuk fitur pendaftaran.
5. `fix_device_bindings_rls.sql` jika perlu memperbaiki policy RLS device binding.

Buat bucket Supabase Storage:

```text
pendaftaran-files
```

Set bucket menjadi public agar PDF pendaftar bisa dipreview dari aplikasi.

## Instalasi

Install dependency root, server, dan client:

```bash
npm install
```

Script `postinstall` di root akan menjalankan install untuk `server` dan `client`.

Jika ingin manual:

```bash
cd server
npm install

cd ../client
npm install
```

## Menjalankan Development

Terminal 1 - backend:

```bash
npm run dev
```

Backend berjalan di:

```text
http://localhost:5000
```

Terminal 2 - frontend:

```bash
npm run dev:frontend
```

Frontend berjalan di:

```text
http://localhost:5173
```

## Build Production

Build frontend:

```bash
npm run build
```

Jalankan backend yang sekaligus serve hasil build React:

```bash
npm start
```

## Endpoint Utama

Public:

- `GET /health`
- `GET /api/check-ip`
- `POST /api/login`
- `POST /api/pendaftaran`
- `POST /api/admin-pendaftaran/login`
- `GET /api/admin-pendaftaran/list`
- `POST /api/admin-pendaftaran/seed`

Mahasiswa/anak SMK:

- `POST /api/absen`
- `GET /api/riwayat`
- `POST /api/izin`
- `GET /api/izin`
- `DELETE /api/izin/:id`
- `GET /api/logbook`
- `GET /api/logbook/today`
- `POST /api/logbook`
- `PUT /api/logbook/:id`
- `POST /api/logbook/:id/submit`
- `DELETE /api/logbook/:id`

Admin:

- `GET /api/admin/stats`
- `GET /api/admin/attendance-today`
- `GET /api/admin/students`
- `GET /api/admin/attendance/:nama`
- `GET /api/admin/devices`
- `DELETE /api/admin/devices/:deviceId`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `POST /api/admin/users/:id/reset-password`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/report`
- `GET /api/admin/izin`
- `PUT /api/admin/izin/:id`
- `GET /api/admin/logbook`
- `GET /api/admin/logbook/:id`
- `POST /api/admin/logbook/:id/reset`
- `DELETE /api/admin/logbook/:id`

Admin pendaftaran:

- `GET /api/pendaftaran`
- `PUT /api/pendaftaran/:id`
- `DELETE /api/pendaftaran/:id`
- `GET /api/pendaftaran/file/:id/:type`
- `GET /api/pendaftaran/file-url/:id/:type`
- `POST /api/admin-pendaftaran/create`
- `DELETE /api/admin-pendaftaran/:id`

## Aturan Absensi

- Sesi pagi: 08:00-10:00.
- Sesi sore: 15:00-17:00.
- Sore hanya bisa dilakukan jika user sudah absen pagi.
- Jeda pagi ke sore minimal 6 jam, di luar waktu istirahat 12:00-13:00.
- User tidak bisa absen dua kali pada sesi yang sama.
- Device harus sudah terdaftar dan tidak boleh dipakai akun lain.
- Absensi wajib dari WiFi kampus kecuali `BYPASS_WIFI_CHECK=true`.

## Pendaftaran

Form pendaftaran menerima:

- Nama.
- NIM.
- Email.
- Divisi pilihan: Networking, Software Engineer, Multimedia, Artificial Intelligence, Data Analyst.
- File PDF CV.
- File PDF transkrip.
- File PDF surat persetujuan.

Pendaftar pertama sampai urutan ke-30 diberi status `priority`, sisanya `pending`. Admin pendaftaran dapat assign divisi dengan batas maksimal 6 peserta per divisi.

## Catatan Keamanan

- Jangan commit file `.env` berisi kredensial asli.
- Gunakan `JWT_SECRET` kuat minimal 32 karakter.
- Gunakan `BYPASS_WIFI_CHECK=false` di production.
- Simpan service role key hanya di backend/server environment.
