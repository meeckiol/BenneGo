import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, MessageCircle } from 'lucide-react';
import api from '../services/api';
import useDriverAuthStore from '../store/authStore';
import { TRUCK_LABELS, WHATSAPP_URL } from '../utils/format';
import '../../../frontend-client/src/styles/profile.css';

const OPERATORS = { mtn: 'MTN MoMo', moov: 'Moov Money' };
// Seuls les 2 derniers chiffres du numéro de paiement restent visibles
const masked = (n = '') => (n ? `${n.slice(0, 4)} •• •• ${n.slice(-2)}` : '—');

/**
 * Véhicule et paiement, en lecture seule : ils sont vérifiés par BenneGo.
 * Une modification passe par l'assistance, pour éviter qu'un téléphone volé change le compte de versement.
 */
export default function VehiclePage() {
  const navigate = useNavigate();
  const stored = useDriverAuthStore((s) => s.user);
  const [me, setMe] = useState(stored);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setMe(data.user)).catch(() => {});
  }, []);

  const rows = [
    ['Type de camion', TRUCK_LABELS[me?.truck_type] || '—'],
    ['Capacité', me?.truck_capacity_m3 ? `${Number(me.truck_capacity_m3)} m³` : '—'],
    ['Immatriculation', me?.truck_plate || '—'],
    ['Paiement des courses', me?.momo_provider ? `${OPERATORS[me.momo_provider] || me.momo_provider} · ${masked(me.momo_number)}` : '—'],
  ];

  return (
    <main className="bn-page bn-profile2">
      <header className="bn-pinfo__head">
        <button type="button" className="bn-pinfo__back" onClick={() => navigate('/profil')} aria-label="Retour au profil">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1>Véhicule</h1>
      </header>

      <section className="bn-pinfo" aria-label="Votre véhicule">
        {rows.map(([label, value]) => (
          <div key={label} className="bn-field">
            <span className="bn-label">{label}</span>
            <span className="bn-pinfo__locked"><Lock size={15} aria-hidden="true" /> {value}</span>
          </div>
        ))}
        <p className="bn-subtitle">Ces informations sont vérifiées par BenneGo. Pour les changer, écrivez à l'assistance.</p>
        <a className="bn-btn bn-btn--primary bn-btn--block" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={18} aria-hidden="true" /> Demander une modification
        </a>
      </section>
    </main>
  );
}
