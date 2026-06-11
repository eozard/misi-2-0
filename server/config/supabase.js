/*
 * ============================================================================
 * KONFIGURASI SUPABASE CLIENT
 * ============================================================================
 * File ini berfungsi untuk menginisialisasi koneksi ke database Supabase.
 * Supabase adalah platform Backend-as-a-Service (BaaS) yang menyediakan:
 * - PostgreSQL database dengan REST API
 * - Row Level Security (RLS) untuk keamanan data
 * - Realtime subscriptions
 * - Authentication built-in
 *
 * Di sistem ini, kami menggunakan Supabase untuk:
 * 1. Menyimpan data user (tabel: users)
 * 2. Menyimpan data absensi (tabel: absensi)
 * 3. Menyimpan data izin (tabel: izin)
 * 4. Menyimpan binding device (tabel: device_bindings)
 *a
 * CARA KERJA:
 * 1. Load file .env untuk mendapatkan credentials Supabase
 * 2. Pilih service role key jika tersedia (untuk operasi admin)
 * 3. Buat client Supabase yang bisa digunakan di seluruh aplikasi
 * ============================================================================
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Mendapatkan path file saat ini (karena pakai ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path ke file .env di root project dan di folder server
const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");
const localEnvPath = path.resolve(__dirname, "..", ".env");

// Load .env dari root project terlebih dahulu
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

// Load .env dari folder server (jika ada) tanpa override variabel yang sudah ada
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath, override: false });
}

// Ambil credentials dari environment variables
const supabaseUrl = process.env.SUPABASE_URL; // URL project Supabase
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Public key (limited access)
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY; // Admin key (full access)

// Validasi: pastikan minimal ada URL dan salah satu key
if (!supabaseUrl || (!supabaseAnonKey && !supabaseServiceKey)) {
  throw new Error(
    "SUPABASE_URL dan SUPABASE_ANON_KEY atau SUPABASE_SERVICE_ROLE_KEY harus didefinisikan di .env",
  );
}

// Prioritaskan service key untuk operasi backend (bypass RLS jika diperlukan)
// Service key memberikan akses penuh tanpa RLS policy
// Anon key hanya untuk public access dengan RLS aktif
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

// Buat instance Supabase client yang akan digunakan di seluruh backend
// Client ini sudah ter-configure dengan URL dan key yang tepat
export const supabase = createClient(supabaseUrl, supabaseKey);
