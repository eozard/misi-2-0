/*
 * ============================================================================
 * MIDDLEWARE AUTENTIKASI DAN OTORISASI
 * ============================================================================
 * File ini berisi middleware untuk:
 * 1. Verifikasi JWT token (memastikan user sudah login)
 * 2. Role-based access control (admin vs mahasiswa)
 *
 * KONSEP JWT (JSON Web Token):
 * - Token dibuat saat login dan dikirim ke client
 * - Client menyimpan token (biasanya di localStorage/sessionStorage)
 * - Setiap request ke protected endpoint, client kirim token di header
 * - Server verifikasi token untuk memastikan user terautentikasi
 *
 * FLOW AUTENTIKASI:
 * 1. User login → server generate JWT token
 * 2. Client simpan token
 * 3. Client kirim token di header: Authorization: Bearer <token>
 * 4. Middleware verifyToken validasi token
 * 5. Middleware role guard cek apakah user punya akses ke endpoint
 *
 * STRUKTUR JWT TOKEN:
 * Payload berisi: { id, nama, role, kelompok, iat, exp }
 * Token di-sign dengan JWT_SECRET dari .env
 * ============================================================================
 */

import jwt from "jsonwebtoken";

// Function untuk mendapatkan JWT secret dari environment
// Menggunakan lazy loading agar dotenv sudah sempat load .env file
const getJWTSecret = () => {
  const secret =
    process.env.JWT_SECRET ||
    "your-super-secret-jwt-key-min-32-characters-long-here"; // Fallback default
  return secret;
};

/*
 * MIDDLEWARE: verifyToken
 * ============================================================================
 * Fungsi: Memvalidasi JWT token yang dikirim client di header request
 *
 * CARA KERJA:s
 * 1. Ambil header Authorization dari request
 * 2. Pastikan format: "Bearer <token>"
 * 3. Extract token (substring dari karakter ke-7 untuk skip "Bearer ")
 * 4. Verifikasi token menggunakan jwt.verify() dengan JWT_SECRET
 * 5. Decode token dan simpan payload ke req.user
 * 6. Lanjutkan ke middleware/handler berikutnya
 *
 * JIKA GAGAL:
 * - Status 401 Unauthorized jika token tidak ada atau format salah
 * - Status 401 jika token expired atau signature tidak valid
 * ============================================================================
 */
export const verifyToken = (req, res, next) => {
  console.log("\n🔐 VERIFY_TOKEN MIDDLEWARE");
  try {
    // Ambil header Authorization (format: "Bearer eyJhbGci...")
    const authHeader = req.headers.authorization;

    // Cek apakah header ada dan formatnya benar
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ success: false, message: "Token tidak ditemukan" });
    }

    // Extract token (potong "Bearer " dari depan)
    const token = authHeader.substring(7);

    // Verifikasi token menggunakan secret key
    // Akan throw error jika token expired atau signature tidak valid
    const decoded = jwt.verify(token, getJWTSecret());

    // Simpan payload token ke req.user untuk digunakan di handler berikutnya
    // decoded berisi: { id, nama, role, kelompok, iat, exp }
    req.user = decoded;

    // Lanjut ke middleware/handler berikutnya
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);
    return res
      .status(401)
      .json({ success: false, message: "Token tidak valid" });
  }
};

/*
 * MIDDLEWARE: isMahasiswa
 * ============================================================================
 * Fungsi: Membatasi akses endpoint hanya untuk user dengan role mahasiswa/anak_smk
 *
 * CARA KERJA:
 * 1. Cek req.user.role (sudah di-set oleh verifyToken)
 * 2. Pastikan role adalah "mahasiswa" atau "anak_smk"
 * 3. Jika bukan, tolak dengan status 403 Forbidden
 * 4. Jika iya, lanjutkan ke handler berikutnya
 *
 * PENGGUNAAN:
 * app.post('/api/absen', verifyToken, isMahasiswa, absenHandler)
 * ============================================================================
 */
export const isMahasiswa = (req, res, next) => {
  console.log("📚 IS_MAHASISWA MIDDLEWARE - User role:", req.user.role);

  // Cek apakah role adalah mahasiswa atau anak_smk
  if (req.user.role !== "mahasiswa" && req.user.role !== "anak_smk") {
    return res.status(403).json({
      success: false,
      message: "Akses hanya untuk mahasiswa/anak SMK",
    });
  }

  console.log("✅ IS_MAHASISWA: Passed");
  next(); // Lanjut ke handler berikutnya
};

/*
 * MIDDLEWARE: isAdmin
 * ============================================================================
 * Fungsi: Membatasi akses endpoint hanya untuk user dengan role admin
 *
 * CARA KERJA:
 * 1. Cek req.user.role (sudah di-set oleh verifyToken)
 * 2. Pastikan role adalah "admin"
 * 3. Jika bukan, tolak dengan status 403 Forbidden
 * 4. Jika iya, lanjutkan ke handler berikutnya
 *
 * PENGGUNAAN:
 * app.get('/api/admin/stats', verifyToken, isAdmin, getStatsHandler)
 * ============================================================================
 */
export const isAdmin = (req, res, next) => {
  // Cek apakah role adalah admin
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Akses hanya untuk admin" });
  }

  next(); // Lanjut ke handler berikutnya
};
