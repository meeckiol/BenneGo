import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleDemoAccess = () => {
    useAuthStore.setState({
      user: {
        id: '11111111-2222-3333-4444-555555555555',
        full_name: 'Ing. Koffi (Entreprise BTP)',
        phone: '+22997000000',
        role: 'client',
      },
      token: 'demo-token-123',
      isAuthenticated: true,
    });
    toast.success('Mode Démo activé : Bienvenue sur LogiTruck !');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(phone, password);
      toast.success(`Bienvenue ${user.full_name} !`);
      navigate('/');
    } catch (err) {
      // L'erreur est gérée par l'intercepteur axios
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <h1 style={styles.logoText}>LogiTruck</h1>
          <p style={styles.logoSub}>Livraison de matériaux au Bénin</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Numéro de téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+229 XX XX XX XX"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              required
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          <button
            type="button"
            onClick={handleDemoAccess}
            style={styles.demoButton}
          >
            ⚡ Accès Démo Direct (Voir le Dashboard)
          </button>
        </form>

        <p style={styles.footer}>
          Pas encore de compte ?{' '}
          <Link to="/register" style={styles.link}>S'inscrire</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #FF6B00 0%, #FF8C00 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  logo: { textAlign: 'center', marginBottom: '32px' },
  logoText: { fontSize: '28px', fontWeight: '800', color: '#FF6B00', margin: '8px 0 4px' },
  logoSub: { color: '#666', fontSize: '14px', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { fontWeight: '600', color: '#333', fontSize: '14px' },
  input: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: '2px solid #eee',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    padding: '14px',
    background: '#FF6B00',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
  },
  demoButton: {
    padding: '12px',
    background: '#0F172A',
    color: '#FFB74D',
    border: '1px solid #FF6B00',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  footer: { textAlign: 'center', marginTop: '24px', color: '#666', fontSize: '14px' },
  link: { color: '#FF6B00', fontWeight: '600', textDecoration: 'none' },
};
