/*
 * ============================================================================
 * MIDDLEWARE VALIDASI WIFI KAMPUS
 * ============================================================================
 * File ini berisi middleware untuk memvalidasi bahwa request absensi hanya
 * datang dari WiFi kampus/sekolah dengan IP range tertentu.
 *
 * TUJUAN:
 * - Mencegah siswa absen dari luar kampus (dari rumah/warnet)
 * - Memastikan siswa benar-benar datang ke sekolah saat absen
 * - Meningkatkan validitas data kehadiran
 *
 * CARA KERJA:a
 * 1. Extract IP address dari HTTP headers (support proxy/load balancer)
 * 2. Validasi IP address dengan regex pattern (103.209.9.*)
 * 3. Tolak request jika IP tidak match dengan WiFi sekolah
 * 4. Lanjutkan ke handler berikutnya jika IP valid
 *
 * DEPLOYMENT NOTES:
 * - Di Railway/production, real IP ada di header 'x-forwarded-for'
 * - Di development, bisa bypass dengan env BYPASS_WIFI_CHECK=true
 * - IP sekolah: 103.209.9.* (ganti sesuai IP WiFi sekolah Anda)
 * ============================================================================
 */

export const wifiKampus = (req, res, next) => {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 WIFI_KAMPUS MIDDLEWARE TRIGGERED");
  console.log("=".repeat(60));

  // MODE DEVELOPMENT: Bypass WiFi check untuk testing di local
  // Set BYPASS_WIFI_CHECK=true di .env untuk skip validasi
  if (process.env.BYPASS_WIFI_CHECK === "true") {
    console.log("⚠️  WiFi check bypassed (development mode)");
    console.log("=".repeat(60) + "\n");
    return next(); // Langsung lanjut tanpa cek IP
  }

  // MODE PRODUCTION: Ambil IP address sebenarnya dari client
  // Saat deploy di Railway/Nginx/Load Balancer, IP asli ada di header
  // karena request melewati proxy terlebih dahulu
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() || // Railway/Nginx: IP pertama di chain
    req.headers["x-real-ip"] || // Alternative header dari beberapa proxy
    req.ip || // Fallback ke express req.ip
    req.connection.remoteAddress || // Fallback terakhir
    "unknown"; // Jika semua gagal

  console.log(`📍 Client IP: ${clientIp}`);
  console.log(`📋 Headers:`, {
    "x-forwarded-for": req.headers["x-forwarded-for"],
    "x-real-ip": req.headers["x-real-ip"],
    "req.ip": req.ip,
  });

  // Regex pattern untuk IP WiFi Sekolah: 103.209.9.0 - 103.209.9.255
  // Format: 103.209.9.[0-999] (tapi cuma valid sampai 255)
  const ipRegex = /^103\.209\.9\.\d{1,3}$/;

  console.log(`🔐 Checking regex: ${ipRegex}`);
  console.log(`✔️  Match result: ${ipRegex.test(clientIp)}`);

  // TOLAK jika IP tidak match dengan WiFi sekolah
  // Response 403 Forbidden dengan pesan error yang jelas
  if (!ipRegex.test(clientIp)) {
    console.log(`❌ Absen ditolak - IP tidak diizinkan: ${clientIp}`);
    console.log("=".repeat(60) + "\n");
    return res.status(403).json({
      success: false,
      message:
        "Absensi hanya dapat dilakukan dari WiFi Sekolah (IP: 103.209.9.*)",
      clientIp: clientIp,
      hint: "Pastikan Anda terhubung ke WiFi sekolah",
    });
  }

  console.log(`✅ WiFi Kampus verified: ${clientIp}`);
  console.log("=".repeat(60) + "\n");
  next();
};
