/*
 * ============================================================================
 * MAIN SERVER FILE - ENTRY POINT BACKEND
 * ============================================================================
 * File ini adalah entry point dari aplikasi backend.
 * Berisi konfigurasi Express server, middleware, routing, dan static file serving.
 *
 * STRUKTUR APLIKASI:
 * - Express.js sebagai web framework
 * - RESTful API untuk frontend
 * - JWT-based authentication
 * - Role-based access control (admin vs mahasiswa)
 * - Device binding untuk keamanan
 * - WiFi restriction untuk validasi lokasi absensi
 *
 * ENDPOINT GROUPS:
 * 1. Public: /api/login, /health, /api/check-ip
 * 2. Mahasiswa: /api/absen, /api/riwayat, /api/izin
 * 3. Admin: /api/admin/* (stats, users, devices, reports)
 *
 * DEPLOYMENT:
 * - Production: Railway (dengan proxy support)
 * - Development: localhost:5000
 * ============================================================================
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// PENTING: Load .env SEBELUM import module lain
// Karena module lain (seperti supabase.js) membutuhkan environment variables
dotenv.config();

// Import middleware untuk autentikasi dan otorisasi
import { verifyToken, isMahasiswa, isAdmin } from "./middleware/auth.js";
// Import middleware untuk validasi WiFi kampus
import { wifiKampus } from "./middleware/wifiKampus.js";

// Import handler/controller untuk endpoint mahasiswa
import {
  login, // Login user (mahasiswa/admin)
  absen, // Submit absensi harian
  getRiwayat, // Lihat riwayat absensi
  submitIzin, // Submit permohonan izin
  getIzin, // Lihat daftar izin yang diajukan
  cancelIzin, // Batalkan permohonan izin
} from "./routes/auth.js";

// Import handler/controller untuk endpoint admin
import {
  getStats, // Statistik keseluruhan (total user, absensi hari ini, dll)
  getAttendanceToday, // List semua yang absen hari ini
  getStudents, // List semua mahasiswa
  getStudentAttendance, // Detail riwayat absensi per mahasiswa
  getDevices, // List semua device yang terdaftar
  deleteDevice, // Hapus device binding (unbind device)
  getUsers, // List semua user (admin + mahasiswa)
  createUser, // Tambah user baru
  resetUserPassword, // Reset password user
  deleteUser, // Hapus user
  getAttendanceReport, // Generate laporan absensi (export-ready)
  getAllIzin, // List semua permohonan izin
  updateIzinStatus, // Approve/reject izin
} from "./routes/admin.js";

// Karena pakai ES modules, perlu manual define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inisialisasi Express app
const app = express();
const PORT = process.env.PORT || 5000; // Railway auto-set PORT, fallback 5000 untuk local

/*
 * ============================================================================
 * MIDDLEWARE SETUP
 * ============================================================================
 */

// Middleware untuk parse JSON body dari request
// Otomatis parse req.body dari JSON string menjadi JavaScript object
app.use(express.json());

// Middleware CORS untuk allow cross-origin requests
// Penting untuk frontend yang di-serve dari domain/port berbeda
app.use(cors());

// Trust proxy setting untuk Railway/Nginx/Load Balancer
// Memungkinkan Express membaca IP asli client dari header x-forwarded-for
// Tanpa ini, req.ip akan selalu IP dari proxy, bukan client
app.set("trust proxy", true);

/*
 * ============================================================================
 * STATIC FILE SERVING (FRONTEND)
 * ============================================================================
 */

// Path ke folder frontend (React app)
const clientPath = path.join(__dirname, "..", "client");
const publicPath = path.join(clientPath, "dist"); // Hasil build production (npm run build)
const indexPath = path.join(publicPath, "index.html"); // Entry point SPA

// Serve static files dari folder dist (production build)
// CSS, JS, images, dll akan di-serve dari sini
app.use(express.static(publicPath));

