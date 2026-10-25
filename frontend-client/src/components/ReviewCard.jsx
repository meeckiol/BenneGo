import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import api from '../services/api';
import StarRating from './StarRating';

/**
 * Après confirmation de la réception : noter le chauffeur (1-5 étoiles + avis)
 * et/ou donner son avis sur la plateforme.
 */
export default function ReviewCard({ order, onDone }) {
  const [tab, setTab] = useState('driver');
  const [rating, setRating] = useState(order.client_rating || 0);
  const [comment, setComment] = useState('');
  const [platformRating, setPlatformRating] = useState(0);
  const [platformComment, setPlatformComment] = useState('');
  const [driverDone, setDriverDone] = useState(!!order.client_rating);
  const [platformDone, setPlatformDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submitDriver = async () => {
    if (!rating) return toast.error('Choisissez une note de 1 à 5 étoiles');
    setBusy(true);
    try {
      await api.post(`/reviews/orders/${order.id}/driver`, { rating, comment: comment.trim() || undefined });
      setDriverDone(true);
      toast.success('Merci pour votre avis sur le chauffeur !');
      onDone?.();
    } catch { /* message affiché par l'intercepteur */ } finally { setBusy(false); }
  };

  const submitPlatform = async () => {
    if (platformComment.trim().length < 3) return toast.error('Écrivez quelques mots pour votre avis');
    setBusy(true);
    try {
      await api.post('/reviews/platform', {
        order_id: order.id,
        rating: platformRating || undefined,
        comment: platformComment.trim(),
      });
      setPlatformDone(true);
      toast.success('Merci pour votre avis sur BenneGo !');
    } catch { /* idem */ } finally { setBusy(false); }
  };

  return (
    <div style={s.card}>
      <h3 style={s.title}>Votre avis compte</h3>
      <div style={s.tabs} role="tablist">
        <button role="tab" aria-selected={tab === 'driver'} onClick={() => setTab('driver')}
          style={{ ...s.tab, ...(tab === 'driver' ? s.tabOn : {}) }}>
          Le chauffeur {driverDone && <Check size={14} aria-hidden="true" />}
        </button>
        <button role="tab" aria-selected={tab === 'platform'} onClick={() => setTab('platform')}
          style={{ ...s.tab, ...(tab === 'platform' ? s.tabOn : {}) }}>
          La plateforme {platformDone && <Check size={14} aria-hidden="true" />}
        </button>
      </div>

      {tab === 'driver' && (driverDone ? (
        <div style={s.done}>
          <StarRating value={rating} size={28} label="Votre note" />
          <p>Merci, votre note a bien été enregistrée.</p>
        </div>
      ) : (
        <div style={s.form}>
          <p style={s.hint}>Comment s'est passée la livraison avec {order.driver_name || 'votre chauffeur'} ?</p>
          <StarRating value={rating} onChange={setRating} label="Note du chauffeur" />
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3}
            placeholder="Ponctualité, état du chargement, courtoisie… (facultatif)" style={s.textarea} />
          <button onClick={submitDriver} disabled={busy} style={s.btn}>Envoyer ma note</button>
        </div>
      ))}

      {tab === 'platform' && (platformDone ? (
        <div style={s.done}><p>Merci, votre avis sur BenneGo a bien été envoyé.</p></div>
      ) : (
        <div style={s.form}>
          <p style={s.hint}>Que pensez-vous de BenneGo (commande, paiement sécurisé, suivi) ?</p>
          <StarRating value={platformRating} onChange={setPlatformRating} label="Note de la plateforme" size={30} />
          <textarea value={platformComment} onChange={(e) => setPlatformComment(e.target.value)} maxLength={1000} rows={3}
            placeholder="Votre avis sur la plateforme" style={s.textarea} />
          <button onClick={submitPlatform} disabled={busy} style={s.btn}>Envoyer mon avis</button>
        </div>
      ))}
    </div>
  );
}

const s = {
  card: { background: 'var(--surface)', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  title: { margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: 'var(--text-strong)' },
  tabs: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: { flex: 1, padding: '10px 8px', borderRadius: 8, border: '2px solid var(--border)', background: 'var(--surface)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-2)' },
  tabOn: { borderColor: '#FF6B00', color: '#FF6B00', background: 'var(--warning-soft)' },
  form: { display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' },
  hint: { margin: 0, fontSize: 14, color: 'var(--text-2)' },
  textarea: { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 8, border: '2px solid var(--border)', fontSize: 15, fontFamily: 'inherit', resize: 'vertical' },
  btn: { alignSelf: 'stretch', padding: 14, background: '#FF6B00', color: '#0b0b10', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  done: { color: 'var(--success)', fontSize: 14 },
};
