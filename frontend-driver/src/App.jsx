import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useDriverAuthStore from './store/authStore';

const DriverLoginPage = lazy(() => import('./pages/DriverLoginPage'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const ActiveDeliveryPage = lazy(() => import('./pages/ActiveDeliveryPage'));
const DriverHistoryPage = lazy(() => import('./pages/DriverHistoryPage'));

const DriverFallback = () => (
  <div style={{
    minHeight: '100vh',
    background: '#0F172A',
    color: '#94A3B8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    fontFamily: 'sans-serif'
  }}>
    <div style={{
      width: '44px',
      height: '44px',
      border: '4px solid #334155',
      borderTopColor: '#FF6B00',
      borderRadius: '50%',
      animation: 'driverSpin 0.7s linear infinite',
    }} />
    <span style={{ fontSize: '15px', fontWeight: 600, color: '#E2E8F0' }}>BenneGo Chauffeur...</span>
    <style>{`@keyframes driverSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useDriverAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <Suspense fallback={<DriverFallback />}>
      <Routes>
        <Route path="/login" element={<DriverLoginPage />} />
        <Route path="/" element={<PrivateRoute><DriverDashboard /></PrivateRoute>} />
        <Route path="/order/:orderId" element={<PrivateRoute><ActiveDeliveryPage /></PrivateRoute>} />
        <Route path="/history" element={<PrivateRoute><DriverHistoryPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
