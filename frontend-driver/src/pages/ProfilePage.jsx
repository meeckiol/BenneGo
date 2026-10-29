import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, ChevronRight, Copy, LogOut, MessageCircle, Settings, Share2, Truck, UserRound } from 'lucide-react';
import api, { mediaUrl } from '../services/api';
import { getSocket, destroySocket } from '../services/socket';
import useDriverAuthStore from '../store/authStore';
import { rewardLine, shareTextFor } from '../../../shared/ReferralView';
import { fcfa, initialsOf, TRUCK_LABELS, WHATSAPP_URL } from '../utils/format';
import '../../../frontend-client/src/styles/profile.css';

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Ligne de réglage avec une icône de couleur, comme le profil client. */
function Row({ to, href, onClick, icon: Icon, tone, title, text, danger }) {
  const content = (
    <>
      <span className={`bn-prow__icon bn-prow__icon--${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <span className="bn-prow__main">
        <strong>{title}</strong>
        {text && <small>{text}</small>}
      </span>
      {!danger && <ChevronRight size={18} className="bn-prow__chev" aria-hidden="true" />}
    </>
  );
  const className = `bn-prow${danger ? ' is-danger' : ''}`;
  if (to) return <Link to={to} className={className}>{content}</Link>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>;
  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

/**
 * Profil du camionneur (même composition que le client) : photo, carte de parrainage,
 * informations personnelles, véhicule, gains et note, notifications, aide, déconnexion.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useDriverAuthStore((s) => s.user);
  const logout = useDriverAuthStore((s) => s.logout);
  const updateUser = useDriverAuthStore((s) => s.updateUser);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [referral, setReferral] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get('/referrals/me').then(({ data }) => setReferral(data)).catch(() => setReferral({}));
    api.get('/drivers/me/summary').then(({ data }) => setSummary(data)).catch(() => {});
  }, []);

  const handlePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) return toast.error('Format non accepté : JPEG, PNG ou WebP');
    if (file.size > PHOTO_MAX_BYTES) return toast.error('Photo trop lourde : 2 Mo maximum');

    const form = new FormData();
    form.append('photo', file);
    setUploading(true);
    try {
      const { data } = await api.post('/auth/me/photo', form, { headers: { 'Content-Type': undefined } });
      updateUser({ profile_photo_url: data.profile_photo_url });
      toast.success('Photo de profil mise à jour');
    } catch {
      // L'erreur est affichée par l'intercepteur API
    } finally {
      setUploading(false);
    }
  };

  const code = referral?.referral_code;
  const shareText = code ? shareTextFor('driver', code, referral?.rewards?.same_type?.referee) : '';

  const copyCode = () => {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => toast.success('Code copié')).catch(() => {});
  };

  const shareCode = async () => {
    if (!code) return;
    if (navigator.share) {
      try { await navigator.share({ title: 'BenneGo', text: shareText }); } catch { /* partage annulé */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLogout = () => {
    // Hors ligne avant de partir : plus aucune course proposée sur ce téléphone
    getSocket()?.emit('driver_unavailable');
    try { localStorage.removeItem('bennego-driver-en-ligne'); } catch { /* stockage indisponible */ }
    destroySocket();
    logout();
    navigate('/login', { replace: true });
  };

  const truck = TRUCK_LABELS[summary?.truck_type || user?.truck_type] || 'Camion';
  const plate = summary?.truck_plate || user?.truck_plate;

  return (
    <main className="bn-page bn-profile2">
      <header className="bn-profile2__head">
        <button type="button" className="bn-profile2__photo" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label="Changer la photo de profil">
          {user?.profile_photo_url
            ? <img src={mediaUrl(user.profile_photo_url)} alt="" />
            : <span aria-hidden="true">{initialsOf(user?.full_name)}</span>}
          <span className="bn-profile2__cam" aria-hidden="true"><Camera size={14} /></span>
        </button>
        <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(',')} onChange={handlePhoto} hidden />
        <h1 className="bn-profile2__name">{user?.full_name}</h1>
        <p className="bn-profile2__phone">{user?.phone}</p>
        <span className="bn-profile2__pill">{uploading ? 'Envoi de la photo…' : `Camionneur · ${truck}`}</span>
      </header>

      <section className="bn-refer" aria-label="Code parrain">
        <div className="bn-refer__top">
          <strong>Parrainage</strong>
          {referral?.credit_balance > 0 && <span>Crédit : {fcfa(referral.credit_balance)}</span>}
        </div>
        <p>{rewardLine('driver', referral?.rewards)}</p>
        <button type="button" className="bn-refer__code" onClick={copyCode} disabled={!code} aria-label="Copier le code parrain">
          <span>{code || (referral ? '—' : '…')}</span>
          <Copy size={18} aria-hidden="true" />
        </button>
        <div className="bn-refer__actions">
          <button type="button" className="bn-refer__share" onClick={shareCode} disabled={!code}>
            <Share2 size={16} aria-hidden="true" /> Partager
          </button>
          <Link to="/profil/parrainage" className="bn-refer__more">{`Mes filleuls (${referral?.total_referrals ?? 0})`}</Link>
        </div>
      </section>

      <div className="bn-plist">
        <Row to="/profil/infos" icon={UserRound} tone="slate" title="Informations personnelles" text="Nom, adresse, e-mail" />
        <Row to="/profil/vehicule" icon={Truck} tone="sand" title="Véhicule" text={plate ? `${truck} · ${plate}` : truck} />
      </div>

      <div className="bn-pstats" aria-label="Vos chiffres">
        <div><strong>{summary ? summary.total_trips ?? 0 : '…'}</strong><small>Courses</small></div>
        <div><strong>{summary ? fcfa(summary.earnings?.this_month).replace(' FCFA', '') : '…'}</strong><small>FCFA ce mois</small></div>
        <div><strong>{summary?.rating ? Number(summary.rating).toFixed(1) : '—'}</strong><small>{summary?.rating_count ? `Note · ${summary.rating_count} avis` : 'Note'}</small></div>
      </div>

      <section className="bn-pgroup">
        <h2>Réglages</h2>
        <div className="bn-plist">
          <Row to="/profil/reglages" icon={Settings} tone="slate" title="Réglages" text="Notifications, confidentialité, sécurité, suppression" />
        </div>
      </section>

      <section className="bn-pgroup">
        <h2>Aide</h2>
        <div className="bn-plist">
          <Row href={WHATSAPP_URL} icon={MessageCircle} tone="green" title="Assistance WhatsApp" text="Un souci sur une course ou un paiement" />
        </div>
      </section>

      <div className="bn-plist">
        <Row onClick={handleLogout} icon={LogOut} tone="red" title="Se déconnecter" danger />
      </div>
    </main>
  );
}
