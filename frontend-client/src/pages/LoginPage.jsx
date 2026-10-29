import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, Phone } from 'lucide-react';
import useAuthStore from '../store/authStore';
import AuthShell from '../components/AuthShell';

const ACCOUNT_TYPES = [
  { key: 'particulier', label: 'Client', hint: 'Commandes à l\'unité, pour vous ou un proche.' },
  { key: 'entreprise', label: 'Entreprise', hint: 'Chantiers, commandes groupées et factures proforma.' },
];

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState('particulier');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const restore = useAuthStore((s) => s.restore);
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
      // Compte supprimé il y a moins de 60 jours : on propose de le reprendre (autres erreurs : intercepteur axios)
      const data = err.response?.data;
      if (data?.code === 'ACCOUNT_DELETION_PENDING') {
        const until = new Date(data.restore_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        if (window.confirm(`Votre compte est en cours de suppression. Vous pouvez le reprendre jusqu'au ${until}.\n\nReprendre mon compte ?`)) {
          try {
            const user = await restore(phone, password);
            toast.success(`Bon retour ${user.full_name} ! Votre compte est rétabli.`);
            navigate('/');
          } catch { /* intercepteur */ }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      tab="login"
      title="Bon retour."
      subtitle="Reprenez là où vous en étiez : vos chantiers et vos commandes vous attendent."
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
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

        <label className="bn-login__input">
          <Phone size={18} aria-hidden="true" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Numéro de téléphone"
            aria-label="Numéro de téléphone"
            autoComplete="username"
            required
          />
        </label>

        <label className="bn-login__input">
          <Lock size={18} aria-hidden="true" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            aria-label="Mot de passe"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="bn-login__eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </label>

        <button type="submit" disabled={loading} className="bn-btn bn-btn--primary bn-btn--block bn-login__submit">
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>

        {import.meta.env.DEV && (
          <button type="button" onClick={handleDemoAccess} className="bn-btn bn-btn--block">
            Accès démo (développement)
          </button>
        )}
      </form>

      <p className="bn-login__foot">
        Nouveau sur BenneGo ? <Link to="/register" className="bn-link">Créer un compte</Link>
        {' · '}
        <Link to="/confidentialite" className="bn-link">Confidentialité</Link>
      </p>
    </AuthShell>
  );
}
