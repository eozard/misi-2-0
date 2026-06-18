/*
 * Landing page PKL BPTI.
 * Halaman awal aplikasi: pengguna memilih untuk mendaftar atau login absensi.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, LogIn, Building2 } from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4 shadow-lg">
            <Building2 className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PKL BPTI</h1>
          <p className="text-gray-600 text-lg">
            Praktik Kerja Lapangan - Balai Pelatihan Teknologi Informasi
          </p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
            Selamat Datang
          </h2>
          <p className="text-gray-600 text-center mb-8">
            Silakan pilih menu di bawah ini
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => navigate("/pendaftaran")}
              className="flex flex-col items-center justify-center p-6 border-2 border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition group"
            >
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition">
                <UserPlus className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">Daftar</span>
              <span className="text-sm text-gray-600 mt-1 text-center">
                Pendaftaran peserta PKL baru
              </span>
            </button>

            <button
              type="button"
              onClick={() => navigate("/absen")}
              className="flex flex-col items-center justify-center p-6 border-2 border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-400 transition group"
            >
              <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition">
                <LogIn className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">Absen</span>
              <span className="text-sm text-gray-600 mt-1 text-center">
                Login untuk absensi harian
              </span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          &copy; {new Date().getFullYear()} PKL BPTI. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
