import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import AuthShell from '../components/AuthShell';

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
    <AuthShell
      tab="register"
      title="Créer un compte."
      subtitle="Quelques informations et un code par SMS, puis vous pouvez commander."
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input
            className="bn-input"
            placeholder="Prénom"
            value={form.prenom}
            onChange={(e) => setForm({ ...form, prenom: e.target.value })}
            required
          />
          <input
            className="bn-input"
            placeholder="Nom"
            value={form.nom}
            onChange={(e) => setForm({ ...form, nom: e.target.value })}
            required
          />
        </div>

        <input
          className="bn-input"
          placeholder="Téléphone (+229...)"
          type="tel"
          value={form.phone}
          onChange={(e) => changePhone(e.target.value)}
          disabled={verified}
          required
        />
        {!verified && (
          <div style={{ display: 'flex', gap: 8 }}>
            {!otpSent ? (
              <button
                type="button"
                className="bn-btn bn-btn--block"
                onClick={requestCode}
                disabled={otpLoading || cleanPhone.length < 8}
              >
                {otpLoading ? 'Envoi...' : 'Recevoir le code par SMS'}
              </button>
            ) : (
              <>
                <input
                  className="bn-input"
                  placeholder="Code à 6 chiffres"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  style={{ flex: 1, letterSpacing: '4px', textAlign: 'center' }}
                />
                <button type="button" className="bn-btn" onClick={verifyCode} disabled={otpLoading || code.length !== 6}>
                  {otpLoading ? '...' : 'Valider'}
                </button>
              </>
            )}
          </div>
        )}
        {verified && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--success)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} aria-hidden="true" /> Numéro vérifié</p>
        )}

        <input
          className="bn-input"
          placeholder="Date naissance"
          type="date"
          value={form.date_naissance}
          onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
          required
        />
        <input
          className="bn-input"
          placeholder="Adresse"
          value={form.adresse}
          onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          required
        />
        <input
          className="bn-input"
          placeholder="Email (facultatif)"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="bn-input"
          placeholder="Mot de passe (8 car. min)"
          type="password"
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button type="submit" className="bn-btn bn-btn--primary bn-btn--block bn-login__submit" disabled={loading || !verified}>
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>
      <p className="bn-login__foot">
        Déjà un compte ? <Link to="/login" className="bn-link">Se connecter</Link>
      </p>
    </AuthShell>
  );
}
