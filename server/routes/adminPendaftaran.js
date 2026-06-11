/*
 * ============================================================================
 * ROUTES: ADMIN PENDAFTARAN
 * ============================================================================
 * File ini berisi endpoint untuk admin pendaftaran (login & manajemen pendaftar).
 *
 * ENDPOINT:
 * - POST   /api/admin-pendaftaran/login        Login admin (return JWT)
 * - GET    /api/admin-pendaftaran/me           Info admin yang sedang login
 * - GET    /api/admin-pendaftaran/pendaftar    List semua pendaftar
 * - GET    /api/admin-pendaftaran/stats        Statistik (jumlah pendaftar, dll)
 * - POST   /api/admin-pendaftaran/assign       Assign pendaftar ke divisi
 * - DELETE /api/admin-pendaftaran/pendaftar/:id Hapus pendaftar
 * - GET    /api/admin-pendaftaran/files/:id    Lihat daftar file pendaftar
 *
 * LOGIKA BISNIS:
 * - 30 pendaftar paling awal (urutan 1-30) = PRIORITAS
 * - Maksimal 6 pendaftar per divisi setelah di-assign
 * - Admin bisa memindahkan pendaftar ke divisi yang sesuai
 * ============================================================================
 */

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "../config/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const JWT_SECRET = () =>
  process.env.JWT_SECRET ||
  process.env.JWT_SECRET_ADMIN_PENDAFTARAN ||
  "your-super-secret-jwt-key-min-32-characters-long-here";

const DIVISI_OPTIONS = [
  "networking",
  "software_engineer",
  "multimedia",
  "ai",
  "data_analyst",
];

const MAX_PER_DIVISI = 6;
const PRIORITY_LIMIT = 30;

// Middleware: verifikasi token admin pendaftaran
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

/*
 * ENDPOINT: POST /api/admin-pendaftaran/login
 * Body: { username, password }
 * Response: { success, token, admin: { id, username, nama } }
 */
