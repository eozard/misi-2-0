/*
 * ============================================================================
 * ROUTES: PENDAFTARAN (PUBLIK + ADMIN)
 * ============================================================================
 * File PDF pendaftar disimpan di Supabase Storage (bukan disk lokal) supaya
 * file tetap tersedia setelah restart/deploy Railway.
 *
 * SETUP SEBELUM PAKAI:
 * 1. Buka Supabase → Storage → Create bucket "pendaftaran" (Public: ON)
 *    Atau via SQL:
 *      INSERT INTO storage.buckets (id, name, public)
 *      VALUES ('pendaftaran', 'pendaftaran', true)
 *      ON CONFLICT (id) DO NOTHING;
 *
 * ENDPOINT:
 * - POST   /api/pendaftaran                  Submit pendaftar + 3 file PDF
 * - GET    /api/pendaftaran                  List pendaftar (admin)
 * - PUT    /api/pendaftaran/:id              Update assigned_divisi (admin)
 * - DELETE /api/pendaftaran/:id              Hapus pendaftar + file (admin)
 * - GET    /api/pendaftaran/file/:id/:type   Proxy file PDF (untuk inline preview)
 * - GET    /api/pendaftaran/file-url/:id/:type Direct public URL
 *
 * FIELD FORM:
 * - nama, nim, divisi, email
 * - cv (file PDF)
 * - transkrip (file PDF)
 * - surat_persetujuan (file PDF)
 * ============================================================================
 */

import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import fs from "fs";
import { supabase } from "../config/supabase.js";
import {
  uploadFile,
  deleteFile,
  getPublicUrl,
  BUCKET_NAME,
} from "../config/storage.js";

const router = express.Router();

const DIVISI_OPTIONS = [
  "Networking",
  "Software Engineer",
  "Multimedia",
  "Artificial Intelligence",
  "Data Analyst",
];

const JWT_SECRET = () =>
  process.env.JWT_SECRET ||
  process.env.JWT_SECRET_ADMIN_PENDAFTARAN ||
  "your-super-secret-jwt-key-min-32-characters-long-here";

const verifyAdminPendaftaran = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "Token tidak ditemukan" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET());
    if (decoded.type !== "admin_pendaftaran") {
      return res
        .status(403)
        .json({ success: false, message: "Token bukan admin pendaftaran" });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: "Token tidak valid" });
  }
};

// Pakai memory storage supaya bisa dapat buffer untuk upload ke Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("File harus berformat PDF"), false);
    }
  },
});

/**
 * Bangun object pendaftar dengan URL Supabase Storage.
 */
const buildPendaftarResponse = (p, files = []) => {
  const findFile = (tipe) => files.find((f) => f.tipe === tipe);

  const cv = findFile("cv");
  const transkrip = findFile("transkrip");
  const surat = findFile("surat");

  return {
    id: p.id,
    nama: p.nama,
    nim: p.nim,
    email: p.email,
    divisi: p.divisi_pilihan,
    assigned_divisi: p.divisi_assigned || null,
    assigned_by: p.assigned_by || null,
    assigned_at: p.assigned_at || null,
    urutan: p.urutan,
    status: p.status,
    created_at: p.created_at,
    cv_url: cv ? getPublicUrl(cv.storage_path) : null,
    transkrip_url: transkrip ? getPublicUrl(transkrip.storage_path) : null,
    surat_persetujuan_url: surat ? getPublicUrl(surat.storage_path) : null,
  };
};

/*
 * ENDPOINT: POST /api/pendaftaran
 * Public: form submit pendaftaran
 */
