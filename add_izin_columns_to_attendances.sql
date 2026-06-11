-- Migration: Tambah kolom IZIN ke tabel attendances
-- Tujuan: Merge izin functionality ke dalam attendances table
-- Jalankan ini di Supabase SQL Editor

-- 1. Tambah kolom izin ke attendances table
ALTER TABLE attendances 
ADD COLUMN IF NOT EXISTS keterangan TEXT,
ADD COLUMN IF NOT EXISTS bukti_url TEXT,
ADD COLUMN IF NOT EXISTS status_approval VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Tambah constraint untuk validasi status izin (optional, bisa diabaikan jika sudah ada)
-- ALTER TABLE attendances 
-- ADD CONSTRAINT attendances_status_check 
-- CHECK (status IN ('hadir', 'sakit', 'izin', 'alpa'));

-- 3. Tambah constraint untuk status_approval (optional, bisa diabaikan jika sudah ada)
-- ALTER TABLE attendances 
-- ADD CONSTRAINT attendances_status_approval_check 
-- CHECK (status_approval IS NULL OR status_approval IN ('pending', 'approved', 'rejected'));

-- 4. Buat index untuk query izin
CREATE INDEX IF NOT EXISTS idx_attendances_status_approval ON attendances(status_approval);
CREATE INDEX IF NOT EXISTS idx_attendances_status_izin ON attendances(status, tanggal);

-- 5. Setelah columns ditambah, migrate data dari izin table jika ada
-- (Uncomment jika izin table sudah punya data yang perlu di-migrate)
/*
INSERT INTO attendances 
  (nama, kelompok, tanggal, sesi, jam_masuk, login_time, status, keterangan, status_approval, approved_by, approved_at, created_at)
SELECT 
  izin.nama,
  izin.kelompok,
  izin.tanggal,
  'harian' AS sesi,
  '00:00:00'::TIME AS jam_masuk,
  izin.tanggal::TIMESTAMP AS login_time,
  'izin' AS status,
  izin.keterangan,
  CASE WHEN izin.status = 'approved' THEN 'approved' ELSE 'pending' END AS status_approval,
  izin.approved_by,
  izin.approved_at,
  izin.created_at
FROM izin
ON CONFLICT (nama, tanggal, sesi) DO NOTHING;
*/

-- Done! Columns sudah siap untuk izin functionality
