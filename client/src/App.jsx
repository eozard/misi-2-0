/*
 * App routes for the web UI (login, admin, mahasiswa, pendaftaran, admin_pendaftaran).
 * Uses role-based protected routes.
 */
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import MahasiswaDashboard from "./pages/MahasiswaDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PendaftaranPage from "./pages/PendaftaranPage";
import AdminPendaftaran from "./pages/AdminPendaftaran";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/pendaftaran" element={<PendaftaranPage />} />
        <Route path="/admin_pendaftaran" element={<AdminPendaftaran />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["mahasiswa", "anak_smk"]}>
              <MahasiswaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
