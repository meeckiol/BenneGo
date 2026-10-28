import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';

const fcfa = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

export default function PromoPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const check = async (event) => {
    event.preventDefault();
    setResult(null);
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/promo/validate', { code: code.trim(), order_amount: Number(amount) });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Code promo invalide');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bn-page">
      <header className="bn-page-head">
        <button className="bn-icon-btn" onClick={() => navigate(-1)} aria-label="Retour"><ArrowLeft size={20} aria-hidden="true" /></button>
        <div>
          <p className="bn-kicker">Mon compte</p>
          <h1 className="bn-title">Code promo</h1>
        </div>
      </header>

      <section className="bn-card">
        <p className="bn-subtitle">
          Saisissez un code pour voir la remise qu'il donne sur un montant. Pour en profiter, saisissez-le ensuite dans « Nouvelle commande ».
        </p>
        <form onSubmit={check} style={{ display: 'grid', gap: 14 }}>
          <label className="bn-field">
            <span className="bn-label">Code promo</span>
            <input
              className="bn-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex. BIENVENUE10"
              required
            />
          </label>
          <label className="bn-field">
            <span className="bn-label">Montant de la commande (FCFA)</span>
            <input
              className="bn-input"
              type="number"
              min="0"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="bn-btn bn-btn--primary bn-btn--block" disabled={loading}>
            {loading ? 'Vérification…' : 'Vérifier le code'}
          </button>
        </form>

        {error && <p className="bn-subtitle" role="alert">{error}</p>}

        {result && (
          <div className="bn-list">
            <div className="bn-row bn-row--static">
              <span>Remise</span>
              <strong>-{fcfa(result.discount_amount)}</strong>
            </div>
            <div className="bn-row bn-row--static">
              <span>Total pour ce montant</span>
              <strong>{fcfa(result.final_amount)}</strong>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
