import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>LogiTruck</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.full_name}</span>
          <button onClick={logout} style={styles.logoutBtn}>Déconnexion</button>
        </div>
      </header>

      {/* Contenu principal */}
      <main style={styles.main}>
        <div style={styles.welcome}>
          <h2 style={styles.welcomeTitle}>
            Bonjour, {user?.full_name?.split(' ')[0]}
          </h2>
          <p style={styles.welcomeSub}>
            Que souhaitez-vous livrer aujourd'hui ?
          </p>
        </div>

        {/* Actions rapides */}
        <div style={styles.actions}>
          <button
            onClick={() => navigate('/orders/new')}
            style={styles.primaryBtn}
          >
            Passer une commande
          </button>
          <button
            onClick={() => navigate('/orders')}
            style={styles.secondaryBtn}
          >
            Mes commandes
          </button>
        </div>

        {/* Matériaux disponibles */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Matériaux disponibles</h3>
          <div style={styles.materialGrid}>
            {MATERIALS.map((m) => (
              <div key={m.name} style={styles.materialCard}
                onClick={() => navigate('/orders/new')}>
                <span style={styles.materialName}>{m.name}</span>
                <span style={styles.materialPrice}>
                  à partir de {m.price.toLocaleString()} FCFA
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Info commission */}
        <div style={styles.infoBox}>
          <p><strong>Comment ça marche ?</strong></p>
          <ol style={styles.steps}>
            <li>Saisissez votre point de chargement et de livraison</li>
            <li>Obtenez un prix instantané</li>
            <li>Payez via MTN MoMo ou Moov Money</li>
            <li>Un chauffeur accepte et livre en moins de 2h</li>
            <li>Validez la livraison pour libérer le paiement</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

const MATERIALS = [
  { name: 'Sable de rivière', price: 50000 },
  { name: 'Gravier concassé', price: 65000 },
  { name: 'Latérite', price: 40000 },
  { name: 'Terre de remblai', price: 35000 },
];

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: {
    background: '#FF6B00',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
  },
  headerLeft: {},
  logo: { fontSize: '20px', fontWeight: '800' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  userName: { fontSize: '14px' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  main: { padding: '20px', maxWidth: '600px', margin: '0 auto' },
  welcome: { marginBottom: '24px' },
  welcomeTitle: { fontSize: '24px', fontWeight: '800', color: '#333', margin: '0 0 8px' },
  welcomeSub: { color: '#666', margin: 0 },
  actions: { display: 'flex', gap: '12px', marginBottom: '32px' },
  primaryBtn: {
    flex: 1,
    padding: '16px',
    background: '#FF6B00',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1,
    padding: '16px',
    background: 'white',
    color: '#FF6B00',
    border: '2px solid #FF6B00',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  section: { marginBottom: '32px' },
  sectionTitle: { fontSize: '18px', fontWeight: '700', color: '#333', marginBottom: '16px' },
  materialGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  materialCard: {
    background: 'white',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  materialName: { fontWeight: '600', color: '#333', fontSize: '14px' },
  materialPrice: { color: '#FF6B00', fontSize: '12px', fontWeight: '600' },
  infoBox: {
    background: '#FFF3E0',
    border: '1px solid #FFB74D',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '14px',
    color: '#333',
  },
  steps: { paddingLeft: '20px', margin: '8px 0 0', lineHeight: '1.8' },
};