// Development mode: Jika folder dist belum ada (belum build),
// fallback ke folder public untuk testing
if (!fs.existsSync(publicPath)) {
  app.use(express.static(path.join(clientPath, "public")));
}

/*
 * ============================================================================
 * API ROUTES - ENDPOINT DEFINITIONS
 * ============================================================================
 */

/*
 * HEALTH CHECK ENDPOINT
 * ─────────────────────────────────────────────────────────────────────────
 * GET /health
 * Public endpoint untuk monitoring (Railway health check)
 * Memastikan server berjalan dengan baik
 */
app.get("/health", (req, res) => {
  res.json({ status: "Server is running" });
});

/*
 * IP CHECK ENDPOINT (Testing & Debugging)
 * ─────────────────────────────────────────────────────────────────────────
 * GET /api/check-ip
 * Public endpoint untuk testing WiFi restriction
 * Mengembalikan IP yang terdeteksi dan apakah termasuk WiFi kampus
 * Berguna untuk debugging saat deploy
 */
app.get("/api/check-ip", (req, res) => {
  // Check bypass mode dulu
  if (process.env.BYPASS_WIFI_CHECK === "true") {
    res.json({
      success: true,
      detectedIP: "bypassed",
      isWiFiKampus: true,
      message: "✅ WiFi check bypassed (development mode)",
      headers: {
        "x-forwarded-for": req.headers["x-forwarded-for"],
        "x-real-ip": req.headers["x-real-ip"],
      },
    });
    return;
  }

  // Extract IP dari berbagai header (support proxy)
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.ip ||
    req.connection.remoteAddress;

  // Check apakah IP termasuk range WiFi kampus (103.209.9.*)
  const isWiFiKampus = /^103\.209\.9\.\d{1,3}$/.test(ip);

  res.json({
    success: true,
    detectedIP: ip,
    isWiFiKampus: isWiFiKampus,
    message: isWiFiKampus
      ? "✅ Anda terhubung ke WiFi Kampus"
      : "❌ Anda TIDAK terhubung ke WiFi Kampus",
    headers: {
      "x-forwarded-for": req.headers["x-forwarded-for"],
      "x-real-ip": req.headers["x-real-ip"],
    },
  });
});

/*
 * PUBLIC ROUTES (Tanpa Autentikasi)
 * ─────────────────────────────────────────────────────────────────────────
 * Endpoint yang bisa diakses tanpa login
 */
// POST /api/login - Login user (mahasiswa atau admin)
app.post("/api/login", login);

/*
 * PROTECTED ROUTES - MAHASISWA/ANAK SMK
 * ─────────────────────────────────────────────────────────────────────────
 * Endpoint khusus untuk user dengan role mahasiswa/anak_smk
 * Semua endpoint ini memerlukan:
 * 1. verifyToken: Validasi JWT token
 * 2. isMahasiswa: Pastikan role adalah mahasiswa/anak_smk
 * Endpoint absen juga memerlukan:
 * 3. wifiKampus: Pastikan request dari WiFi sekolah
 */

// POST /api/absen - Submit absensi (pagi atau sore)
// Middleware chain: verifyToken → isMahasiswa → wifiKampus → absen handler
app.post("/api/absen", verifyToken, isMahasiswa, wifiKampus, absen);

// GET /api/riwayat - Lihat riwayat absensi sendiri
app.get("/api/riwayat", verifyToken, isMahasiswa, getRiwayat);

// POST /api/izin - Submit permohonan izin (sakit/izin)
app.post("/api/izin", verifyToken, isMahasiswa, submitIzin);

// GET /api/izin - Lihat daftar izin yang sudah diajukan
app.get("/api/izin", verifyToken, isMahasiswa, getIzin);

// DELETE /api/izin/:id - Batalkan permohonan izin (jika belum diapprove)
app.delete("/api/izin/:id", verifyToken, isMahasiswa, cancelIzin);

