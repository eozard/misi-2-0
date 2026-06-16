import React, { useState } from "react";
import { UserPlus, Loader2, Upload, FileText, CheckCircle, Mail } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

const DIVISI_OPTIONS = [
  "Networking",
  "Software Engineer",
  "Multimedia",
  "Artificial Intelligence",
  "Data Analyst",
];

const PendaftaranPage = () => {
  const [nama, setNama] = useState("");
  const [nim, setNim] = useState("");
  const [divisi, setDivisi] = useState("");
  const [cv, setCv] = useState(null);
  const [transkrip, setTranskrip] = useState(null);
  const [suratPersetujuan, setSuratPersetujuan] = useState(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleFileChange = (setter) => (e) => {
    const file = e.target.files[0];
    if (file && file.type !== "application/pdf") {
      setError("Hanya file PDF yang diperbolehkan");
      e.target.value = "";
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setError("Ukuran file maksimal 10MB");
      e.target.value = "";
      return;
    }
    setError("");
    setter(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!nama || !nim || !divisi || !email) {
      setError("Nama, NIM, divisi, dan email wajib diisi");
      return;
    }
    if (!cv || !transkrip || !suratPersetujuan) {
      setError("Semua file PDF wajib diunggah");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("nama", nama);
      formData.append("nim", nim);
      formData.append("divisi", divisi);
      formData.append("email", email);
      formData.append("cv", cv);
      formData.append("transkrip", transkrip);
      formData.append("surat_persetujuan", suratPersetujuan);

      await axios.post(`${API_URL}/pendaftaran`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess(true);
    } catch (err) {
      const message = err.response?.data?.message || "Gagal mengirim pendaftaran";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
        <div className="max-w-md w-full text-center">
          <div className="card">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Pendaftaran Berhasil!
            </h2>
            <p className="text-gray-600">
              Data pendaftaran kamu telah berhasil dikirim. Silakan tunggu informasi selanjutnya.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pendaftaran PKL</h1>
          <p className="text-gray-600">Isi formulir di bawah untuk mendaftar</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Masukkan nama lengkap"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIM
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Masukkan NIM"
                value={nim}
                onChange={(e) => setNim(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Divisi
              </label>
              <div className="space-y-2">
                {DIVISI_OPTIONS.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center px-4 py-3 border rounded-lg cursor-pointer transition ${
                      divisi === option
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <input
                      type="radio"
                      name="divisi"
                      value={option}
                      checked={divisi === option}
                      onChange={(e) => setDivisi(e.target.value)}
                      disabled={loading}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                        divisi === option ? "border-blue-500" : "border-gray-400"
                      }`}
                    >
                      {divisi === option && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CV (PDF)
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg px-4 py-3 hover:border-gray-400 transition">
                <Upload className="w-5 h-5 text-gray-400 mr-3" />
                <label className="cursor-pointer flex-1">
                  <span className="text-sm text-gray-600">
                    {cv ? cv.name : "Pilih file CV (PDF)"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange(setCv)}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
                {cv && <FileText className="w-5 h-5 text-green-500 ml-2" />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Transkrip Nilai (PDF)
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg px-4 py-3 hover:border-gray-400 transition">
                <Upload className="w-5 h-5 text-gray-400 mr-3" />
                <label className="cursor-pointer flex-1">
                  <span className="text-sm text-gray-600">
                    {transkrip ? transkrip.name : "Pilih file Transkrip Nilai (PDF)"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange(setTranskrip)}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
                {transkrip && <FileText className="w-5 h-5 text-green-500 ml-2" />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Surat Persetujuan Sekolah (PDF)
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg px-4 py-3 hover:border-gray-400 transition">
                <Upload className="w-5 h-5 text-gray-400 mr-3" />
                <label className="cursor-pointer flex-1">
                  <span className="text-sm text-gray-600">
                    {suratPersetujuan ? suratPersetujuan.name : "Pilih file Surat Persetujuan (PDF)"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange(setSuratPersetujuan)}
                    disabled={loading}
                    className="hidden"
                  />
                </label>
                {suratPersetujuan && <FileText className="w-5 h-5 text-green-500 ml-2" />}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition">
                <Mail className="w-5 h-5 text-gray-400 mr-3" />
                <input
                  type="email"
                  className="flex-1 outline-none text-sm text-gray-700 bg-transparent"
                  placeholder="contoh@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Email digunakan untuk menghubungi pendaftar
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Kirim Pendaftaran
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PendaftaranPage;
