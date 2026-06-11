# 📋 Sistem Absensi PKL (Praktek Kerja Lapangan)

Sistem absensi berbasis web untuk mengelola kehadiran mahasiswa dan anak SMK dalam program PKL dengan fitur browser fingerprinting, device binding, dan pembatasan WiFi kampus.

## 🎯 Features

- ✅ **Authentication**: JWT-based login dengan browser fingerprinting
- ✅ **Device Binding**: Batasi 2 device per user (mahasiswa/anak_smk)
- ✅ **WiFi Restriction**: Hanya bisa absen dari WiFi Kampus (IP: 103.209.9.\*)
- ✅ **Session Management**: Pagi (08:00-11:59) & Sore (12:00-18:00) dengan validasi jeda 6 jam
- ✅ **Admin Dashboard**: Stats, filter, search, export Excel
- ✅ **Student Dashboard**: History absensi & real-time jam
- ✅ **Database Seeding**: Dummy data 40 siswa + 30 hari attendance

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS + Lucide Icons
- **Backend**: Node.js + Express.js + Supabase
- **Database**: PostgreSQL (Supabase)
- **Auth**: JWT + Browser Fingerprinting (@fingerprintjs/fingerprintjs)

## 📁 Struktur Project

```
absensi-pkl-supabase/          # Root project
├── server/                     # Backend API (Express.js)
│   ├── config/
│   │   └── supabase.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── wifiKampus.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── admin.js
│   ├── scripts/
│   │   ├── seedDatabase.js
│   │   ├── createAdminUser.js
│   │   └── ...
│   ├── server.js               # Entry point
│   └── package.json
│
├── client/                      # Frontend React (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── .env                        # Environment variables
├── package.json                # Root scripts
└── README.md
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Copy env example
cp .env.example .env

# Edit .env dengan credentials Supabase Anda
```

### 2. Install Dependencies

```bash
# Install semua dependencies (root, server, client)
npm install

# Jika ingin install separate:
npm install                    # Install root
cd server && npm install      # Install server
cd client && npm install      # Install client
```

### 3. Jalankan Project

#### Option A: Development Mode (Separated)

**Terminal 1 - Backend:**

```bash
cd server
npm run dev
# Server runs on http://localhost:5000
```

**Terminal 2 - Frontend:**

```bash
cd client
npm run dev
# Frontend runs on http://localhost:5173 (with API proxy to :5000)
```

#### Option B: Production Mode (Unified)

```bash
# Build frontend
cd client && npm run build && cd ..

# Run backend (serves frontend)
cd server && npm run dev
# Access on http://localhost:5000
```

### 4. Database Setup

```bash
# Seed dummy data
npm run seed

# Create admin user
npm run create-admin

# List all users
npm run list-users
```

## 📝 Available Scripts

### Root Scripts

```bash
npm run dev              # Run backend server
npm run dev:frontend    # Run frontend dev server
npm run build:frontend  # Build frontend
npm run preview:frontend # Preview frontend build
npm run seed            # Seed database with dummy data
npm run create-admin    # Create admin account
npm run list-users      # List all users
```

### Server Scripts

```bash
cd server
npm run dev                    # Start server
npm run seed                   # Seed database
npm run create-admin           # Create admin
npm run list-users             # List users
node test-comprehensive.js    # Run comprehensive tests
```

### Client Scripts

```bash
cd client
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## 🔐 Authentication

### Login

```bash
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password",
  "fingerprint": "device-fingerprint-hash"
}
```

### Device Binding

- Max 2 devices per user
- Automatic fingerprint-based binding
- Remove device dari dashboard

## 📊 API Endpoints

### Authentication

- `POST /api/login` - Login

### Mahasiswa

- `POST /api/absen` - Record attendance
- `GET /api/riwayat` - Get attendance history
- `POST /api/izin` - Submit permit request
- `GET /api/izin` - Get permits
- `DELETE /api/izin/:id` - Cancel permit

### Admin

- `GET /api/admin/stats` - Dashboard stats
- `GET /api/admin/students` - List students
- `GET /api/admin/attendance/:nama` - Student attendance
- `GET /api/admin/devices` - List devices
- `DELETE /api/admin/devices/:deviceId` - Remove device
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Create user
- `GET /api/admin/izin` - All permits
- `PUT /api/admin/izin/:id` - Update permit status

## 📋 Struktur Project

│ │ └── wifiKampus.js
│ ├── routes/
│ │ ├── auth.js
│ │ └── admin.js
│ ├── scripts/
│ │ ├── seedDatabase.js
│ │ ├── createAdminUser.js
│ │ └── listAllUsers.js
│ ├── .env
│ ├── .env.example
│ ├── server.js
│ └── package.json
│
├── frontend/
│ ├── src/
│ │ ├── components/
│ │ │ └── ProtectedRoute.jsx
│ │ ├── pages/
│ │ │ ├── LoginPage.jsx
│ │ │ ├── MahasiswaDashboard.jsx
│ │ │ └── AdminDashboard.jsx
│ │ ├── utils/
│ │ │ ├── axios.js
│ │ │ └── fingerprint.js
│ │ ├── App.jsx
│ │ ├── main.jsx
│ │ └── index.css
│ ├── index.html
│ ├── vite.config.js
│ ├── tailwind.config.js
│ ├── postcss.config.js
│ ├── .env
│ └── package.json
│
├── database.sql
└── README.md

````

## 🚀 Quick Start

### Prerequisites

- Node.js v16+
- Supabase account (free tier: https://supabase.com)
- npm atau yarn

### 1. Setup Supabase

1. Buat project baru di [Supabase Dashboard](https://supabase.com)
2. Copy `SUPABASE_URL` dan `SUPABASE_ANON_KEY` dari project settings
3. Buka SQL Editor dan copy-paste isi file `database.sql`
4. Jalankan semua SQL queries untuk membuat tables

### 2. Setup Backend

```bash
cd backend
npm install
````

