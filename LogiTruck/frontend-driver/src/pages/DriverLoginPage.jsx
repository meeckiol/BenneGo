import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useDriverAuthStore from '../store/authStore';

export default function DriverLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useDriverAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(phone, password);
      toast.success(`Bienvenue ${user.full_name}`);
      navigate('/');
    } catch (err) {
      if (err.message.includes('chauffeur')) {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <h1 style={styles.title}>LogiTruck</h1>
          <p style={styles.subtitle}>Espace Chauffeur</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Numéro de téléphone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+22961234567"
              style={styles.input}
              required
              autoComplete="tel"
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
              autoComplete="current-password"
            />
          </div>

          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div style={styles.helpBox}>
          <p style={styles.helpText}>
            Pas encore inscrit ? Contactez LogiTruck au
          </p>
          <a href="tel:+22900000000" style={styles.helpPhone}>
            +229 00 00 00 00
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '40px 32px',
    width: '100%',
    maxWidth: '380px',
  },
  logo: { textAlign: 'center', marginBottom: '36px' },
  title: { fontSize: '28px', fontWeight: '800', color: '#FF6B00', margin: '0 0 6px' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '600' },
  input: {
    padding: '13px 16px',
    borderRadius: '10px',
    border: '1.5px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    fontSize: '16px',
    outline: 'none',
  },
  btn: {
    padding: '15px',
    background: '#FF6B00',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '17px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
  },
  helpBox: {
    marginTop: '28px',
    textAlign: 'center',
    padding: '16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
  },
  helpText: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: '0 0 6px' },
  helpPhone: { color: '#FF6B00', fontWeight: '700', textDecoration: 'none', fontSize: '15px' },
};
