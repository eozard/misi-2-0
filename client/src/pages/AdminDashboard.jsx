/*
 * Admin dashboard: stats, users, devices, attendance, reports, izin actions.
 * Handles admin-only operations like create user, reset password, delete user.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogOut,
  Users,
  BarChart3,
  Download,
  CheckCircle,
  XCircle,
  Loader2,
  Search,
  Trash2,
  Calendar,
} from "lucide-react";
import axiosInstance from "../utils/axios";
import ToastStack from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../hooks/useToast";

const AdminDashboard = () => {
  // State utama untuk tab dan data dashboard
  const [activeTab, setActiveTab] = useState("stats");
  const [stats, setStats] = useState(null);
  const [attendanceToday, setAttendanceToday] = useState([]);
  const [devices, setDevices] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [studentAttendance, setStudentAttendance] = useState([]);
  const [studentSummary, setStudentSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  // State form buat user baru
  const [newUser, setNewUser] = useState({
    nama: "",
    password: "",
    role: "mahasiswa",
    kelompok: "machine learning",
  });
  const [creatingUser, setCreatingUser] = useState(false);
  // State reset password user
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  // State laporan absensi
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({
    fromDate: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0],
    toDate: new Date().toISOString().split("T")[0],
    kelompok: "all",
    nama: "all",
  });
  // State daftar izin
  const [izinList, setIzinList] = useState([]);
  const [izinLoading, setIzinLoading] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  // Notifikasi toast untuk feedback users
  const { toasts, pushToast, dismissToast } = useToast();
  const navigate = useNavigate();

  const kelompokOptions = [
    "machine learning",
    "software engineering",
    "jaringan",
    "desain komunikasi visual",
  ];
  const filteredReportStudents =
    reportFilters.kelompok === "all"
      ? students
      : students.filter(
          (student) => student.kelompok === reportFilters.kelompok,
        );
  const studentRoleByName = Object.fromEntries(
    (students || []).map((student) => [student.nama, student.role]),
  );
  // Ambil semua data dashboard admin sekaligus
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [statsRes, attendanceRes, studentsRes, devicesRes, usersRes] =
        await Promise.all([
          axiosInstance.get("/admin/stats"),
          axiosInstance.get("/admin/attendance-today"),
          axiosInstance.get("/admin/students"),
          axiosInstance.get("/admin/devices"),
          axiosInstance.get("/admin/users"),
        ]);

      if (statsRes.data.success) setStats(statsRes.data.stats);
      if (attendanceRes.data.success)
        setAttendanceToday(attendanceRes.data.data || []);
      if (studentsRes.data.success)
        setStudents(studentsRes.data.students || []);
      if (devicesRes.data.success) setDevices(devicesRes.data.devices || []);
      if (usersRes.data.success) setAllUsers(usersRes.data.users || []);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Cek login admin saat pertama kali masuk
  useEffect(() => {
    // Check auth
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    console.log("🔐 Admin Dashboard - Token check:", {
      hasToken: !!token,
      tokenLength: token?.length,
      user: user?.nama,
      role: user?.role,
    });

    if (!token || !user || user.role !== "admin") {
      console.warn("⚠️ Redirecting to login - auth failed");
      navigate("/");
      return;
    }

    const timer = setTimeout(() => {
      console.log("📡 Starting to fetch admin data...");
      fetchAllData();
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  // Auto-fetch saat tab report/izin dibuka
  useEffect(() => {
    if (activeTab === "report") {
      fetchReportData();
      fetchIzinData(); // Fetch izin data juga saat report dibuka
    }
  }, [activeTab]);

  const fetchStudentAttendance = async (nama) => {
    if (!nama) return;
    try {
      const response = await axiosInstance.get(`/admin/attendance/${nama}`);
      if (response.data.success) {
        setStudentAttendance(response.data.data || []);
        setStudentSummary(response.data.summary);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const handleStudentChange = (nama) => {
    setSelectedStudent(nama);
    fetchStudentAttendance(nama);
  };

  const handleLogout = () => {
    // Clear semua data termasuk deviceId untuk unbind device
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("deviceId");
    console.log("🔓 Logout: Device unbound, localStorage cleared");
    navigate("/");
  };

  // Buat user baru dari form
  const handleCreateUser = async () => {
    if (!newUser.nama || !newUser.password) {
      pushToast({
        type: "warning",
        title: "Input belum lengkap",
        message: "Nama dan password harus diisi",
      });
      return;
    }

    setCreatingUser(true);
    try {
      const response = await axiosInstance.post("/admin/users", {
        nama: newUser.nama,
        password: newUser.password,
        role: newUser.role,
        kelompok: newUser.kelompok,
      });

      if (response.data.success) {
        pushToast({
          type: "success",
          title: "User dibuat",
          message: "User berhasil dibuat",
        });
        setNewUser({
          nama: "",
          password: "",
          role: "mahasiswa",
          kelompok: "kelompok_1",
        });
        fetchAllData();
      } else {
        pushToast({
          type: "error",
          title: "Gagal",
          message: response.data.message || "Gagal membuat user",
        });
      }
    } catch (error) {
      console.error("Create user error:", error);
      pushToast({
        type: "error",
        title: "Gagal",
        message: error.response?.data?.message || "Gagal membuat user",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  // Reset password user terpilih
  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword) {
      pushToast({
        type: "warning",
        title: "Input belum lengkap",
        message: "Pilih user dan isi password baru",
      });
      return;
    }

    setConfirmState({
      title: "Reset password user?",
      message: "Password lama akan diganti dengan yang baru.",
      confirmText: "Reset",
      tone: "danger",
      onConfirm: async () => {
        setResettingPassword(true);
        try {
          const response = await axiosInstance.post(
            `/admin/users/${resetUserId}/reset-password`,
            { password: resetPassword },
          );

          if (response.data.success) {
            pushToast({
              type: "success",
              title: "Reset berhasil",
              message: response.data.message,
            });
            setResetPassword("");
          } else {
            pushToast({
              type: "error",
              title: "Gagal",
              message: response.data.message || "Gagal reset password",
            });
          }
        } catch (error) {
          console.error("Reset password error:", error);
          pushToast({
            type: "error",
            title: "Gagal",
            message: error.response?.data?.message || "Gagal reset password",
          });
        } finally {
          setResettingPassword(false);
        }
      },
    });
  };

  // Hapus device dari daftar binding
  const handleDeleteDevice = async (deviceId) => {
    setConfirmState({
      title: "Hapus device?",
      message: "Device ini akan dihapus dari daftar perangkat terikat.",
      confirmText: "Hapus",
      tone: "danger",
      onConfirm: async () => {
        try {
          const response = await axiosInstance.delete(
            `/admin/devices/${deviceId}`,
          );

          if (response.data.success) {
            pushToast({
              type: "success",
              title: "Device dihapus",
              message: "Device berhasil dihapus",
            });
            setDevices(devices.filter((d) => d.device_id !== deviceId));
          } else {
            pushToast({
              type: "error",
              title: "Gagal",
              message: response.data.message || "Gagal menghapus device",
            });
          }
        } catch (error) {
          console.error("Delete device error:", error);
          pushToast({
            type: "error",
            title: "Gagal",
            message: error.response?.data?.message || "Gagal menghapus device",
          });
        }
      },
    });
  };

  const handleResetUserDevices = async (user) => {
    setConfirmState({
      title: "Reset device user?",
      message: `Semua device untuk ${user.nama} akan dihapus.`,
      confirmText: "Reset",
      tone: "danger",
      onConfirm: async () => {
        try {
          const response = await axiosInstance.post(
            `/admin/users/${user.id}/reset-devices`,
          );

          if (response.data.success) {
            pushToast({
              type: "success",
              title: "Reset berhasil",
              message: "Device user berhasil direset",
            });
            fetchAllData();
          } else {
            pushToast({
              type: "error",
              title: "Gagal",
              message: response.data.message || "Gagal reset device user",
            });
          }
        } catch (error) {
          console.error("Reset user devices error:", error);
          pushToast({
            type: "error",
            title: "Gagal",
            message: error.response?.data?.message || "Gagal reset device user",
          });
        }
      },
    });
  };

  // Hapus user (non-admin) dari sistem
  const handleDeleteUser = async (user) => {
    if (!user?.id) {
      pushToast({
        type: "error",
        title: "Gagal",
        message: "User id tidak ditemukan. Silakan refresh data.",
      });
      return;
    }

    setConfirmState({
      title: "Hapus user?",
      message: `User ${user.nama} akan dihapus permanen.`,
      confirmText: "Hapus",
      tone: "danger",
      onConfirm: async () => {
        try {
          const response = await axiosInstance.delete(
            `/admin/users/${user.id}`,
          );

          if (response.data.success) {
            pushToast({
              type: "success",
              title: "User dihapus",
              message: response.data.message,
            });
            setAllUsers(allUsers.filter((u) => u.id !== user.id));
          } else {
            pushToast({
              type: "error",
              title: "Gagal",
              message: response.data.message || "Gagal menghapus user",
            });
          }
        } catch (error) {
          console.error("Delete user error:", error);
          pushToast({
            type: "error",
            title: "Gagal",
            message: error.response?.data?.message || "Gagal menghapus user",
          });
        }
      },
    });
  };

  // Ambil laporan absensi berdasarkan filter
  async function fetchReportData() {
    setReportLoading(true);
    try {
      const params = new URLSearchParams({
        fromDate: reportFilters.fromDate,
        toDate: reportFilters.toDate,
        kelompok: reportFilters.kelompok,
        nama: reportFilters.nama,
      });

      const response = await axiosInstance.get(`/admin/report?${params}`);

      if (response.data.success) {
        setReportData(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch report error:", error);
      pushToast({
        type: "error",
        title: "Gagal",
        message: "Gagal memuat data report",
      });
    } finally {
      setReportLoading(false);
    }
  }

  // Export laporan ke CSV
  const handleExportReport = () => {
    if (reportData.length === 0) {
      pushToast({
        type: "warning",
        title: "Tidak ada data",
        message: "Tidak ada data untuk diekspor",
      });
      return;
    }

    let csv =
      "\ufeffNama;Role;Jurusan;Tanggal;Sesi;Jam Masuk;Status;Keterangan\r\n";
    reportData.forEach((row) => {
      const tanggal = new Date(row.tanggal).toLocaleDateString("id-ID");
      const tanggalText = `'${tanggal}`;
      const keterangan = row.status === "izin" ? row.keterangan || "" : "";
      const role = studentRoleByName[row.nama] || "-";
      const approvalStatus = (row.status_approval || "pending").toLowerCase();
      const izinLabel =
        approvalStatus === "approved"
          ? "Izin Diterima"
          : approvalStatus === "rejected"
            ? "Izin Ditolak"
            : "Izin Pending";
      const sesiText = row.status === "izin" ? izinLabel : row.sesi;
      const statusText = row.status === "izin" ? izinLabel : row.status;
      csv += `"${row.nama}";"${role}";"${row.kelompok}";"${tanggalText}";"${sesiText}";"${row.jam_masuk}";"${statusText}";"${keterangan}"\r\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `report-absensi-${reportFilters.fromDate}-to-${reportFilters.toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    pushToast({
      type: "success",
      title: "Export siap",
      message: "File report berhasil dibuat",
    });
  };

  // Ambil daftar izin untuk approval
  async function fetchIzinData() {
    setIzinLoading(true);
    try {
      const response = await axiosInstance.get("/admin/izin");
      if (response.data.success) {
        setIzinList(response.data.data || []);
      }
    } catch (error) {
      console.error("Fetch izin error:", error);
    } finally {
      setIzinLoading(false);
    }
  }

  // Setujui / tolak izin
  const handleUpdateIzin = async (id, status) => {
    const confirmMsg =
      status === "approved" ? "Setujui izin ini?" : "Tolak izin ini?";

    setConfirmState({
      title: status === "approved" ? "Setujui izin?" : "Tolak izin?",
      message: confirmMsg,
      confirmText: status === "approved" ? "Setujui" : "Tolak",
      tone: status === "approved" ? "primary" : "danger",
      onConfirm: async () => {
        try {
          const response = await axiosInstance.put(`/admin/izin/${id}`, {
            status,
          });
          if (response.data.success) {
            pushToast({
              type: "success",
              title: "Berhasil",
              message: response.data.message,
            });
            fetchIzinData();
          }
        } catch (error) {
          const msg = error.response?.data?.message || "Gagal update izin";
          pushToast({
            type: "error",
            title: "Gagal",
            message: msg,
          });
        }
      },
    });
  };

  // Export rekap absensi hari ini ke CSV
  const handleExport = () => {
    let csv = "\ufeffNama;Kelompok;Pagi;Sore;Status\r\n";
    attendanceToday.forEach((row) => {
      const pagiTime = row.pagi?.jam_masuk || "-";
      const soreTime = row.sore?.jam_masuk || "-";
      const status = row.pagi?.status || row.sore?.status || "Belum absen";
      csv += `"${row.nama}";"${row.kelompok}";"${pagiTime}";"${soreTime}";"${status}"\r\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `absensi-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredAttendance = attendanceToday.filter((item) => {
    const matchesSearch =
      item.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.kelompok.toLowerCase().includes(searchTerm.toLowerCase());

    if (filter === "hadir") {
      return (
        matchesSearch &&
        (item.pagi?.status === "hadir" || item.sore?.status === "hadir")
      );
    }
    return matchesSearch;
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
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Kelola sistem absensi PKL</p>
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
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex space-x-8">
            {["stats", "devices", "students", "report"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium transition ${
                  activeTab === tab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "izin"
                  ? "Izin"
                  : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Tab */}
        {activeTab === "stats" && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Mahasiswa</p>
                  <p className="text-3xl font-bold">{stats.totalMahasiswa}</p>
                </div>
                <Users className="w-12 h-12 text-blue-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Anak SMK</p>
                  <p className="text-3xl font-bold">{stats.totalAnakSmk}</p>
                </div>
                <Users className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Hadir Hari Ini</p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.hadirToday}
                  </p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Izin Hari Ini</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {stats.izinToday}
                  </p>
                </div>
                <Calendar className="w-12 h-12 text-yellow-600" />
              </div>
            </div>
          </div>
        )}

        {/* Devices Tab */}
        {activeTab === "devices" && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="text-xl font-bold mb-4">📱 Daftar Device</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Device ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Kelompok
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Last Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {devices.length > 0 ? (
                      devices.map((device, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-mono text-gray-900 break-all">
                            {device.device_id}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">
                            {device.user_name}
                          </td>
                          <td className="px-6 py-4 text-sm capitalize">
                            {device.kelompok}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(device.last_used).toLocaleDateString(
                              "id-ID",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() =>
                                handleDeleteDevice(device.device_id)
                              }
                              className="text-red-600 hover:text-red-800 flex items-center"
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          Belum ada device
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === "attendance" && (
          <div className="space-y-4">
            {/* Filter & Search */}
            <div className="card">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cari nama atau kelompok..."
                    className="input-field pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="input-field"
                >
                  <option value="all">Semua</option>
                  <option value="hadir">Hadir</option>
                </select>

                <button
                  onClick={handleExport}
                  className="btn-success flex items-center whitespace-nowrap"
                >
                  <Download className="w-4 h-4 mr-2" /> Export
                </button>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Absensi Hari Ini</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nama
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Kelompok
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Pagi
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Sore
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Keterangan
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAttendance.length > 0 ? (
                      filteredAttendance.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium">
                            {item.nama}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                            {item.kelompok}
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            {item.pagi ? (
                              <span className="badge-green">
                                {item.pagi.jam_masuk}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-sm">
                            {item.sore ? (
                              <span className="badge-green">
                                {item.sore.jam_masuk}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {item.pagi?.status === "hadir" ||
                            item.sore?.status === "hadir" ? (
                              <span className="badge-green">Hadir</span>
                            ) : (
                              <span className="badge-red">Alpa</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          Tidak ada data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Students Tab */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {/* Create User Form */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">➕ Buat User Baru</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">Nama</label>
                  <input
                    type="text"
                    placeholder="Nama user"
                    className="input-field"
                    value={newUser.nama}
                    onChange={(e) =>
                      setNewUser({ ...newUser, nama: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Password"
                    className="input-field"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select
                    className="input-field"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value })
                    }
                  >
                    <option value="mahasiswa">Mahasiswa</option>
                    <option value="anak_smk">Anak SMK</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Kelompok
                  </label>
                  <select
                    className="input-field"
                    value={newUser.kelompok}
                    onChange={(e) =>
                      setNewUser({ ...newUser, kelompok: e.target.value })
                    }
                  >
                    {kelompokOptions.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleCreateUser}
                  disabled={creatingUser}
                  className="btn-success flex items-center justify-center"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Membuat
                    </>
                  ) : (
                    "Buat User"
                  )}
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4">🔒 Reset Password User</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">User</label>
                  <select
                    className="input-field"
                    value={resetUserId}
                    onChange={(e) => setResetUserId(e.target.value)}
                  >
                    <option value="">Pilih user</option>
                    {allUsers.map((user) => (
                      <option key={user.id || user.nama} value={user.id || ""}>
                        {user.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    placeholder="Password baru"
                    className="input-field"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                  className="btn-danger flex items-center justify-center"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Resetting
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </div>
            </div>

            {/* Users List */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">👥 Daftar Semua User</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nama
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Kelompok
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Device Terdaftar (Terpakai/Maks)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {allUsers.length > 0 ? (
                      allUsers.map((user) => (
                        <tr
                          key={user.id || user.nama}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 text-sm font-medium">
                            {user.nama}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span
                              className={
                                user.role === "admin"
                                  ? "badge-purple"
                                  : user.role === "mahasiswa"
                                    ? "badge-blue"
                                    : "badge-green"
                              }
                            >
                              {user.role === "admin"
                                ? "Admin"
                                : user.role === "mahasiswa"
                                  ? "Mahasiswa"
                                  : "Anak SMK"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm capitalize">
                            {user.kelompok || "-"}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {user.role === "admin"
                              ? "-"
                              : `${user.devices_count ?? 0}/${user.max_devices ?? 0}`}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {user.role === "admin" ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
                                title="Hapus user"
                              >
                                <Trash2 className="w-4 h-4 mr-1" /> Hapus
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          Belum ada user
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Old Attendance History Section (if needed) */}
            {selectedStudent && (
              <div className="card">
                <h2 className="text-xl font-bold mb-4">
                  Riwayat Absensi {selectedStudent}
                </h2>
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
                      {studentAttendance.length > 0 ? (
                        studentAttendance.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-6 py-4 text-sm">
                              {new Date(item.tanggal).toLocaleDateString(
                                "id-ID",
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm capitalize font-medium">
                              {item.sesi}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {item.jam_masuk}
                            </td>
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
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {isIzin ? item.keterangan || "-" : "-"}
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
            )}
          </div>
        )}

        {/* Izin Tab */}
        {/* Report Tab */}
        {activeTab === "report" && (
          <div className="space-y-4">
            {/* Filter Card */}
            <div className="card">
              <h2 className="text-xl font-bold mb-4">🔍 Filter Absensi</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Dari Tanggal
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      className="input-field pl-10"
                      value={reportFilters.fromDate}
                      onChange={(e) =>
                        setReportFilters({
                          ...reportFilters,
                          fromDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Sampai Tanggal
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      className="input-field pl-10"
                      value={reportFilters.toDate}
                      onChange={(e) =>
                        setReportFilters({
                          ...reportFilters,
                          toDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Kelompok
                  </label>
                  <select
                    className="input-field"
                    value={reportFilters.kelompok}
                    onChange={(e) => {
                      const nextKelompok = e.target.value;
                      const nextStudents =
                        nextKelompok === "all"
                          ? students
                          : students.filter(
                              (student) => student.kelompok === nextKelompok,
                            );
                      const namaStillValid =
                        reportFilters.nama === "all" ||
                        nextStudents.some(
                          (student) => student.nama === reportFilters.nama,
                        );

                      setReportFilters({
                        ...reportFilters,
                        kelompok: nextKelompok,
                        nama: namaStillValid ? reportFilters.nama : "all",
                      });
                    }}
                  >
                    <option value="all">Semua Kelompok</option>
                    {kelompokOptions.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Siswa
                  </label>
                  <select
                    className="input-field"
                    value={reportFilters.nama}
                    onChange={(e) =>
                      setReportFilters({
                        ...reportFilters,
                        nama: e.target.value,
                      })
                    }
                  >
                    <option value="all">Semua Siswa</option>
                    {filteredReportStudents.map((student) => (
                      <option key={student.nama} value={student.nama}>
                        {student.nama}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={fetchReportData}
                  disabled={reportLoading}
                  className="btn-primary flex items-center justify-center"
                >
                  {reportLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Filter
                    </>
                  ) : (
                    "Filter"
                  )}
                </button>
              </div>
            </div>

            {/* Report Data Card */}
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  📋 Data Absensi ({reportData.length})
                </h2>
                <button
                  onClick={handleExportReport}
                  disabled={reportData.length === 0}
                  className="btn-success flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" /> Export Excel
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nama
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Jurusan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Tanggal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Sesi
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Jam Masuk
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Keterangan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {reportData.length > 0 ? (
                      reportData.map((item, idx) => {
                        const normalizedApproval = (item.status_approval || "")
                          .toLowerCase()
                          .trim();
                        const isIzin = item.status === "izin";
                        const approvalLabel =
                          normalizedApproval === "approved"
                            ? "Izin Disetujui"
                            : normalizedApproval === "rejected"
                              ? "Izin Ditolak"
                              : normalizedApproval === "cancelled"
                                ? "Izin Dibatalkan"
                                : "Izin Pending";

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium">
                              {item.nama}
                            </td>
                            <td className="px-6 py-4 text-sm capitalize">
                              {studentRoleByName[item.nama] || "-"}
                            </td>
                            <td className="px-6 py-4 text-sm capitalize">
                              {item.kelompok}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {new Date(item.tanggal).toLocaleDateString(
                                "id-ID",
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm capitalize font-medium">
                              {item.sesi}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {item.jam_masuk}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={
                                  isIzin
                                    ? normalizedApproval === "approved"
                                      ? "badge-green"
                                      : normalizedApproval === "rejected"
                                        ? "badge-red"
                                        : normalizedApproval === "cancelled"
                                          ? "badge-blue"
                                          : "badge-yellow"
                                    : item.status === "hadir"
                                      ? "badge-green"
                                      : "badge-red"
                                }
                              >
                                {isIzin
                                  ? approvalLabel
                                  : item.status.charAt(0).toUpperCase() +
                                    item.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {item.keterangan || "-"}
                            </td>
                            <td className="px-6 py-4">
                              {item.status === "izin" ? (
                                normalizedApproval === "approved" ||
                                normalizedApproval === "rejected" ||
                                normalizedApproval === "cancelled" ? (
                                  <span className="text-sm text-gray-500">
                                    {item.approved_by
                                      ? `oleh ${item.approved_by}`
                                      : "-"}
                                  </span>
                                ) : (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleUpdateIzin(item.id, "approved")
                                      }
                                      className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center"
                                      title="Setujui"
                                    >
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Setujui
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleUpdateIzin(item.id, "rejected")
                                      }
                                      className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center"
                                      title="Tolak"
                                    >
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Tolak
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan="7"
                          className="px-6 py-4 text-center text-gray-500"
                        >
                          Klik "Filter" untuk menampilkan data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
