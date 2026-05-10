import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Import Pages
import AdminDashboard from './pages/AdminDashboard';
import AddStudent from './pages/AddStudent';
import StudentList from './pages/StudentList';
import StudentPortal from './pages/StudentPortal';
import AboutPage from './pages/AboutPage';
import HelpPage from './pages/HelpPage';
import SettingsPage from './pages/SettingsPage';
import FeeManager from './pages/FeeManager';
import LoginPage from './pages/LoginPage';
import Attendance from './pages/Attendance';
import TestManager from './pages/TestManager';
import PromotePage from './pages/PromotePage';
import StrategicDashboard from './pages/StrategicDashboard'; // NEW IMPORT

import PrivateRoute from './components/PrivateRoute';

import { Toaster } from 'sonner';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        {/* --- Public Access --- */}
        <Route path="/about" element={<AboutPage />} />
        <Route path="/help" element={<HelpPage />} />

        {/* Public Route: Login */}
        <Route path="/login" element={<LoginPage />} />

        {/* Public Route: Student Portal (Parents access this via Magic Link) */}
        <Route path="/student/:secret_id" element={<StudentPortal />} />

        {/* --- PROTECTED ADMIN ROUTES --- */}
        {/* We wrap these inside PrivateRoute to prevent unauthorized access */}
        <Route element={<PrivateRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/add-student" element={<AddStudent />} />
          <Route path="/admin/students" element={<StudentList />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/fees" element={<FeeManager />} />
          <Route path="/admin/attendance" element={<Attendance />} />
          <Route path="/admin/tests" element={<TestManager />} />
          <Route path="/admin/promote" element={<PromotePage />} /> {/* <--- NEW ROUTE */}
          <Route path="/admin/strategic" element={<StrategicDashboard />} /> {/* <--- NEW ROUTE */}
        </Route>

        {/* Default Redirect: Send root "/" to Login (or Dashboard if you prefer) */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Catch-all for 404s - Optional: Redirect unknown paths to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter >
  );
}

export default App;