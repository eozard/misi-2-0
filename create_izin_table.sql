-- SQL untuk membuat table izin di Supabase
-- Tujuan: tabel izin mahasiswa (pending/approved/rejected)
-- Jalankan di Supabase SQL Editor

CREATE TABLE IF NOT EXISTS izin (
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

-- Buat index untuk performance
CREATE INDEX IF NOT EXISTS idx_izin_nama ON izin(nama);
CREATE INDEX IF NOT EXISTS idx_izin_tanggal ON izin(tanggal);
CREATE INDEX IF NOT EXISTS idx_izin_status ON izin(status);

-- Komentar: status bisa 'pending', 'approved', atau 'rejected'
