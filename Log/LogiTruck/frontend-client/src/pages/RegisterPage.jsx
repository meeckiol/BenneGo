import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const [form, setForm] = useState({ phone: '', full_name: '', password: '', role: 'client' });
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Compte créé avec succès !');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <h1 style={styles.logoText}>LogiTruck</h1>
          <p style={styles.sub}>Créer un compte</p>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Nom complet</label>
            <input name="full_name" value={form.full_name} onChange={handleChange}
              placeholder="Koffi Atchadé" style={styles.input} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Téléphone (MTN/Moov)</label>
            <input name="phone" type="tel" value={form.phone} onChange={handleChange}
              placeholder="+22961234567" style={styles.input} required />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Mot de passe</label>
            <input name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="8 caractères minimum" style={styles.input} required minLength={8} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Je suis</label>
            <select name="role" value={form.role} onChange={handleChange} style={styles.input}>
              <option value="client">Client (je commande des matériaux)</option>
              <option value="driver">Chauffeur (je livre des matériaux)</option>
            </select>
          </div>
          <button type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <p style={styles.footer}>
          Déjà inscrit ? <Link to="/login" style={styles.link}>Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'linear-gradient(135deg, #FF6B00, #FF8C00)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  card: { background: 'white', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  logo: { textAlign: 'center', marginBottom: '24px' },
  logoText: { fontSize: '24px', fontWeight: '800', color: '#FF6B00', margin: '4px 0' },
  sub: { color: '#666', margin: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontWeight: '600', color: '#333', fontSize: '13px' },
  input: { padding: '11px 14px', borderRadius: '8px', border: '2px solid #eee', fontSize: '15px' },
  btn: { padding: '14px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' },
  footer: { textAlign: 'center', marginTop: '20px', color: '#666', fontSize: '14px' },
  link: { color: '#FF6B00', fontWeight: '600', textDecoration: 'none' },
};
