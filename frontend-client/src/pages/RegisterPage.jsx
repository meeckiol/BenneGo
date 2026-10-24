import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid var(--border-2)' };

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
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const cleanPhone = form.phone.replace(/\s+/g, '');

  const changePhone = (value) => {
    setForm({ ...form, phone: value });
    setOtpSent(false);
    setVerified(false);
    setCode('');
  };

  const requestCode = async () => {
    setOtpLoading(true);
    try {
      await api.post('/auth/otp/request', { phone: cleanPhone });
      setOtpSent(true);
      toast.success('Code envoyé par SMS');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Impossible d\'envoyer le code');
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyCode = async () => {
    setOtpLoading(true);
    try {
      await api.post('/auth/otp/verify', { phone: cleanPhone, code });
      setVerified(true);
      toast.success('Numéro vérifié');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Code incorrect');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!verified) {
      toast.error('Vérifiez votre numéro par SMS avant de créer le compte');
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, phone: cleanPhone });
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
      <div style={{ background: 'var(--surface)', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '440px' }}>
        <h2 style={{ color: '#FF6B00', textAlign: 'center', fontWeight: '900', margin: '0 0 16px' }}>BenneGo</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <input
              placeholder="Prénom"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              required
              style={inputStyle}
            />
            <input
              placeholder="Nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
              style={inputStyle}
            />
          </div>

          <input
            placeholder="Téléphone (+229...)"
            type="tel"
            value={form.phone}
            onChange={(e) => changePhone(e.target.value)}
            disabled={verified}
            required
            style={inputStyle}
          />
          {!verified && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {!otpSent ? (
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={otpLoading || cleanPhone.length < 8}
                  style={{ flex: 1, padding: '10px', background: 'var(--surface)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {otpLoading ? 'Envoi...' : 'Recevoir le code par SMS'}
                </button>
              ) : (
                <>
                  <input
                    placeholder="Code à 6 chiffres"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    style={{ ...inputStyle, flex: 1, letterSpacing: '4px', textAlign: 'center' }}
                  />
                  <button
                    type="button"
                    onClick={verifyCode}
                    disabled={otpLoading || code.length !== 6}
                    style={{ padding: '10px 14px', background: 'var(--surface)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    {otpLoading ? '...' : 'Valider'}
                  </button>
                </>
              )}
            </div>
          )}
          {verified && (
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--success)', fontWeight: '700' }}>✓ Numéro vérifié</p>
          )}

          <input
            placeholder="Date naissance"
            type="date"
            value={form.date_naissance}
            onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
            required
            style={inputStyle}
          />
          <input
            placeholder="Adresse"
            value={form.adresse}
            onChange={(e) => setForm({ ...form, adresse: e.target.value })}
            required
            style={inputStyle}
          />
          <input
            placeholder="Email (facultatif)"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Mot de passe (8 car. min)"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading || !verified}
            style={{ padding: '13px', background: verified ? '#FF6B00' : '#CBD5E1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: verified ? 'pointer' : 'not-allowed' }}
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
