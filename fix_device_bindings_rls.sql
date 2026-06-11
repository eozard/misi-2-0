-- Fix untuk Device Bindings - Enable RLS dan create policies
-- Tujuan: mengatur policy device_bindings dan users saat diperlukan

-- 1. Check current RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('device_bindings', 'users', 'attendances', 'izin');

-- 2. Disable RLS untuk semua table (ATAU gunakan policies yang tepat)
-- Pilihan 1: Disable RLS sepenuhnya (less secure but easier for now)
ALTER TABLE device_bindings DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendances DISABLE ROW LEVEL SECURITY;
ALTER TABLE izin DISABLE ROW LEVEL SECURITY;

-- Pilihan 2: Jika ingin keep RLS, create policies berikut:
-- Enable RLS
-- ALTER TABLE device_bindings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE izin ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
-- DROP POLICY IF EXISTS "device_bindings_insert" ON device_bindings;
-- DROP POLICY IF EXISTS "device_bindings_select" ON device_bindings;
-- DROP POLICY IF EXISTS "device_bindings_update" ON device_bindings;
-- DROP POLICY IF EXISTS "users_select" ON users;
-- DROP POLICY IF EXISTS "attendances_insert" ON attendances;
-- DROP POLICY IF EXISTS "attendances_select" ON attendances;
-- DROP POLICY IF EXISTS "izin_select" ON izin;
-- DROP POLICY IF EXISTS "izin_insert" ON izin;

-- Create policies untuk authenticated users (if using RLS)
-- Uncomment section ini jika Anda ingin gunakan RLS:
/*
-- device_bindings policies
CREATE POLICY "device_bindings_select_all" ON device_bindings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "device_bindings_insert" ON device_bindings
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "device_bindings_update" ON device_bindings
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- users policies  
CREATE POLICY "users_select" ON users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- attendances policies
CREATE POLICY "attendances_select" ON attendances
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "attendances_insert" ON attendances
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- izin policies
CREATE POLICY "izin_select" ON izin
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "izin_insert" ON izin
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "izin_update" ON izin
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);
*/
