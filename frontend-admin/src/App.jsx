import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAdminStore from './store/adminStore';
import AdminLayout from './components/AdminLayout';

const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const DriversPage = lazy(() => import('./pages/DriversPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const B2BEnterprisePage = lazy(() => import('./pages/B2BEnterprisePage'));
const MonthlyReportPage = lazy(() => import('./pages/MonthlyReportPage'));
const ReferralsAdminPage = lazy(() => import('./pages/ReferralsAdminPage'));
const PromoCodesAdminPage = lazy(() => import('./pages/PromoCodesAdminPage'));
const DisputesPage = lazy(() => import('./pages/DisputesPage'));
const ReliefsPage = lazy(() => import('./pages/ReliefsPage'));
const BarometerAdminPage = lazy(() => import('./pages/BarometerAdminPage'));

const AdminFallback = () => (
  <div style={{
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    color: 'var(--text-3)',
  }}>
    <div style={{
      width: '38px',
      height: '38px',
      border: '3px solid var(--border-2)',
      borderTopColor: '#D9A55B',
      borderRadius: '50%',
      animation: 'adminSpin 0.75s linear infinite',
    }} />
    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-2)' }}>Chargement console BenneGo...</span>
    <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAdminStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AdminLayout>{children}</AdminLayout>;
};

export default function App() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/"        element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/orders"  element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/b2b"     element={<PrivateRoute><B2BEnterprisePage /></PrivateRoute>} />
        <Route path="/drivers" element={<PrivateRoute><DriversPage /></PrivateRoute>} />
        <Route path="/clients" element={<PrivateRoute><ClientsPage /></PrivateRoute>} />
        <Route path="/payments" element={<PrivateRoute><PaymentsPage /></PrivateRoute>} />
        <Route path="/reviews" element={<PrivateRoute><ReviewsPage /></PrivateRoute>} />
        <Route path="/report"    element={<PrivateRoute><MonthlyReportPage /></PrivateRoute>} />
        <Route path="/referrals" element={<PrivateRoute><ReferralsAdminPage /></PrivateRoute>} />
        <Route path="/promos"    element={<PrivateRoute><PromoCodesAdminPage /></PrivateRoute>} />
        <Route path="/disputes" element={<PrivateRoute><DisputesPage /></PrivateRoute>} />
        <Route path="/reliefs" element={<PrivateRoute><ReliefsPage /></PrivateRoute>} />
        <Route path="/barometer" element={<PrivateRoute><BarometerAdminPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

