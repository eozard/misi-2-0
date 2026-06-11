/*
 * ============================================================================
 * ROUTES: ADMIN PENDAFTARAN
 * ============================================================================
 * Endpoint untuk autentikasi & manajemen akun admin_pendaftaran.
 *
 * ENDPOINT:
 * - POST /api/admin-pendaftaran/login        Login admin (return JWT)
 * - GET  /api/admin-pendaftaran/list         List admin (public, untuk cek)
 * - POST /api/admin-pendaftaran/seed         Seed admin default kalau belum ada
 * - POST /api/admin-pendaftaran/create       Buat admin baru (admin only)
 * - DELETE /api/admin-pendaftaran/:id       Hapus admin (admin only)
 *
 * JWT Token:
 * - Disimpan di localStorage dengan key 'admin_pendaftaran_token'
 * - User info di 'admin_pendaftaran_user'
 * ============================================================================
 */

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";

const router = express.Router();

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

/*
 * ENDPOINT: POST /api/admin-pendaftaran/login
 * Body: { username, password }
 */
router.post("/admin-pendaftaran/login", async (req, res) => {
  try {
    const { username, password } = req.body;
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

    if (error || !admin) {
      return res
        .status(401)
        .json({ success: false, message: "Username atau password salah" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
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
 * ENDPOINT: GET /api/admin-pendaftaran/list
 * Public: untuk cek jumlah admin (misal sebelum login)
 * Tidak return password
 */
router.get("/admin-pendaftaran/list", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admin_pendaftaran")
      .select("id, username, nama, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      data: data || [],
      total: (data || []).length,
    });
  } catch (err) {
    console.error("List admin error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: POST /api/admin-pendaftaran/seed
 * Public: bikin admin default kalau belum ada
 * Default: username=admin, password=admin123
 */
router.post("/admin-pendaftaran/seed", async (req, res) => {
  try {
    const { data: existing } = await supabase
      .from("admin_pendaftaran")
      .select("id")
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({
        success: true,
        seeded: false,
        message: "Admin sudah ada, tidak perlu seed",
      });
    }

    const defaultPassword = "admin123";
    const hash = await bcrypt.hash(defaultPassword, 10);

    const { data, error } = await supabase
      .from("admin_pendaftaran")
      .insert([
        {
          username: "admin",
          password: hash,
          nama: "Admin Pendaftaran",
        },
      ])
      .select("id, username, nama")
      .single();

    if (error) {
      console.error("Seed admin error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      seeded: true,
      data,
      message: `Admin default berhasil dibuat (username: admin, password: admin123)`,
    });
  } catch (err) {
    console.error("Seed admin error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: POST /api/admin-pendaftaran/create
 * Admin only: buat admin baru
 * Body: { username, password, nama }
 */
router.post(
  "/admin-pendaftaran/create",
  verifyAdminPendaftaran,
  async (req, res) => {
    try {
      const { username, password, nama } = req.body;
      if (!username || !password || !nama) {
        return res
          .status(400)
          .json({ success: false, message: "Semua field wajib diisi" });
      }
      if (password.length < 6) {
        return res
          .status(400)
          .json({ success: false, message: "Password minimal 6 karakter" });
      }

      // Cek username sudah dipakai
      const { data: existing } = await supabase
        .from("admin_pendaftaran")
        .select("id")
        .eq("username", username)
        .limit(1);

      if (existing && existing.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "Username sudah dipakai" });
      }

      const hash = await bcrypt.hash(password, 10);
      const { data, error } = await supabase
        .from("admin_pendaftaran")
        .insert([{ username, password: hash, nama }])
        .select("id, username, nama, created_at")
        .single();

      if (error) {
        return res
          .status(500)
          .json({ success: false, message: error.message });
      }

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Create admin error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Server error" });
    }
  },
);

/*
 * ENDPOINT: DELETE /api/admin-pendaftaran/:id
 * Admin only: hapus admin (tidak bisa hapus diri sendiri)
 */
router.delete(
  "/admin-pendaftaran/:id",
  verifyAdminPendaftaran,
  async (req, res) => {
    try {
      const targetId = parseInt(req.params.id, 10);
      if (isNaN(targetId)) {
        return res
          .status(400)
          .json({ success: false, message: "ID tidak valid" });
      }

      if (String(req.admin.id) === String(targetId)) {
        return res
          .status(400)
          .json({ success: false, message: "Tidak bisa menghapus akun sendiri" });
      }

      const { data, error } = await supabase
        .from("admin_pendaftaran")
        .delete()
        .eq("id", targetId)
        .select("id, username")
        .single();

      if (error) {
        return res
          .status(500)
          .json({ success: false, message: error.message });
      }

      return res.json({ success: true, data });
    } catch (err) {
      console.error("Delete admin error:", err);
      return res
        .status(500)
        .json({ success: false, message: "Server error" });
    }
  },
);

export default router;