router.post(
  "/pendaftaran",
  upload.fields([
    { name: "cv", maxCount: 1 },
    { name: "transkrip", maxCount: 1 },
    { name: "surat_persetujuan", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { nama, nim, divisi, email } = req.body;
      const files = req.files || {};

      if (!nama || !nim || !divisi || !email) {
        return res.status(400).json({
          success: false,
          message: "Nama, NIM, divisi, dan email wajib diisi",
        });
      }

      if (!DIVISI_OPTIONS.includes(divisi)) {
        return res.status(400).json({
          success: false,
          message: `Divisi tidak valid. Pilihan: ${DIVISI_OPTIONS.join(", ")}`,
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Format email tidak valid",
        });
      }

      if (!files.cv || !files.transkrip || !files.surat_persetujuan) {
        return res.status(400).json({
          success: false,
          message: "File CV, transkrip, dan surat persetujuan wajib diupload",
        });
      }

      // Cek duplikat
      const { data: existing } = await supabase
        .from("pendaftar")
        .select("id, nim, email")
        .or(`nim.eq.${nim},email.eq.${email}`)
        .limit(1);

      if (existing && existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: "NIM atau email sudah pernah digunakan untuk pendaftaran",
        });
      }

      // Hitung urutan
      const { count } = await supabase
        .from("pendaftar")
        .select("*", { count: "exact", head: true });
      const urutan = (count || 0) + 1;
      const status = urutan <= 30 ? "priority" : "pending";

      // Insert pendaftar dulu (untuk dapat ID)
      const { data: pendaftar, error: insertError } = await supabase
        .from("pendaftar")
        .insert([
          {
            nama,
            nim,
            email,
            divisi_pilihan: divisi,
            urutan,
            status,
          },
        ])
        .select()
        .single();

      if (insertError) {
        console.error("Insert pendaftar error:", insertError);
        return res.status(500).json({
          success: false,
          message: "Gagal menyimpan data pendaftar: " + insertError.message,
        });
      }

      // Upload 3 file ke Supabase Storage
      const fileRows = [];
      const uploadTasks = [
        { tipe: "cv", field: "cv", original: files.cv[0].originalname, size: files.cv[0].size },
        { tipe: "transkrip", field: "transkrip", original: files.transkrip[0].originalname, size: files.transkrip[0].size },
        { tipe: "surat", field: "surat_persetujuan", original: files.surat_persetujuan[0].originalname, size: files.surat_persetujuan[0].size },
      ];

      const safeName = (s) => s.replace(/[^a-zA-Z0-9._-]/g, "_");

      for (const task of uploadTasks) {
        const fileObj = files[task.field][0];
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const storagePath = `${pendaftar.id}/${task.tipe}_${timestamp}_${random}_${safeName(task.original)}`;

        const result = await uploadFile(
          storagePath,
          fileObj.buffer,
          fileObj.mimetype,
        );
        if (!result.ok) {
          console.error(`Upload ${task.tipe} gagal:`, result.error);
          // Lanjut terus, tapi catat error
        }

        fileRows.push({
          pendaftar_id: pendaftar.id,
          tipe: task.tipe,
          filename: storagePath,
          original_name: task.original,
          file_size: task.size,
          mime_type: fileObj.mimetype,
          storage_path: storagePath,
        });
      }

      // Insert metadata file
      const { data: fileRowsData, error: filesError } = await supabase
        .from("pendaftar_files")
        .insert(fileRows)
        .select();

      if (filesError) {
        console.error("Insert files metadata error:", filesError);
        // Tidak rollback pendaftar supaya admin tidak bingung,
        // tapi log agar bisa dimonitor
      }

      return res.status(201).json({
        success: true,
        message: "Pendaftaran berhasil dikirim",
        data: buildPendaftarResponse(pendaftar, fileRowsData || fileRows),
      });
    } catch (err) {
      console.error("Pendaftaran error:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Terjadi kesalahan server",
      });
    }
  },
);

/*
 * ENDPOINT: GET /api/pendaftaran
 * Admin: list semua pendaftar
 */