router.post("/admin-pendaftaran/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`[admin-pendaftaran/login] attempt username=${username}`);
    if (!username || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Username dan password wajib diisi" });
    }

    const { data: admin, error } = await supabase
      .from("admin_pendaftaran")
      .select("*")
      .eq("username", username)
      .single();

    if (error) {
      console.error("[admin-pendaftaran/login] supabase error:", error);
    }
    if (error || !admin) {
      console.log(`[admin-pendaftaran/login] admin not found: ${username}`);
      return res
        .status(401)
        .json({ success: false, message: "Username atau password salah" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    console.log(
      `[admin-pendaftaran/login] user=${username} match=${passwordMatch} hashPrefix=${(admin.password || "").slice(0, 7)}`,
    );
    if (!passwordMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Username atau password salah" });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        nama: admin.nama,
        type: "admin_pendaftaran",
      },
      JWT_SECRET(),
      { expiresIn: "7d" },
    );

    return res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        nama: admin.nama,
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/admin-pendaftaran/me
 * Return info admin yang sedang login (cek token valid)
 */
router.get("/admin-pendaftaran/me", verifyAdminPendaftaran, (req, res) => {
  return res.json({
    success: true,
    admin: {
      id: req.admin.id,
      username: req.admin.username,
      nama: req.admin.nama,
    },
  });
});

/*
 * ENDPOINT: GET /api/admin-pendaftaran/stats
 * Statistik jumlah pendaftar
 */
router.get("/admin-pendaftaran/stats", verifyAdminPendaftaran, async (req, res) => {
  try {
    const { data: all } = await supabase
      .from("pendaftar")
      .select("id, urutan, status, divisi_assigned");

    const total = all?.length || 0;
    const priority = all?.filter((p) => p.urutan <= PRIORITY_LIMIT).length || 0;
    const outside = total - priority;
    const assigned = all?.filter((p) => p.divisi_assigned).length || 0;
    const unassigned = total - assigned;

    // Count per divisi
    const perDivisi = DIVISI_OPTIONS.reduce((acc, d) => {
      acc[d] = all?.filter((p) => p.divisi_assigned === d).length || 0;
      return acc;
    }, {});

    return res.json({
      success: true,
      stats: {
        total,
        priority,
        outside,
        assigned,
        unassigned,
        perDivisi,
        maxPerDivisi: MAX_PER_DIVISI,
        priorityLimit: PRIORITY_LIMIT,
      },
    });
  } catch (err) {
    console.error("Stats error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/admin-pendaftaran/pendaftar
 * Query params:
 *   - category: 'priority' | 'outside' | 'all' (default 'all')
 *   - divisi: filter by divisi_assigned
 *   - status: filter by status
 * Response: list pendaftar sorted by urutan ASC
 */
router.get("/admin-pendaftaran/pendaftar", verifyAdminPendaftaran, async (req, res) => {
  try {
    const { category, divisi, status } = req.query;

    let query = supabase
      .from("pendaftar")
      .select("*")
      .order("urutan", { ascending: true });

    if (category === "priority") {
      query = query.lte("urutan", PRIORITY_LIMIT);
    } else if (category === "outside") {
      query = query.gt("urutan", PRIORITY_LIMIT);
    }

    if (divisi && divisi !== "all") {
      query = query.eq("divisi_assigned", divisi);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Fetch pendaftar error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (err) {
    console.error("Fetch pendaftar error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: POST /api/admin-pendaftaran/assign
 * Body: { pendaftar_id, divisi_assigned }
 * Assign pendaftar ke divisi tertentu, dengan validasi max 6 per divisi.
 */
router.post("/admin-pendaftaran/assign", verifyAdminPendaftaran, async (req, res) => {
  try {
    const { pendaftar_id, divisi_assigned } = req.body;

    if (!pendaftar_id || !divisi_assigned) {
      return res
        .status(400)
        .json({ success: false, message: "pendaftar_id dan divisi_assigned wajib diisi" });
    }

    if (!DIVISI_OPTIONS.includes(divisi_assigned)) {
      return res.status(400).json({
        success: false,
        message: `Divisi tidak valid. Pilihan: ${DIVISI_OPTIONS.join(", ")}`,
      });
    }

    // Cek pendaftar ada
    const { data: existing, error: fetchError } = await supabase
      .from("pendaftar")
      .select("*")
      .eq("id", pendaftar_id)
      .single();

    if (fetchError || !existing) {
      return res
        .status(404)
        .json({ success: false, message: "Pendaftar tidak ditemukan" });
    }

    // Hitung jumlah di divisi tujuan
    const { count: currentCount } = await supabase
      .from("pendaftar")
      .select("*", { count: "exact", head: true })
      .eq("divisi_assigned", divisi_assigned)
      .neq("id", pendaftar_id);

    if ((currentCount || 0) >= MAX_PER_DIVISI) {
      return res.status(400).json({
        success: false,
        message: `Divisi ${divisi_assigned} sudah penuh (maksimal ${MAX_PER_DIVISI} peserta)`,
      });
    }

    const { data, error } = await supabase
      .from("pendaftar")
      .update({
        divisi_assigned,
        status: "assigned",
        assigned_at: new Date().toISOString(),
        assigned_by: req.admin.username,
      })
      .eq("id", pendaftar_id)
      .select()
      .single();

    if (error) {
      console.error("Assign error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: `Pendaftar ${data.nama} berhasil di-assign ke divisi ${divisi_assigned}`,
      data,
    });
  } catch (err) {
    console.error("Assign error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: DELETE /api/admin-pendaftaran/pendaftar/:id
 * Hapus pendaftar + file terkait
 */
router.delete("/admin-pendaftaran/pendaftar/:id", verifyAdminPendaftaran, async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.id, 10);
    if (isNaN(pendaftarId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    // Ambil data pendaftar untuk hapus file
    const { data: pendaftar } = await supabase
      .from("pendaftar")
      .select("id, nama")
      .eq("id", pendaftarId)
      .single();

    if (!pendaftar) {
      return res
        .status(404)
        .json({ success: false, message: "Pendaftar tidak ditemukan" });
    }

    // Ambil daftar file
    const { data: files } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId);

    // Hapus file di disk
    if (files) {
      for (const f of files) {
        const filePath = path.join(uploadDir, f.filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.error("Gagal hapus file:", filePath, e.message);
        }
      }
    }

    // Hapus data pendaftar (ON DELETE CASCADE akan hapus pendaftar_files)
    const { error } = await supabase
      .from("pendaftar")
      .delete()
      .eq("id", pendaftarId);

    if (error) {
      console.error("Delete pendaftar error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: `Pendaftar ${pendaftar.nama} berhasil dihapus`,
    });
  } catch (err) {
    console.error("Delete pendaftar error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/admin-pendaftaran/files/:pendaftarId
 * Ambil daftar file (metadata) milik pendaftar
 */
router.get("/admin-pendaftaran/files/:pendaftarId", verifyAdminPendaftaran, async (req, res) => {
  try {
    const pendaftarId = parseInt(req.params.pendaftarId, 10);
    if (isNaN(pendaftarId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data, error } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("pendaftar_id", pendaftarId)
      .order("tipe", { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error("Fetch files error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/admin-pendaftaran/file/:fileId/download
 * Download file PDF (CV, transkrip, atau surat)
 */
router.get("/admin-pendaftaran/file/:fileId/download", verifyAdminPendaftaran, async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data: file, error } = await supabase
      .from("pendaftar_files")
      .select("*")
      .eq("id", fileId)
      .single();

    if (error || !file) {
      return res.status(404).json({ success: false, message: "File tidak ditemukan" });
    }

    const filePath = path.join(uploadDir, file.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File fisik tidak ditemukan di server" });
    }

    res.download(filePath, file.original_name);
  } catch (err) {
    console.error("Download file error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

const uploadDir = path.join(__dirname, "..", "uploads", "pendaftaran");

export default router;