/*
 * PROTECTED ROUTES - ADMIN ONLY
 * ─────────────────────────────────────────────────────────────────────────
 * Endpoint khusus untuk user dengan role admin
 * Semua endpoint ini memerlukan:
 * 1. verifyToken: Validasi JWT token
 * 2. isAdmin: Pastikan role adalah admin
 */

// GET /api/admin/stats - Dashboard statistics
// Total user, total absensi hari ini, breakdown per kelompok, dll
app.get("/api/admin/stats", verifyToken, isAdmin, getStats);

// GET /api/admin/attendance-today - List semua yang absen hari ini
app.get(
  "/api/admin/attendance-today",
  verifyToken,
  isAdmin,
  getAttendanceToday,
);

// GET /api/admin/students - List semua mahasiswa/anak SMK
app.get("/api/admin/students", verifyToken, isAdmin, getStudents);

// GET /api/admin/attendance/:nama - Detail riwayat absensi per mahasiswa
app.get(
  "/api/admin/attendance/:nama",
  verifyToken,
  isAdmin,
  getStudentAttendance,
);

// GET /api/admin/devices - List semua device yang ter-bind
app.get("/api/admin/devices", verifyToken, isAdmin, getDevices);

// DELETE /api/admin/devices/:deviceId - Unbind device
app.delete("/api/admin/devices/:deviceId", verifyToken, isAdmin, deleteDevice);

// GET /api/admin/users - List semua user (admin + mahasiswa)
app.get("/api/admin/users", verifyToken, isAdmin, getUsers);

// POST /api/admin/users - Tambah user baru
app.post("/api/admin/users", verifyToken, isAdmin, createUser);

// POST /api/admin/users/:id/reset-password - Reset password user
app.post(
  "/api/admin/users/:id/reset-password",
  verifyToken,
  isAdmin,
  resetUserPassword,
);

// DELETE /api/admin/users/:id - Hapus user
app.delete("/api/admin/users/:id", verifyToken, isAdmin, deleteUser);

// GET /api/admin/report - Generate laporan absensi (export ready)
app.get("/api/admin/report", verifyToken, isAdmin, getAttendanceReport);

// GET /api/admin/izin - List semua permohonan izin
app.get("/api/admin/izin", verifyToken, isAdmin, getAllIzin);

// PUT /api/admin/izin/:id - Update status izin (approve/reject)
app.put("/api/admin/izin/:id", verifyToken, isAdmin, updateIzinStatus);

/*
 * SPA FALLBACK ROUTE
 * ─────────────────────────────────────────────────────────────────────────
 * Semua route yang tidak match dengan API endpoint di-redirect ke index.html
 * Ini penting untuk React Router (client-side routing)
 * Contoh: /admin, /mahasiswa → akan serve index.html → React Router handle routing
 */
app.get("*", (req, res) => {
  res.sendFile(indexPath, (err) => {
    if (err) {
      res
        .status(404)
        .json({ success: false, message: "Route tidak ditemukan" });
    }
  });
});

/*
 * 404 HANDLER untuk API routes yang tidak ditemukan
 * ─────────────────────────────────────────────────────────────────────────
 */
app.use("/api/*", (req, res) => {
  res
    .status(404)
    .json({ success: false, message: "API route tidak ditemukan" });
});

/*
 * GLOBAL ERROR HANDLER
 * ─────────────────────────────────────────────────────────────────────────
 * Menangkap semua error yang tidak tertangani di middleware/handler
 */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

/*
 * ============================================================================
 * START SERVER
 * ============================================================================
 */
app.listen(PORT, () => {
  console.log(`\n🚀 Server berjalan di http://localhost:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Supabase connected: ${process.env.SUPABASE_URL}`);
  console.log(
    `⚙️  WiFi check: ${process.env.BYPASS_WIFI_CHECK === "true" ? "BYPASSED (dev)" : "ENABLED (prod)"}`,
  );
});
