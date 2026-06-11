/*
 * Halaman publik /pendaftaran
 * Form untuk pendaftar baru (tidak butuh login).
 *
 * Field:
 * 1. Nama
 * 2. NIM
 * 3. Divisi pilihan (radio: networking, software_engineer, multimedia, ai, data_analyst)
 * 4. Upload CV (PDF)
 * 5. Upload Transkrip Nilai semester kemarin (PDF)
 * 6. Upload Surat persetujuan dari sekolah (PDF)
 * 7. Email (untuk dihubungi admin)
 */
import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Loader2,
  CheckCircle,
  Upload,
  FileText,
  Mail,
  User,
  Hash,
  Network,
  Code,
  Palette,
  Brain,
  BarChart3,
} from "lucide-react";
import axiosInstance from "../utils/axios";

const DIVISI_OPTIONS = [
  {
    value: "networking",
    label: "Networking",
    icon: Network,
    color: "blue",
    selectedBorder: "border-blue-500",
    selectedBg: "bg-blue-50",
    iconBg: "bg-blue-500",
    text: "text-blue-700",
  },
  {
    value: "software_engineer",
    label: "Software Engineer",
    icon: Code,
    color: "indigo",
    selectedBorder: "border-indigo-500",
    selectedBg: "bg-indigo-50",
    iconBg: "bg-indigo-500",
    text: "text-indigo-700",
  },
  {
    value: "multimedia",
    label: "Multimedia",
    icon: Palette,
    color: "pink",
    selectedBorder: "border-pink-500",
    selectedBg: "bg-pink-50",
    iconBg: "bg-pink-500",
    text: "text-pink-700",
  },
  {
    value: "ai",
    label: "Artificial Intelligence",
    icon: Brain,
    color: "purple",
    selectedBorder: "border-purple-500",
    selectedBg: "bg-purple-50",
    iconBg: "bg-purple-500",
    text: "text-purple-700",
  },
  {
    value: "data_analyst",
    label: "Data Analyst",
    icon: BarChart3,
    color: "emerald",
    selectedBorder: "border-emerald-500",
    selectedBg: "bg-emerald-50",
    iconBg: "bg-emerald-500",
    text: "text-emerald-700",
  },
];

const PendaftaranPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nama: "",
    nim: "",
    email: "",
    divisi_pilihan: "",
  });
  const [files, setFiles] = useState({
    cv: null,
    transkrip: null,
    surat: null,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  const cvRef = useRef(null);
  const transkripRef = useRef(null);
  const suratRef = useRef(null);

  const handleFile = (key, file) => {
    if (!file) {
      setFiles((prev) => ({ ...prev, [key]: null }));
      return;
    }
    if (file.type !== "application/pdf") {
      setError("File harus berformat PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10MB");
      return;
    }
    setError("");
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validasi field
    if (!form.nama || !form.nim || !form.email || !form.divisi_pilihan) {
      setError("Nama, NIM, email, dan divisi wajib diisi");
      return;
    }
    if (!files.cv || !files.transkrip || !files.surat) {
      setError("Semua file PDF (CV, transkrip, surat) wajib diupload");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("nama", form.nama);
      formData.append("nim", form.nim);
      formData.append("email", form.email);
      formData.append("divisi_pilihan", form.divisi_pilihan);
      formData.append("cv", files.cv);
      formData.append("transkrip", files.transkrip);
      formData.append("surat", files.surat);

      const response = await axiosInstance.post("/pendaftaran", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setSuccess(response.data.data);
      } else {
        setError(response.data.message || "Pendaftaran gagal");
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Terjadi kesalahan saat mengirim pendaftaran",
      );
    } finally {
      setLoading(false);
    }
  };

  const FileInput = ({ fieldKey, label, fileRef, accept = ".pdf" }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-secondary flex items-center"
          disabled={loading}
        >
          <Upload className="w-4 h-4 mr-2" />
          Pilih File
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(fieldKey, e.target.files?.[0])}
        />
        {files[fieldKey] ? (
          <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
            <FileText className="w-4 h-4" />
            <span className="truncate">{files[fieldKey].name}</span>
            <span className="text-xs text-green-600 ml-auto">
              {(files[fieldKey].size / 1024).toFixed(1)} KB
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-400">Belum ada file</span>
        )}
      </div>
    </div>
  );

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-md w-full card text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Pendaftaran Berhasil!
          </h2>
          <p className="text-gray-600 mb-4">
            Terima kasih <strong>{success.nama}</strong> telah mendaftar.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-600">NIM:</span>{" "}
                <strong>{success.nim}</strong>
              </p>
              <p>
                <span className="text-gray-600">Email:</span>{" "}
                <strong className="break-all">{success.email}</strong>
              </p>
              <p>
                <span className="text-gray-600">Divisi pilihan:</span>{" "}
                <strong>{success.divisi_pilihan}</strong>
              </p>
              <p>
                <span className="text-gray-600">Nomor urut:</span>{" "}
                <strong>#{success.urutan}</strong>
              </p>
              <p>
                <span className="text-gray-600">Status:</span>{" "}
                <strong
                  className={
                    success.status === "priority"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }
                >
                  {success.status === "priority"
                    ? "Prioritas (masuk 30 besar)"
                    : "List tunggu (di luar 30 besar)"}
                </strong>
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Admin akan menghubungi Anda melalui email untuk konfirmasi dan
            informasi selanjutnya.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Form Pendaftaran
          </h1>
          <p className="text-gray-600">
            Isi data di bawah ini untuk mendaftar sebagai peserta
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nama */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                1. Nama Lengkap
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Masukkan nama lengkap"
                  value={form.nama}
                  onChange={(e) =>
                    setForm({ ...form, nama: e.target.value })
                  }
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* NIM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                2. NIM
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className="input-field pl-10"
                  placeholder="Masukkan NIM"
                  value={form.nim}
                  onChange={(e) => setForm({ ...form, nim: e.target.value })}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Divisi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                3. Pilih Divisi
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DIVISI_OPTIONS.map((d) => {
                  const Icon = d.icon;
                  const selected = form.divisi_pilihan === d.value;
                  return (
                    <label
                      key={d.value}
                      className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${
                        selected
                          ? `${d.selectedBorder} ${d.selectedBg}`
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="divisi"
                        value={d.value}
                        checked={selected}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            divisi_pilihan: e.target.value,
                          })
                        }
                        className="sr-only"
                        disabled={loading}
                      />
                      <div
                        className={`p-2 rounded-lg ${
                          selected
                            ? `${d.iconBg} text-white`
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-sm font-medium ${
                          selected ? d.text : "text-gray-700"
                        }`}
                      >
                        {d.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* CV */}
            <FileInput
              fieldKey="cv"
              label="4. Upload CV (PDF)"
              fileRef={cvRef}
            />

            {/* Transkrip */}
            <FileInput
              fieldKey="transkrip"
              label="5. Upload Transkrip Nilai Semester Kemarin (PDF)"
              fileRef={transkripRef}
            />

            {/* Surat */}
            <FileInput
              fieldKey="surat"
              label="6. Upload Surat Persetujuan dari Sekolah (PDF)"
              fileRef={suratRef}
            />

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                7. Email (untuk dihubungi admin)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  className="input-field pl-10"
                  placeholder="nama@email.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Kirim Pendaftaran
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PendaftaranPage;
