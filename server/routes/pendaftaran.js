/*
 * ============================================================================
 * ROUTES: PENDAFTARAN (PUBLIK)
 * ============================================================================
 * File ini berisi endpoint untuk pendaftaran pendaftar baru.
 *
 * ENDPOINT:
 * - POST /api/pendaftaran
 *   Upload data pendaftar + 3 file PDF (CV, transkrip, surat persetujuan).
 *   Tidak butuh autentikasi (publik, siapa saja bisa daftar).
 *
 * CARA KERJA:
 * 1. Terima multipart/form-data: nama, nim, email, divisi_pilihan, cv, transkrip, surat
 * 2. Validasi field & tipe file (harus PDF)
 * 3. Hitung urutan pendaftaran (auto increment)
 * 4. Tentukan status:
 *    - urutan 1-30  → 'priority'
 *    - urutan > 30  → 'pending' (tetap masuk, tapi di luar list prioritas)
 * 5. Simpan data pendaftar ke tabel pendaftar
 * 6. Simpan file PDF ke folder server/uploads/pendaftaran/
 * 7. Simpan metadata file ke tabel pendaftar_files
 * 8. Return response ke client
 * ============================================================================
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { supabase } from "../config/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Folder tujuan upload
const uploadDir = path.join(__dirname, "..", "uploads", "pendaftaran");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Format: <timestamp>_<random>_<tipe>_<namaAsli>
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}_${random}_${file.fieldname}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10 MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("File harus berformat PDF"), false);
    }
  },
});

const DIVISI_OPTIONS = [
  "networking",
  "software_engineer",
  "multimedia",
  "ai",
  "data_analyst",
];

/*
 * ENDPOINT: POST /api/pendaftaran
 * Body (multipart/form-data):
 *   - nama          (string, required)
 *   - nim           (string, required)
 *   - email         (string, required, valid email)
 *   - divisi_pilihan(string, required, salah satu dari DIVISI_OPTIONS)
 *   - cv            (file PDF, required)
 *   - transkrip     (file PDF, required)
 *   - surat         (file PDF, required)
 */
router.post("/pendaftaran", upload.fields([
  { name: "cv", maxCount: 1 },
  { name: "transkrip", maxCount: 1 },
  { name: "surat", maxCount: 1 },
]), async (req, res) => {
  try {
    const { nama, nim, email, divisi_pilihan } = req.body;
    const files = req.files || {};

    // Validasi field wajib
    if (!nama || !nim || !email || !divisi_pilihan) {
      return res.status(400).json({
        success: false,
        message: "Nama, NIM, email, dan divisi pilihan wajib diisi",
      });
    }

    // Validasi divisi
    if (!DIVISI_OPTIONS.includes(divisi_pilihan)) {
      return res.status(400).json({
        success: false,
        message: `Divisi tidak valid. Pilihan: ${DIVISI_OPTIONS.join(", ")}`,
      });
    }

    // Validasi format email sederhana
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Format email tidak valid",
      });
    }

    // Validasi semua file harus ada
    if (!files.cv || !files.transkrip || !files.surat) {
      // Hapus file yang terlanjur terupload
      Object.values(files).forEach((arr) => {
        arr.forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (_) {}
        });
      });
      return res.status(400).json({
        success: false,
        message: "File CV, transkrip, dan surat persetujuan wajib diupload",
      });
    }

    // Cek duplikat NIM atau email
    const { data: existing } = await supabase
      .from("pendaftar")
      .select("id, nim, email")
      .or(`nim.eq.${nim},email.eq.${email}`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Hapus file yang terlanjur terupload
      Object.values(files).forEach((arr) => {
        arr.forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (_) {}
        });
      });
      return res.status(409).json({
        success: false,
        message: "NIM atau email sudah pernah digunakan untuk pendaftaran",
      });
    }

    // Hitung urutan pendaftaran (jumlah pendaftar + 1)
    const { count } = await supabase
      .from("pendaftar")
      .select("*", { count: "exact", head: true });
    const urutan = (count || 0) + 1;

    // Tentukan status berdasarkan urutan
    // 1-30 = priority, >30 = pending
    const status = urutan <= 30 ? "priority" : "pending";

    // Insert data pendaftar
    const { data: pendaftar, error: insertError } = await supabase
      .from("pendaftar")
      .insert([
        {
          nama,
          nim,
          email,
          divisi_pilihan,
          urutan,
          status,
        },
      ])
      .select()
      .single();

    if (insertError) {
      // Hapus file yang terlanjur terupload
      Object.values(files).forEach((arr) => {
        arr.forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (_) {}
        });
      });
      console.error("Insert pendaftar error:", insertError);
      return res.status(500).json({
        success: false,
        message: "Gagal menyimpan data pendaftar: " + insertError.message,
      });
    }

    // Insert metadata file
    const fileRows = [
      {
        pendaftar_id: pendaftar.id,
        tipe: "cv",
        filename: files.cv[0].filename,
        original_name: files.cv[0].originalname,
        file_size: files.cv[0].size,
        mime_type: files.cv[0].mimetype,
      },
      {
        pendaftar_id: pendaftar.id,
        tipe: "transkrip",
        filename: files.transkrip[0].filename,
        original_name: files.transkrip[0].originalname,
        file_size: files.transkrip[0].size,
        mime_type: files.transkrip[0].mimetype,
      },
      {
        pendaftar_id: pendaftar.id,
        tipe: "surat",
        filename: files.surat[0].filename,
        original_name: files.surat[0].originalname,
        file_size: files.surat[0].size,
        mime_type: files.surat[0].mimetype,
      },
    ];

    const { error: filesError } = await supabase
      .from("pendaftar_files")
      .insert(fileRows);

    if (filesError) {
      console.error("Insert files error:", filesError);
      // Data pendaftar sudah masuk, file sudah tersimpan di disk.
      // Tetap lanjut, tapi log error.
    }

    return res.status(201).json({
      success: true,
      message: "Pendaftaran berhasil dikirim",
      data: {
        id: pendaftar.id,
        nama: pendaftar.nama,
        nim: pendaftar.nim,
        email: pendaftar.email,
        divisi_pilihan: pendaftar.divisi_pilihan,
        urutan: pendaftar.urutan,
        status: pendaftar.status,
      },
    });
  } catch (err) {
    console.error("Pendaftaran error:", err);
    // Cleanup file jika ada
    if (req.files) {
      Object.values(req.files).forEach((arr) => {
        arr.forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (_) {}
        });
      });
    }
    return res.status(500).json({
      success: false,
      message: err.message || "Terjadi kesalahan server",
    });
  }
});

export default router;
