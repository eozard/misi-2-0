/*
 * ============================================================================
 * ROUTES: LOGBOOK
 * ============================================================================
 * Endpoint untuk logbook mahasiswa PKL.
 *
 * MAHASISWA ENDPOINTS (perlu token user biasa):
 * - GET    /api/logbook              List logbook milik sendiri
 * - GET    /api/logbook/today        Ambil/cek logbook hari ini (kalau ada)
 * - GET    /api/logbook/:id          Detail 1 logbook (milik sendiri)
 * - POST   /api/logbook              Create draft baru (1 per hari)
 * - PUT    /api/logbook/:id          Update draft (hanya kalau status draft)
 * - POST   /api/logbook/:id/submit   Submit logbook (status -> submitted, lock)
 * - DELETE /api/logbook/:id          Hapus draft sendiri
 *
 * ADMIN ENDPOINTS (perlu token admin):
 * - GET    /api/admin/logbook        List semua logbook, filter by nama/tanggal/status
 * - GET    /api/admin/logbook/:id    Detail 1 logbook (termasuk yang submitted)
 * - POST   /api/admin/logbook/:id/reset  Reset submitted -> draft (re-open edit)
 * - DELETE /api/admin/logbook/:id    Hapus logbook
 *
 * ATURAN BISNIS:
 * - 1 logbook per mahasiswa per hari (UNIQUE constraint)
 * - Hanya draft yang bisa diedit/dihapus oleh mahasiswa
 * - Setelah submit, logbook locked (admin yang bisa reset)
 * ============================================================================
 */

import express from "express";
import { supabase } from "../config/supabase.js";
import { verifyToken, isMahasiswa, isAdmin } from "../middleware/auth.js";

const router = express.Router();

const todayDate = () => {
  // YYYY-MM-DD in UTC+7 (WIB)
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
};

