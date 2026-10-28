import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useChatAlerts } from '../../shared/messaging';
import api from './services/api';
import { getSocket } from './services/socket';
import useAuthStore, { selectAccountType } from './store/authStore';
import BottomNav from './components/BottomNav';
import { hasSeenOnboarding } from './pages/OnboardingPage';

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
const PersonalInfoPage = lazy(() => import('./pages/PersonalInfoPage'));
const PromoPage = lazy(() => import('./pages/PromoPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));
// Vitrine mise de côté : elle n'est plus dans le parcours, seulement sur /vitrine
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
      borderTopColor: '#D9A55B',
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
// `nav={false}` : écran plein (discussion), sans la barre de navigation du bas
const PrivateRoute = ({ children, nav = true }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!nav) return children;
  return (
    <div className="bn-shell">
      {children}
      <BottomNav />
    </div>
  );
};

// Accueil : les visiteurs passent par le carrousel (premier lancement) puis la connexion ;
// les connectés arrivent sur l'accueil du type de compte choisi à la connexion
const HomeRoute = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accountType = useAuthStore(selectAccountType);
  if (!isAuthenticated) return <Navigate to={hasSeenOnboarding() ? '/login' : '/bienvenue'} replace />;
  return (
    <PrivateRoute>
      {accountType === 'entreprise' ? <EnterprisePage /> : <HomePage />}
    </PrivateRoute>
  );
};

// Nouveaux messages : pastilles, bandeau, son et vibration, sur toutes les pages
const ChatAlerts = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useChatAlerts({ api, getSocket, enabled: isAuthenticated, navigate });
  return null;
};

function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ChatAlerts />
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/confidentialite" element={<PrivacyPage />} />
        <Route path="/bienvenue" element={<OnboardingPage />} />
        <Route path="/vitrine" element={<LandingPage />} />

        {/* Routes protégées */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
        <Route path="/orders/new" element={<PrivateRoute><NewOrderPage /></PrivateRoute>} />
        <Route path="/orders/:id" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />
        <Route path="/enterprise" element={<Navigate to="/" replace />} />
        <Route path="/referral" element={<PrivateRoute><ReferralPage /></PrivateRoute>} />
        <Route path="/messages" element={<PrivateRoute><MessagesPage /></PrivateRoute>} />
        <Route path="/messages/:id" element={<PrivateRoute nav={false}><ChatPage /></PrivateRoute>} />
        <Route path="/profil" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/profil/infos" element={<PrivateRoute><PersonalInfoPage /></PrivateRoute>} />
        <Route path="/code-promo" element={<PrivateRoute><PromoPage /></PrivateRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
