/*
 * ============================================================================
 * ROUTES: PENDAFTARAN (PUBLIK)
 * ============================================================================
 * Endpoint untuk pendaftar baru + admin kelola pendaftar.
 *
 * PUBLIC ENDPOINTS:
 * - POST /api/pendaftaran                  Submit pendaftar + 3 file PDF
 *
 * ADMIN ENDPOINTS (perlu token admin_pendaftaran):
 * - GET    /api/pendaftaran                List semua pendaftar
 * - PUT    /api/pendaftaran/:id            Update assigned_divisi
 * - DELETE /api/pendaftaran/:id            Hapus pendaftar + file
 * - GET    /api/pendaftaran/file/:id/:type Serve file PDF (cv|transkrip|surat_persetujuan)
 *
 * FIELD NAMES (form data):
 * - nama, nim, divisi, email
 * - cv (file PDF)
 * - transkrip (file PDF)
 * - surat_persetujuan (file PDF)
 *
 * RESPONSE PADA TIAP PENDAFTAR:
 * {
 *   id, nama, nim, email, divisi, assigned_divisi, assigned_by,
 *   cv_url, transkrip_url, surat_persetujuan_url,  // URL untuk preview
 *   urutan, status, created_at
 * }
 * ============================================================================
 */

import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads", "pendaftaran");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${timestamp}_${random}_${file.fieldname}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("File harus berformat PDF"), false);
    }
  },
});

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

/**
 * Bangun object pendaftar dengan URL file yang siap dipakai frontend.
 */
const buildPendaftarResponse = (p, files = []) => {
  const baseUrl = process.env.PUBLIC_BASE_URL || "";
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
    cv_url: cv ? `${baseUrl}/api/pendaftaran/file/${p.id}/cv` : null,
    transkrip_url: transkrip
      ? `${baseUrl}/api/pendaftaran/file/${p.id}/transkrip`
      : null,
    surat_persetujuan_url: surat
      ? `${baseUrl}/api/pendaftaran/file/${p.id}/surat_persetujuan`
      : null,
  };
};

/*
 * ENDPOINT: POST /api/pendaftaran
 * Public: form submit pendaftaran baru
 */
router.post("/pendaftaran", upload.fields([
  { name: "cv", maxCount: 1 },
  { name: "transkrip", maxCount: 1 },
  { name: "surat_persetujuan", maxCount: 1 },
]), async (req, res) => {
  try {
    const { nama, nim, divisi, email } = req.body;
    const files = req.files || {};

    if (!nama || !nim || !divisi || !email) {
      cleanupFiles(files);
      return res.status(400).json({
        success: false,
        message: "Nama, NIM, divisi, dan email wajib diisi",
      });
    }

    if (!DIVISI_OPTIONS.includes(divisi)) {
      cleanupFiles(files);
      return res.status(400).json({
        success: false,
        message: `Divisi tidak valid. Pilihan: ${DIVISI_OPTIONS.join(", ")}`,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      cleanupFiles(files);
      return res.status(400).json({
        success: false,
        message: "Format email tidak valid",
      });
    }

    if (!files.cv || !files.transkrip || !files.surat_persetujuan) {
      cleanupFiles(files);
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
      cleanupFiles(files);
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

    // Insert pendaftar
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
      cleanupFiles(files);
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
        filename: files.surat_persetujuan[0].filename,
        original_name: files.surat_persetujuan[0].originalname,
        file_size: files.surat_persetujuan[0].size,
        mime_type: files.surat_persetujuan[0].mimetype,
      },
    ];

    const { data: fileRowsData, error: filesError } = await supabase
      .from("pendaftar_files")
      .insert(fileRows)
      .select();

    if (filesError) {
      console.error("Insert files error:", filesError);
    }

    return res.status(201).json({
      success: true,
      message: "Pendaftaran berhasil dikirim",
      data: buildPendaftarResponse(pendaftar, fileRowsData || []),
    });
  } catch (err) {
    console.error("Pendaftaran error:", err);
    cleanupFiles(req.files);
    return res.status(500).json({
      success: false,
      message: err.message || "Terjadi kesalahan server",
    });
  }
});

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
 * Body: { assigned_divisi, admin_nama }
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

    // Validasi max 6 per divisi
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
 * Admin: hapus pendaftar + file
 */
router.delete("/pendaftaran/:id", verifyAdminPendaftaran, async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.id, 10);
    if (isNaN(pendaftarId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data: files } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId);

    if (files) {
      for (const f of files) {
        const filePath = path.join(uploadDir, f.filename);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Gagal hapus file:", filePath, e.message);
        }
      }
    }

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
 * Serve file PDF inline untuk preview
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
      return res.status(400).json({ success: false, message: "Tipe file tidak valid" });
    }

    const { data: file, error } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId)
      .eq("tipe", dbTipe)
      .single();

    if (error || !file) {
      return res.status(404).json({ success: false, message: "File tidak ditemukan" });
    }

    const filePath = path.join(uploadDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ success: false, message: "File fisik tidak ditemukan di server" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${file.original_name}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error("Serve file error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

function cleanupFiles(files) {
  if (!files) return;
  Object.values(files).forEach((arr) => {
    if (Array.isArray(arr)) {
      arr.forEach((f) => {
        try {
          if (f.path) fs.unlinkSync(f.path);
        } catch (_) {}
      });
    }
  });
}

export default router;
