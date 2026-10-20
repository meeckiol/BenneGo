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
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.logo}>
          <img src="/logo-icon.png" alt="BenneGo" style={{ width: 48, height: 48, borderRadius: 10, marginBottom: 8 }} />
          <h1 style={s.logoTitle}>BenneGo</h1>
          <p style={s.logoSub}>Administration</p>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Téléphone administrateur</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+22900000000" style={s.input} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" style={s.input} required />
          </div>
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Connexion...' : 'Accéder au dashboard'}
          </button>
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={handleDemoAccess}
              style={s.demoBtn}
            >
              Accès Démo Administrateur
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const s = {
  container: { minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  card: { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '380px' },
  logo: { textAlign: 'center', marginBottom: '32px' },
  logoIcon: { fontSize: '48px' },
  logoTitle: { fontSize: '26px', fontWeight: '800', color: '#FF6B00', margin: '8px 0 4px' },
  logoSub: { color: '#64748b', fontSize: '14px', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#94a3b8', fontSize: '13px', fontWeight: '600' },
  input: { padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '15px', outline: 'none' },
  btn: { padding: '14px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' },
  demoBtn: { padding: '12px', background: '#1e3a8a', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
};
