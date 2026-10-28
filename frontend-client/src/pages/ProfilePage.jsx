import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, ChevronRight, Copy, FileText, LogOut, MessageCircle, Share2, Tag, UserRound } from 'lucide-react';
import api, { mediaUrl } from '../services/api';
import useAuthStore, { selectAccountType } from '../store/authStore';
import { WHATSAPP_URL } from '../constants/contact';
import PushToggle from '../../../shared/PushToggle';
import '../styles/profile.css';

const ACCOUNT_LABELS = { particulier: 'Compte client', entreprise: 'Compte entreprise' };
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const DONE = ['validated', 'completed'];

const initialsOf = (name = '') => (
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'B'
);
const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

/** Ligne de réglage avec une icône de couleur (vert, ardoise, sable, rouge…). */
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
 * Profil : en-tête (photo, nom, type de compte), carte du code parrain, informations personnelles,
 * quelques chiffres, puis avantages, aide et déconnexion.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setProfilePhoto = useAuthStore((s) => s.setProfilePhoto);
  const accountType = useAuthStore(selectAccountType);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [referral, setReferral] = useState(null);
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api.get('/referrals/me').then(({ data }) => setReferral(data)).catch(() => setReferral({}));
    api.get('/orders').then(({ data }) => setOrders(data.orders || [])).catch(() => setOrders([]));
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
      const { data } = await api.post('/auth/me/photo', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setProfilePhoto(data.profile_photo_url);
      toast.success('Photo de profil mise à jour');
    } catch {
      // L'erreur est affichée par l'intercepteur API
    } finally {
      setUploading(false);
    }
  };

  const code = referral?.referral_code;
  const shareText = code
    ? `Rejoins BenneGo pour tes transports de matériaux et locations d'engins avec mon code ${code} et reçois 2500 FCFA de réduction sur ta première commande !`
    : '';

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
    logout();
    navigate('/login', { replace: true });
  };

  const delivered = (orders || []).filter((o) => DONE.includes(o.status)).length;

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
        <span className="bn-profile2__pill">{uploading ? 'Envoi de la photo…' : ACCOUNT_LABELS[accountType]}</span>
      </header>

      <section className="bn-refer" aria-label="Code parrain">
        <div className="bn-refer__top">
          <strong>Affiliation</strong>
          {referral?.total_rewards > 0 && <span>{fcfa(referral.total_rewards)} gagnés</span>}
        </div>
        <p>Chaque ami inscrit avec votre code vous rapporte 2 500 FCFA.</p>
        <button type="button" className="bn-refer__code" onClick={copyCode} disabled={!code} aria-label="Copier le code parrain">
          <span>{code || (referral ? '—' : '…')}</span>
          <Copy size={18} aria-hidden="true" />
        </button>
        <div className="bn-refer__actions">
          <button type="button" className="bn-refer__share" onClick={shareCode} disabled={!code}>
            <Share2 size={16} aria-hidden="true" /> Partager
          </button>
          <Link to="/referral" className="bn-refer__more">Mes filleuls</Link>
        </div>
      </section>

      <div className="bn-plist">
        <Row
          to="/profil/infos"
          icon={UserRound}
          tone="slate"
          title="Informations personnelles"
          text={accountType === 'entreprise' ? 'Identité, adresse et entreprise' : 'Nom, adresse, e-mail'}
        />
      </div>

      <div className="bn-pstats" aria-label="Vos chiffres">
        <div><strong>{orders ? orders.length : '…'}</strong><small>Commandes</small></div>
        <div><strong>{orders ? delivered : '…'}</strong><small>Livrées</small></div>
        <div><strong>{referral?.total_referrals ?? '…'}</strong><small>Filleuls</small></div>
      </div>

      <section className="bn-pgroup">
        <h2>Réglages</h2>
        <div className="bn-plist">
          <PushToggle api={api} />
        </div>
      </section>

      <section className="bn-pgroup">
        <h2>Avantages</h2>
        <div className="bn-plist">
          <Row to="/code-promo" icon={Tag} tone="sand" title="Code promo" text="Vérifier une remise avant de commander" />
        </div>
      </section>

      <section className="bn-pgroup">
        <h2>Aide et légal</h2>
        <div className="bn-plist">
          <Row href={WHATSAPP_URL} icon={MessageCircle} tone="green" title="Assistance WhatsApp" text="Une question sur une commande" />
          <Row to="/confidentialite" icon={FileText} tone="blue" title="Politique de confidentialité" text="Vos données et vos droits" />
        </div>
      </section>

      <div className="bn-plist">
        <Row onClick={handleLogout} icon={LogOut} tone="red" title="Se déconnecter" danger />
      </div>
    </main>
  );
}
