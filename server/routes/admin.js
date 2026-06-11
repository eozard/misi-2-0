/*
 * Admin routes: stats, users, devices, reports, izin approvals.
 */
import express from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../config/supabase.js";

const router = express.Router();

// GET /api/admin/stats
// Ringkasan statistik untuk kartu dashboard
export const getStats = async (req, res) => {
  try {
    console.log("📊 Get admin stats");

    // Total mahasiswa
    const { data: mahasiswa, error: mahasiswaError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "mahasiswa");

    // Total anak SMK
    const { data: anakSmk, error: anakSmkError } = await supabase
      .from("users")
      .select("id")
      .eq("role", "anak_smk");

    // Hadir hari ini (count per siswa unik, bukan per record)
    const today = new Date().toISOString().split("T")[0];
    const { data: hadirRaw, error: hadirError } = await supabase
      .from("attendances")
      .select("nama")
      .eq("tanggal", today)
      .eq("status", "hadir");

    // Izin hari ini (count per siswa unik)
    const { data: izinRaw, error: izinError } = await supabase
      .from("attendances")
      .select("nama")
      .eq("tanggal", today)
      .eq("status", "izin");

    if (mahasiswaError || anakSmkError || hadirError || izinError) {
      console.error("Stats error");
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    // Count unique siswa (jangan duplikat pagi/sore)
    const hadirUnique = new Set((hadirRaw || []).map((a) => a.nama));
    const izinUnique = new Set((izinRaw || []).map((a) => a.nama));

    return res.json({
      success: true,
      stats: {
        totalMahasiswa: mahasiswa?.length || 0,
        totalAnakSmk: anakSmk?.length || 0,
        hadirToday: hadirUnique.size,
        izinToday: izinUnique.size,
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/attendance-today
// Rekap absensi hari ini (pagi/sore)
export const getAttendanceToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    console.log(`📋 Get attendance untuk: ${today}`);

    const { data: attendances, error } = await supabase
      .from("attendances")
      .select("*")
      .eq("tanggal", today)
      .order("nama", { ascending: true });

    if (error) {
      console.error("Get attendance error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    // Transform data ke format yang lebih user-friendly
    const result = {};
    (attendances || []).forEach((att) => {
      if (!result[att.nama]) {
        result[att.nama] = {
          nama: att.nama,
          kelompok: att.kelompok,
          pagi: null,
          sore: null,
        };
      }
      if (att.sesi === "pagi") {
        result[att.nama].pagi = {
          jam_masuk: att.jam_masuk,
          status: att.status,
        };
      } else if (att.sesi === "sore") {
        result[att.nama].sore = {
          jam_masuk: att.jam_masuk,
          status: att.status,
        };
      }
    });

    return res.json({
      success: true,
      data: Object.values(result),
    });
  } catch (error) {
    console.error("Get attendance today error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/students
// Daftar mahasiswa/anak SMK
export const getStudents = async (req, res) => {
  try {
    console.log("� Get all students");

    const { data: students, error } = await supabase
      .from("users")
      .select("nama, role, kelompok")
      .in("role", ["mahasiswa", "anak_smk"])
      .order("nama", { ascending: true });

    if (error) {
      console.error("Get students error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    return res.json({
      success: true,
      students: students || [],
    });
  } catch (error) {
    console.error("Get students error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/attendance/:nama
// Riwayat absensi per siswa
export const getStudentAttendance = async (req, res) => {
  try {
    const { nama } = req.params;

    console.log(`📖 Get attendance untuk: ${nama}`);

    const { data: attendances, error } = await supabase
      .from("attendances")
      .select("*")
      .eq("nama", nama)
      .order("tanggal", { ascending: false });

    if (error) {
      console.error("Get student attendance error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    // Calculate summary
    let totalPagi = 0,
      totalSore = 0,
      totalAlpa = 0;
    (attendances || []).forEach((att) => {
      if (att.status === "hadir") {
        if (att.sesi === "pagi") totalPagi++;
        else if (att.sesi === "sore") totalSore++;
      } else if (att.status === "alpa") {
        totalAlpa++;
      }
    });

    return res.json({
      success: true,
      data: attendances || [],
      summary: { totalPagi, totalSore, totalAlpa },
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/devices
// Daftar semua device terikat
export const getDevices = async (req, res) => {
  try {
    console.log("📱 Get all devices");

    const { data: devices, error } = await supabase
      .from("device_bindings")
      .select("device_id, user_name, kelompok, last_used")
      .order("last_used", { ascending: false });

    if (error) {
      console.error("Get devices error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    return res.json({
      success: true,
      devices: devices || [],
    });
  } catch (error) {
    console.error("Get devices error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/admin/devices/:deviceId
// Hapus ikatan device tertentu dari device_bindings dan users.devices array
export const deleteDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;

    console.log(`🗑️ Delete device: ${deviceId}`);

    // STEP 1: Cari user yang punya device ini
    const { data: deviceBinding, error: bindingError } = await supabase
      .from("device_bindings")
      .select("user_name")
      .eq("device_id", deviceId)
      .single();

    if (bindingError || !deviceBinding) {
      console.error("Device binding not found:", bindingError?.message);
      return res.status(404).json({
        success: false,
        message: "Device tidak ditemukan",
      });
    }

    const userName = deviceBinding.user_name;

    // STEP 2: Hapus dari device_bindings
    const { error: deleteBindingError } = await supabase
      .from("device_bindings")
      .delete()
      .eq("device_id", deviceId);

    if (deleteBindingError) {
      console.error(
        "Delete device_bindings error:",
        deleteBindingError.message,
      );
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    // STEP 3: Hapus dari users.devices array
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("devices")
      .eq("nama", userName)
      .single();

    if (userError || !user) {
      console.error("User not found:", userError?.message);
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    // Filter device yang TIDAK sama dengan deviceId yang dihapus
    const updatedDevices = (user.devices || []).filter(
      (d) => d.deviceId !== deviceId,
    );

    // Update users.devices dengan array yang sudah difilter
    const { error: updateError } = await supabase
      .from("users")
      .update({ devices: updatedDevices })
      .eq("nama", userName);

    if (updateError) {
      console.error("Update users.devices error:", updateError.message);
      return res.status(500).json({
        success: false,
        message: "Database error",
      });
    }

    console.log(
      `✅ Device ${deviceId} dihapus dari ${userName} (slot dari ${user.devices.length} → ${updatedDevices.length})`,
    );

    return res.json({
      success: true,
      message: "Device berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete device error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/users
// Daftar user + hitung jumlah device
export const getUsers = async (req, res) => {
  try {
    console.log("👥 Get all users");

    const { data: users, error } = await supabase
      .from("users")
      .select("id, nama, role, kelompok, devices, max_devices")
      .order("nama", { ascending: true });

    if (error) {
      console.error("Get users error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    const { data: deviceBindings, error: deviceError } = await supabase
      .from("device_bindings")
      .select("user_name");

    if (deviceError) {
      console.error("Get device bindings error:", deviceError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    const deviceCounts = (deviceBindings || []).reduce((acc, binding) => {
      if (!binding.user_name) return acc;
      acc[binding.user_name] = (acc[binding.user_name] || 0) + 1;
      return acc;
    }, {});

    // Transform to add devices_count
    const formattedUsers = (users || []).map((user) => ({
      ...user,
      devices_count: deviceCounts[user.nama] || 0,
    }));

    return res.json({
      success: true,
      users: formattedUsers,
    });
  } catch (error) {
    console.error("Get users error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin/users/:id/reset-password
// Admin mengganti password user
export const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!id || !password) {
      return res.status(400).json({
        success: false,
        message: "User id dan password diperlukan",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", id)
      .select("id");

    if (error) {
      console.error("Reset password error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Password user berhasil direset",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// DELETE /api/admin/users/:id
// Hapus user (non-admin) + bersihkan device bindings
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "User id diperlukan" });
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, nama, role")
      .eq("id", id)
      .single();

    if (userError || !user) {
      console.error("Get user error:", userError?.message);
      return res
        .status(404)
        .json({ success: false, message: "User tidak ditemukan" });
    }

    if (user.role === "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Tidak bisa hapus admin" });
    }

    const { error: deleteBindingsError } = await supabase
      .from("device_bindings")
      .delete()
      .eq("user_name", user.nama);

    if (deleteBindingsError) {
      console.error("Delete bindings error:", deleteBindingsError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    const { error: deleteUserError } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (deleteUserError) {
      console.error("Delete user error:", deleteUserError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    return res.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/admin/users
// Buat user baru (hash password)
export const createUser = async (req, res) => {
  try {
    const { nama, password, role, kelompok } = req.body;

    if (!nama || !password || !role || !kelompok) {
      return res.status(400).json({
        success: false,
        message: "Nama, password, role, dan kelompok diperlukan",
      });
    }

    console.log(`➕ Create user: ${nama} (${role})`);

    // Check jika user sudah ada
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("nama", nama);

    if (checkError) {
      console.error("Check user error:", checkError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    if (existingUser && existingUser.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: "User sudah ada" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const { data: newUser, error: createError } = await supabase
      .from("users")
      .insert([
        {
          nama,
          password: hashedPassword,
          role,
          kelompok,
          devices: [],
          max_devices: role === "admin" ? 999 : 2,
        },
      ])
      .select();

    if (createError) {
      console.error("Create user error:", createError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    console.log(`✅ User ${nama} berhasil dibuat`);

    return res.json({
      success: true,
      message: "User berhasil dibuat",
      user: newUser?.[0],
    });
  } catch (error) {
    console.error("Create user error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/report - filtered attendance report
export const getAttendanceReport = async (req, res) => {
  try {
    const { fromDate, toDate, kelompok, nama } = req.query;

    console.log(
      `📊 Get report: ${fromDate} to ${toDate}, kelompok: ${kelompok}, nama: ${nama}`,
    );

    let query = supabase
      .from("attendances")
      .select("*")
      .order("tanggal", { ascending: false })
      .order("jam_masuk", { ascending: false });

    // Apply date filter
    if (fromDate) {
      query = query.gte("tanggal", fromDate);
    }
    if (toDate) {
      query = query.lte("tanggal", toDate);
    }

    // Apply kelompok filter
    if (kelompok && kelompok !== "all") {
      query = query.eq("kelompok", kelompok);
    }

    // Apply nama filter
    if (nama && nama !== "all") {
      query = query.eq("nama", nama);
    }

    const { data: attendances, error } = await query;

    if (error) {
      console.error("Get report error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    return res.json({
      success: true,
      data: attendances || [],
      count: attendances?.length || 0,
    });
  } catch (error) {
    console.error("Get report error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/izin - Get all izin requests
// GET /api/admin/izin - Lihat semua permohonan izin
// Query izin dari tabel attendances dengan status='izin'
export const getAllIzin = async (req, res) => {
  try {
    console.log("📋 Get all izin requests");

    // Query izin dari tabel attendances (status='izin')
    const { data: izinList, error } = await supabase
      .from("attendances")
      .select(
        "id, nama, kelompok, tanggal, sesi, keterangan, bukti_url, status_approval, approved_by, approved_at, created_at",
      )
      .eq("status", "izin")
      .order("tanggal", { ascending: false });

    if (error) {
      console.error("Get izin error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    return res.json({
      success: true,
      data: izinList || [],
    });
  } catch (error) {
    console.error("Get izin error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PUT /api/admin/izin/:id - Approve/Reject izin
// Update status_approval di tabel attendances
export const updateIzinStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    const adminName = req.user.nama;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status harus 'approved' atau 'rejected'",
      });
    }

    console.log(`✏️ Update izin ${id} to ${status} by ${adminName}`);

    // Update izin di tabel attendances dengan kolom status_approval
    const { data, error } = await supabase
      .from("attendances")
      .update({
        status_approval: status,
        approved_by: adminName,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "izin")
      .select();

    if (error) {
      console.error("Update izin error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Izin tidak ditemukan",
      });
    }

    console.log(
      `✅ Izin ${id} berhasil ${status === "approved" ? "disetujui" : "ditolak"}`,
    );

    return res.json({
      success: true,
      message: `Izin berhasil ${status === "approved" ? "disetujui" : "ditolak"}`,
      data: data[0],
    });
  } catch (error) {
    console.error("Update izin error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export default router;
