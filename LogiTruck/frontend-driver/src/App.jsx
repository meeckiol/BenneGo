import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useDriverAuthStore from './store/authStore';
import DriverLoginPage from './pages/DriverLoginPage';
import DriverDashboard from './pages/DriverDashboard';
import ActiveDeliveryPage from './pages/ActiveDeliveryPage';
import DriverHistoryPage from './pages/DriverHistoryPage';

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useDriverAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<DriverLoginPage />} />
      <Route path="/" element={<PrivateRoute><DriverDashboard /></PrivateRoute>} />
      <Route path="/order/:orderId" element={<PrivateRoute><ActiveDeliveryPage /></PrivateRoute>} />
      <Route path="/history" element={<PrivateRoute><DriverHistoryPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
