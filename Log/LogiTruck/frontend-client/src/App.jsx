import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import NewOrderPage from './pages/NewOrderPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';

// Guard pour les routes protégées
const PrivateRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Routes protégées */}
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/orders" element={<PrivateRoute><OrdersPage /></PrivateRoute>} />
      <Route path="/orders/new" element={<PrivateRoute><NewOrderPage /></PrivateRoute>} />
      <Route path="/orders/:id" element={<PrivateRoute><OrderDetailPage /></PrivateRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
