import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Camera, ChevronRight, FileText, Gift, LogOut, Tag } from 'lucide-react';
import api, { mediaUrl } from '../services/api';
import useAuthStore, { selectAccountType } from '../store/authStore';
import CompanyProfileForm from '../components/CompanyProfileForm';

const ACCOUNT_LABELS = { particulier: 'Compte client', entreprise: 'Compte entreprise' };
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const initialsOf = (name = '') => (
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'B'
);

/** Rubrique du profil : un lien avec une icône, un titre et une courte explication. */
function Rubrique({ to, icon: Icon, title, text }) {
  return (
    <Link to={to} className="bn-card bn-row">
      <Icon size={20} aria-hidden="true" />
      <span className="bn-row__main">
        <strong>{title}</strong>
        <span className="bn-subtitle">{text}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setProfilePhoto = useAuthStore((s) => s.setProfilePhoto);
  const accountType = useAuthStore(selectAccountType);
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);

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

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="bn-page">
      <header className="bn-page-head">
        <div>
          <p className="bn-kicker">Mon compte</p>
          <h1 className="bn-title">Profil</h1>
        </div>
      </header>

      <section className="bn-card bn-profile">
        {user?.profile_photo_url ? (
          <img className="bn-avatar bn-avatar--xl" src={mediaUrl(user.profile_photo_url)} alt="Photo de profil" />
        ) : (
          <span className="bn-avatar bn-avatar--xl" aria-hidden="true">{initialsOf(user?.full_name)}</span>
        )}
        <div className="bn-profile__identity">
          <strong>{user?.full_name}</strong>
          <span className="bn-subtitle">{user?.phone}</span>
          <span className="bn-pill bn-pill--brand">{ACCOUNT_LABELS[accountType]}</span>
          <button type="button" className="bn-link" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Camera size={14} aria-hidden="true" /> {uploading ? 'Envoi en cours…' : 'Changer la photo'}
          </button>
          <input ref={fileInput} type="file" accept={PHOTO_TYPES.join(',')} onChange={handlePhoto} hidden />
        </div>
      </section>

      {accountType === 'entreprise' && <CompanyProfileForm />}

      <div className="bn-list">
        <Rubrique to="/code-promo" icon={Tag} title="Code promo" text="Vérifiez la remise d'un code avant de commander." />
        <Rubrique to="/referral" icon={Gift} title="Affiliation" text="Partagez votre code et suivez vos gains." />
        <Rubrique to="/confidentialite" icon={FileText} title="Politique de confidentialité" text="Vos données et vos droits." />
      </div>

      <button type="button" className="bn-btn bn-btn--danger bn-btn--block" onClick={handleLogout}>
        <LogOut size={18} aria-hidden="true" /> Se déconnecter
      </button>
    </main>
  );
}