router.get("/pendaftaran", verifyAdminPendaftaran, async (req, res) => {
  try {
    const { data: pendaftarRows, error } = await supabase
      .from("pendaftar")
      .select("*")
      .order("urutan", { ascending: true });

    if (error) {
      console.error("Fetch pendaftar error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (!pendaftarRows || pendaftarRows.length === 0) {
      return res.json({ success: true, data: [], total: 0 });
    }

    const ids = pendaftarRows.map((p) => p.id);
    const { data: files } = await supabase
      .from("pendaftar_files")
      .select("*")
      .in("pendaftar_id", ids);

    const filesByPendaftar = (files || []).reduce((acc, f) => {
      if (!acc[f.pendaftar_id]) acc[f.pendaftar_id] = [];
      acc[f.pendaftar_id].push(f);
      return acc;
    }, {});

    const data = pendaftarRows.map((p) =>
      buildPendaftarResponse(p, filesByPendaftar[p.id] || []),
    );

    return res.json({ success: true, data, total: data.length });
  } catch (err) {
    console.error("Fetch pendaftar error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: PUT /api/pendaftaran/:id
 * Admin: update assigned_divisi
 */
router.put("/pendaftaran/:id", verifyAdminPendaftaran, async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.id, 10);
    if (isNaN(pendaftarId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { assigned_divisi, admin_nama } = req.body;
    if (!assigned_divisi) {
      return res
        .status(400)
        .json({ success: false, message: "assigned_divisi wajib diisi" });
    }
    if (!DIVISI_OPTIONS.includes(assigned_divisi)) {
      return res.status(400).json({
        success: false,
        message: `Divisi tidak valid. Pilihan: ${DIVISI_OPTIONS.join(", ")}`,
      });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("pendaftar")
      .select("*")
      .eq("id", pendaftarId)
      .single();

    if (fetchError || !existing) {
      return res
        .status(404)
        .json({ success: false, message: "Pendaftar tidak ditemukan" });
    }

    const MAX_PER_DIVISI = 6;
    const movingToSame = existing.divisi_assigned === assigned_divisi;
    if (!movingToSame) {
      const { count } = await supabase
        .from("pendaftar")
        .select("*", { count: "exact", head: true })
        .eq("divisi_assigned", assigned_divisi)
        .neq("id", pendaftarId);

      if ((count || 0) >= MAX_PER_DIVISI) {
        return res.status(400).json({
          success: false,
          message: `Divisi ${assigned_divisi} sudah penuh (maksimal ${MAX_PER_DIVISI} peserta)`,
        });
      }
    }

    const { data, error } = await supabase
      .from("pendaftar")
      .update({
        divisi_assigned: assigned_divisi,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        assigned_by: admin_nama || req.admin.username,
      })
      .eq("id", pendaftarId)
      .select()
      .single();

    if (error) {
      console.error("Update error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: DELETE /api/pendaftaran/:id
 * Admin: hapus pendaftar + file di Supabase Storage
 */
router.delete("/pendaftaran/:id", verifyAdminPendaftaran, async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.id, 10);
    if (isNaN(pendaftarId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    // Ambil file
    const { data: files } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId);

    // Hapus file di Supabase Storage
    if (files && files.length > 0) {
      const paths = files.map((f) => f.storage_path).filter(Boolean);
      if (paths.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(paths);
        if (storageErr) {
          console.error("Storage delete error:", storageErr);
        }
      }
    }

    // Hapus pendaftar (ON DELETE CASCADE hapus pendaftar_files)
    const { error } = await supabase
      .from("pendaftar")
      .delete()
      .eq("id", pendaftarId);

    if (error) {
      console.error("Delete error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, message: "Pendaftar berhasil dihapus" });
  } catch (err) {
    console.error("Delete error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/pendaftaran/file/:id/:type
 * Proxy file PDF dari Supabase Storage (untuk inline preview).
 * type: 'cv' | 'transkrip' | 'surat_persetujuan'
 */
router.get("/pendaftaran/file/:id/:type", async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.id, 10);
    const { type } = req.params;

    const tipeMap = {
      cv: "cv",
      transkrip: "transkrip",
      surat_persetujuan: "surat",
    };
    const dbTipe = tipeMap[type];
    if (!dbTipe) {
      return res
        .status(400)
        .json({ success: false, message: "Tipe file tidak valid" });
    }

    const { data: file, error } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId)
      .eq("tipe", dbTipe)
      .single();

    if (error || !file) {
      return res
        .status(404)
        .json({ success: false, message: "File metadata tidak ditemukan di database" });
    }

    if (!file.storage_path) {
      return res.status(404).json({
        success: false,
        message: "File belum ada di storage (data lama, harus daftar ulang)",
      });
    }

    // Download dari Supabase Storage, stream ke client
    const { data: blob, error: dlErr } = await supabase.storage
      .from(BUCKET_NAME)
      .download(file.storage_path);

    if (dlErr || !blob) {
      console.error("Storage download error:", dlErr);
      return res.status(404).json({
        success: false,
        message: "File tidak ada di storage: " + (dlErr?.message || "unknown"),
      });
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${file.original_name}"`,
    );
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(buffer);
  } catch (err) {
    console.error("Serve file error:", err);
    return res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

/*
 * ENDPOINT: GET /api/pendaftaran/file-url/:id/:type
 * Return direct public URL (untuk debugging)
 */
router.get("/pendaftaran/file-url/:id/:type", async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.id, 10);
    const { type } = req.params;

    const tipeMap = { cv: "cv", transkrip: "transkrip", surat_persetujuan: "surat" };
    const dbTipe = tipeMap[type];
    if (!dbTipe) {
      return res.status(400).json({ success: false, message: "Tipe file tidak valid" });
    }

    const { data: file } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId)
      .eq("tipe", dbTipe)
      .single();

    if (!file) {
      return res.status(404).json({ success: false, message: "File tidak ditemukan" });
    }

    const { getPublicUrl } = await import("../config/storage.js");
    const publicUrl = file.storage_path ? getPublicUrl(file.storage_path) : null;

    return res.json({
      success: true,
      data: {
        id: file.id,
        tipe: file.tipe,
        original_name: file.original_name,
        storage_path: file.storage_path,
        public_url: publicUrl,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
