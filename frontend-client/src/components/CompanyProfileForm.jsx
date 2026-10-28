import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

const toForm = (company = {}) => ({
  name: company.name || '',
  ifu: company.ifu || '',
  address: company.address || '',
  phone: company.phone || '',
  email: company.email || '',
});

/** Coordonnées légales de l'entreprise (raison sociale, IFU, siège) pour les proformas et les reçus. */
export default function CompanyProfileForm() {
  const [form, setForm] = useState(toForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get('/companies/my-company')
      .then(({ data }) => {
        if (active && data.company) setForm(toForm(data.company));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/companies/my-company', form);
      setForm(toForm(data.company));
      toast.success('Profil entreprise enregistré !');
    } catch {
      // L'erreur est affichée par l'intercepteur API
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bn-card" style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 className="bn-title" style={{ fontSize: 17 }}>Entreprise</h2>
        <p className="bn-subtitle">Coordonnées légales utilisées pour les factures proforma et les reçus.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
        <label className="bn-field">
          <span className="bn-label">Raison sociale</span>
          <input
            className="bn-input"
            value={form.name}
            onChange={update('name')}
            placeholder="Ex. Colas Bénin, Sogea-Satom, Immo Cotonou"
            required
          />
        </label>
        <label className="bn-field">
          <span className="bn-label">Numéro IFU (Bénin)</span>
          <input className="bn-input" value={form.ifu} onChange={update('ifu')} placeholder="Ex. 0201912345678" />
        </label>
        <label className="bn-field">
          <span className="bn-label">Adresse du siège</span>
          <input className="bn-input" value={form.address} onChange={update('address')} placeholder="Ex. Haie Vive, Cotonou" />
        </label>
        <label className="bn-field">
          <span className="bn-label">Téléphone de la direction</span>
          <input className="bn-input" type="tel" value={form.phone} onChange={update('phone')} placeholder="+229 21 00 00 00" />
        </label>
        <label className="bn-field">
          <span className="bn-label">E-mail de facturation</span>
          <input
            className="bn-input"
            type="email"
            value={form.email}
            onChange={update('email')}
            placeholder="facturation@entreprise.bj"
          />
        </label>

        <button type="submit" className="bn-btn bn-btn--primary bn-btn--block" disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer l’entreprise'}
        </button>
      </form>
    </section>
  );
}
