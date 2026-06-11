/*
 * Halaman dashboard untuk admin_pendaftaran (/admin_pendaftaran)
 *
 * Fitur:
 * - Login admin_pendaftaran (akun terpisah dari users biasa)
 * - Lihat statistik pendaftar (total, priority, outside, per divisi)
 * - Lihat list pendaftar (bisa filter: priority / outside / per divisi)
 * - Lihat detail pendaftar + file yang diupload (CV, transkrip, surat)
 * - Assign pendaftar ke divisi (dengan validasi max 6 per divisi)
 * - Hapus pendaftar (termasuk file PDF di server)
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogIn,
  LogOut,
  Loader2,
  Users,
  UserCheck,
  Clock,
  Trash2,
  Download,
  FileText,
  Network,
  Code,
  Palette,
  Brain,
  BarChart3,
  X,
  UserPlus,
  Home,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../utils/axios";
import ToastStack from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../hooks/useToast";

const DIVISI_OPTIONS = [
  { value: "networking", label: "Networking", icon: Network, color: "blue", text: "text-blue-600" },
  { value: "software_engineer", label: "Software Engineer", icon: Code, color: "indigo", text: "text-indigo-600" },
  { value: "multimedia", label: "Multimedia", icon: Palette, color: "pink", text: "text-pink-600" },
  { value: "ai", label: "Artificial Intelligence", icon: Brain, color: "purple", text: "text-purple-600" },
  { value: "data_analyst", label: "Data Analyst", icon: BarChart3, color: "emerald", text: "text-emerald-600" },
];

const AdminPendaftaran = () => {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [stats, setStats] = useState(null);
  const [pendaftar, setPendaftar] = useState([]);
  const [filterCategory, setFilterCategory] = useState("priority");
  const [filterDivisi, setFilterDivisi] = useState("all");
  const [loadingData, setLoadingData] = useState(false);
  const [selectedPendaftar, setSelectedPendaftar] = useState(null);
  const [pendaftarFiles, setPendaftarFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const { toasts, pushToast, dismissToast } = useToast();

  // Cek token di localStorage saat mount
  useEffect(() => {
    const token = localStorage.getItem("adminPendaftaranToken");
    const stored = JSON.parse(localStorage.getItem("adminPendaftaranUser") || "null");
    if (token && stored) {
      setAdmin(stored);
    }
    setAuthChecked(true);
  }, []);

  // Fetch data saat admin sudah login
  useEffect(() => {
    if (admin) {
      fetchStats();
      fetchPendaftar();
    }
  }, [admin, filterCategory, filterDivisi]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    if (!loginForm.username || !loginForm.password) {
      setLoginError("Username dan password wajib diisi");
      return;
    }
    setLoginLoading(true);
    try {
      const response = await axiosInstance.post(
        "/admin-pendaftaran/login",
        loginForm,
      );
      if (response.data.success) {
        localStorage.setItem(
          "adminPendaftaranToken",
          response.data.token,
        );
        localStorage.setItem(
          "adminPendaftaranUser",
          JSON.stringify(response.data.admin),
        );
        setAdmin(response.data.admin);
      }
    } catch (err) {
      setLoginError(
        err.response?.data?.message || "Login gagal, periksa kredensial Anda",
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminPendaftaranToken");
    localStorage.removeItem("adminPendaftaranUser");
    setAdmin(null);
    setPendaftar([]);
    setStats(null);
  };

  const fetchStats = async () => {
    try {
      const res = await axiosInstance.get("/admin-pendaftaran/stats");
      if (res.data.success) setStats(res.data.stats);
    } catch (err) {
      console.error("Fetch stats error:", err);
    }
  };

  const fetchPendaftar = async () => {
    setLoadingData(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== "all") params.append("category", filterCategory);
      if (filterDivisi !== "all") params.append("divisi", filterDivisi);
      const res = await axiosInstance.get(
        `/admin-pendaftaran/pendaftar?${params.toString()}`,
      );
      if (res.data.success) setPendaftar(res.data.data || []);
    } catch (err) {
      console.error("Fetch pendaftar error:", err);
      pushToast({
        type: "error",
        title: "Gagal",
        message: "Gagal memuat data pendaftar",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const openDetail = async (p) => {
    setSelectedPendaftar(p);
    setPendaftarFiles([]);
    setLoadingFiles(true);
    try {
      const res = await axiosInstance.get(
        `/admin-pendaftaran/files/${p.id}`,
      );
      if (res.data.success) setPendaftarFiles(res.data.data || []);
    } catch (err) {
      console.error("Fetch files error:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  const closeDetail = () => {
    setSelectedPendaftar(null);
    setPendaftarFiles([]);
  };

  const handleAssign = async (pendaftarId, divisi) => {
    if (!divisi) {
      pushToast({
        type: "warning",
        title: "Pilih divisi",
        message: "Pilih divisi terlebih dahulu",
      });
      return;
    }
    setAssigning(true);
    try {
      const res = await axiosInstance.post("/admin-pendaftaran/assign", {
        pendaftar_id: pendaftarId,
        divisi_assigned: divisi,
      });
      if (res.data.success) {
        pushToast({
          type: "success",
          title: "Berhasil",
          message: res.data.message,
        });
        // Update local state
        setPendaftar((prev) =>
          prev.map((p) =>
            p.id === pendaftarId
              ? {
                  ...p,
                  divisi_assigned: divisi,
                  status: "assigned",
                }
              : p,
          ),
        );
        if (selectedPendaftar?.id === pendaftarId) {
          setSelectedPendaftar({
            ...selectedPendaftar,
            divisi_assigned: divisi,
            status: "assigned",
          });
        }
        fetchStats();
      }
    } catch (err) {
      pushToast({
        type: "error",
        title: "Gagal",
        message: err.response?.data?.message || "Gagal assign pendaftar",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = (p) => {
    setConfirmState({
      title: "Hapus pendaftar?",
      message: `Pendaftar ${p.nama} (NIM: ${p.nim}) dan semua file-nya akan dihapus permanen.`,
      confirmText: "Hapus",
      tone: "danger",
      onConfirm: async () => {
        try {
          const res = await axiosInstance.delete(
            `/admin-pendaftaran/pendaftar/${p.id}`,
          );
          if (res.data.success) {
            pushToast({
              type: "success",
              title: "Dihapus",
              message: res.data.message,
            });
            setPendaftar((prev) => prev.filter((x) => x.id !== p.id));
            if (selectedPendaftar?.id === p.id) closeDetail();
            fetchStats();
          }
        } catch (err) {
          pushToast({
            type: "error",
            title: "Gagal",
            message:
              err.response?.data?.message || "Gagal menghapus pendaftar",
          });
        }
      },
    });
  };

  const handleDownload = (fileId) => {
    const token = localStorage.getItem("adminPendaftaranToken");
    // Use plain anchor for download (browser handles auth via URL param approach below)
    const url = `${axiosInstance.defaults.baseURL}/admin-pendaftaran/file/${fileId}/download?token=${token}`;
    window.open(url, "_blank");
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Tampilan login
  if (!admin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Admin Pendaftaran
            </h1>
            <p className="text-gray-600">Login untuk mengelola pendaftar</p>
          </div>

          <div className="card">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Username admin"
                  value={loginForm.username}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, username: e.target.value })
                  }
                  disabled={loginLoading}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Password"
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  disabled={loginLoading}
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center"
                disabled={loginLoading}
              >
                {loginLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" /> Login
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate("/pendaftaran")}
                className="btn-secondary w-full flex items-center justify-center"
                disabled={loginLoading}
              >
                <UserPlus className="w-4 h-4 mr-2" /> Halaman Pendaftaran
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan dashboard admin
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
              <h1 className="text-2xl font-bold">Admin Pendaftaran</h1>
              <p className="text-sm text-gray-600">
                Login sebagai: <strong>{admin.nama}</strong> ({admin.username})
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/pendaftaran")}
                className="btn-secondary flex items-center"
                title="Lihat halaman pendaftaran publik"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Form Pendaftaran
              </button>
              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Statistik */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Pendaftar</p>
                  <p className="text-3xl font-bold">{stats.total}</p>
                </div>
                <Users className="w-10 h-10 text-blue-600" />
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Prioritas (1-30)</p>
                  <p className="text-3xl font-bold text-green-600">
                    {stats.priority}
                  </p>
                </div>
                <UserCheck className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">List Tunggu (&gt;30)</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {stats.outside}
                  </p>
                </div>
                <Clock className="w-10 h-10 text-yellow-600" />
              </div>
            </div>
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Sudah di-Assign</p>
                  <p className="text-3xl font-bold text-indigo-600">
                    {stats.assigned}
                  </p>
                </div>
                <UserCheck className="w-10 h-10 text-indigo-600" />
              </div>
            </div>
          </div>
        )}

        {/* Kapasitas per Divisi */}
        {stats && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">📊 Kapasitas per Divisi (maks {stats.maxPerDivisi})</h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {DIVISI_OPTIONS.map((d) => {
                const Icon = d.icon;
                const count = stats.perDivisi[d.value] || 0;
                const full = count >= stats.maxPerDivisi;
                return (
                  <div
                    key={d.value}
                    className={`p-4 rounded-lg border-2 ${
                      full ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${d.text}`} />
                      <span className="text-sm font-medium">{d.label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${full ? "text-red-600" : "text-gray-900"}`}>
                      {count}/{stats.maxPerDivisi}
                    </p>
                    {full && (
                      <p className="text-xs text-red-600 mt-1">PENUH</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter & List Pendaftar */}
        <div className="card">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <h2 className="text-xl font-bold flex-1">📋 Daftar Pendaftar</h2>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="input-field md:w-48"
            >
              <option value="all">Semua</option>
              <option value="priority">Prioritas (1-30)</option>
              <option value="outside">List Tunggu (&gt;30)</option>
            </select>
            <select
              value={filterDivisi}
              onChange={(e) => setFilterDivisi(e.target.value)}
              className="input-field md:w-48"
            >
              <option value="all">Semua Divisi</option>
              <option value="unassigned">Belum di-Assign</option>
              {DIVISI_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {loadingData ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
            </div>
          ) : pendaftar.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Belum ada pendaftar
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Urutan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nama
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      NIM
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Divisi Pilihan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Divisi Assigned
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendaftar.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`font-bold ${
                            p.urutan <= 30 ? "text-green-600" : "text-gray-500"
                          }`}
                        >
                          #{p.urutan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{p.nama}</td>
                      <td className="px-4 py-3 text-sm">{p.nim}</td>
                      <td className="px-4 py-3 text-sm break-all">{p.email}</td>
                      <td className="px-4 py-3 text-sm capitalize">
                        {p.divisi_pilihan?.replace("_", " ")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {p.divisi_assigned ? (
                          <span className="badge-green">
                            {p.divisi_assigned.replace("_", " ")}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            p.status === "assigned"
                              ? "badge-green"
                              : p.urutan <= 30
                                ? "badge-blue"
                                : "badge-yellow"
                          }
                        >
                          {p.status === "assigned"
                            ? "Assigned"
                            : p.urutan <= 30
                              ? "Priority"
                              : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openDetail(p)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="text-red-600 hover:text-red-800 flex items-center text-xs"
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Detail Pendaftar */}
      {selectedPendaftar && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">Detail Pendaftar</h3>
              <button
                onClick={closeDetail}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-600">Nomor Urut</p>
                  <p className="font-bold text-lg">#{selectedPendaftar.urutan}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium">
                    {selectedPendaftar.status === "assigned"
                      ? "Assigned"
                      : selectedPendaftar.urutan <= 30
                        ? "Priority"
                        : "Pending (list tunggu)"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Nama</p>
                  <p className="font-medium">{selectedPendaftar.nama}</p>
                </div>
                <div>
                  <p className="text-gray-600">NIM</p>
                  <p className="font-medium">{selectedPendaftar.nim}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium break-all">{selectedPendaftar.email}</p>
                </div>
                <div>
                  <p className="text-gray-600">Divisi Pilihan</p>
                  <p className="font-medium capitalize">
                    {selectedPendaftar.divisi_pilihan?.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Divisi Assigned</p>
                  <p className="font-medium capitalize">
                    {selectedPendaftar.divisi_assigned
                      ? selectedPendaftar.divisi_assigned.replace("_", " ")
                      : "-"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600">Waktu Daftar</p>
                  <p className="font-medium text-sm">
                    {new Date(selectedPendaftar.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>

              {/* File PDF */}
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">📎 File yang diupload</h4>
                {loadingFiles ? (
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                ) : pendaftarFiles.length === 0 ? (
                  <p className="text-sm text-gray-500">Tidak ada file</p>
                ) : (
                  <div className="space-y-2">
                    {pendaftarFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-red-600" />
                          <div>
                            <p className="font-medium">
                              {f.tipe === "cv"
                                ? "CV"
                                : f.tipe === "transkrip"
                                  ? "Transkrip Nilai"
                                  : "Surat Persetujuan"}
                            </p>
                            <p className="text-xs text-gray-500">
                              {f.original_name} ({(f.file_size / 1024).toFixed(1)} KB)
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownload(f.id)}
                          className="btn-secondary flex items-center text-xs"
                        >
                          <Download className="w-3 h-3 mr-1" /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign ke Divisi */}
              <div className="border-t pt-4">
                <h4 className="font-bold mb-2">🎯 Assign ke Divisi</h4>
                <p className="text-xs text-gray-500 mb-3">
                  Maksimal {stats?.maxPerDivisi || 6} peserta per divisi
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {DIVISI_OPTIONS.map((d) => {
                    const count = stats?.perDivisi?.[d.value] || 0;
                    const full = count >= (stats?.maxPerDivisi || 6);
                    const isCurrent =
                      selectedPendaftar.divisi_assigned === d.value;
                    const Icon = d.icon;
                    return (
                      <button
                        key={d.value}
                        onClick={() =>
                          handleAssign(selectedPendaftar.id, d.value)
                        }
                        disabled={assigning || (full && !isCurrent)}
                        className={`flex items-center gap-2 p-3 border-2 rounded-lg transition ${
                          isCurrent
                            ? `border-${d.color}-500 bg-${d.color}-50`
                            : full
                              ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                              : "border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${d.text}`} />
                        <span className="text-sm font-medium flex-1 text-left">
                          {d.label}
                        </span>
                        <span className="text-xs text-gray-500">
                          {count}/{stats?.maxPerDivisi || 6}
                        </span>
                        {isCurrent && (
                          <span className="text-xs text-green-600 font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPendaftaran;
