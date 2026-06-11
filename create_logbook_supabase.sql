-- =============================================================================
-- TABEL LOGBOOK - SUPABASE SQL
-- =============================================================================
-- Tambah tabel logbook untuk mencatat kegiatan harian mahasiswa PKL.
--
-- CARA PAKAI:
-- 1. Buka Supabase Project → SQL Editor
-- 2. Buat query baru, paste seluruh isi file ini
-- 3. Klik "Run" untuk menjalankan
--
-- DESAIN:
-- - 1 entri per hari per mahasiswa (UNIQUE constraint)
-- - Status: 'draft' (bisa edit) atau 'submitted' (locked, tidak bisa edit)
-- - Relasi ke tabel users via user_id (FK) DAN nama (string) supaya redundant
--   tapi match dengan struktur existing yang pakai 'nama' string di attendances
-- =============================================================================


-- =============================================================================
-- TABEL: logbook
-- =============================================================================
CREATE TABLE IF NOT EXISTS logbook (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  nama VARCHAR(255) NOT NULL,
  kelompok VARCHAR(100),
  tanggal DATE NOT NULL,
  kegiatan TEXT NOT NULL,
  kendala TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(nama, tanggal)
);

COMMENT ON TABLE logbook IS 'Catatan kegiatan harian mahasiswa PKL. 1 entri per hari per user.';
COMMENT ON COLUMN logbook.user_id IS 'FK ke users.id. NULL untuk backward compat dengan data lama.';
COMMENT ON COLUMN logbook.nama IS 'Snapshot nama user (untuk query yang match dengan struktur attendances).';
COMMENT ON COLUMN logbook.kelompok IS 'Snapshot kelompok user saat logbook dibuat.';
COMMENT ON COLUMN logbook.tanggal IS 'Tanggal kegiatan, default hari ini saat create.';
COMMENT ON COLUMN logbook.kegiatan IS 'Deskripsi kegiatan yang dilakukan (wajib).';
COMMENT ON COLUMN logbook.kendala IS 'Kendala/hambatan yang dialami (opsional).';
COMMENT ON COLUMN logbook.status IS 'draft = masih bisa diedit, submitted = locked, sudah kirim ke admin.';


-- =============================================================================
-- INDEXES untuk performa
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_logbook_user_id ON logbook(user_id);
CREATE INDEX IF NOT EXISTS idx_logbook_nama ON logbook(nama);
CREATE INDEX IF NOT EXISTS idx_logbook_tanggal ON logbook(tanggal);
CREATE INDEX IF NOT EXISTS idx_logbook_status ON logbook(status);
CREATE INDEX IF NOT EXISTS idx_logbook_kelompok ON logbook(kelompok);


-- =============================================================================
-- TRIGGER: auto-update updated_at saat row di-UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION update_logbook_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_logbook_updated_at ON logbook;
CREATE TRIGGER trg_logbook_updated_at
  BEFORE UPDATE ON logbook
  FOR EACH ROW
  EXECUTE FUNCTION update_logbook_updated_at();


-- =============================================================================
-- (OPSIONAL) Row Level Security
-- =============================================================================
-- Catatan: Backend pakai SUPABASE_SERVICE_ROLE_KEY yang bypass RLS.
-- Aktifkan hanya jika Anda setup Supabase Auth untuk user biasa.
--
-- ALTER TABLE logbook ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "User can read own logbook" ON logbook
--   FOR SELECT USING (auth.uid()::text = user_id::text);
-- CREATE POLICY "User can insert own logbook" ON logbook
--   FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
-- CREATE POLICY "User can update own draft logbook" ON logbook
--   FOR UPDATE USING (auth.uid()::text = user_id::text AND status = 'draft');
-- CREATE POLICY "Admin can read all logbook" ON logbook
--   FOR ALL USING (auth.jwt() ->> 'role' = 'admin');


-- =============================================================================
-- SELESAI
-- =============================================================================
-- Setelah menjalankan SQL ini:
-- 1. Backend otomatis support endpoint:
--    - GET    /api/logbook                  (list logbook milik sendiri, mahasiswa)
--    - GET    /api/logbook/:id              (detail 1 logbook)
--    - POST   /api/logbook                  (create draft baru)
--    - PUT    /api/logbook/:id              (update draft)
--    - POST   /api/logbook/:id/submit       (kirim = status jadi submitted, lock)
--    - DELETE /api/logbook/:id              (hapus draft sendiri)
--    - GET    /api/admin/logbook            (list semua logbook, admin only)
--    - POST   /api/admin/logbook/:id/reset  (reset ke draft, admin only)
--    - DELETE /api/admin/logbook/:id        (hapus logbook, admin only)
-- 2. Frontend: MahasiswaDashboard & AdminDashboard akan punya tab/section Logbook
-- =============================================================================
