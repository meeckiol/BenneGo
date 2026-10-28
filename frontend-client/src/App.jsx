import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore, { selectAccountType } from './store/authStore';
import BottomNav from './components/BottomNav';

// Code-splitting via React.lazy
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const NewOrderPage = lazy(() => import('./pages/NewOrderPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const EnterprisePage = lazy(() => import('./pages/EnterprisePage'));
const ReferralPage = lazy(() => import('./pages/ReferralPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PromoPage = lazy(() => import('./pages/PromoPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));

// Composant de chargement avec animation sobre BenneGo
const PageFallback = () => (
  <div style={{
    minHeight: '60vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: 'var(--text-2)',
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid var(--border)',
      borderTopColor: '#FF6B00',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <span style={{ fontSize: '14px', fontWeight: 500 }}>Chargement de BenneGo...</span>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Guard pour les routes protégées
const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="bn-shell">
      {children}
      <BottomNav />
    </div>
  );
};

// Accueil : vitrine publique pour les visiteurs ; pour les connectés, l'accueil du type de compte choisi à la connexion
const HomeRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accountType = useAuthStore(selectAccountType);
  if (!isAuthenticated) return <LandingPage />;
  return (
    <PrivateRoute>
      {accountType === 'entreprise' ? <EnterprisePage /> : <HomePage />}
    </PrivateRoute>
  );
};

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />

        {/* Routes protégées */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/orders/new" element={<PrivateRoute><NewOrderPage /></PrivateRoute>} />
        <Route path="/orders/:id" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />
        <Route path="/enterprise" element={<Navigate to="/" replace />} />
        <Route path="/referral" element={<PrivateRoute><ReferralPage /></PrivateRoute>} />
        <Route path="/profil" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/code-promo" element={<PrivateRoute><PromoPage /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
