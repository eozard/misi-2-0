/*
 * Axios client with baseURL and auth token interceptor.
 */
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Public endpoints yang tidak butuh token
const PUBLIC_ENDPOINTS = [
  "/login",
  "/check-ip",
  "/pendaftaran",
  "/admin-pendaftaran/login",
];

// Add token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    // Don't require token for public endpoints
    if (PUBLIC_ENDPOINTS.includes(config.url)) {
      return config;
    }

    // Untuk endpoint admin-pendaftaran (kecuali login), pakai token admin pendaftaran
    let token = null;
    if (config.url?.startsWith("/admin-pendaftaran")) {
      token = localStorage.getItem("adminPendaftaranToken");
    } else {
      token = localStorage.getItem("token");
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log(
        "✅ Token attached to:",
        config.url,
        "(length:",
        token.length,
        ")",
      );
    } else {
      console.warn("⚠️  NO TOKEN for protected request:", config.url);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Handle response errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error("❌ 401 Unauthorized - clearing token and redirecting");
      // Hanya bersihkan token user biasa, jangan bersihkan adminPendaftaranToken
      // agar tidak force-logout admin pendaftaran di tab berbeda
      const isAdminPendaftaranEndpoint = error.config?.url?.startsWith(
        "/admin-pendaftaran",
      );
      if (isAdminPendaftaranEndpoint) {
        localStorage.removeItem("adminPendaftaranToken");
        localStorage.removeItem("adminPendaftaranUser");
        // Jangan redirect otomatis, biar AdminPendaftaran page handle UI-nya
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
