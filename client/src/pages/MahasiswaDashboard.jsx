/*
 * Mahasiswa dashboard: absensi, riwayat, izin, WiFi check, and notifications.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import axiosInstance from "../utils/axios";
import ToastStack from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../hooks/useToast";

const MahasiswaDashboard = () => {
  const bypassMode = import.meta.env.VITE_BYPASS_TIME_CHECK === "true";
  const bypassPagiOnly = import.meta.env.VITE_BYPASS_PAGI_ONLY === "true";

  // State utama untuk user dan data absensi
  const [user, setUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [absenLoading, setAbsenLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(10 * 60);
  const [canAbsenPagi, setCanAbsenPagi] = useState(false);
  const [canAbsenSore, setCanAbsenSore] = useState(false);
  // State modal dan data izin
  const [showIzinModal, setShowIzinModal] = useState(false);
  const [izinData, setIzinData] = useState({
    keterangan: "",
  });
  const [izinList, setIzinList] = useState([]);
  const [izinLoading, setIzinLoading] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  // Notifikasi toast untuk feedback user
  const { toasts, pushToast, dismissToast } = useToast();
  const navigate = useNavigate();

  // Cek login dan ambil data awal
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user") || "null");
    const token = localStorage.getItem("token");

    if (!storedUser || !token) {
      navigate("/");
      return;
    }

    setUser(storedUser);

    console.log("🔐 Dashboard Load:", {
      user: storedUser?.nama,
    });

    // Small delay to ensure localStorage is fully written
    setTimeout(() => {
      fetchRiwayat();
      fetchIzin();
    }, 150);
  }, []);

  // Update status waktu absen setiap detik
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // PENTING: Hitung waktu dengan timezone Jakarta (UTC+7) berbasis UTC
      // agar tidak double-offset saat device user sudah berada di timezone WIB.
      const hours = (now.getUTCHours() + 7) % 24;
      const minutes = now.getUTCMinutes();
      const seconds = now.getUTCSeconds();

      // Check session times
      const timeInMinutes = hours * 60 + minutes;
      const pagiStart = 8 * 60;
      const pagiEnd = 10 * 60;
      const soreStart = 15 * 60;
      const soreEnd = 17 * 60;

      // DEVELOPMENT: Untuk test/trial and error, gunakan env Vite untuk unlock tombol
      // Backend tetap akan validate dengan BYPASS_TIME_CHECK=true
      if (bypassPagiOnly) {
        // Mode bypass pagi-only: hanya allow absen pagi
        setCanAbsenPagi(true);
        setCanAbsenSore(false);
        console.log("🔄 Frontend bypass mode ON - pagi only");
      } else if (bypassMode) {
        // Mode bypass: selalu allow absen
        setCanAbsenPagi(true);
        setCanAbsenSore(true);
        console.log("🔄 Frontend bypass mode ON - selalu allow absen");
      } else {
        // Mode normal: validasi jam ketat
        setCanAbsenPagi(timeInMinutes >= pagiStart && timeInMinutes <= pagiEnd);
        setCanAbsenSore(timeInMinutes >= soreStart && timeInMinutes <= soreEnd);
      }

      // Calculate time remaining (10 min window)
      const nextHour = hours + 1;
      const nextTime = new Date();
      nextTime.setHours(nextHour, 0, 0);
      const remaining = Math.max(0, Math.floor((nextTime - now) / 1000));
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Ambil riwayat absensi user
  const fetchRiwayat = async () => {
    try {
      const response = await axiosInstance.get("/riwayat");
      if (response.data.success) {
        setHistory(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Ambil daftar izin user
  const fetchIzin = async () => {
    try {
      const response = await axiosInstance.get("/izin");
      if (response.data.success) {
        setIzinList(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch izin error:", error);
    }
  };

  // Batalkan izin yang masih pending
  const handleCancelIzin = async (id) => {
    setConfirmState({
      title: "Batalkan izin?",
      message: "Izin ini akan dibatalkan dan tidak bisa dikembalikan.",
      confirmText: "Batalkan",
      tone: "danger",
      onConfirm: async () => {
        try {
          const response = await axiosInstance.delete(`/izin/${id}`);
          if (response.data.success) {
            pushToast({
              type: "success",
              title: "Izin dibatalkan",
              message: response.data.message,
            });
            fetchIzin();
          }
        } catch (error) {
          const msg = error.response?.data?.message || "Gagal membatalkan izin";
          pushToast({
            type: "error",
            title: "Gagal",
            message: msg,
          });
        }
      },
    });
  };

  // Proses absen: cek WiFi, kirim login_time
  const handleAbsen = async (sesi) => {
    setAbsenLoading(true);

    try {
      const deviceId = localStorage.getItem("deviceId") || "device_unknown";
      const now = new Date();

      // Check WiFi sebelum absen
      const wifiCheck = await axiosInstance.get("/check-ip");
      if (!wifiCheck.data?.isWiFiKampus) {
        const msg =
          wifiCheck.data?.message ||
          "Absensi hanya dapat dilakukan dari WiFi Sekolah";
        pushToast({
          type: "warning",
          title: "WiFi tidak sesuai",
          message: msg,
        });
        return;
      }

      const response = await axiosInstance.post("/absen", {
        login_time: now.toISOString(),
        deviceId,
      });

      if (response.data.success) {
        pushToast({
          type: "success",
          title: "Absensi berhasil",
          message: response.data.message,
        });
        fetchRiwayat();
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Absen gagal";
      pushToast({
        type: "error",
        title: "Absen gagal",
        message: msg,
      });
      console.error("Absen error:", msg);
    } finally {
      setAbsenLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear semua data termasuk deviceId untuk unbind device
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("deviceId");
    console.log("🔓 Logout: Device unbound, localStorage cleared");
    navigate("/");
  };

  // Kirim izin baru
  const handleSubmitIzin = async (e) => {
    e.preventDefault();
    setIzinLoading(true);

    try {
      const response = await axiosInstance.post("/izin", izinData);

      if (response.data.success) {
        pushToast({
          type: "success",
          title: "Izin terkirim",
          message: response.data.message,
        });
        setShowIzinModal(false);
        setIzinData({ keterangan: "" });
        fetchIzin();
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Gagal mengajukan izin";
      pushToast({
        type: "error",
        title: "Izin gagal",
        message: msg,
      });
      console.error("Izin error:", msg);
    } finally {
      setIzinLoading(false);
    }
  };

  // Helper untuk menampilkan sesi saat ini
  const getCurrentSession = () => {
    const now = new Date();
    // PENTING: Hitung waktu dengan timezone Jakarta (UTC+7) berbasis UTC
    // agar konsisten lintas timezone client.
    const hours = (now.getUTCHours() + 7) % 24;
    const minutes = now.getUTCMinutes();
    const timeInMinutes = hours * 60 + minutes;

    if (timeInMinutes >= 8 * 60 && timeInMinutes <= 10 * 60) {
      return "Pagi";
    } else if (timeInMinutes >= 15 * 60 && timeInMinutes <= 17 * 60) {
      return "Sore";
    }
    return "Diluar Jam Absen";
  };

  const hadiruTodayPagi = history.some((h) => {
    const hDate = new Date(h.tanggal);
    const today = new Date();
    return (
      hDate.toDateString() === today.toDateString() &&
      h.sesi === "pagi" &&
      h.status === "hadir"
    );
  });

  const hadirTodaySore = history.some((h) => {
    const hDate = new Date(h.tanggal);
    const today = new Date();
    return (
      hDate.toDateString() === today.toDateString() &&
      h.sesi === "sore" &&
      h.status === "hadir"
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmText={confirmState?.confirmText}
        cancelText={confirmState?.cancelText}
        tone={confirmState?.tone}
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          const action = confirmState?.onConfirm;
          setConfirmState(null);
          if (action) await action();
        }}
      />
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Dashboard Mahasiswa</h1>
              <p className="text-sm text-gray-600">
                Selamat datang,{" "}
                <span className="font-semibold">{user?.nama}</span>
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Timer */}
          <div className="card">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Jam Sekarang</p>
                <p className="text-2xl font-bold text-blue-600">
                  {new Date().toLocaleTimeString("id-ID")}
                </p>
              </div>
            </div>
          </div>

          {/* Kelompok */}
          <div className="card">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Kelompok</p>
                <p className="text-xl font-semibold capitalize">
                  {user?.kelompok}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Absensi Card */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Absensi Hari Ini</h2>

          {/* DEBUG INFO */}
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 text-xs font-mono">
            <p className="font-bold mb-2 text-yellow-900">🔍 DEBUG INFO:</p>
            <div className="grid grid-cols-2 gap-2 text-yellow-800">
              <div>Jam: {new Date().toLocaleTimeString("id-ID")}</div>
              <div>
                Bisa Absen Pagi:{" "}
                <span
                  className={canAbsenPagi ? "text-green-600" : "text-red-600"}
                >
                  {canAbsenPagi ? "✅" : "❌"}
                </span>
              </div>
              <div>
                Bisa Absen Sore:{" "}
                <span
                  className={canAbsenSore ? "text-green-600" : "text-red-600"}
                >
                  {canAbsenSore ? "✅" : "❌"}
                </span>
              </div>
              <div>
                Sudah Absen Pagi:{" "}
                <span
                  className={
                    hadiruTodayPagi ? "text-green-600" : "text-gray-600"
                  }
                >
                  {hadiruTodayPagi ? "✅" : "❌"}
                </span>
              </div>
              <div>
                Sudah Absen Sore:{" "}
                <span
                  className={
                    hadirTodaySore ? "text-green-600" : "text-gray-600"
                  }
                >
                  {hadirTodaySore ? "✅" : "❌"}
                </span>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleAbsen("pagi")}
              disabled={!canAbsenPagi || hadiruTodayPagi || absenLoading}
              title={
                !canAbsenPagi
                  ? "Diluar jam absen pagi"
                  : hadiruTodayPagi
                    ? "Sudah absen pagi"
                    : ""
              }
              className={`btn-primary flex items-center justify-center py-3 ${
                hadiruTodayPagi ? "opacity-50" : ""
              }`}
            >
              {absenLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {hadiruTodayPagi ? (
                    <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 mr-2" />
                  )}
                  {hadiruTodayPagi ? "Sudah Absen Pagi" : "Absen Pagi"}
                </>
              )}
            </button>

            <button
              onClick={() => handleAbsen("sore")}
              disabled={
                !canAbsenSore ||
                !hadiruTodayPagi ||
                hadirTodaySore ||
                absenLoading
              }
              title={
                !canAbsenSore
                  ? "Diluar jam absen sore"
                  : !hadiruTodayPagi
                    ? "Harus absen pagi dulu"
                    : hadirTodaySore
                      ? "Sudah absen sore"
                      : ""
              }
              className={`btn-primary flex items-center justify-center py-3 ${
                hadirTodaySore ? "opacity-50" : ""
              }`}
            >
              {absenLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {hadirTodaySore ? (
                    <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 mr-2" />
                  )}
                  {hadirTodaySore ? "Sudah Absen Sore" : "Absen Sore"}
                </>
              )}
            </button>
          </div>

          {/* Tombol Izin */}
          <button
            onClick={() => setShowIzinModal(true)}
            className="btn-secondary w-full flex items-center justify-center py-3 mt-4"
          >
            <FileText className="w-5 h-5 mr-2" />
            Ajukan Izin
          </button>

          <p className="text-xs text-gray-500 mt-4 text-center">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            08.00-10.00 | 15.00-17.00
          </p>
        </div>

        {/* Riwayat Absensi */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Riwayat Absensi</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Sesi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Jam
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {history.length > 0 ? (
                  history.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm">
                        {new Date(item.tanggal).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-sm capitalize font-medium">
                        {item.sesi}
                      </td>
                      <td className="px-6 py-4 text-sm">{item.jam_masuk}</td>
                      <td className="px-6 py-4">
                        <span
                          className={
                            item.status === "hadir"
                              ? "badge-green"
                              : item.status === "izin_approved"
                                ? "badge-yellow"
                                : "badge-red"
                          }
                        >
                          {item.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Belum ada riwayat absensi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Riwayat Izin */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Riwayat Izin</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {izinList.length > 0 ? (
                  izinList.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm">
                        {new Date(item.tanggal).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-6 py-4 text-sm">{item.keterangan}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const status = (item.status_approval || "")
                            .toLowerCase()
                            .trim();
                          const badgeClass =
                            status === "approved"
                              ? "badge-green"
                              : status === "rejected"
                                ? "badge-red"
                                : status === "cancelled"
                                  ? "badge-blue"
                                  : "badge-yellow";
                          const label =
                            status === "approved"
                              ? "Disetujui"
                              : status === "rejected"
                                ? "Ditolak"
                                : status === "cancelled"
                                  ? "Dibatalkan"
                                  : "Pending";
                          return <span className={badgeClass}>{label}</span>;
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        {(item.status_approval === "pending" ||
                          !item.status_approval) && (
                          <button
                            onClick={() => handleCancelIzin(item.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Batalkan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      Belum ada riwayat izin
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Izin */}
      {showIzinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-xl font-bold">Ajukan Izin</h3>
              <button
                onClick={() => setShowIzinModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitIzin} className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  📅 Izin untuk hari ini:{" "}
                  <strong>{new Date().toLocaleDateString("id-ID")}</strong>
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keterangan Izin
                </label>
                <textarea
                  value={izinData.keterangan}
                  onChange={(e) =>
                    setIzinData({ ...izinData, keterangan: e.target.value })
                  }
                  className="input-field"
                  rows="4"
                  placeholder="Alasan izin (sakit, keperluan keluarga, dll.)"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowIzinModal(false)}
                  className="btn-secondary flex-1"
                  disabled={izinLoading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center"
                  disabled={izinLoading}
                >
                  {izinLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Submit Izin"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MahasiswaDashboard;
