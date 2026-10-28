import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';

const ACCOUNT_TYPES = [
  { key: 'particulier', label: 'Client', hint: 'Commandes à l\'unité, pour vous ou un proche.' },
  { key: 'entreprise', label: 'Entreprise', hint: 'Chantiers, commandes groupées et factures proforma.' },
];

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('particulier');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const selected = ACCOUNT_TYPES.find((type) => type.key === accountType);

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
      accountType,
    });
    toast.success('Mode Démo activé : Bienvenue sur BenneGo !');
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(phone, password, accountType);
      toast.success(`Bienvenue ${user.full_name} !`);
      navigate('/');
    } catch (err) {
      // L'erreur est gérée par l'intercepteur axios
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bn-auth">
      <section className="bn-auth__hero">
        <img src="/logo-icon.png" alt="" width="68" height="68" className="bn-auth__logo" />
        <p className="bn-kicker bn-auth__brand">BenneGo</p>
        <h1 className="bn-auth__title">Gérez vos livraisons de matériaux en toute simplicité</h1>
        <p className="bn-subtitle">Sable, gravier, latérite, engins et évacuation. Votre paiement reste bloqué jusqu'à la livraison.</p>
      </section>

      <form className="bn-card bn-auth__card" onSubmit={handleSubmit}>
        <div className="bn-field">
          <span className="bn-label" id="account-type-label">Vous vous connectez en tant que</span>
          <div
            className="bn-segment"
            role="radiogroup"
            aria-labelledby="account-type-label"
            style={{ gridTemplateColumns: '1fr 1fr' }}
          >
            {ACCOUNT_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                role="radio"
                aria-checked={accountType === type.key}
                className={`bn-segment__btn${accountType === type.key ? ' is-active' : ''}`}
                onClick={() => setAccountType(type.key)}
              >
                {type.label}
              </button>
            ))}
          </div>
          <span className="bn-subtitle">{selected.hint}</span>
        </div>

        <label className="bn-field">
          <span className="bn-label">Numéro de téléphone</span>
          <input
            className="bn-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+229 XX XX XX XX"
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
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        {import.meta.env.DEV && (
          <button type="button" onClick={handleDemoAccess} className="bn-btn bn-btn--block">
            Accès démo (développement)
          </button>
        )}
      </form>

      <p className="bn-auth__foot">
        Pas encore de compte ? <Link to="/register" className="bn-link">S'inscrire</Link>
        {' · '}
        <Link to="/confidentialite" className="bn-link">Confidentialité</Link>
      </p>
    </main>
  );
}
