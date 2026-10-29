import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, Gift, Share2, Wallet } from 'lucide-react';
import './referral.css';

const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;
const day = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '');
const ROLE = { client: 'Client', driver: 'Camionneur' };
const PAYOUT = { requested: 'En cours', paid: 'Versé', rejected: 'Refusé' };

/** Texte de partage : le filleul reçoit 1 500 FCFA s'il est du même type que le parrain. */
export const shareTextFor = (role, code, welcome = 1500) => (role === 'driver'
  ? `Rejoins BenneGo comme camionneur avec mon code ${code} : des courses de sable et de gravier près de chez toi, payées sur Mobile Money, et ${welcome.toLocaleString('fr-FR')} FCFA de bonus à ta première course livrée.`
  : `Rejoins BenneGo pour tes livraisons de matériaux avec mon code ${code} et reçois ${welcome.toLocaleString('fr-FR')} FCFA de réduction sur ta première commande !`);

/** Phrase des primes pour la carte de parrainage du profil. */
export const rewardLine = (role, rewards) => {
  const same = rewards?.same_type?.referrer ?? 1500;
  const cross = rewards?.cross_type?.referrer ?? 1000;
  const welcome = rewards?.same_type?.referee ?? 1500;
  return role === 'driver'
    ? `Chaque camionneur qui livre sa 1re course vous rapporte ${fcfa(same)} (${fcfa(cross)} pour un client qui fait sa 1re commande). Votre filleul camionneur reçoit ${fcfa(welcome)} de bonus.`
    : `Chaque ami qui fait sa 1re commande vous rapporte ${fcfa(same)} (${fcfa(cross)} pour un camionneur qui livre sa 1re course). Votre ami client reçoit ${fcfa(welcome)} de réduction.`;
};

/**
 * « Mes filleuls » (client et camionneur) : crédit BenneGo, règles des primes, code à partager,
 * avantage reçu comme filleul, saisie d'un code (avant la 1re commande ou course) et état de chaque filleul.
 */