const formatLogbook = (row) => ({
  id: row.id,
  user_id: row.user_id,
  nama: row.nama,
  kelompok: row.kelompok,
  tanggal: row.tanggal,
  kegiatan: row.kegiatan,
  kendala: row.kendala,
  status: row.status,
  submitted_at: row.submitted_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/*
 * ENDPOINT: GET /api/logbook
 * List logbook milik user yang login, urut tanggal DESC
 * Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=draft|submitted
 */
router.get("/logbook", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    let query = supabase
      .from("logbook")
      .select("*")
      .eq("nama", req.user.nama)
      .order("tanggal", { ascending: false });

    if (from) query = query.gte("tanggal", from);
    if (to) query = query.lte("tanggal", to);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      console.error("Fetch logbook error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.json({
      success: true,
      data: (data || []).map(formatLogbook),
    });
  } catch (err) {
    console.error("Fetch logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/logbook/today
 * Ambil logbook hari ini (kalau ada), untuk auto-fill form
 */
router.get("/logbook/today", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const today = todayDate();
    const { data, error } = await supabase
      .from("logbook")
      .select("*")
      .eq("nama", req.user.nama)
      .eq("tanggal", today)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.json({
      success: true,
      data: data ? formatLogbook(data) : null,
      tanggal: today,
    });
  } catch (err) {
    console.error("Fetch today logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: GET /api/logbook/:id
 * Detail 1 logbook (mahasiswa hanya bisa akses milik sendiri)
 */
router.get("/logbook/:id", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data, error } = await supabase
      .from("logbook")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res
        .status(404)
        .json({ success: false, message: "Logbook tidak ditemukan" });
    }

    if (data.nama !== req.user.nama) {
      return res
        .status(403)
        .json({ success: false, message: "Anda tidak punya akses ke logbook ini" });
    }

    return res.json({ success: true, data: formatLogbook(data) });
  } catch (err) {
    console.error("Fetch logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: POST /api/logbook
 * Create draft logbook baru
 * Body: { tanggal, kegiatan, kendala? }
 * Default tanggal = hari ini kalau tidak dikirim
 */
router.post("/logbook", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const { tanggal, kegiatan, kendala } = req.body;

    if (!kegiatan || !kegiatan.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Kegiatan wajib diisi" });
    }

    const tanggalFinal = tanggal || todayDate();

    // Cek duplikat
    const { data: existing } = await supabase
      .from("logbook")
      .select("id, status")
      .eq("nama", req.user.nama)
      .eq("tanggal", tanggalFinal)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Sudah ada logbook untuk tanggal ${tanggalFinal} (status: ${existing.status})`,
        data: formatLogbook(existing),
      });
    }

    const { data, error } = await supabase
      .from("logbook")
      .insert([
        {
          user_id: req.user.id,
          nama: req.user.nama,
          kelompok: req.user.kelompok,
          tanggal: tanggalFinal,
          kegiatan: kegiatan.trim(),
          kendala: kendala ? kendala.trim() : null,
          status: "draft",
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Create logbook error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.status(201).json({
      success: true,
      message: "Logbook berhasil dibuat",
      data: formatLogbook(data),
    });
  } catch (err) {
    console.error("Create logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: PUT /api/logbook/:id
 * Update draft (hanya kalau status draft & milik sendiri)
 * Body: { kegiatan, kendala }
 */
router.put("/logbook/:id", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { kegiatan, kendala } = req.body;
    if (!kegiatan || !kegiatan.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Kegiatan wajib diisi" });
    }

    // Ambil existing
    const { data: existing, error: fetchError } = await supabase
      .from("logbook")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res
        .status(404)
        .json({ success: false, message: "Logbook tidak ditemukan" });
    }

    if (existing.nama !== req.user.nama) {
      return res
        .status(403)
        .json({ success: false, message: "Anda tidak punya akses ke logbook ini" });
    }

    if (existing.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Logbook yang sudah di-submit tidak bisa diedit",
      });
    }

    const { data, error } = await supabase
      .from("logbook")
      .update({
        kegiatan: kegiatan.trim(),
        kendala: kendala ? kendala.trim() : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update logbook error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: "Logbook berhasil diupdate",
      data: formatLogbook(data),
    });
  } catch (err) {
    console.error("Update logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: POST /api/logbook/:id/submit
 * Submit logbook (status -> submitted, lock)
 */
router.post("/logbook/:id/submit", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data: existing, error: fetchError } = await supabase
      .from("logbook")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return res
        .status(404)
        .json({ success: false, message: "Logbook tidak ditemukan" });
    }

    if (existing.nama !== req.user.nama) {
      return res
        .status(403)
        .json({ success: false, message: "Anda tidak punya akses ke logbook ini" });
    }

    if (existing.status === "submitted") {
      return res
        .status(400)
        .json({ success: false, message: "Logbook sudah submitted" });
    }

    const { data, error } = await supabase
      .from("logbook")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: "Logbook berhasil di-submit",
      data: formatLogbook(data),
    });
  } catch (err) {
    console.error("Submit logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * ENDPOINT: DELETE /api/logbook/:id
 * Hapus draft (milik sendiri, hanya kalau status draft)
 */
router.delete("/logbook/:id", verifyToken, isMahasiswa, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data: existing } = await supabase
      .from("logbook")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Logbook tidak ditemukan" });
    }

    if (existing.nama !== req.user.nama) {
      return res
        .status(403)
        .json({ success: false, message: "Anda tidak punya akses ke logbook ini" });
    }

    if (existing.status !== "draft") {
      return res
        .status(400)
        .json({ success: false, message: "Hanya draft yang bisa dihapus" });
    }

    const { error } = await supabase.from("logbook").delete().eq("id", id);
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, message: "Logbook berhasil dihapus" });
  } catch (err) {
    console.error("Delete logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ============================================================================
 * ADMIN ENDPOINTS
 * ========================================================================== */

/*
 * GET /api/admin/logbook
 * Query: ?nama=...&from=YYYY-MM-DD&to=YYYY-MM-DD&status=draft|submitted&kelompok=...
 */
router.get("/admin/logbook", verifyToken, isAdmin, async (req, res) => {
  try {
    const { nama, from, to, status, kelompok } = req.query;
    let query = supabase
      .from("logbook")
      .select("*")
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false });

    if (nama) query = query.eq("nama", nama);
    if (from) query = query.gte("tanggal", from);
    if (to) query = query.lte("tanggal", to);
    if (status) query = query.eq("status", status);
    if (kelompok) query = query.eq("kelompok", kelompok);

    const { data, error } = await query;
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
    return res.json({
      success: true,
      data: (data || []).map(formatLogbook),
      total: (data || []).length,
    });
  } catch (err) {
    console.error("Admin fetch logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * GET /api/admin/logbook/:id
 * Detail (admin boleh akses semua)
 */
router.get("/admin/logbook/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data, error } = await supabase
      .from("logbook")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res
        .status(404)
        .json({ success: false, message: "Logbook tidak ditemukan" });
    }

    return res.json({ success: true, data: formatLogbook(data) });
  } catch (err) {
    console.error("Admin fetch logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * POST /api/admin/logbook/:id/reset
 * Reset submitted -> draft (re-open edit)
 */
router.post("/admin/logbook/:id/reset", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { data, error } = await supabase
      .from("logbook")
      .update({
        status: "draft",
        submitted_at: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({
      success: true,
      message: "Logbook di-reset ke draft",
      data: formatLogbook(data),
    });
  } catch (err) {
    console.error("Reset logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

/*
 * DELETE /api/admin/logbook/:id
 * Hapus logbook (admin only)
 */
router.delete("/admin/logbook/:id", verifyToken, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: "ID tidak valid" });
    }

    const { error } = await supabase.from("logbook").delete().eq("id", id);
    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    return res.json({ success: true, message: "Logbook berhasil dihapus" });
  } catch (err) {
    console.error("Admin delete logbook error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
