/*
 * ============================================================================
 * ROUTES: AUTHENTICATION & ABSENSI
 * ============================================================================
 * File ini berisi semua endpoint untuk:
 * 1. LOGIN - Autentikasi user dengan device binding
 * 2. ABSEN - Submit absensi harian (pagi/sore)
 * 3. RIWAYAT - Lihat history absensi
 * 4. IZIN - Submit, lihat, dan batalkan permohonan izin
 *
 * KONSEP DEVICE BINDING:
 * Setiap user hanya bisa login dari device yang terdaftar (max 2-3 device).
 * Device diidentifikasi dengan fingerprint unik dari browser.
 * Tujuan: Mencegah sharing akun antar siswa.
 *
 * FLOW LOGIN:
 * 1. Client kirim {nama, password, deviceId}
 * 2. Server cek apakah user exists
 * 3. Server cek apakah device sudah terikat ke user lain (DEVICE BINDING CHECK)
 * 4. Server validasi password
 * 5. Server daftarkan device ke user (jika device baru)
 * 6. Server generate JWT token
 * 7. Client simpan token untuk request berikutnya
 * ============================================================================
 */

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";

const router = express.Router();

// Function untuk mendapatkan JWT secret dari environment
// Menggunakan lazy loading agar dotenv sudah sempat load .env
const getJWTSecret = () => {
  return (
    process.env.JWT_SECRET ||
    "your-super-secret-jwt-key-min-32-characters-long-here"
  );
};

/*
 * ============================================================================
 * ENDPOINT: POST /api/login
 * ============================================================================
 * Fungsi: Autentikasi user dan device binding
 *
 * REQUEST BODY:
 * - nama: string (username/nama lengkap)
 * - password: string (plain text, akan di-hash compare)
 * - deviceId: string (fingerprint dari browser)
 *
 * RESPONSE SUCCESS (200):
 * {
 *   success: true,
 *   token: "eyJhbGci...", // JWT token
 *   user: { id, nama, role, kelompok }
 * }
 *
 * CARA KERJA DEVICE BINDING:
 * 1. Cek di tabel device_bindings apakah deviceId sudah terikat ke user lain
 * 2. Jika ya → TOLAK login dengan error 403
 * 3. Jika tidak → Lanjut validasi password
 * 4. Setelah password benar:
 *    a. Simpan device ke kolom users.devices (JSONB array)
 *    b. Insert/update ke tabel device_bindings
 * 5. Generate JWT token dan return ke client
 *s
 * KEAMANAN:
 * - Admin tidak dibatasi device (bisa login dari device apapun)
 * - Mahasiswa max 2-3 device (sesuai users.max_devices)
 * - Password di-hash dengan bcrypt
 * - Token expired dalam 7 hari
 * ============================================================================
 */
