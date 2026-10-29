import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useDriverAuthStore from '../store/authStore';
import { dateLocale } from '../../../shared/i18n/dom';

export default function DriverLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useDriverAuthStore((s) => s.login);
  const restore = useDriverAuthStore((s) => s.restore);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(phone, password);
      toast.success(`Bienvenue ${user.full_name}`);
      navigate('/');
    } catch (err) {
      const data = err.response?.data;
      if (err.message.includes('chauffeur')) {
        toast.error(err.message);
      } else if (data?.code === 'ACCOUNT_DELETION_PENDING') {
        // Compte supprimé il y a moins de 60 jours : on propose de le reprendre
        const until = new Date(data.restore_until).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' });
        if (window.confirm(`Votre compte est en cours de suppression. Vous pouvez le reprendre jusqu'au ${until}.\n\nReprendre mon compte ?`)) {
          try {
            const user = await restore(phone, password);
            toast.success(`Bon retour ${user.full_name} ! Votre compte est rétabli.`);
            navigate('/');
          } catch (restoreError) {
            if (restoreError.message.includes('chauffeur')) toast.error(restoreError.message);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bn-auth">
      <section className="bn-auth__hero">
        <img src="/icon-192.png" alt="" width="68" height="68" className="bn-auth__logo" />
        <p className="bn-kicker bn-auth__brand">BenneGo Driver</p>
        <h1 className="bn-auth__title">Vos courses, votre paiement, en un seul endroit</h1>
        <p className="bn-subtitle">Recevez des missions, suivez le chargement et soyez payé dès la réception confirmée.</p>
      </section>

      <form className="bn-card bn-auth__card" onSubmit={handleSubmit}>
        <label className="bn-field">
          <span className="bn-label">Numéro de téléphone</span>
          <input
            className="bn-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+22961234567"
            autoComplete="tel"
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
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>

      <p className="bn-auth__foot">
        Pas encore inscrit ? Contactez BenneGo au{' '}
        <a href="tel:+22900000000" className="bn-link">+229 00 00 00 00</a>
      </p>
    </main>
  );
}
