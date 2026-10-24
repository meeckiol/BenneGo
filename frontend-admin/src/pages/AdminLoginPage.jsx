import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAdminStore from '../store/adminStore';

export default function AdminLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAdminStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(phone, password);
      toast.success('Bienvenue, administrateur');
      navigate('/');
    } catch (err) {
      if (err.message.includes('administrateurs')) toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    useAdminStore.setState({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Superviseur BenneGo Admin',
        phone: '+22997000001',
        role: 'admin',
      },
      token: 'demo-admin-token-123',
      isAuthenticated: true,
    });
    toast.success('Mode Démo Administrateur activé !');
    navigate('/');
  };

  return (
    <main className="bn-auth bn-auth--admin">
      <section className="bn-auth__hero">
        <img src="/logo-icon.png" alt="" width="60" height="60" className="bn-auth__logo" />
        <p className="bn-kicker bn-auth__brand">BenneGo · Administration</p>
        <h1 className="bn-auth__title">Console d'exploitation</h1>
        <p className="bn-subtitle">Séquestres, reversements, litiges et pannes. Réservé à l'équipe BenneGo.</p>
      </section>

      <form className="bn-card bn-auth__card" onSubmit={handleSubmit}>
        <label className="bn-field">
          <span className="bn-label">Téléphone administrateur</span>
          <input
            className="bn-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+22900000000"
            autoComplete="username"
            required
          />
        </label>

        <label className="bn-field">
          <span className="bn-label">Mot de passe</span>
          <input
            className="bn-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={loading} className="bn-btn bn-btn--primary bn-btn--block">
          {loading ? 'Connexion…' : 'Accéder au tableau de bord'}
        </button>

        {import.meta.env.DEV && (
          <button type="button" onClick={handleDemoAccess} className="bn-btn bn-btn--block">
            Accès démo administrateur
          </button>
        )}
      </form>
    </main>
  );
}
