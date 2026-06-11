-- =============================================================================
-- TABLE PENDAFTARAN - SUPABASE SQL
-- =============================================================================
-- File SQL ini digunakan untuk membuat tabel pendaftar, divisi assignment,
-- dan admin pendaftaran di Supabase.
--
-- CARA PAKAI:
-- 1. Buka Supabase Project → SQL Editor
-- 2. Buat query baru, paste seluruh isi file ini
-- 3. Klik "Run" untuk menjalankan
--
-- TABEL YANG DIBUAT:
-- 1. pendaftar             - Data pendaftar (nama, NIM, email, divisi pilihan, status)
-- 2. pendaftar_files       - File PDF yang diupload (CV, transkrip, surat persetujuan)
-- 3. admin_pendaftaran     - Akun admin yang bisa akses /admin_pendaftaran
-- =============================================================================


-- =============================================================================
-- TABEL 1: pendaftar
-- =============================================================================
-- Menyimpan data pendaftar beserta divisi yang dipilih & penugasan dari admin.
-- Status pendaftar:
--   - 'pending'  : Baru daftar, belum diproses admin
--   - 'priority' : Masuk 30 pendaftar paling awal
--   - 'assigned' : Sudah ditempatkan ke divisi oleh admin
--   - 'rejected' : Ditolak / tidak mendapat slot
CREATE TABLE IF NOT EXISTS pendaftar (
  id SERIAL PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  nim VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  divisi_pilihan VARCHAR(100) NOT NULL,
  divisi_assigned VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  urutan INTEGER NOT NULL,
  assigned_at TIMESTAMP,
  assigned_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE pendaftar IS 'Data pendaftar PKL/divisi. Urutan menentukan list prioritas (1-30).';
COMMENT ON COLUMN pendaftar.urutan IS 'Nomor urut pendaftaran (1 = paling awal). Pendaftar 1-30 = priority.';
COMMENT ON COLUMN pendaftar.divisi_pilihan IS 'Pilihan divisi pendaftar: networking, software_engineer, multimedia, ai, data_analyst';
COMMENT ON COLUMN pendaftar.divisi_assigned IS 'Divisi hasil penugasan admin. NULL jika belum ditempatkan.';
COMMENT ON COLUMN pendaftar.status IS 'pending | priority | assigned | rejected';


-- =============================================================================
-- TABEL 2: pendaftar_files
-- =============================================================================
-- Menyimpan metadata file PDF yang diupload pendaftar.
-- File PDF sendiri disimpan di server lokal (folder server/uploads/pendaftaran).
-- Kolom tipe:
--   - 'cv'        : File CV
--   - 'transkrip' : File transkrip nilai semester kemarin
--   - 'surat'     : File surat persetujuan dari sekolah
CREATE TABLE IF NOT EXISTS pendaftar_files (
  id SERIAL PRIMARY KEY,
  pendaftar_id INTEGER NOT NULL REFERENCES pendaftar(id) ON DELETE CASCADE,
  tipe VARCHAR(50) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  storage_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE pendaftar_files IS 'Metadata file PDF yang diupload pendaftar (CV, transkrip, surat). Disimpan di Supabase Storage bucket "pendaftaran".';
COMMENT ON COLUMN pendaftar_files.tipe IS 'cv | transkrip | surat';
COMMENT ON COLUMN pendaftar_files.storage_path IS 'Path file di Supabase Storage bucket, contoh: "1/cv_1700000000_abc.pdf". NULL untuk data lama yang masih di disk lokal.';


-- =============================================================================
-- TABEL 3: admin_pendaftaran
-- =============================================================================
-- Akun khusus untuk admin yang mengelola halaman /admin_pendaftaran.
-- Dipisahkan dari tabel users biasa agar tidak tercampur dengan user absensi.
-- Password disimpan dalam bentuk bcrypt hash.
CREATE TABLE IF NOT EXISTS admin_pendaftaran (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nama VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE admin_pendaftaran IS 'Akun admin yang bisa akses dashboard /admin_pendaftaran. Terpisah dari users biasa.';


-- =============================================================================
-- INDEXES untuk performa query
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_pendaftar_urutan ON pendaftar(urutan);
CREATE INDEX IF NOT EXISTS idx_pendaftar_status ON pendaftar(status);
CREATE INDEX IF NOT EXISTS idx_pendaftar_nim ON pendaftar(nim);
CREATE INDEX IF NOT EXISTS idx_pendaftar_email ON pendaftar(email);
CREATE INDEX IF NOT EXISTS idx_pendaftar_divisi_assigned ON pendaftar(divisi_assigned);
CREATE INDEX IF NOT EXISTS idx_pendaftar_files_pendaftar ON pendaftar_files(pendaftar_id);
CREATE INDEX IF NOT EXISTS idx_admin_pendaftaran_username ON admin_pendaftaran(username);


-- =============================================================================
-- (OPSIONAL) Row Level Security
-- =============================================================================
-- Catatan: Backend menggunakan SUPABASE_SERVICE_ROLE_KEY yang bypass RLS,
-- jadi RLS tidak wajib. Jika ingin tetap mengaktifkan RLS, uncomment baris di bawah.
--
-- ALTER TABLE pendaftar ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE pendaftar_files ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE admin_pendaftaran ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- SELESAI
-- =============================================================================
-- Setelah menjalankan SQL ini, Anda perlu:
-- 1. Membuat akun admin_pendaftaran secara manual via SQL Editor, contoh:
--
--    INSERT INTO admin_pendaftaran (username, password, nama) VALUES
--    ('admin', '<bcrypt_hash_password>', 'Admin Pendaftaran');
--
--    Untuk generate bcrypt hash, bisa pakai command di Node.js:
--    node -e "console.log(require('bcryptjs').hashSync('password_anda', 10))"
--
-- 2. Pastikan server sudah support endpoint:
--    - POST   /api/pendaftaran                  (publik, upload pendaftar)
--    - POST   /api/admin-pendaftaran/login      (login admin pendaftaran)
--    - GET    /api/admin-pendaftaran/pendaftar  (list pendaftar, butuh token)
--    - POST   /api/admin-pendaftaran/assign     (assign pendaftar ke divisi)
--    - DELETE /api/admin-pendaftaran/pendaftar/:id (hapus pendaftar)
--    - GET    /api/admin-pendaftaran/files/:id  (download file PDF)
-- =============================================================================