export default function ReferralView({ api, role, onBack }) {
  const [data, setData] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/referrals/me').then(({ data: d }) => setData(d)).catch(() => setData({}));
  useEffect(() => { load(); }, []);

  const share = async () => {
    if (!data?.referral_code) return;
    const text = shareTextFor(role, data.referral_code, data.rewards?.same_type?.referee);
    if (navigator.share) {
      try { await navigator.share({ title: 'BenneGo', text }); } catch { /* partage annulé */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const copy = () => navigator.clipboard?.writeText(data.referral_code).then(() => toast.success('Code copié')).catch(() => {});

  const apply = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const { data: res } = await api.post('/referrals', { referral_code: code.trim() });
      toast.success(res.message || 'Code parrain enregistré');
      setCode('');
      await load();
    } catch { /* message affiché par l'intercepteur */ } finally {
      setBusy(false);
    }
  };

  const askPayout = async () => {
    if (!window.confirm(`Demander le versement de ${fcfa(data.credit_balance)} sur votre Mobile Money ?`)) return;
    setBusy(true);
    try {
      const { data: res } = await api.post('/referrals/credit/payout');
      toast.success(res.message || 'Demande envoyée');
      await load();
    } catch { /* message affiché par l'intercepteur */ } finally {
      setBusy(false);
    }
  };

  const same = data?.rewards?.same_type;
  const cross = data?.rewards?.cross_type;
  const credit = data?.credit_balance ?? 0;
  const firstStep = (r) => (r === 'driver' ? 'sa 1re course livrée' : 'sa 1re commande livrée');

  return (
    <main className="bn-page bn-referral2">
      <header className="bn-referral2__head">
        <button type="button" className="bn-referral2__back" onClick={onBack} aria-label="Retour au profil">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1>Mes filleuls</h1>
      </header>

      {data === null ? <p className="bn-subtitle">Chargement…</p> : (
        <>
          <section className="bn-credit" aria-label="Crédit BenneGo">
            <span className="bn-credit__icon"><Wallet size={22} aria-hidden="true" /></span>
            <div className="bn-credit__main">
              <small>Votre crédit BenneGo</small>
              <strong>{fcfa(credit)}</strong>
              <span>
                {role === 'driver'
                  ? `Versé sur votre Mobile Money à la demande (dès ${fcfa(data.min_payout || 500)}).`
                  : 'À utiliser quand vous voulez : cochez « Utiliser mon crédit » au moment du devis.'}
              </span>
            </div>
          </section>
          {role === 'driver' && (
            <button type="button" className="bn-btn bn-btn--primary bn-btn--block" onClick={askPayout}
              disabled={busy || credit < (data.min_payout || 500) || data.payouts?.some((p) => p.status === 'requested')}>
              Demander le versement
            </button>
          )}
          {role === 'driver' && data.payouts?.length > 0 && (
            <ul className="bn-referral2__payouts">
              {data.payouts.map((p) => (
                <li key={p.id}><span>{day(p.requested_at)} · {fcfa(p.amount)}</span><b className={`is-${p.status}`}>{PAYOUT[p.status]}</b></li>
              ))}
            </ul>
          )}

          <section className="bn-refer" aria-label="Code parrain">
            <div className="bn-refer__top"><strong>Votre code</strong></div>
            <button type="button" className="bn-refer__code" onClick={copy} disabled={!data.referral_code} aria-label="Copier le code parrain">
              <span>{data.referral_code || '—'}</span>
              <Copy size={18} aria-hidden="true" />
            </button>
            <button type="button" className="bn-refer__share" onClick={share} disabled={!data.referral_code}>
              <Share2 size={16} aria-hidden="true" /> Partager mon code
            </button>
          </section>

          <section className="bn-rules" aria-label="Comment gagner">
            <h2>Comment ça marche</h2>
            <ul>
              <li>
                <b>{role === 'driver' ? 'Un camionneur' : 'Un client'} :</b>{' '}
                {/* Phrase d'un seul tenant : traduite en entier dans les autres langues */}
                {`${fcfa(same?.referrer ?? 1500)} pour vous quand il fait ${firstStep(role)}. Il reçoit aussi ${fcfa(same?.referee ?? 1500)} ${role === 'driver' ? 'de bonus' : 'de réduction sur sa 1re commande'}.`}
              </li>
              <li>
                <b>{role === 'driver' ? 'Un client' : 'Un camionneur'} :</b>{' '}
                {`${fcfa(cross?.referrer ?? 1000)} pour vous quand il fait ${firstStep(role === 'driver' ? 'client' : 'driver')}.`}
              </li>
              <li>Votre filleul saisit votre code à son inscription, avant sa 1re commande ou course.</li>
            </ul>
          </section>

          {data.welcome && (
            <p className="bn-rules__welcome">
              <Gift size={16} aria-hidden="true" /> Parrainé par {data.welcome.referrer}
              {data.welcome.amount > 0 && (role === 'driver'
                ? ` : ${fcfa(data.welcome.amount)} de bonus à votre 1re course livrée${data.welcome.status === 'rewarded' ? ' (reçus)' : ''}.`
                : ` : ${fcfa(data.welcome.amount)} de réduction sur votre 1re commande${data.welcome.status === 'rewarded' ? ' (utilisés)' : ''}.`)}
            </p>
          )}

          {data.can_apply_code && (
            <form className="bn-pinfo" onSubmit={apply}>
              <label className="bn-field">
                <span className="bn-label">Vous avez un code parrain ?</span>
                <input className="bn-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={30} placeholder="Ex. D0P4EP" />
              </label>
              <button type="submit" className="bn-btn bn-btn--primary bn-btn--block" disabled={busy || !code.trim()}>Valider le code</button>
            </form>
          )}

          <section className="bn-referees" aria-label="Vos filleuls">
            <h2>{data.total_referrals || 0} filleul(s)</h2>
            {(data.referees || []).length === 0 ? (
              <p className="bn-subtitle">Partagez votre code : vos filleuls apparaîtront ici avec l'avancement de votre prime.</p>
            ) : (
              <ul>
                {data.referees.map((r) => (
                  <li key={r.id}>
                    <span className="bn-referees__avatar" aria-hidden="true">{r.name.slice(0, 1)}</span>
                    <span className="bn-referees__main">
                      <strong>{r.name} <small>{ROLE[r.role] || ''}</small></strong>
                      <span>{r.status === 'rewarded' ? `Prime gagnée le ${day(r.rewarded_at)}` : `Inscrit le ${day(r.created_at)} · en attente de ${firstStep(r.role)}`}</span>
                    </span>
                    <b className={r.status === 'rewarded' ? 'is-won' : ''}>{r.status === 'rewarded' ? '+' : ''}{fcfa(r.reward)}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
