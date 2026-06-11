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

// Add token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    // Don't require token for public endpoints
    if (config.url === "/login" || config.url === "/check-ip") {
      return config;
    }

    const token = localStorage.getItem("token");
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
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
