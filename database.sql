-- Database Schema untuk Sistem Absensi PKL (Supabase/PostgreSQL)
-- Tujuan: struktur tabel utama (users, attendances, device_bindings, izin)

-- Table: users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'mahasiswa',
  kelompok VARCHAR(100),
  devices JSONB DEFAULT '[]',
  max_devices INTEGER DEFAULT 2,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: attendances
CREATE TABLE attendances (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kelompok VARCHAR(100),
  tanggal DATE NOT NULL,
  sesi VARCHAR(10) NOT NULL,
  jam_masuk TIME NOT NULL,
  login_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'hadir',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(nama, tanggal, sesi)
);

-- Table: device_bindings
CREATE TABLE device_bindings (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  kelompok VARCHAR(100),
  bound_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1
);

-- Table: izin
CREATE TABLE izin (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kelompok VARCHAR(100),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  keterangan TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes untuk performance
CREATE INDEX idx_attendances_nama ON attendances(nama);
CREATE INDEX idx_attendances_tanggal ON attendances(tanggal);
CREATE INDEX idx_device_bindings_device ON device_bindings(device_id);
CREATE INDEX idx_users_nama ON users(nama);
CREATE INDEX idx_izin_nama ON izin(nama);
CREATE INDEX idx_izin_tanggal ON izin(tanggal);

-- Grants (opsional, sesuaikan dengan Supabase settings)
-- GRANT ALL PRIVILEGES ON TABLE users TO authenticated;
-- GRANT ALL PRIVILEGES ON TABLE attendances TO authenticated;
-- GRANT ALL PRIVILEGES ON TABLE device_bindings TO authenticated;
