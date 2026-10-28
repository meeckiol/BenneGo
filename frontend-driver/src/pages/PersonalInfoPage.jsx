import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Lock } from 'lucide-react';
import api from '../services/api';
import useDriverAuthStore from '../store/authStore';
import '../../../frontend-client/src/styles/profile.css';

const FIELDS = ['prenom', 'nom', 'email', 'adresse', 'date_naissance'];
const toForm = (u = {}) => ({
  prenom: u.prenom || '',
  nom: u.nom || '',
  email: u.email || '',
  adresse: u.adresse || '',
  date_naissance: u.date_naissance ? String(u.date_naissance).slice(0, 10) : '',
});

/** Informations personnelles du camionneur : modifiables sauf le téléphone, vérifié par SMS. */
export default function PersonalInfoPage() {
  const navigate = useNavigate();
  const user = useDriverAuthStore((s) => s.user);
  const updateUser = useDriverAuthStore((s) => s.updateUser);
  const [form, setForm] = useState(toForm(user));
  const [saved, setSaved] = useState(toForm(user));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setForm(toForm(data.user));
      setSaved(toForm(data.user));
    }).catch(() => {});
  }, []);

  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const dirty = FIELDS.some((k) => form[k] !== saved[k]);

  const save = async (e) => {
    e.preventDefault();
    const changes = Object.fromEntries(FIELDS.filter((k) => form[k] !== saved[k]).map((k) => [k, form[k]]));
    setSaving(true);
    try {
      const { data } = await api.patch('/auth/me', changes);
      updateUser(data.user);
      setSaved(toForm(data.user));
      toast.success('Informations enregistrées');
    } catch {
      // L'erreur est affichée par l'intercepteur API
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="bn-page bn-profile2">
      <header className="bn-pinfo__head">
        <button type="button" className="bn-pinfo__back" onClick={() => navigate('/profil')} aria-label="Retour au profil">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1>Informations personnelles</h1>
      </header>

      <form className="bn-pinfo" onSubmit={save}>
        <div className="bn-pinfo__row">
          <label className="bn-field">
            <span className="bn-label">Prénom</span>
            <input className="bn-input" name="prenom" value={form.prenom} onChange={change} required maxLength={80} autoComplete="given-name" />
          </label>
          <label className="bn-field">
            <span className="bn-label">Nom</span>
            <input className="bn-input" name="nom" value={form.nom} onChange={change} required maxLength={80} autoComplete="family-name" />
          </label>
        </div>
        <label className="bn-field">
          <span className="bn-label">Téléphone</span>
          <span className="bn-pinfo__locked"><Lock size={15} aria-hidden="true" /> {user?.phone} · vérifié par SMS</span>
        </label>
        <label className="bn-field">
          <span className="bn-label">E-mail (facultatif)</span>
          <input className="bn-input" type="email" name="email" value={form.email} onChange={change} autoComplete="email" />
        </label>
        <label className="bn-field">
          <span className="bn-label">Adresse</span>
          <input className="bn-input" name="adresse" value={form.adresse} onChange={change} maxLength={200} autoComplete="street-address" />
        </label>
        <label className="bn-field">
          <span className="bn-label">Date de naissance</span>
          <input className="bn-input" type="date" name="date_naissance" value={form.date_naissance} onChange={change} />
        </label>
        <button type="submit" className="bn-btn bn-btn--primary bn-btn--block" disabled={!dirty || saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>
    </main>
  );
}
