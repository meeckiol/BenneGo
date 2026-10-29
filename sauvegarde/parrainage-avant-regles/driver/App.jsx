import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import useDriverAuthStore from './store/authStore';
import BottomNav from './components/BottomNav';
import { DriverSessionProvider } from './context/DriverSession';
import { useChatAlerts } from '../../shared/messaging';
import api from './services/api';
import { getSocket } from './services/socket';

const DriverLoginPage = lazy(() => import('./pages/DriverLoginPage'));
const DriverHomePage = lazy(() => import('./pages/DriverHomePage'));
const ActiveDeliveryPage = lazy(() => import('./pages/ActiveDeliveryPage'));
const CoursesPage = lazy(() => import('./pages/CoursesPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PersonalInfoPage = lazy(() => import('./pages/PersonalInfoPage'));
const VehiclePage = lazy(() => import('./pages/VehiclePage'));

const DriverFallback = () => (
  <div style={{
    minHeight: '100vh',
    background: 'var(--bg)',
    color: 'var(--text-3)',
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
      border: '4px solid var(--border-2)',
      borderTopColor: '#D9A55B',
      borderRadius: '50%',
      animation: 'driverSpin 0.7s linear infinite',
    }} />
    <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>BenneGo Chauffeur...</span>
    <style>{`@keyframes driverSpin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// `nav={false}` : écran plein (discussion, course en cours), sans la barre du bas
const PrivateRoute = ({ children, nav = true }) => {
  const isAuthenticated = useDriverAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!nav) return children;
  return (
    <div className="bn-shell">
      {children}
      <BottomNav />
    </div>
  );
};

// Session (disponibilité, GPS, nouvelles courses) et alertes de messages, une fois connecté
const DriverSession = ({ children }) => {
  const navigate = useNavigate();
  const isAuthenticated = useDriverAuthStore((s) => s.isAuthenticated);
  useChatAlerts({ api, getSocket, enabled: isAuthenticated, navigate });
  if (!isAuthenticated) return children;
  return <DriverSessionProvider>{children}</DriverSessionProvider>;
};

export default function App() {
  return (
    <Suspense fallback={<DriverFallback />}>
      <DriverSession>
        <Routes>
          <Route path="/login" element={<DriverLoginPage />} />
          <Route path="/" element={<PrivateRoute><DriverHomePage /></PrivateRoute>} />
          <Route path="/courses" element={<PrivateRoute><CoursesPage /></PrivateRoute>} />
          <Route path="/order/:orderId" element={<PrivateRoute nav={false}><ActiveDeliveryPage /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
          <Route path="/messages/:id" element={<PrivateRoute nav={false}><ChatPage /></PrivateRoute>} />
          <Route path="/profil" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/profil/infos" element={<PrivateRoute><PersonalInfoPage /></PrivateRoute>} />
          <Route path="/profil/vehicule" element={<PrivateRoute><VehiclePage /></PrivateRoute>} />
          <Route path="/history" element={<Navigate to="/courses" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DriverSession>
    </Suspense>
  );
}
