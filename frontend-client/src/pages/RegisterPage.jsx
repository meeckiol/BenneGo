import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

export default function RegisterPage() {
  const [form, setForm] = useState({
    prenom: '',
    nom: '',
    phone: '',
    date_naissance: '',
    adresse: '',
    email: '',
    password: '',
    role: 'client',
  });
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Compte créé avec succès !');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la création du compte');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FF6B00, #E05D00)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '440px' }}>
        <h2 style={{ color: '#FF6B00', textAlign: 'center', fontWeight: '900', margin: '0 0 16px' }}>BenneGo</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              placeholder="Prénom"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              required
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            />
            <input
              placeholder="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
            />
          </div>
          <input
            placeholder="Téléphone (+229...)"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <input
            placeholder="Date naissance"
            type="date"
            value={form.date_naissance}
            onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <input
            placeholder="Adresse"
            value={form.adresse}
            onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <input
            placeholder="Email (facultatif)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <input
            placeholder="Mot de passe (8 car. min)"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            style={{ padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '13px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer' }}
          >
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px' }}>
          <Link to="/login" style={{ color: '#FF6B00', fontWeight: '700' }}>
            Déjà un compte ? Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
