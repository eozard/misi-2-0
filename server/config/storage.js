/*
 * ============================================================================
 * STORAGE HELPER - SUPABASE STORAGE
 * ============================================================================
 * Wrapper untuk upload/download/hapus file di Supabase Storage.
 *
 * CARA SETUP:
 * 1. Buka Supabase Dashboard → Storage
 * 2. Create bucket baru dengan nama 'pendaftaran-files' (atau sesuai setting)
 * 3. Set Public: ON (supaya PDF bisa langsung di-preview)
 * 4. Buat folder di dalam bucket: cv, transkrip, surat_persetujuan (opsional)
 *    ATAU biarkan kosong, kode akan otomatis bikin sub-folder
 *
 * ENV VARIABLE (opsional):
 *   PENDAFTARAN_BUCKET  (default: 'pendaftaran-files')
 * ============================================================================
 */

import { supabase } from "../config/supabase.js";

const BUCKET = process.env.PENDAFTARAN_BUCKET || "pendaftaran-files";

/**
 * Upload file ke Supabase Storage.
 * @param {string} path  Path di dalam bucket, contoh: "1/cv_1700000000_abc.pdf"
 * @param {Buffer} buffer Isi file
 * @param {string} mimetype
 * @returns {Promise<{ok: boolean, error?: any}>}
 */
export const uploadFile = async (path, buffer, mimetype = "application/pdf") => {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimetype,
      upsert: true,
    });

  if (error) {
    console.error("Supabase storage upload error:", error);
    return { ok: false, error };
  }
  return { ok: true };
};

/**
 * Hapus file dari Supabase Storage.
 * @param {string} path
 */
export const deleteFile = async (path) => {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    console.error("Supabase storage delete error:", error);
    return { ok: false, error };
  }
  return { ok: true };
};

/**
 * Ambil public URL untuk file di Supabase Storage.
 * Return URL absolut yang siap dipakai <iframe src=...> atau <a href=...>.
 */
export const getPublicUrl = (path) => {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
};

export const BUCKET_NAME = BUCKET;