export const login = async (req, res) => {
  try {
    const { nama, password, deviceId } = req.body;

    // Log untuk debugging dan monitoring
    console.log("\n" + "=".repeat(60));
    console.log("🔐 NEW LOGIN REQUEST");
    console.log("=".repeat(60));
    console.log("👤 User:", nama);
    console.log("📱 Device ID:", deviceId);
    console.log("⏰ Timestamp:", new Date().toISOString());
    console.log("=".repeat(60) + "\n");

    // STEP 1: Validasi input
    // Pastikan semua field required ada
    if (!nama || !password || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "Nama, password, dan deviceId diperlukan",
      });
    }

    // Deteksi IP client (hanya untuk log, bukan untuk validasi di endpoint ini)
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";

    console.log(
      `🔐 Login attempt: ${nama} dari device: ${deviceId}, IP: ${clientIp}`,
    );

    // STEP 2: Ambil data user dari database
    // Query users dengan nama yang sesuai
    const { data: users, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("nama", nama);

    if (fetchError) {
      console.error("Database error:", fetchError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    // Jika user tidak ditemukan, return error (jangan spesifik apakah nama atau password salah)
    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Nama atau password salah",
      });
    }

    const user = users[0];

    // STEP 3: DEVICE BINDING CHECK (PENTING!)
    // Cek apakah device ini sudah terikat ke user lain
    // Skip untuk admin (admin bisa login dari device apapun)
    if (user.role !== "admin") {
      console.log("🔍 Checking device binding...");

      // Query tabel device_bindings untuk cek apakah deviceId sudah terdaftar
      const { data: deviceBindings, error: deviceError } = await supabase
        .from("device_bindings")
        .select("*")
        .eq("device_id", deviceId);

      if (deviceError) {
        console.error("Device binding error:", deviceError.message);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }

      // Jika device sudah terdaftar, cek apakah terikat ke user yang berbeda
      if (deviceBindings && deviceBindings.length > 0) {
        const boundUser = deviceBindings[0];

        // TOLAK jika device sudah terikat ke user lain
        if (boundUser.user_name !== nama) {
          console.log(
            `❌ Device ${deviceId} sudah terdaftar ke user ${boundUser.user_name}`,
          );
          return res.status(403).json({
            success: false,
            message: `Device sudah terikat untuk user lain (${boundUser.user_name})`,
          });
        }

        console.log(`✅ Device ${deviceId} milik user ${nama} (valid)`);
      } else {
        console.log(`🆕 Device ${deviceId} adalah device baru`);
      }
    }

    // STEP 4: Validasi password
    // Bandingkan password plaintext dengan hash di database
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Nama atau password salah",
      });
    }

    console.log("✅ Password valid");

    // STEP 5: Device binding untuk non-admin
    // Update kolom users.devices dan tabel device_bindings
    if (user.role !== "admin") {
      const existingDevices = user.devices || []; // Ambil list device yang sudah terdaftar

      // Cek apakah device ini sudah ada di list
      const deviceExists = existingDevices.some((d) => d.deviceId === deviceId);

      if (!deviceExists) {
        // DEVICE BARU: Perlu daftarkan
        console.log(`🆕 Registering new device for user ${nama}`);

        // Cek batas maksimal device
        if (existingDevices.length >= user.max_devices) {
          console.log(
            `❌ User ${nama} sudah mencapai maksimal devices (${user.max_devices})`,
          );
          return res.status(403).json({
            success: false,
            message: `Maksimal ${user.max_devices} device per user`,
          });
        }

        // Tambahkan device baru ke array
        existingDevices.push({
          deviceId,
          firstSeen: new Date().toISOString(),
          lastUsed: new Date().toISOString(),
          usageCount: 1,
        });

        // Update kolom users.devices di database
        const { error: updateError } = await supabase
          .from("users")
          .update({ devices: existingDevices })
          .eq("id", user.id);

        if (updateError) {
          console.error("Error updating devices:", updateError.message);
          return res
            .status(500)
            .json({ success: false, message: "Database error" });
        }

        // Insert ke tabel device_bindings (untuk validasi cepat saat login)
        console.log("🔍 About to insert device binding:", {
          device_id: deviceId,
          user_name: nama,
          kelompok: user.kelompok,
        });

        const { data: bindData, error: bindError } = await supabase
          .from("device_bindings")
          .insert({
            device_id: deviceId,
            user_name: nama,
            kelompok: user.kelompok,
            bound_at: new Date().toISOString(),
            last_used: new Date().toISOString(),
            usage_count: 1,
          })
          .select();

        if (bindError) {
          console.error(
            "❌ Error binding device - FULL DETAILS:",
            JSON.stringify(
              {
                message: bindError.message,
                code: bindError.code,
                details: bindError.details,
                hint: bindError.hint,
              },
              null,
              2,
            ),
          );
          // Hanya return error kalau bukan duplicate key (23505)
          // Duplicate key artinya device sudah ada (race condition), diabaikan
          if (bindError.code !== "23505") {
            return res.status(500).json({
              success: false,
              message: "Database error: " + bindError.message,
            });
          }
          console.log(`⚠️  Device sudah ada di device_bindings (diabaikan)`);
        } else {
          console.log(`✅ Device baru terbind untuk user ${nama}:`, bindData);
        }
      } else {
        // DEVICE SUDAH ADA: Update usage count dan last used
        console.log(`🔄 Updating existing device for user ${nama}`);

        const deviceIndex = existingDevices.findIndex(
          (d) => d.deviceId === deviceId,
        );
        existingDevices[deviceIndex].lastUsed = new Date().toISOString();
        existingDevices[deviceIndex].usageCount =
          (existingDevices[deviceIndex].usageCount || 0) + 1;

        // Update kolom users.devices
        const { error: updateError } = await supabase
          .from("users")
          .update({ devices: existingDevices })
          .eq("id", user.id);

        if (updateError) {
          console.error("Error updating device usage:", updateError.message);
          return res
            .status(500)
            .json({ success: false, message: "Database error" });
        }

        // UPSERT tabel device_bindings
        // (insert jika belum ada, update jika sudah ada)
        console.log("🔄 Upserting device binding for existing device");
        const { data: upsertData, error: bindUpsertError } = await supabase
          .from("device_bindings")
          .upsert(
            {
              device_id: deviceId,
              user_name: nama,
              kelompok: user.kelompok,
              last_used: new Date().toISOString(),
              usage_count: existingDevices[deviceIndex].usageCount,
            },
            {
              onConflict: "device_id", // Conflict resolution: update jika device_id sama
            },
          )
          .select();

        if (bindUpsertError) {
          console.error(
            "❌ Error upserting device binding:",
            bindUpsertError.message,
          );
        } else {
          console.log(
            `✅ Device binding upserted untuk user ${nama}:`,
            upsertData,
          );
        }

        console.log(
          `✅ Device update untuk user ${nama}: usage count = ${existingDevices[deviceIndex].usageCount}`,
        );
      }
    }

    // STEP 6: Generate JWT token
    // ─────────────────────────────────────────────────────────────────────────
    // JWT token adalah string yang di-encode berisi informasi user
    // Token ini akan dikirim ke client dan disimpan (localStorage/sessionStorage)
    // Setiap request ke protected endpoint, client harus kirim token ini di header
    const token = jwt.sign(
      {
        // Payload: data yang akan di-encode di dalam token
        nama: user.nama,
        role: user.role,
        kelompok: user.kelompok,
        deviceId,
      },
      getJWTSecret(), // Secret key untuk sign token (dari .env)
      { expiresIn: "24h" }, // Token expired dalam 24 jam
    );

    console.log(`✅ Login berhasil: ${nama} (${user.role})`);

    // STEP 7: Return response sukses dengan token dan data user
    return res.json({
      success: true,
      token, // JWT token untuk autentikasi
      user: {
        nama: user.nama,
        role: user.role,
        kelompok: user.kelompok,
        devicesCount: (user.devices || []).length, // Jumlah device yang terdaftar
        maxDevices: user.max_devices, // Maksimal device yang diizinkan
      },
    });
  } catch (error) {
    // Catch semua error yang tidak tertangani
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/*
 * ============================================================================
 * ENDPOINT: POST /api/absen
 * ============================================================================
 * Fungsi: Submit absensi harian (pagi atau sore)
 * Middleware: verifyToken + isMahasiswa + wifiKampus
 *
 * REQUEST BODY:
 * - login_time: string ISO timestamp (waktu absen)
 * - deviceId: string (fingerprint device)
 *
 * RESPONSE SUCCESS (200):
 * {
 *   success: true,
 *   message: "Absen pagi berhasil tercatat",
 *   attendance: { ... }
 * }
 *
 * ATURAN ABSENSI:
 * 1. WAKTU PAGI: 08:00 - 10:00
 * 2. WAKTU SORE: 15:00 - 17:00
 * 3. Absen sore harus sudah absen pagi terlebih dahulu
 * 4. Jeda minimal antara absen pagi-sore: 6 jam (exclude waktu istirahat 12:00-13:00)
 * 5. Device harus terdaftar (ada di device_bindings)
 * 6. Hanya dari WiFi kampus (middleware wifiKampus)
 * 7. Tidak boleh absen 2 kali untuk sesi yang sama
 *
 * CARA KERJA:
 * 1. Validasi input (login_time, deviceId)
 * 2. Cek device terdaftar (query device_bindings)
 * 3. Konversi waktu ke timezone Jakarta (UTC+7)
 * 4. Tentukan sesi (pagi/sore) berdasarkan waktu
 * 5. Jika sore: cek sudah absen pagi + validasi jeda 6 jam
 * 6. Cek duplikat absen (tidak boleh absen 2x di sesi yang sama)
 * 7. Insert ke tabel attendances
 * ============================================================================
 */
export const absen = async (req, res) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("📝 ABSEN ROUTE HANDLER CALLED");
    console.log("=".repeat(60));

    const { login_time, deviceId } = req.body;
    const { nama, role, kelompok } = req.user; // Dari JWT token (sudah di-decode oleh verifyToken)

    console.log(`👤 User: ${nama}`);
    console.log(`🔐 Role: ${role}`);
    console.log(`📱 Device ID: ${deviceId}`);
    console.log("=".repeat(60) + "\n");

    // STEP 1: Validasi input
    if (!login_time || !deviceId) {
      return res.status(400).json({
        success: false,
        message: "login_time dan deviceId diperlukan",
      });
    }

    console.log(`📝 Absen attempt: ${nama} di ${login_time}`);

    // STEP 2: Validasi device
    // Pastikan device terdaftar di device_bindings
    const { data: deviceBindings, error: deviceError } = await supabase
      .from("device_bindings")
      .select("*")
      .eq("device_id", deviceId);

    if (deviceError || !deviceBindings || deviceBindings.length === 0) {
      console.log(`❌ Device ${deviceId} tidak terdaftar`);
      return res.status(403).json({
        success: false,
        message: "Device tidak terdaftar",
      });
    }

    // STEP 3: Parse dan konversi waktu ke timezone Jakarta (UTC+7)
    // Date yang dikirim client biasanya dalam UTC, perlu convert ke WIB
    const normalizeIso = (value) => {
      if (!value) return value;
      return /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
    };
    const getJakartaDateTimeParts = (date) => {
      const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
      return {
        hour: shifted.getUTCHours(),
        minute: shifted.getUTCMinutes(),
        date: shifted.toISOString().split("T")[0],
      };
    };
    const loginDateTime = new Date(normalizeIso(login_time));
    const {
      hour,
      minute,
      date: today,
    } = getJakartaDateTimeParts(loginDateTime);
    const timeInMinutes = hour * 60 + minute; // Convert ke total menit untuk mudah compare

    // STEP 4: Tentukan sesi berdasarkan waktu atau status absen pagi
    // Pagi: 08:00 - 10:00 (480 menit - 600 menit)
    // Sore: 15:00 - 17:00 (900 menit - 1020 menit)
    let sesi;
    const pagiStart = 8 * 60; // 08:00 = 480 menit
    const pagiEnd = 10 * 60; // 10:00 = 600 menit
    const soreStart = 15 * 60; // 15:00 = 900 menit
    const soreEnd = 17 * 60; // 17:00 = 1020 menit
    // today harus berdasarkan timezone Jakarta agar validasi harian akurat.

    // Check apakah time validation di-bypass (development mode)
    // Jika BYPASS_PAGI_ONLY=true, selalu set sesi ke pagi
    // Jika BYPASS_TIME_CHECK=true, tentukan sesi berdasarkan apakah sudah absen pagi
    if (process.env.BYPASS_PAGI_ONLY === "true") {
      console.log("⏰ Time check bypassed (pagi only)");
      sesi = "pagi";
    } else if (process.env.BYPASS_TIME_CHECK === "true") {
      console.log("⏰ Time check bypassed (full)");

      // Cek apakah sudah absen pagi hari ini
      const { data: pagiAttendance } = await supabase
        .from("attendances")
        .select("*")
        .eq("nama", nama)
        .eq("tanggal", today)
        .eq("sesi", "pagi");

      // Jika sudah ada absen pagi hari ini → set sesi sore
      // Jika belum ada → set sesi pagi
      sesi = pagiAttendance && pagiAttendance.length > 0 ? "sore" : "pagi";
      console.log(
        `📝 Bypass mode: Sesi otomatis set ke "${sesi}" (sudah absen pagi: ${pagiAttendance && pagiAttendance.length > 0})`,
      );
    } else {
      // Mode production: validasi jam normal
      if (timeInMinutes >= pagiStart && timeInMinutes <= pagiEnd) {
        sesi = "pagi";
      } else if (timeInMinutes >= soreStart && timeInMinutes <= soreEnd) {
        sesi = "sore";
      } else {
        // Waktu di luar jam absen
        return res.status(403).json({
          success: false,
          message:
            "Waktu absensi tidak valid. Pagi: 08:00-10:00, Sore: 15:00-17:00",
        });
      }
    }

    // STEP 5: Validasi khusus untuk absen sore
    // Harus sudah absen pagi + jeda minimal 6 jam (exclude istirahat)
    if (sesi === "sore") {
      // Cek apakah sudah absen pagi hari ini
      const { data: pagiAttendance, error: pagiError } = await supabase
        .from("attendances")
        .select("*")
        .eq("nama", nama)
        .eq("tanggal", today)
        .eq("sesi", "pagi")
        .order("login_time", { ascending: false })
        .limit(1);

      if (pagiError) {
        console.error("Pagi attendance check error:", pagiError.message);
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      }

      // Tolak jika belum absen pagi
      if (!pagiAttendance || pagiAttendance.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Harus sudah absen pagi sebelum absen sore",
        });
      }

      const bypassJedaCheck = process.env.BYPASS_JEDA_CHECK === "true";

      if (!bypassJedaCheck) {
        // Hitung jeda waktu antara absen pagi dan sore
        // Exclude waktu istirahat (12:00-13:00) dari hitungan
        const pagiLoginTime = new Date(
          normalizeIso(pagiAttendance[0].login_time),
        );
        const diffMinutesRaw = (loginDateTime - pagiLoginTime) / (1000 * 60); // Selisih dalam menit

        if (!Number.isFinite(diffMinutesRaw)) {
          console.warn("⚠️ Invalid time diff for 6-hour check", {
            login_time,
            pagi_login_time: pagiAttendance[0].login_time,
          });
          return res.status(400).json({
            success: false,
            message: "Data waktu absen tidak valid",
          });
        }

        // Convert ke Jakarta time untuk hitung overlap waktu istirahat
        const pagiJakarta = new Date(
          pagiLoginTime.getTime() + 7 * 60 * 60 * 1000,
        );
        const soreJakarta = new Date(
          loginDateTime.getTime() + 7 * 60 * 60 * 1000,
        );

        // Hitung berapa menit overlap dengan waktu istirahat (12:00-13:00)
        let overlapMinutes = 0;
        if (pagiJakarta.toDateString() === soreJakarta.toDateString()) {
          const startMinutes =
            pagiJakarta.getUTCHours() * 60 + pagiJakarta.getUTCMinutes();
          const endMinutes =
            soreJakarta.getUTCHours() * 60 + soreJakarta.getUTCMinutes();
          const breakStart = 12 * 60; // 12:00
          const breakEnd = 13 * 60; // 13:00

          // Hitung overlap (jika ada)
          overlapMinutes = Math.max(
            0,
            Math.min(endMinutes, breakEnd) - Math.max(startMinutes, breakStart),
          );
        }

        // Selisih efektif = selisih total - waktu istirahat
        const effectiveDiffMinutes = diffMinutesRaw - overlapMinutes;
        const diffHours = effectiveDiffMinutes / 60;

        console.log("⏱️ Jeda check", {
          bypassJedaCheck,
          login_time,
          pagi_login_time: pagiAttendance[0].login_time,
          diffHours,
        });

        // Tolak jika jeda kurang dari 6 jam
        if (diffHours < 6) {
          return res.status(403).json({
            success: false,
            message: `Jeda absen pagi-sore minimal 6 jam (di luar istirahat). Waktu tersisa: ${(6 - diffHours).toFixed(1)} jam`,
          });
        }
      } else {
        console.log("⏰ 6-hour jeda rule bypassed (BYPASS_JEDA_CHECK=true)");
      }
    }

    // STEP 6: Cek duplikat absen (tidak boleh absen 2x untuk sesi yang sama)
    const { data: existingAttendance, error: existingError } = await supabase
      .from("attendances")
      .select("*")
      .eq("nama", nama)
      .eq("tanggal", today)
      .eq("sesi", sesi);

    if (existingError) {
      console.error("Duplicate check error:", existingError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    // Tolak jika sudah absen di sesi yang sama
    if (existingAttendance && existingAttendance.length > 0) {
      console.log(`❌ Duplikat absen ${sesi} untuk ${nama}`);
      return res.status(403).json({
        success: false,
        message: `Anda sudah absen ${sesi} hari ini`,
      });
    }

    // STEP 7: Insert absensi ke database
    const jamMasuk = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`; // Format: HH:MM:SS

    const { data: newAttendance, error: insertError } = await supabase
      .from("attendances")
      .insert({
        nama,
        kelompok,
        tanggal: today, // YYYY-MM-DD
        sesi, // "pagi" atau "sore"
        jam_masuk: jamMasuk, // HH:MM:SS
        login_time: loginDateTime.toISOString(), // ISO timestamp lengkap
        status: "hadir",
      })
      .select();

    if (insertError) {
      console.error("Insert attendance error:", insertError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    console.log(`✅ Absen berhasil: ${nama} - ${sesi} - ${jamMasuk}`);

    // Return response sukses
    return res.json({
      success: true,
      message: `Absen ${sesi} berhasil tercatat`,
      attendance: newAttendance[0],
    });
  } catch (error) {
    console.error("Absen error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/izin - Get izin mahasiswa
// GET /api/izin - Lihat daftar izin yang sudah diajukan
// Query dari tabel attendances dengan status='izin'
export const getIzin = async (req, res) => {
  try {
    const { nama } = req.user;

    console.log(`📋 Get izin untuk: ${nama}`);

    // Query izin dari tabel attendances (status='izin')
    const { data: izinList, error } = await supabase
      .from("attendances")
      .select(
        "id, nama, kelompok, tanggal, sesi, keterangan, status_approval, approved_by, approved_at, created_at",
      )
      .eq("nama", nama)
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

// DELETE /api/izin/:id - Batalkan izin (hanya pending)
// Tandai izin sebagai dibatalkan agar kuota harian tetap dihitung
export const cancelIzin = async (req, res) => {
  try {
    const { nama } = req.user;
    const { id } = req.params;

    // Check if izin exists and belongs to user
    const { data: izinData, error: fetchError } = await supabase
      .from("attendances")
      .select("*")
      .eq("id", id)
      .eq("nama", nama)
      .eq("status", "izin")
      .single();

    if (fetchError || !izinData) {
      return res.status(404).json({
        success: false,
        message: "Izin tidak ditemukan",
      });
    }

    // Hanya bisa batalkan izin dengan status_approval null atau pending
    if (izinData.status_approval && izinData.status_approval !== "pending") {
      return res.status(403).json({
        success: false,
        message: "Hanya izin pending yang bisa dibatalkan",
      });
    }

    // Update status izin jadi cancelled (tetap dihitung untuk limit harian)
    const { error: updateError } = await supabase
      .from("attendances")
      .update({
        status_approval: "cancelled",
        approved_by: nama,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Update izin cancel error:", updateError.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    console.log(`✅ Izin ${id} dibatalkan oleh ${nama}`);

    return res.json({
      success: true,
      message: "Izin berhasil dibatalkan",
    });
  } catch (error) {
    console.error("Cancel izin error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/izin - Submit permohonan izin
// Insert izin ke tabel attendances dengan status='izin'
export const submitIzin = async (req, res) => {
  try {
    const { nama, kelompok } = req.user;
    const { keterangan, sesi, bukti_url } = req.body;

    // Validasi input
    if (!keterangan) {
      return res.status(400).json({
        success: false,
        message: "Keterangan izin diperlukan",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    // Batasi izin maksimal 2x per hari (sesi: izin-1, izin-2)
    const { data: existingIzin } = await supabase
      .from("attendances")
      .select("sesi")
      .eq("nama", nama)
      .eq("tanggal", today)
      .eq("status", "izin");

    const existingSessions = existingIzin?.map((a) => a.sesi) || [];
    const allowedSessions = ["izin-1", "izin-2"];
    let sesiIzin = sesi;

    if (existingSessions.length >= allowedSessions.length) {
      return res.status(400).json({
        success: false,
        message: "Maksimal izin 2x per hari",
      });
    }

    if (!sesiIzin || !allowedSessions.includes(sesiIzin)) {
      sesiIzin = allowedSessions.find(
        (session) => !existingSessions.includes(session),
      );
    }

    console.log(
      `📝 Submit izin: ${nama} untuk ${today} (sesi: ${sesiIzin}, alasan: ${keterangan})`,
    );

    // Insert izin ke tabel attendances
    // Catat jam izin saat tombol ditekan (waktu server dalam WIB/Jakarta)
    const izinTime = new Date();
    const izinJakarta = new Date(izinTime.getTime() + 7 * 60 * 60 * 1000);
    const izinHour = izinJakarta.getUTCHours();
    const izinMinute = izinJakarta.getUTCMinutes();
    const jamMasukIzin = `${String(izinHour).padStart(2, "0")}:${String(izinMinute).padStart(2, "0")}:00`;
    const { data, error } = await supabase
      .from("attendances")
      .insert({
        nama,
        kelompok,
        tanggal: today,
        sesi: sesiIzin,
        status: "izin", // Status izin
        jam_masuk: jamMasukIzin,
        login_time: izinTime.toISOString(),
        keterangan,
        bukti_url: bukti_url || null,
        status_approval: "pending", // Default pending menunggu admin approve
        created_at: izinTime.toISOString(),
      })
      .select();

    if (error) {
      console.error("Submit izin error:", error.message);
      return res.status(500).json({
        success: false,
        message: `Database error: ${error.message}`,
      });
    }

    console.log(`✅ Izin berhasil disubmit untuk ${nama}`);

    return res.json({
      success: true,
      message: "Izin berhasil diajukan. Menunggu persetujuan admin.",
      data: data[0],
    });
  } catch (error) {
    console.error("Submit izin error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/riwayat
export const getRiwayat = async (req, res) => {
  try {
    const { nama } = req.user;

    console.log(`📖 Get riwayat untuk: ${nama}`);

    const { data: attendances, error } = await supabase
      .from("attendances")
      .select("*")
      .eq("nama", nama)
      .order("tanggal", { ascending: false });

    if (error) {
      console.error("Get riwayat error:", error.message);
      return res
        .status(500)
        .json({ success: false, message: "Database error" });
    }

    return res.json({
      success: true,
      data: attendances || [],
    });
  } catch (error) {
    console.error("Get riwayat error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export default router;