**Buat file `.env`:**

```env
PORT=5000
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long-here
NODE_ENV=development
BYPASS_WIFI_CHECK=true
```

**Seed database:**

```bash
npm run seed
```

**Jalankan server:**

```bash
npm run dev
```

Server akan berjalan di `http://localhost:5000`

### 3. Setup Frontend

```bash
cd frontend
npm install
```

**Jalankan development server:**

```bash
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

## 📝 API Endpoints

### Public

- `POST /api/login` - Login & device binding

### Protected (Mahasiswa/Anak SMK)

- `POST /api/absen` - Absen (WiFi restriction)
- `GET /api/riwayat` - Get history absensi

### Protected (Admin Only)

- `GET /api/admin/stats` - Get stats hari ini
- `GET /api/admin/attendance-today` - Get absensi hari ini
- `GET /api/admin/students` - List semua siswa
- `GET /api/admin/attendance/:nama` - Get riwayat siswa

## 🔐 Demo Credentials

Setelah seeding, gunakan:

**Admin:**

- Nama: `admin`
- Password: `admin123`

**Mahasiswa/Anak SMK:**

- Nama: (lihat list dengan `npm run list-users`)
- Password: `12345678`

## 📊 Database Schema

### users

```sql
id, nama (unique), password, role, kelompok, devices (JSONB), max_devices
```

### attendances

```sql
id, nama, kelompok, tanggal, sesi, jam_masuk, login_time, status, created_at
```

### device_bindings

```sql
id, device_id (unique), user_name, kelompok, bound_at, last_used, usage_count
```

## 🧪 Testing Scenarios

### Login & Device Binding

```
✅ Admin login dari device apapun
✅ Mahasiswa login pertama → device binding
✅ Mahasiswa login dari device sama → usage count++
❌ Mahasiswa login dari device ke-3 (max 2)
❌ Mahasiswa A login dari device milik B
```

### Absensi

```
✅ Absen pagi jam 09:00
❌ Absen pagi jam 07:00 (belum waktunya)
❌ Absen sore tanpa absen pagi
❌ Absen sore < 6 jam dari pagi
✅ Absen sore 6+ jam dari pagi
❌ Duplikat absen (1 sesi per hari)
❌ Absen dari IP selain 103.209.9.* (dev: bypass)
❌ Absen dari device tidak terdaftar
```

## 🛠️ Available Scripts

### Backend

```bash
npm run dev           # Start development server
npm run seed          # Seed database dengan dummy data
npm run create-admin  # Create admin user
npm run list-users    # List semua users
```

### Frontend

```bash
npm run dev      # Start development server
npm run build    # Build untuk production
npm run preview  # Preview production build
```

## 🔒 Security Features

1. **JWT Authentication**: Token expire 15 menit
2. **Password Hashing**: bcrypt (10 rounds)
3. **Device Binding**: Prevent multi-device abuse
4. **WiFi Restriction**: IP whitelist (103.209.9.\*)
5. **Browser Fingerprinting**: Unique device identification

## 📱 UI Components

- **Login Page**: Gradient background, card-based form
- **Mahasiswa Dashboard**: Real-time clock, session buttons, history table
- **Admin Dashboard**: 4 tabs (Stats, Attendance, Students, Report)
- **TailwindCSS**: Custom button & badge styles

## 🌐 Deployment

### Backend (Render.com / Railway.app)

1. Push ke GitHub
2. Connect repository ke Render/Railway
3. Set environment variables
4. Deploy

### Frontend (Vercel / Netlify)

1. Push ke GitHub
2. Connect repository ke Vercel/Netlify
3. Set `VITE_API_URL` ke backend URL
4. Deploy

## 📋 Environment Variables

**Backend (.env):**

```
PORT=5000
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
JWT_SECRET=... (min 32 chars)
NODE_ENV=production
BYPASS_WIFI_CHECK=false
```

**Frontend (.env):**

```
VITE_API_URL=https://your-backend.com/api
```

## 🐛 Troubleshooting

### "SUPABASE_URL dan SUPABASE_ANON_KEY harus didefinisikan"

→ Pastikan `.env` file ada di backend folder dengan value yang benar

### "Token tidak valid"

→ JWT_SECRET di backend harus minimal 32 karakter

### "Database error"

→ Pastikan tables sudah dibuat (jalankan database.sql di Supabase SQL editor)

### WiFi restriction tidak bekerja

→ Pastikan `BYPASS_WIFI_CHECK=false` di production

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Express.js Docs](https://expressjs.com)
- [React Docs](https://react.dev)
- [TailwindCSS Docs](https://tailwindcss.com)
- [FingerprintJS Docs](https://fingerprint.com/blog/introduction-to-browser-fingerprinting/)

## 📝 License

MIT

## 👥 Support

Untuk pertanyaan atau issue, silakan buat GitHub issue di repository ini.

---

**Dibuat dengan ❤️ untuk Sistem Absensi PKL**
