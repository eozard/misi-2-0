/*
 * Admin Pendaftaran Dashboard
 * - Login admin
 * - List pendaftar (urutan paling awal → akhir)
 * - Total count dengan split: priority (30 pertama) & excess (>30)
 * - Admin bisa assign pendaftar ke divisi yang cocok
 * - Admin bisa hapus pendaftar
 */
import React, { useState, useEffect } from "react";
import {
  LogOut,
  Loader2,
  Trash2,
  Edit3,
  UserPlus,
  Download,
  FileText,
  CheckCircle,
  Clock,
  X,
  Lock,
  Mail,
  User,
  Hash,
  Briefcase,
  Users,
  AlertCircle,
  RefreshCw,
  Shield,
  Key,
  UserCog,
} from "lucide-react";
import axios from "axios";
import ToastStack from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../hooks/useToast";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const DIVISI_OPTIONS = [
  "Networking",
  "Software Engineer",
  "Multimedia",
  "Artificial Intelligence",
  "Data Analyst",
];

const AdminPendaftaranPage = () => {
  // Auth state
  const [token, setToken] = useState(
    () => localStorage.getItem("admin_pendaftaran_token") || null,
  );
  const [admin, setAdmin] = useState(() => {
    try {
      const raw = localStorage.getItem("admin_pendaftaran_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Login form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [adminCount, setAdminCount] = useState(null);
  const [showSeedButton, setShowSeedButton] = useState(false);

  // Cek apakah ada admin saat halaman login muncul
  useEffect(() => {
    if (token) return;
    const checkAdmin = async () => {
      try {
        const res = await axios.get(`${API_URL}/admin-pendaftaran/list`);
        if (res.data.success) {
          setAdminCount(res.data.total);
          if (res.data.total === 0) {
            setShowSeedButton(true);
          }
        }
      } catch {
        // silent
      }
    };
    checkAdmin();
  }, [token]);

  const handleSeedAdmin = async () => {
    setSeeding(true);
    setLoginError("");
    try {
      const res = await axios.post(`${API_URL}/admin-pendaftaran/seed`);
      if (res.data.success) {
        if (res.data.seeded) {
          pushToast({
            type: "success",
            message: `Admin default berhasil dibuat! Login: admin / admin123`,
          });
          setShowSeedButton(false);
          setAdminCount(1);
        } else {
          pushToast({
            type: "info",
            message: res.data.message,
          });
        }
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal membuat admin default";
      setLoginError(message);
    } finally {
      setSeeding(false);
    }
  };

  // Dashboard state
  const [activeTab, setActiveTab] = useState("pendaftar"); // 'pendaftar' | 'admins' | 'divisi'
  const [pendaftar, setPendaftar] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDivisi, setEditDivisi] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Admin management state
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    username: "",
    password: "",
    nama: "",
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [confirmDeleteAdmin, setConfirmDeleteAdmin] = useState(null);

  const { toasts, pushToast, dismissToast } = useToast();

  const api = axios.create({
    baseURL: API_URL,
    headers: { "Content-Type": "application/json" },
  });

  api.interceptors.request.use((config) => {
    if (token && !config.url.includes("/admin-pendaftaran/login")) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && !error.config.url.includes("/admin-pendaftaran/login")) {
        handleLogout();
      }
      return Promise.reject(error);
    },
  );

  const fetchPendaftar = async () => {
    setLoading(true);
    try {
      const res = await api.get("/pendaftaran");
      if (res.data.success) {
        setPendaftar(res.data.data);
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal memuat data pendaftar";
      pushToast({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPendaftar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    if (!username || !password) {
      setLoginError("Username dan password wajib diisi");
      return;
    }

    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_URL}/admin-pendaftaran/login`, {
        username,
        password,
      });

      if (res.data.success) {
        localStorage.setItem(
          "admin_pendaftaran_token",
          res.data.token,
        );
        localStorage.setItem(
          "admin_pendaftaran_user",
          JSON.stringify(res.data.admin),
        );
        setToken(res.data.token);
        setAdmin(res.data.admin);
        setUsername("");
        setPassword("");
        pushToast({
          type: "success",
          message: `Selamat datang, ${res.data.admin.nama}!`,
        });
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Login gagal";
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_pendaftaran_token");
    localStorage.removeItem("admin_pendaftaran_user");
    setToken(null);
    setAdmin(null);
    setPendaftar([]);
  };

  const handleEditDivisi = (item) => {
    setEditingId(item.id);
    setEditDivisi(item.assigned_divisi || item.divisi || "");
  };

  const handleSaveDivisi = async (id) => {
    if (!editDivisi) {
      pushToast({ type: "error", message: "Pilih divisi terlebih dahulu" });
      return;
    }

    // Cek limitasi 6 peserta per divisi (kecuali pendaftar yang sudah di divisi yang sama)
    const MAX_PER_DIVISI = 6;
    const currentItem = pendaftar.find((p) => p.id === id);
    const movingToSameDivisi = currentItem?.assigned_divisi === editDivisi;
    if (!movingToSameDivisi) {
      const countInTarget = pendaftar.filter(
        (p) => p.assigned_divisi === editDivisi,
      ).length;
      if (countInTarget >= MAX_PER_DIVISI) {
        pushToast({
          type: "error",
          message: `Divisi ${editDivisi} sudah penuh (${MAX_PER_DIVISI}/${MAX_PER_DIVISI} peserta)`,
        });
        return;
      }
    }

    try {
      const res = await api.put(`/pendaftaran/${id}`, {
        assigned_divisi: editDivisi,
        admin_nama: admin?.nama || "admin",
      });

      if (res.data.success) {
        pushToast({ type: "success", message: "Divisi berhasil diupdate" });
        setEditingId(null);
        setEditDivisi("");
        fetchPendaftar();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal update divisi";
      pushToast({ type: "error", message });
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditDivisi("");
  };

  const handleDelete = (item) => {
    setConfirmState({
      id: item.id,
      nama: item.nama,
    });
  };

  const confirmDelete = async () => {
    const id = confirmState?.id;
    if (!id) return;

    try {
      const res = await api.delete(`/pendaftaran/${id}`);
      if (res.data.success) {
        pushToast({ type: "success", message: "Pendaftar berhasil dihapus" });
        fetchPendaftar();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal menghapus pendaftar";
      pushToast({ type: "error", message });
    } finally {
      setConfirmState(null);
    }
  };

  // ===== Admin management =====
  const fetchAdminList = async () => {
    setAdminLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin-pendaftaran/list`);
      if (res.data.success) {
        setAdminList(res.data.data || []);
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal memuat daftar admin";
      pushToast({ type: "error", message });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!newAdmin.username || !newAdmin.password || !newAdmin.nama) {
      pushToast({ type: "error", message: "Semua field wajib diisi" });
      return;
    }
    if (newAdmin.password.length < 6) {
      pushToast({ type: "error", message: "Password minimal 6 karakter" });
      return;
    }

    setCreatingAdmin(true);
    try {
      const res = await api.post("/admin-pendaftaran/create", newAdmin);
      if (res.data.success) {
        pushToast({
          type: "success",
          message: `Admin '${newAdmin.username}' berhasil dibuat`,
        });
        setNewAdmin({ username: "", password: "", nama: "" });
        setShowCreateAdmin(false);
        fetchAdminList();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal membuat admin";
      pushToast({ type: "error", message });
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id, username) => {
    if (String(admin?.id) === String(id)) {
      pushToast({
        type: "error",
        message: "Tidak bisa menghapus akun sendiri",
      });
      setConfirmDeleteAdmin(null);
      return;
    }
    try {
      const res = await api.delete(`/admin-pendaftaran/${id}`);
      if (res.data.success) {
        pushToast({
          type: "success",
          message: `Admin '${username}' berhasil dihapus`,
        });
        fetchAdminList();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Gagal menghapus admin";
      pushToast({ type: "error", message });
    } finally {
      setConfirmDeleteAdmin(null);
    }
  };

  useEffect(() => {
    if (token && activeTab === "admins") {
      fetchAdminList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Split priority (30 paling awal) dan excess
  const priority = pendaftar.slice(0, 30);
  const excess = pendaftar.slice(30);
  const totalPendaftar = pendaftar.length;

  // ========== LOGIN VIEW ==========
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Admin Pendaftaran
            </h1>
            <p className="text-gray-600">Login untuk mengelola pendaftar PKL</p>
          </div>

          <div className="card">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                    <Lock className="w-5 h-5 mr-2" />
                    Login
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 text-center space-y-2">
              <a
                href="/pendaftaran"
                className="text-sm text-indigo-600 hover:text-indigo-700 block"
              >
                ← Kembali ke halaman pendaftaran
              </a>

              {showSeedButton && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-2">
                    ⚠️ Belum ada akun admin di database.
                    <br />
                    Klik tombol di bawah untuk membuat admin default.
                  </p>
                  <button
                    type="button"
                    onClick={handleSeedAdmin}
                    disabled={seeding}
                    className="btn-primary w-full text-sm flex items-center justify-center"
                  >
                    {seeding ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserCog className="w-4 h-4 mr-2" />
                        Setup Admin Default (admin/admin123)
                      </>
                    )}
                  </button>
                </div>
              )}

              {adminCount !== null && adminCount > 0 && (
                <p className="text-xs text-gray-400">
                  {adminCount} akun admin terdaftar
                </p>
              )}
            </div>
          </div>
        </div>

        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // ========== DASHBOARD VIEW ==========
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                Admin Pendaftaran PKL
              </h1>
              <p className="text-xs text-gray-500">
                Halo, {admin?.nama || "Admin"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                activeTab === "pendaftar" ? fetchPendaftar() : fetchAdminList()
              }
              className="btn-secondary flex items-center gap-2 text-sm"
              disabled={loading || adminLoading}
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  loading || adminLoading ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="btn-danger flex items-center gap-2 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 border-b border-gray-200 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab("pendaftar")}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                activeTab === "pendaftar"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Users className="w-4 h-4" />
              Pendaftar
            </button>
            <button
              onClick={() => setActiveTab("divisi")}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                activeTab === "divisi"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Divisi
            </button>
            <button
              onClick={() => setActiveTab("admins")}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                activeTab === "admins"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Shield className="w-4 h-4" />
              Kelola Admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {activeTab === "pendaftar" && (
          <>
            {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pendaftar</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalPendaftar}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Prioritas (30 Awal)</p>
              <p className="text-2xl font-bold text-gray-900">
                {priority.length}
              </p>
            </div>
          </div>
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">List Tambahan (&gt; 30)</p>
              <p className="text-2xl font-bold text-gray-900">{excess.length}</p>
            </div>
          </div>
        </div>

        {/* Priority List */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="inline-block w-2 h-6 bg-green-500 rounded" />
              Daftar Prioritas ({priority.length} pendaftar pertama)
            </h2>
          </div>

          {loading ? (
            <div className="card flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : priority.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Belum ada pendaftar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {priority.map((item, idx) => (
                <PendaftarCard
                  key={item.id}
                  item={item}
                  index={idx + 1}
                  editingId={editingId}
                  editDivisi={editDivisi}
                  setEditDivisi={setEditDivisi}
                  onEdit={handleEditDivisi}
                  onSave={handleSaveDivisi}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDelete}
                  onView={setSelectedItem}
                />
              ))}
            </div>
          )}
        </section>

        {/* Excess List (only shown if total > 30) */}
        {excess.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span className="inline-block w-2 h-6 bg-amber-500 rounded" />
                List Tambahan ({excess.length} pendaftar setelah 30 pertama)
              </h2>
            </div>

            <div className="space-y-3">
              {excess.map((item, idx) => (
                <PendaftarCard
                  key={item.id}
                  item={item}
                  index={idx + 31}
                  editingId={editingId}
                  editDivisi={editDivisi}
                  setEditDivisi={setEditDivisi}
                  onEdit={handleEditDivisi}
                  onSave={handleSaveDivisi}
                  onCancelEdit={handleCancelEdit}
                  onDelete={handleDelete}
                  onView={setSelectedItem}
                />
              ))}
            </div>
          </section>
        )}
          </>
        )}

        {/* ========== TAB: DIVISI ========== */}
        {activeTab === "divisi" && (
          <DivisiTab
            pendaftar={pendaftar}
            onView={setSelectedItem}
            maxPerDivisi={6}
          />
        )}

        {/* ========== TAB: KELOLA ADMIN ========== */}
        {activeTab === "admins" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Daftar Admin Pendaftaran
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Kelola akun admin yang punya akses ke dashboard ini
                </p>
              </div>
              <button
                onClick={() => setShowCreateAdmin(true)}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <UserCog className="w-4 h-4" />
                Buat Admin Baru
              </button>
            </div>

            {adminLoading ? (
              <div className="card flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : adminList.length === 0 ? (
              <div className="card text-center py-12 text-gray-500">
                <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Belum ada admin</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminList.map((a) => {
                  const isMe = String(admin?.id) === String(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`card ${
                        isMe ? "ring-2 ring-indigo-500 bg-indigo-50/30" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                          {a.nama?.[0]?.toUpperCase() || "A"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900 truncate">
                              {a.nama}
                            </h3>
                            {isMe && (
                              <span className="badge-blue text-xs">Anda</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">
                            @{a.username}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Dibuat:{" "}
                            {new Date(a.created_at).toLocaleDateString("id-ID")}
                          </p>
                        </div>
                      </div>
                      {!isMe && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() =>
                              setConfirmDeleteAdmin({ id: a.id, username: a.username })
                            }
                            className="btn-danger text-xs py-1.5 w-full flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus Admin
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      {/* Confirm Delete Pendaftar Dialog */}
      <ConfirmDialog
        open={!!confirmState}
        title="Hapus Pendaftar?"
        message={`Apakah Anda yakin ingin menghapus pendaftar "${confirmState?.nama}"? Data dan file PDF terkait akan dihapus permanen.`}
        confirmText="Hapus"
        cancelText="Batal"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState(null)}
      />

      {/* Confirm Delete Admin Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteAdmin}
        title="Hapus Admin?"
        message={`Apakah Anda yakin ingin menghapus admin "${confirmDeleteAdmin?.username}"? Admin ini tidak akan bisa login lagi.`}
        confirmText="Hapus"
        cancelText="Batal"
        tone="danger"
        onConfirm={() =>
          handleDeleteAdmin(confirmDeleteAdmin?.id, confirmDeleteAdmin?.username)
        }
        onCancel={() => setConfirmDeleteAdmin(null)}
      />

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <CreateAdminModal
          newAdmin={newAdmin}
          setNewAdmin={setNewAdmin}
          onClose={() => {
            setShowCreateAdmin(false);
            setNewAdmin({ username: "", password: "", nama: "" });
          }}
          onSubmit={handleCreateAdmin}
          loading={creatingAdmin}
        />
      )}

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

/* ============================================================================
 * DivisiTab - tampilkan peserta per divisi (max 6 per divisi)
 * ========================================================================== */
const DIVISI_COLORS = {
  Networking: { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
  "Software Engineer": { bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-500" },
  Multimedia: { bg: "bg-pink-50", text: "text-pink-700", bar: "bg-pink-500" },
  "Artificial Intelligence": { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
  "Data Analyst": { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" },
};

const DivisiTab = ({ pendaftar, onView, maxPerDivisi = 6 }) => {
  // Group pendaftar by assigned_divisi
  const grouped = DIVISI_OPTIONS.reduce((acc, d) => {
    acc[d] = pendaftar.filter((p) => p.assigned_divisi === d);
    return acc;
  }, {});

  const totalAssigned = Object.values(grouped).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );
  const unassigned = pendaftar.filter((p) => !p.assigned_divisi);

  return (
    <section className="space-y-6">
      <div className="card bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Distribusi Peserta per Divisi
            </h2>
            <p className="text-sm text-gray-600">
              Maksimal {maxPerDivisi} peserta per divisi · Total assigned:{" "}
              <span className="font-semibold">{totalAssigned}</span> /{" "}
              {DIVISI_OPTIONS.length * maxPerDivisi}
            </p>
          </div>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="card border-l-4 border-amber-400">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900">
                {unassigned.length} peserta belum di-assign ke divisi
              </h3>
              <p className="text-sm text-gray-600">
                Buka tab <strong>Pendaftar</strong> untuk assign mereka ke divisi.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {DIVISI_OPTIONS.map((divisi) => {
          const members = grouped[divisi] || [];
          const colors = DIVISI_COLORS[divisi];
          const isFull = members.length >= maxPerDivisi;
          const percent = Math.min(100, (members.length / maxPerDivisi) * 100);

          return (
            <div
              key={divisi}
              className={`card border-l-4 ${
                isFull ? "border-red-500" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    {divisi}
                    {isFull && (
                      <span className="badge-red text-xs">PENUH</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {members.length} / {maxPerDivisi} peserta
                  </p>
                </div>
                <div
                  className={`w-10 h-10 ${colors.bg} ${colors.text} rounded-lg flex items-center justify-center font-bold`}
                >
                  {members.length}
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isFull ? "bg-red-500" : colors.bar
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Members */}
              {members.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  Belum ada peserta
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {members.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => onView(p)}
                      className="w-full flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition text-left"
                    >
                      <span className="text-xs font-mono text-gray-400 w-6 flex-shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {p.nama}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          NIM: {p.nim}
                        </p>
                      </div>
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* ============================================================================
 * CreateAdminModal - modal buat admin baru
 * ========================================================================== */
const CreateAdminModal = ({ newAdmin, setNewAdmin, onClose, onSubmit, loading }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <UserCog className="w-5 h-5 text-indigo-600" />
            Buat Admin Baru
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Lengkap
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Contoh: Budi Santoso"
              value={newAdmin.nama}
              onChange={(e) =>
                setNewAdmin({ ...newAdmin, nama: e.target.value })
              }
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Contoh: budi_admin"
              value={newAdmin.username}
              onChange={(e) =>
                setNewAdmin({ ...newAdmin, username: e.target.value })
              }
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Minimal 6 karakter"
              value={newAdmin.password}
              onChange={(e) =>
                setNewAdmin({ ...newAdmin, password: e.target.value })
              }
              disabled={loading}
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">
              Admin akan bisa login dengan username & password ini
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserCog className="w-4 h-4 mr-2" />
                  Buat
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * PendaftarCard - kartu untuk satu pendaftar
 * ========================================================================== */
const PendaftarCard = ({
  item,
  index,
  editingId,
  editDivisi,
  setEditDivisi,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onView,
}) => {
  const isEditing = editingId === item.id;
  const isAssigned = !!item.assigned_divisi;

  return (
    <div
      className={`card hover:shadow-lg transition ${
        isAssigned ? "border-l-4 border-green-500" : "border-l-4 border-gray-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
          {index}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{item.nama}</h3>
              <p className="text-sm text-gray-500">NIM: {item.nim}</p>
            </div>
            <div className="flex items-center gap-2">
              {isAssigned ? (
                <span className="badge-green">Assigned: {item.assigned_divisi}</span>
              ) : (
                <span className="badge-yellow">Belum di-assign</span>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              <a
                href={`mailto:${item.email}`}
                className="text-indigo-600 hover:underline truncate max-w-[200px]"
              >
                {item.email}
              </a>
            </span>
            <span className="inline-flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              Pilihan: {item.divisi}
            </span>
          </div>

          {/* Edit divisi */}
          {isEditing ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={editDivisi}
                onChange={(e) => setEditDivisi(e.target.value)}
                className="input-field flex-1 min-w-[180px] py-2"
              >
                <option value="">-- Pilih Divisi --</option>
                {DIVISI_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button onClick={() => onSave(item.id)} className="btn-primary text-sm py-2">
                Simpan
              </button>
              <button onClick={onCancelEdit} className="btn-secondary text-sm py-2">
                Batal
              </button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onEdit(item)}
                className="btn-secondary text-sm py-1.5 flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                {isAssigned ? "Ganti Divisi" : "Pilih Divisi"}
              </button>
              <button
                onClick={() => onView(item)}
                className="btn-secondary text-sm py-1.5 flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                Lihat Berkas
              </button>
              <button
                onClick={() => onDelete(item)}
                className="btn-danger text-sm py-1.5 flex items-center gap-1 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * DetailModal - modal detail pendaftar + preview file
 * ========================================================================== */
const DetailModal = ({ item, onClose }) => {
  // Pakai proxy endpoint supaya PDF di-serve dengan Content-Disposition: inline
  // (Supabase default attachment bikin Edge/Firefox langsung download)
  const proxyUrl = (type) => `${API_URL}/pendaftaran/file/${item.id}/${type}`;

  const files = [
    { label: "CV", url: proxyUrl("cv"), originalUrl: item.cv_url, key: "cv" },
    {
      label: "Transkrip Nilai",
      url: proxyUrl("transkrip"),
      originalUrl: item.transkrip_url,
      key: "transkrip",
    },
    {
      label: "Surat Persetujuan",
      url: proxyUrl("surat_persetujuan"),
      originalUrl: item.surat_persetujuan_url,
      key: "surat",
    },
  ].filter((f) => f.originalUrl);

  const [activeTab, setActiveTab] = useState(files[0]?.key || "");
  const activeFile = files.find((f) => f.key === activeTab) || files[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            Detail Pendaftar
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <DetailRow icon={User} label="Nama" value={item.nama} />
            <DetailRow icon={Hash} label="NIM" value={item.nim} />
            <DetailRow
              icon={Mail}
              label="Email"
              value={
                <a
                  href={`mailto:${item.email}`}
                  className="text-indigo-600 hover:underline"
                >
                  {item.email}
                </a>
              }
            />
            <DetailRow
              icon={Briefcase}
              label="Divisi Pilihan"
              value={item.divisi}
            />
            {item.assigned_divisi && (
              <DetailRow
                icon={CheckCircle}
                label="Divisi Assigned"
                value={`${item.assigned_divisi} (oleh ${
                  item.assigned_by || "admin"
                })`}
              />
            )}
          </div>

          <h4 className="mb-3 font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Preview Berkas PDF
          </h4>

          {/* Tabs PDF */}
          <div className="flex flex-wrap gap-1 mb-3 border-b border-gray-200">
            {files.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveTab(f.key)}
                className={`px-3 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
                  activeTab === f.key
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {f.label}
              </button>
            ))}
          </div>

          {/* PDF Preview */}
          {activeFile && (
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
              <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">
                  {activeFile.label}
                </span>
                <a
                  href={activeFile.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download / Buka di tab baru
                </a>
              </div>
              <iframe
                src={activeFile.url}
                title={activeFile.label}
                className="w-full"
                style={{ height: "60vh", border: "none" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DetailRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <Icon className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-words">{value}</p>
    </div>
  </div>
);

export default AdminPendaftaranPage;
