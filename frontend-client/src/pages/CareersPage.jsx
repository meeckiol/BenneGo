import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function CareersPage() {
  const navigate = useNavigate();
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    cover_letter: '',
  });

  useEffect(() => {
    loadCareers();
  }, []);

  const loadCareers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/careers');
      setCareers(data.careers || []);
    } catch {
      toast.error('Impossible de charger les offres d\'emploi');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.email || !form.phone) {
      return toast.error('Veuillez renseigner votre nom, email et téléphone');
    }
    setSubmitting(true);
    try {
      await api.post(`/careers/${selectedJob.id}/apply`, form);
      toast.success('Candidature envoyée avec succès ! Notre équipe vous contactera.');
      setSelectedJob(null);
      setForm({ full_name: '', email: '', phone: '', cover_letter: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>← Retour</button>
          <span style={styles.logo}>BenneGo Carrières</span>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Rejoignez l'aventure BenneGo</h1>
          <p style={styles.heroSub}>
            Construisons ensemble l'avenir de la logistique BTP et du transport lourd au Bénin et en Afrique de l'Ouest.
          </p>
        </div>

        {loading ? (
          <div style={styles.loading}>Chargement des opportunités...</div>
        ) : careers.length === 0 ? (
          <div style={styles.empty}>
            <p>Aucune offre ouverte pour le moment. Revenez bientôt !</p>
          </div>
        ) : (
          <div style={styles.jobList}>
            {careers.map((job) => (
              <div key={job.id} style={styles.jobCard}>
                <div style={styles.jobHeader}>
                  <div>
                    <h3 style={styles.jobTitle}>{job.title}</h3>
                    <div style={styles.jobMeta}>
                      <span>{job.location || 'Cotonou, Bénin'}</span>
                      <span>·</span>
                      <span>{job.contract_type || 'CDI'}</span>
                      {job.department && (
                        <>
                          <span>·</span>
                          <span style={styles.jobDept}>{job.department}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedJob(job);
                      setForm({ full_name: '', email: '', phone: '', cover_letter: '' });
                    }}
                    style={styles.applyBtn}
                  >
                    Postuler →
                  </button>
                </div>

                <p style={styles.jobDesc}>{job.description}</p>

                {job.requirements && (
                  <div style={styles.requirementsBox}>
                    <strong>Exigences :</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>
                      {job.requirements}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal Candidature */}
      {selectedJob && (
        <div style={styles.modalOverlay} onClick={() => setSelectedJob(null)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Postuler : {selectedJob.title}</h3>
              <button onClick={() => setSelectedJob(null)} style={styles.modalClose}>✕</button>
            </div>

            <form onSubmit={handleApply} style={styles.modalForm}>
              <div style={styles.field}>
                <label style={styles.label}>Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Jean Houndété"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Email *</label>
                <input
                  type="email"
                  required
                  placeholder="jean@exemple.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Téléphone / WhatsApp *</label>
                <input
                  type="tel"
                  required
                  placeholder="+229 90 00 00 00"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Lettre de motivation ou message court</label>
                <textarea
                  rows={4}
                  placeholder="Présentez vos motivations, compétences et expériences clés..."
                  value={form.cover_letter}
                  onChange={(e) => setForm({ ...form, cover_letter: e.target.value })}
                  style={styles.textarea}
                />
              </div>

              <button type="submit" disabled={submitting} style={styles.submitBtn}>
                {submitting ? 'Envoi en cours...' : 'Envoyer ma candidature'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#F8F9FA' },
  header: { background: '#1E293B', padding: '16px 24px', display: 'flex', alignItems: 'center', color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  logo: { fontSize: '18px', fontWeight: '800', color: '#FF6B00' },
  main: { padding: '32px 20px', maxWidth: '800px', margin: '0 auto' },
  hero: { textAlign: 'center', marginBottom: '32px' },
  heroTitle: { fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '0 0 10px' },
  heroSub: { color: '#64748B', fontSize: '15px', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' },
  loading: { textAlign: 'center', color: '#64748B', padding: '40px' },
  empty: { textAlign: 'center', padding: '40px', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', color: '#64748B' },
  jobList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  jobCard: { background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
  jobHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '14px' },
  jobTitle: { fontSize: '18px', fontWeight: '800', color: '#1E293B', margin: '0 0 6px' },
  jobMeta: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12.5px', color: '#64748B' },
  jobDept: { background: '#FFF3E0', color: '#E65100', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '11px' },
  applyBtn: { background: '#FF6B00', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', whiteSpace: 'nowrap' },
  jobDesc: { color: '#334155', fontSize: '14px', lineHeight: '1.6', margin: '0 0 14px' },
  requirementsBox: { background: '#F8F9FA', borderRadius: '8px', padding: '12px 14px', border: '1px solid #EDF2F7', fontSize: '13px', color: '#1E293B' },

  // Modal
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modalCard: { background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  modalTitle: { fontSize: '18px', fontWeight: '800', color: '#1E293B', margin: 0 },
  modalClose: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748B' },
  modalForm: { display: 'flex', flexDirection: 'column', gap: '14px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#475569' },
  input: { padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none' },
  textarea: { padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '14px', outline: 'none', resize: 'vertical' },
  submitBtn: { background: '#FF6B00', color: 'white', border: 'none', padding: '14px', borderRadius: '8px', fontWeight: '800', fontSize: '15px', cursor: 'pointer', marginTop: '6px' },
};
