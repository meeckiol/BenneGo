import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function ReferralPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friendCode, setFriendCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReferral();
  }, []);

  const loadReferral = async () => {
    setLoading(true);
    try {
      const res = await api.get('/referrals/me');
      setData(res.data);
    } catch {
      toast.error('Erreur lors du chargement de votre parrainage');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!data?.referral_code) return;
    navigator.clipboard.writeText(data.referral_code).then(() => {
      toast.success('Code copié dans le presse-papier !');
    });
  };

  const shareWhatsApp = () => {
    if (!data?.referral_code) return;
    const text = encodeURIComponent(
      `Rejoins BenneGo pour tes transports de matériaux et locations d'engins avec mon code ${data.referral_code} et reçois 2500 FCFA de réduction sur ta première commande !`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const applyFriendCode = async (e) => {
    e.preventDefault();
    if (!friendCode.trim()) return toast.error('Veuillez saisir un code parrain');
    setSubmitting(true);
    try {
      await api.post('/referrals', { referral_code: friendCode.trim() });
      toast.success('Code parrain validé avec succès !');
      setFriendCode('');
      loadReferral();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Code invalide ou déjà utilisé');
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
          <span style={styles.logo}>BenneGo Parrainage</span>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>Invitez vos amis et gagnez</h1>
          <p style={styles.heroSub}>
            Partagez votre code avec vos partenaires BTP et vos collègues. Chaque inscription avec votre code vous rapporte <strong>2 500 FCFA</strong> !
          </p>
        </div>

        {loading ? (
          <div style={styles.loading}>Chargement de vos informations...</div>
        ) : (
          <>
            {/* Carte Mon Code */}
            <div style={styles.card}>
              <h3 style={styles.cardTitle}>Votre code de parrainage exclusif</h3>
              <p style={styles.cardSub}>Donnez ce code à vos contacts lors de leur inscription :</p>
              <div style={styles.codeBox}>
                <span style={styles.codeText}>{data?.referral_code || '------'}</span>
                <button onClick={copyCode} style={styles.copyBtn}>Copier</button>
              </div>

              <button onClick={shareWhatsApp} style={styles.whatsappBtn}>
                Partager directement sur WhatsApp
              </button>
            </div>

            {/* Statistiques */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <span style={styles.statValue}>{data?.total_referrals || 0}</span>
                <span style={styles.statLabel}>Filleuls inscrits</span>
              </div>
              <div style={styles.statCard}>
                <span style={{ ...styles.statValue, color: '#10B981' }}>
                  {Number(data?.total_rewards || 0).toLocaleString()} FCFA
                </span>
                <span style={styles.statLabel}>Gains totaux</span>
              </div>
            </div>

            {/* Formulaire code parrain ami */}
            <div style={{ ...styles.card, marginTop: '24px' }}>
              <h3 style={styles.cardTitle}>Vous avez été invité par un ami ?</h3>
              <p style={styles.cardSub}>Saisissez son code de parrainage pour activer vos avantages :</p>
              <form onSubmit={applyFriendCode} style={styles.formRow}>
                <input
                  type="text"
                  placeholder="Ex: ABC123"
                  value={friendCode}
                  onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                  style={styles.input}
                />
                <button type="submit" disabled={submitting} style={styles.applyBtn}>
                  {submitting ? '...' : 'Valider'}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#F8F9FA' },
  header: { background: '#1E293B', padding: '16px 24px', display: 'flex', alignItems: 'center', color: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  logo: { fontSize: '18px', fontWeight: '800', color: '#FF6B00' },
  main: { padding: '32px 20px', maxWidth: '640px', margin: '0 auto' },
  hero: { textAlign: 'center', marginBottom: '32px' },
  heroTitle: { fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '0 0 10px' },
  heroSub: { color: '#64748B', fontSize: '15px', lineHeight: '1.5', margin: 0 },
  loading: { textAlign: 'center', color: '#64748B', padding: '40px' },
  card: { background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
  cardTitle: { fontSize: '17px', fontWeight: '800', color: '#1E293B', margin: '0 0 6px' },
  cardSub: { color: '#64748B', fontSize: '13.5px', margin: '0 0 16px' },
  codeBox: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F9FA', border: '2px dashed #CBD5E1', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px' },
  codeText: { fontSize: '24px', fontWeight: '900', color: '#FF6B00', letterSpacing: '3px' },
  copyBtn: { background: '#1E293B', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' },
  whatsappBtn: { width: '100%', background: '#25D366', color: 'white', border: 'none', padding: '14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '800', fontSize: '15px' },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '16px' },
  statCard: { background: 'white', borderRadius: '14px', padding: '18px', textAlign: 'center', border: '1px solid #E2E8F0' },
  statValue: { display: 'block', fontSize: '24px', fontWeight: '800', color: '#1E293B', marginBottom: '4px' },
  statLabel: { fontSize: '12.5px', color: '#64748B' },
  formRow: { display: 'flex', gap: '10px' },
  input: { flex: 1, padding: '12px 14px', border: '1px solid #CBD5E1', borderRadius: '8px', fontSize: '15px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', outline: 'none' },
  applyBtn: { background: '#FF6B00', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
};
