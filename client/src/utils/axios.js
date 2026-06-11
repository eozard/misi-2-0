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

const isAdminPendaftaran = (url) =>
  typeof url === "string" && url.startsWith("/admin-pendaftaran");

// Add token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const reqUrl = config.url || "";

    // Skip token attach untuk public endpoints
    if (PUBLIC_ENDPOINTS.includes(reqUrl)) {
      return config;
    }

    // Untuk endpoint admin-pendaftaran (kecuali login), pakai token admin pendaftaran
    let token = null;
    if (isAdminPendaftaran(reqUrl)) {
      token = localStorage.getItem("adminPendaftaranToken");
    } else {
      token = localStorage.getItem("token");
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
      // Untuk endpoint admin-pendaftaran, JANGAN redirect ke "/"
      // cukup bersihkan token; halaman AdminPendaftaran akan render form login lagi
      const reqUrl = error.config?.url || "";
      if (isAdminPendaftaran(reqUrl)) {
        localStorage.removeItem("adminPendaftaranToken");
        localStorage.removeItem("adminPendaftaranUser");
        // Tidak redirect; component AdminPendaftaran mendeteksi token hilang
        // dan otomatis switch ke tampilan login.
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
