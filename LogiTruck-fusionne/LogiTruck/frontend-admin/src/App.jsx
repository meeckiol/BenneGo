import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAdminStore from './store/adminStore';
import AdminLayout from './components/AdminLayout';
import AdminLoginPage from './pages/AdminLoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import DriversPage from './pages/DriversPage';
import ClientsPage from './pages/ClientsPage';
import PaymentsPage from './pages/PaymentsPage';
import ReviewsPage from './pages/ReviewsPage';
import B2BEnterprisePage from './pages/B2BEnterprisePage';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLoginPage />} />
      <Route path="/"        element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/orders"  element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
      <Route path="/b2b"     element={<PrivateRoute><B2BEnterprisePage /></PrivateRoute>} />
      <Route path="/drivers" element={<PrivateRoute><DriversPage /></PrivateRoute>} />
      <Route path="/clients" element={<PrivateRoute><ClientsPage /></PrivateRoute>} />
      <Route path="/payments" element={<PrivateRoute><PaymentsPage /></PrivateRoute>} />
      <Route path="/reviews" element={<PrivateRoute><ReviewsPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
