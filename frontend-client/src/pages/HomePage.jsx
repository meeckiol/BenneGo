import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    api.get('/companies/my-company')
      .then(({ data }) => setCompanyInfo(data))
      .catch(() => {});
  }, []);

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/logo-icon.png" alt="BenneGo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
          <span style={styles.logo}>BenneGo</span>
          <span style={styles.badge}>B2B & BTP Bénin</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user?.full_name}</span>
          <button onClick={() => navigate('/enterprise')} style={{ ...styles.navLink, background: '#FF6B00', color: '#fff', fontWeight: 'bold', padding: '6px 12px', borderRadius: '6px' }}>BenneGoPRO</button>
          <button onClick={() => navigate('/referral')} style={styles.navLink}>Parrainage</button>
          <button onClick={() => navigate('/careers')} style={styles.navLink}>Emplois</button>
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
            Sélectionnez votre besoin logistique de chantier avec paiement bloqué en séquestre :
          </p>
        </div>

        {/* 3 GROS BOUTONS D'ACTION (SERVICES BENNEGO B2B) */}
        <div style={styles.servicesGrid}>
          {/* Service 1 : Transport de Matériaux */}
          <div
            onClick={() => navigate('/orders/new?type=MATERIAL')}
            style={{ ...styles.serviceCard, borderColor: '#FF6B00' }}
          >
            <div style={styles.serviceIconContainer}>
              <span style={{ ...styles.serviceTag, background: '#FFF3E0', color: '#E65100' }}>
                Service Cœur
              </span>
            </div>
            <h3 style={styles.serviceTitle}>Transport de Matériaux</h3>
            <p style={styles.serviceDesc}>
              Livraison de sable (mer, carrière), gravier concassé, latérite, ciment ou briques par camions bennes (10m³, 16m³) et plateaux.
            </p>
            <div style={styles.serviceFooter}>
              <span style={styles.servicePrice}>À partir de 35 000 FCFA</span>
              <span style={styles.serviceArrow}>Commander →</span>
            </div>
          </div>

          {/* Service 2 : Location d'Engins Lourds */}
          <div
            onClick={() => navigate('/orders/new?type=RENTAL')}
            style={{ ...styles.serviceCard, borderColor: '#1976D2' }}
          >
            <div style={styles.serviceIconContainer}>
              <span style={{ ...styles.serviceTag, background: '#E3F2FD', color: '#0D47A1' }}>
                Service Premium
              </span>
            </div>
            <h3 style={styles.serviceTitle}>Location d'Engins Lourds</h3>
            <p style={styles.serviceDesc}>
              Mise à disposition à l'heure ou à la journée de pelles mécaniques, bulldozers, chargeuses, compacteurs et niveleuses pour terrassement.
            </p>
            <div style={styles.serviceFooter}>
              <span style={styles.servicePrice}>Dès 25 000 FCFA / heure</span>
              <span style={{ ...styles.serviceArrow, color: '#1976D2' }}>Réserver →</span>
            </div>
          </div>

          {/* Service 3 : Évacuation de Gravats */}
          <div
            onClick={() => navigate('/orders/new?type=EVACUATION')}
            style={{ ...styles.serviceCard, borderColor: '#388E3C' }}
          >
            <div style={styles.serviceIconContainer}>
              <span style={{ ...styles.serviceTag, background: '#E8F5E9', color: '#1B5E20' }}>
                Service Évacuation
              </span>
            </div>
            <h3 style={styles.serviceTitle}>Logistique d'Évacuation</h3>
            <p style={styles.serviceDesc}>
              Nettoyage de chantiers, évacuation rapide de gravats de démolition et transport de terre excédentaire vers sites de remblai autorisés.
            </p>
            <div style={styles.serviceFooter}>
              <span style={styles.servicePrice}>Prise en charge dès 25 000 FCFA</span>
              <span style={{ ...styles.serviceArrow, color: '#388E3C' }}>Évacuer →</span>
            </div>
          </div>
        </div>

        {/* SECTION B2B GRANDS COMPTES (BENNEGO BUSINESS) */}
        <section style={styles.enterpriseBanner}>
          <div style={styles.enterpriseContent}>
            <div style={styles.enterpriseBadge}>BenneGo Business (B2B)</div>
            <h3 style={styles.enterpriseTitle}>
              Grands Comptes, Promoteurs & Entreprises BTP
            </h3>
            <p style={styles.enterpriseDesc}>
              Planifiez des rotations de 50 camions en proforma unique, bénéficiez du <strong>Suivi GPS Certifié</strong> (anti-détournement) et de commissions réduites (3% à 5%).
            </p>
            {companyInfo?.has_company && companyInfo?.company?.subscription_status === 'active' ? (
              <div style={styles.enterpriseStatusActive}>
                ✓ Entreprise active : <strong>{companyInfo.company.name}</strong> ({companyInfo.company.subscription_plan === 'monthly_saas' ? 'SaaS Mensuel' : 'Pack Chantier'})
              </div>
            ) : null}
          </div>
          <div style={styles.enterpriseActions}>
            <button
              onClick={() => navigate('/enterprise')}
              style={styles.enterpriseBtn}
            >
              Tableau de bord Chantiers & B2B →
            </button>
            <button
              onClick={() => navigate('/orders')}
              style={styles.historyBtn}
            >
              Mes courses en cours
            </button>
          </div>
        </section>

        {/* Badges de confiance */}
        <section style={styles.trustSection}>
          <h3 style={styles.trustTitle}>Pourquoi faire confiance à BenneGo ?</h3>
          <div style={styles.trustGrid}>
            <div style={styles.trustBadge}>
              <strong style={{ fontSize: '13px', color: '#1E293B' }}>Séquestre sécurisé</strong>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Votre argent protégé jusqu'à livraison</p>
            </div>
            <div style={styles.trustBadge}>
              <strong style={{ fontSize: '13px', color: '#1E293B' }}>GPS Temps réel</strong>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Suivez votre camion en direct</p>
            </div>
            <div style={styles.trustBadge}>
              <strong style={{ fontSize: '13px', color: '#1E293B' }}>Chauffeurs vérifiés</strong>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Profils contrôlés par BenneGo</p>
            </div>
            <div style={styles.trustBadge}>
              <strong style={{ fontSize: '13px', color: '#1E293B' }}>Support 24/7</strong>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>Assistance disponible à tout moment</p>
            </div>
          </div>
        </section>

        {/* Pourquoi le Séquestre BenneGo ? */}
        <section style={styles.escrowCard}>
          <h4 style={styles.escrowTitle}>Pourquoi le Séquestre BenneGo change tout au Bénin ?</h4>
          <div style={styles.escrowGrid}>
            <div style={styles.escrowItem}>
              <strong>1. Zéro Risque de Vol</strong>
              <p>Votre argent reste bloqué sur la plateforme tant que la marchandise n'est pas vérifiée au déchargement.</p>
            </div>
            <div style={styles.escrowItem}>
              <strong>2. Suivi GPS Certifié OSRM</strong>
              <p>Alerte automatique transmise si le chauffeur s'écarte de plus de 15% de l'itinéraire prévu.</p>
            </div>
            <div style={styles.escrowItem}>
              <strong>3. Facture Proforma Unique</strong>
              <p>Pour vos chantiers d'envergure à Cotonou, Calavi, Ouidah ou Porto-Novo, réglez par virement bancaire.</p>
            </div>
          </div>
        </section>
        {/* Comparatif BenneGo vs Apps de VTC / Gozem */}
        <section style={styles.comparisonSection}>
          <div style={styles.comparisonHeader}>
            <h4 style={styles.comparisonTitle}>L'avantage BenneGo & BenneGoPRO : L'expert BTP face aux applications de taxi urbain</h4>
          </div>
          <div style={styles.comparisonGrid}>
            <div style={styles.comparisonCol}>
              <div style={styles.comparisonColHeaderBad}>Applications de VTC / Taxi standards</div>
              <ul style={styles.comparisonList}>
                <li>Conçues pour motos et petites voitures (passagers)</li>
                <li>Incapables de gérer le cubage (m³) et le tonnage utile (20T - 35T)</li>
                <li>Aucune liaison avec les carrières d'extraction de sable et gravier</li>
                <li>Pas de bons de pesée pont-bascule certifiés</li>
                <li>Paiement immédiat sans séquestre adapté aux gros montants</li>
                <li>Pas de factures fiscales B2B (IFU, RCCM, TVA, AIB)</li>
              </ul>
            </div>
            <div style={styles.comparisonCol}>
              <div style={styles.comparisonColHeaderGood}>BenneGo & BenneGoPRO (Spécialiste BTP)</div>
              <ul style={styles.comparisonList}>
                <li><strong>Flotte lourde dédiée :</strong> 6 roues (10m³), 8 roues (16m³), semi 25m³ & engins</li>
                <li><strong>Double vérification :</strong> Cubage certifié + ticket de pesée dématérialisé</li>
                <li><strong>Réseau carrières partenaires :</strong> Tori, Sèmè, Ouidah, Dan, Akassato</li>
                <li><strong>Séquestre garanti :</strong> Fonds sécurisés, 100% garanti pour client et chauffeur</li>
                <li><strong>Multi-rotations chantiers :</strong> 10 à 100 voyages gérés en 1 bon de commande</li>
                <li><strong>Conformité fiscale complète :</strong> Factures proforma, TVA 18%, AIB</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Bouton WhatsApp flottant */}
      <a
        href="https://wa.me/22990000000?text=Bonjour%20BenneGo%2C%20j%27ai%20besoin%20d%27aide"
        target="_blank"
        rel="noopener noreferrer"
        style={styles.whatsappBtn}
        aria-label="Contacter via WhatsApp"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      </a>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#F8F9FA' },
  header: {
    background: '#1E293B',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  logo: { fontSize: '22px', fontWeight: '900', color: '#FF6B00', letterSpacing: '-0.5px' },
  badge: { background: 'rgba(255,107,0,0.2)', color: '#FFB74D', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  userName: { fontSize: '14px', fontWeight: '500' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    color: 'white',
    padding: '6px 14px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '600',
  },
  main: { padding: '28px 20px', maxWidth: '850px', margin: '0 auto' },
  welcome: { marginBottom: '28px', textAlign: 'center' },
  welcomeTitle: { fontSize: '26px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' },
  welcomeSub: { color: '#64748B', fontSize: '15px', margin: 0 },
  servicesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '32px',
  },
  serviceCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    border: '2px solid transparent',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  serviceIconContainer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
  serviceEmoji: { fontSize: '32px' },
  serviceTag: { fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '6px', textTransform: 'uppercase' },
  serviceTitle: { fontSize: '18px', fontWeight: '800', color: '#1E293B', margin: '0 0 8px' },
  serviceDesc: { color: '#64748B', fontSize: '13.5px', lineHeight: '1.5', margin: '0 0 16px', flex: 1 },
  serviceFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #F1F5F9' },
  servicePrice: { fontSize: '12px', fontWeight: '700', color: '#334155' },
  serviceArrow: { fontSize: '13px', fontWeight: '800', color: '#FF6B00' },
  enterpriseBanner: {
    background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    borderRadius: '16px',
    padding: '28px',
    color: 'white',
    boxShadow: '0 8px 24px rgba(15,23,42,0.15)',
    marginBottom: '32px',
  },
  enterpriseContent: { marginBottom: '20px' },
  enterpriseBadge: { display: 'inline-block', background: 'rgba(255,107,0,0.25)', color: '#FF9E40', fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', marginBottom: '10px' },
  enterpriseTitle: { fontSize: '20px', fontWeight: '800', margin: '0 0 8px', color: '#F8FAFC' },
  enterpriseDesc: { color: '#94A3B8', fontSize: '14px', lineHeight: '1.6', margin: 0 },
  enterpriseStatusActive: { marginTop: '12px', background: 'rgba(74, 222, 128, 0.15)', color: '#4ADE80', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' },
  enterpriseActions: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  enterpriseBtn: {
    background: '#FF6B00',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  historyBtn: {
    background: 'rgba(255,255,255,0.1)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  escrowCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #E2E8F0',
  },
  escrowTitle: { fontSize: '16px', fontWeight: '800', color: '#1E293B', margin: '0 0 16px' },
  escrowGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  escrowItem: { fontSize: '13px', color: '#475569', lineHeight: '1.5' },
  trustSection: { background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '32px' },
  trustTitle: { fontSize: '16px', fontWeight: '800', color: '#1E293B', margin: '0 0 16px' },
  trustGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' },
  trustBadge: { textAlign: 'center', padding: '16px', background: '#F8F9FA', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  whatsappBtn: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 1000,
    background: '#25D366',
    borderRadius: '50%',
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(37,211,102,0.4)',
    textDecoration: 'none',
  },
  navLink: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600',
  },
};
