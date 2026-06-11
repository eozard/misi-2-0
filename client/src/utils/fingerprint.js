/*
 * ============================================================================
 * DEVICE FINGERPRINTING - GENERATOR DEVICE ID UNIK
 * ============================================================================
 * File ini berisi fungsi untuk menghasilkan dan menyimpan Device ID yang unik
 * untuk setiap perangkat (browser + device combination).
 *
 * TUJUAN:
 * Device ID digunakan untuk Device Binding - memastikan setiap user hanya
 * bisa login dari device yang sudah terdaftar (maksimal 2-3 device).
 * Ini mencegah sharing akun antar siswa.
 *c
 * CARA KERJA:
 * 1. Kumpulkan informasi unik dari browser dan device
 * 2. Gabungkan semua informasi menjadi satu string
 * 3. Hash string tersebut menjadi ID yang lebih pendek
 * 4. Simpan di localStorage agar persistent
 * 5. Gunakan ID yang sama untuk setiap login dari device ini
 *
 * CATATAN PENTING:
 * - Device ID bersifat PERMANENT untuk kombinasi browser + device
 * - Ganti browser = device berbeda
 * - Clear localStorage = device ID baru (dianggap device baru!)
 * - Sama seperti WhatsApp Web device binding
 *
 * INFORMASI YANG DIKUMPULKAN:
 * - User Agent (browser name, version, OS)
 * - Platform (Windows, Mac, Linux, Android, iOS)
 * - Language (bahasa browser)
 * - Timezone (zona waktu device)
 * - Screen Resolution (resolusi layar)
 * - Color Depth (kedalaman warna)
 * - Device Memory (RAM jika tersedia)
 * - Hardware Concurrency (jumlah CPU cores)
 * - Max Touch Points (untuk touchscreen)
 * ============================================================================
 */

/*
 * FUNCTION: initFingerprint (Legacy)
 * ─────────────────────────────────────────────────────────────────────────
 * Fungsi placeholder untuk kompatibilitas backward.
 * Tidak melakukan apa-apa, hanya return resolved promise.
 */
export const initFingerprint = async () => {
  return Promise.resolve();
};

/*
 * FUNCTION: getDeviceId (Async)
 * ─────────────────────────────────────────────────────────────────────────
 * Mendapatkan Device ID (async version)
 *
 * CARA KERJA:
 * 1. Cek apakah device ID sudah ada di localStorage
 * 2. Jika sudah ada, langsung return (device sudah pernah generate ID)
 * 3. Jika belum ada, generate fingerprint baru
 * 4. Simpan ke localStorage untuk digunakan selanjutnya
 * 5. Return device ID
 *
 * RETURN: Promise<string> - Device ID dengan format "device_[hash]"
 */
export const getDeviceId = async () => {
  // Cek localStorage apakah device ID sudah pernah dibuat
  let stored = localStorage.getItem("deviceId");
  if (stored) {
    return stored; // Gunakan ID yang sudah ada
  }

  // Generate ID baru jika belum ada
  const fingerprint = generateDeviceFingerprint();
  const deviceId = `device_${fingerprint}`; // Format: device_abc123...

  // Simpan ke localStorage agar tidak perlu generate lagi
  localStorage.setItem("deviceId", deviceId);
  return deviceId;
};

/*
 * FUNCTION: getDeviceIdSync (Synchronous)
 * ─────────────────────────────────────────────────────────────────────────
 * Mendapatkan Device ID (sync version) - Yang PALING SERING DIGUNAKAN
 *
 * CARA KERJA:
 * Sama seperti getDeviceId, tapi synchronous (tidak perlu await)
 * Ditambah: console.log untuk debugging dan memberitahu user
 *
 * OUTPUT CONSOLE:
 * - Jika device baru: "📱 New device ID generated: device_xxx"
 *   + "💡 Device ini akan terikat permanen ke akun yang login"
 * - Jika device sudah ada: "📱 Existing device ID loaded: device_xxx"
 *   + "⚠️  Device sudah tersimpan - jika terikat ke user lain, login akan ditolak"
 *
 * RETURN: string - Device ID
 */
export const getDeviceIdSync = () => {
  // Cek localStorage
  let stored = localStorage.getItem("deviceId");

  if (!stored) {
    // DEVICE BARU: Generate fingerprint dan simpan
    const fingerprint = generateDeviceFingerprint();
    stored = `device_${fingerprint}`;
    localStorage.setItem("deviceId", stored);

    console.log("📱 New device ID generated:", stored);
    console.log("💡 Device ini akan terikat permanen ke akun yang login");
  } else {
    // DEVICE SUDAH ADA: Gunakan yang tersimpan
    console.log("📱 Existing device ID loaded:", stored);
    console.log(
      "⚠️  Device sudah tersimpan - jika terikat ke user lain, login akan ditolak",
    );
  }

  return stored;
};

/*
 * FUNCTION: generateDeviceFingerprint (CORE ALGORITHM)
 * ─────────────────────────────────────────────────────────────────────────
 * Generate fingerprint unik dari kombinasi properti browser dan device
 *
 * PROPERTI YANG DIKUMPULKAN:
 * 1. navigator.userAgent - String yang berisi info browser dan OS
 *    Contoh: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
 *
 * 2. navigator.platform - Platform OS
 *    Contoh: "Win32", "MacIntel", "Linux x86_64"
 *
 * 3. navigator.language - Bahasa browser
 *    Contoh: "id-ID", "en-US"
 *
 * 4. Intl.DateTimeFormat().resolvedOptions().timeZone - Timezone
 *    Contoh: "Asia/Jakarta", "America/New_York"
 *
 * 5. screen.width x screen.height - Resolusi layar
 *    Contoh: "1920x1080", "1366x768"
 *
 * 6. screen.colorDepth - Kedalaman warna (bits per pixel)
 *    Contoh: 24, 32
 *
 * 7. navigator.deviceMemory - RAM dalam GB (jika tersedia)
 *    Contoh: 8, 16, null (jika browser tidak support)
 *
 * 8. navigator.hardwareConcurrency - Jumlah logical CPU cores
 *    Contoh: 4, 8, 16
 *
 * 9. navigator.maxTouchPoints - Jumlah titik touchpoint (untuk touchscreen)
 *    Contoh: 0 (desktop), 5 (smartphone), 10 (tablet)
 *
 * ALGORITMA:
 * 1. Gabungkan semua properti dengan separator "|"
 *    Contoh: "Mozilla/5.0...|Win32|id-ID|Asia/Jakarta|1920x1080|24|8|8|0"
 *
 * 2. Hash string kombinasi menggunakan simple hash function
 *    - Loop setiap karakter
 *    - Shift bits kiri 5 posisi
 *    - Subtract hash lama
 *    - Add ASCII code karakter
 *    - Convert ke 32-bit integer
 *
 * 3. Convert hash (angka) ke base-36 string
 *    Base-36 = 0-9 dan a-z (36 karakter)
 *    Contoh hasil: "a3b5c7d9e1f3"
 *
 * 4. Ambil 16 karakter pertama
 *    Contoh final: "a3b5c7d9e1f3g5h7"
 *
 * RETURN: string - Fingerprint (16 karakter alphanumeric)
 *
 * KEUNGGULAN:
 * - Lebih stabil daripada hanya pakai userAgent
 * - Kombinasi banyak properti = lebih unik
 * - Hash deterministic = selalu sama untuk device yang sama
 * - Tidak terpengaruh cookies atau IP address
 *
 * KELEMAHAN:
 * - Ganti browser = fingerprint beda (dianggap device baru)
 * - Update OS atau resolution = mungkin berubah
 * - Clear localStorage = perlu generate lagi (tapi hash akan sama!)
 */
const generateDeviceFingerprint = () => {
  // Kumpulkan semua properti device/browser
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const screenRes = `${screen.width}x${screen.height}`;
  const colorDepth = screen.colorDepth;
  const deviceMemory = navigator.deviceMemory || "";
  const hardwareConcurrency = navigator.hardwareConcurrency || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // Gabungkan semua properti menjadi satu string
  // Separator "|" untuk memisahkan setiap properti
  const combined = [
    userAgent,
    platform,
    language,
    timezone,
    screenRes,
    colorDepth,
    deviceMemory,
    hardwareConcurrency,
    maxTouchPoints,
  ].join("|");

  // Hash string menggunakan simple hash function (djb2-like)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i); // ASCII code dari karakter
    hash = (hash << 5) - hash + char; // (hash * 32) - hash + char
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert hash (number) ke base-36 string dan ambil 16 karakter pertama
  return Math.abs(hash).toString(36).substring(0, 16);
};
