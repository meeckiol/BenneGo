import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Check } from 'lucide-react';
import api from '../services/api';

const fcfa = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

export default function EnterprisePage() {
  const [activeTab, setActiveTab] = useState('projects'); // 'projects', 'bulk', 'subscription'
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState(null);
  const [projects, setProjects] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);

  // Formulaire Nouveau Chantier
  const [projForm, setProjForm] = useState({
    name: '',
    address: 'Calavi, Cotonou',
    central_lat: 6.4485,
    central_lng: 2.3556,
    contact_name: '',
    contact_phone: '',
  });

  // Formulaire Planification Massive (Bulk)
  const [bulkForm, setBulkForm] = useState({
    project_id: '',
    pickup_address: 'Carrière d\'Akassato / Tori',
    pickup_lat: 6.5050,
    pickup_lng: 2.3050,
    delivery_address: 'Chantier Calavi Phase 2',
    delivery_lat: 6.4485,
    delivery_lng: 2.3556,
    material_description: 'Sable de carrière et remblai',
    quantity_per_truck_m3: 16,
    truck_type: 'double_benne',
    rotations_per_day: 10,
    number_of_days: 5,
    start_date: new Date().toISOString().split('T')[0],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [compRes, projRes] = await Promise.all([
        api.get('/companies/my-company'),
        api.get('/companies/projects'),
      ]);
      if (compRes.data.company) {
        setCompany(compRes.data.company);
      }
      setProjects(projRes.data.projects || []);
      if (projRes.data.projects?.length > 0) {
        setBulkForm((b) => ({ ...b, project_id: projRes.data.projects[0].id }));
      }
    } catch (err) {
      // Ignorer
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Souscrire abonnement B2B
  const handleSubscribe = async (plan) => {
    if (!company) {
      return toast.error('Veuillez d\'abord enregistrer le profil de votre entreprise.');
    }
    try {
      const { data } = await api.post('/companies/subscribe', { plan });
      setCompany(data.company);
      toast.success(data.message);
    } catch {}
  };

  // Créer un chantier
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await api.post('/companies/projects', projForm);
      toast.success('Chantier ajouté avec succès !');
      setProjForm({
        name: '',
        address: '',
        central_lat: 6.3654,
        central_lng: 2.4183,
        contact_name: '',
        contact_phone: '',
      });
      loadData();
    } catch {}
  };

  // Lancer planification massive
  const handleCreateBulk = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/orders/bulk', bulkForm);
      setBulkResult(data);
      toast.success(data.message);
      loadData();
    } catch {}
  };

  // Télécharger rapport CSV chantier
  const downloadCSV = async (projectId, projectName) => {
    try {
      const res = await api.get(`/companies/projects/${projectId}/export-csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BenneGo_${projectName}_Rapport.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Rapport CSV téléchargé !');
    } catch {
      toast.error('Erreur lors du téléchargement');
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>BenneGo Business</span>
          <span style={styles.badge}>Portail Ingénieurs & BTP</span>
        </div>
        <div style={styles.headerRight}>
          {company?.subscription_status === 'active' ? (
            <span style={styles.activePlanBadge}>
              <Check size={14} aria-hidden="true" /> {company.subscription_plan === 'monthly_saas' ? 'SaaS Mensuel (Actif)' : 'Pack Chantier (Actif)'}
            </span>
          ) : (
            <span style={styles.inactivePlanBadge}>Sans abonnement actif</span>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {/* Navigation des onglets */}
        <div style={styles.navTabs}>
          <button
            onClick={() => setActiveTab('projects')}
            style={{ ...styles.navTab, ...(activeTab === 'projects' ? styles.navTabActive : {}) }}
          >
            Mes Chantiers ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('bulk')}
            style={{ ...styles.navTab, ...(activeTab === 'bulk' ? styles.navTabActive : {}) }}
          >
            Planification Massive (Bulk)
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            style={{ ...styles.navTab, ...(activeTab === 'subscription' ? styles.navTabActive : {}) }}
          >
            Abonnements B2B & Packs
          </button>
        </div>

        {/* ONGLET 1 : CHANTIERS */}
        {activeTab === 'projects' && (
          <div style={styles.sectionContainer}>
            <div style={styles.sectionHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Chantiers de Construction & Travaux</h3>
                <p style={styles.sectionSub}>Suivez l'approvisionnement en direct de chacun de vos sites au Bénin.</p>
              </div>
            </div>

            {/* Formulaire ajout chantier */}
            <form onSubmit={handleCreateProject} style={styles.card}>
              <h4 style={styles.cardHeader}>+ Enregistrer un nouveau chantier</h4>
              <div style={styles.grid2}>
                <div style={styles.field}>
                  <label style={styles.label}>Nom du chantier</label>
                  <input
                    placeholder="Ex: Asphaltage Phase 2 - Calavi"
                    value={projForm.name}
                    onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Adresse du site</label>
                  <input
                    placeholder="Ex: Carrefour Kpota, Calavi"
                    value={projForm.address}
                    onChange={(e) => setProjForm({ ...projForm, address: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Latitude GPS</label>
                  <input
                    type="number"
                    step="0.000001"
                    aria-label="Latitude GPS"
                    value={projForm.central_lat}
                    onChange={(e) => setProjForm({ ...projForm, central_lat: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Longitude GPS</label>
                  <input
                    type="number"
                    step="0.000001"
                    aria-label="Longitude GPS"
                    value={projForm.central_lng}
                    onChange={(e) => setProjForm({ ...projForm, central_lng: e.target.value })}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Chef de chantier (Contact)</label>
                  <input
                    placeholder="Ing. Koffi"
                    value={projForm.contact_name}
                    onChange={(e) => setProjForm({ ...projForm, contact_name: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Téléphone du site</label>
                  <input
                    placeholder="+229 97 00 00 00"
                    value={projForm.contact_phone}
                    onChange={(e) => setProjForm({ ...projForm, contact_phone: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>
              <button type="submit" style={styles.actionBtn}>Créer le Chantier</button>
            </form>

            {/* Liste des chantiers */}
            <div style={styles.projectsList}>
              {projects.length === 0 ? (
                <div style={styles.emptyState}>Aucun chantier enregistré pour le moment.</div>
              ) : (
                projects.map((p) => (
                  <div key={p.id} style={styles.projectCard}>
                    <div style={styles.projectTop}>
                      <div>
                        <h4 style={styles.projectName}>{p.name}</h4>
                        <span style={styles.projectAddress}>{p.address || 'Coordonnées GPS'}</span>
                      </div>
                      <button
                        onClick={() => downloadCSV(p.id, p.name)}
                        style={styles.csvBtn}
                      >
                        Exporter CSV
                      </button>
                    </div>

                    <div style={styles.projectStats}>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>{p.total_orders || 0}</span>
                        <span style={styles.statLabel}>Courses totales</span>
                      </div>
                      <div style={styles.statBox}>
                        <span style={{ ...styles.statNumber, color: 'var(--brand-ink)' }}>{p.active_orders || 0}</span>
                        <span style={styles.statLabel}>En transit</span>
                      </div>
                      <div style={styles.statBox}>
                        <span style={{ ...styles.statNumber, color: 'var(--success)' }}>{p.completed_orders || 0}</span>
                        <span style={styles.statLabel}>Livrées</span>
                      </div>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>{Number(p.total_volume_delivered_m3 || 0)} m³</span>
                        <span style={styles.statLabel}>Volume réceptionné</span>
                      </div>
                      <div style={styles.statBox}>
                        <span style={styles.statNumber}>{fcfa(p.total_budget_spent)}</span>
                        <span style={styles.statLabel}>Budget Séquestre</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ONGLET 2 : PLANIFICATION MASSIVE (BULK) */}
        {activeTab === 'bulk' && (
          <div style={styles.sectionContainer}>
            <div style={styles.sectionHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Planification Massive de Rotations (B2B Bulk)</h3>
                <p style={styles.sectionSub}>
                  Planifiez par exemple <strong>10 rotations de camions par jour pendant 5 jours (50 courses)</strong> sous un devis proforma unique.
                </p>
              </div>
            </div>

            {bulkResult ? (
              <div style={styles.proformaCard}>
                <div style={styles.proformaHeader}>
                  <h4 style={styles.proformaTitle}><Check size={18} aria-hidden="true" /> Facture Proforma Générée : {bulkResult.proforma_invoice_number}</h4>
                  <span style={styles.proformaStatus}>En attente de virement / chèque séquestre</span>
                </div>
                <div style={styles.proformaSummary}>
                  <div><strong>Nombre de rotations générées :</strong> {bulkResult.total_orders_count} camions</div>
                  <div><strong>Prix unitaire par rotation :</strong> {fcfa(bulkResult.unit_price_per_trip)}</div>
                  <div style={styles.proformaTotal}>
                    <strong>TOTAL GLOBAL À BLOQUER EN SÉQUESTRE :</strong> {fcfa(bulkResult.total_amount_global)}
                  </div>
                </div>

                <div style={styles.bankBox}>
                  <h5 style={styles.bankTitle}>Instructions de paiement sécurisé :</h5>
                  <p><strong>Banque :</strong> {bulkResult.escrow_bank_details?.bank_name}</p>
                  <p><strong>Bénéficiaire :</strong> {bulkResult.escrow_bank_details?.account_name}</p>
                  <p><strong>RIB :</strong> {bulkResult.escrow_bank_details?.rib}</p>
                  <p style={{ marginTop: '8px', color: 'var(--warning)' }}>
                    {bulkResult.escrow_bank_details?.instructions}
                  </p>
                </div>

                <button onClick={() => setBulkResult(null)} style={styles.actionBtn}>
                  + Planifier une autre série de camions
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateBulk} style={styles.card}>
                <div style={styles.grid2}>
                  <div style={styles.field}>
                    <label style={styles.label}>Chantier concerné</label>
                    <select
                      value={bulkForm.project_id}
                      onChange={(e) => setBulkForm({ ...bulkForm, project_id: e.target.value })}
                      style={styles.input}
                      required
                    >
                      <option value="">Sélectionnez un chantier</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Type de camion benne</label>
                    <select
                      value={bulkForm.truck_type}
                      onChange={(e) => setBulkForm({ ...bulkForm, truck_type: e.target.value })}
                      style={styles.input}
                    >
                      <option value="simple_benne">Camion 6 roues (benne 10 m³)</option>
                      <option value="pickup">Pick-up / camionnette (sacs, ciment, briques)</option>
                      <option value="double_benne">Camion 10 roues (benne 16 m³, recommandé)</option>
                      <option value="semi_remorque">Camion 12 roues (semi-remorque 25 m³)</option>
                    </select>
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Rotations de camions par jour</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={bulkForm.rotations_per_day}
                      onChange={(e) => setBulkForm({ ...bulkForm, rotations_per_day: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Nombre de jours de livraison</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={bulkForm.number_of_days}
                      onChange={(e) => setBulkForm({ ...bulkForm, number_of_days: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Carrière de chargement (Départ)</label>
                    <input
                      value={bulkForm.pickup_address}
                      onChange={(e) => setBulkForm({ ...bulkForm, pickup_address: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Chantier de déchargement (Arrivée)</label>
                    <input
                      value={bulkForm.delivery_address}
                      onChange={(e) => setBulkForm({ ...bulkForm, delivery_address: e.target.value })}
                      style={styles.input}
                      required
                    />
                  </div>
                </div>

                <div style={styles.bulkNotice}>
                  Total estimé : <strong>{bulkForm.rotations_per_day * bulkForm.number_of_days} courses programmées</strong>. Une facture proforma globale vous sera délivrée avec validation manuelle par virement / chèque.
                </div>

                <button type="submit" style={styles.actionBtn}>
                  Générer la Facture Proforma ({bulkForm.rotations_per_day * bulkForm.number_of_days} rotations) <ArrowRight size={16} aria-hidden="true" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* ONGLET 3 : ABONNEMENTS */}
        {activeTab === 'subscription' && (
          <div style={styles.sectionContainer}>
            <div style={styles.sectionHeader}>
              <div>
                <h3 style={styles.sectionTitle}>Formules B2B BenneGo Business</h3>
                <p style={styles.sectionSub}>Accédez aux technologies de traçabilité et optimisez vos approvisionnements BTP au Bénin.</p>
              </div>
            </div>

            <div style={styles.pricingGrid}>
              <div style={styles.pricingCard}>
                <span style={styles.pricingTag}>SaaS Mensuel</span>
                <h4 style={styles.pricingTitle}>Abonnement Entreprise</h4>
                <div style={styles.priceAmount}>45 000 <span style={styles.pricePeriod}>FCFA / mois</span></div>
                <p style={styles.pricingDesc}>Idéal pour les entreprises BTP actives en continu.</p>
                <ul style={styles.pricingFeatures}>
                  <li><Check size={14} aria-hidden="true" />Accès illimité pour 3 ingénieurs</li>
                  <li><Check size={14} aria-hidden="true" />Suivi GPS en direct</li>
                  <li><Check size={14} aria-hidden="true" />Alerte d'écart d'itinéraire (&gt; 15 %)</li>
                  <li><Check size={14} aria-hidden="true" />Export illimité des reçus en CSV</li>
                  <li><Check size={14} aria-hidden="true" />Tarifs préférentiels</li>
                </ul>
                <button
                  onClick={() => handleSubscribe('monthly_saas')}
                  style={styles.subscribeBtn}
                >
                  Souscrire (45 000 FCFA/mois)
                </button>
              </div>

              <div style={{ ...styles.pricingCard, borderColor: '#D9A55B' }}>
                <span style={{ ...styles.pricingTag, background: '#D9A55B', color: '#0b0b10' }}>Pack Projet</span>
                <h4 style={styles.pricingTitle}>Frais Fixes par Chantier</h4>
                <div style={styles.priceAmount}>75 000 <span style={styles.pricePeriod}>FCFA / chantier</span></div>
                <p style={styles.pricingDesc}>Idéal pour les promoteurs construisant un immeuble précis (6 mois max).</p>
                <ul style={styles.pricingFeatures}>
                  <li><Check size={14} aria-hidden="true" />Valable 6 mois complets</li>
                  <li><Check size={14} aria-hidden="true" />Planification massive de 50 à 500 rotations</li>
                  <li><Check size={14} aria-hidden="true" />Facturation proforma unique & virement séquestre</li>
                  <li><Check size={14} aria-hidden="true" />Suivi GPS en direct sur le chantier</li>
                  <li><Check size={14} aria-hidden="true" />Tarifs préférentiels</li>
                </ul>
                <button
                  onClick={() => handleSubscribe('site_pack')}
                  style={{ ...styles.subscribeBtn, background: '#D9A55B' }}
                >
                  Choisir ce Pack (75 000 FCFA)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--bg)' },
  header: { background: 'var(--bg)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-strong)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '16px' },
  backBtn: { background: 'none', border: 'none', color: 'var(--text-3)', fontSize: '14px', cursor: 'pointer', fontWeight: '600' },
  logo: { fontSize: '20px', fontWeight: '900', color: 'var(--brand-ink)' },
  badge: { background: 'rgba(217, 165, 91,0.2)', color: 'var(--warning)', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px' },
  headerRight: {},
  activePlanBadge: { background: '#16A34A', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  inactivePlanBadge: { background: 'var(--surface-3)', color: 'var(--text-2)', padding: '5px 12px', borderRadius: '20px', fontSize: '12px' },
  main: { padding: '24px', maxWidth: '1000px', margin: '0 auto' },
  navTabs: { display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--border)', paddingBottom: '8px', overflowX: 'auto' },
  navTab: { background: 'none', border: 'none', padding: '10px 18px', fontSize: '14px', fontWeight: '700', color: 'var(--text-2)', cursor: 'pointer', borderRadius: '8px' },
  navTabActive: { background: 'var(--surface)', color: 'var(--text-strong)' },
  sectionContainer: { display: 'flex', flexDirection: 'column', gap: '20px' },
  sectionHeader: { marginBottom: '8px' },
  sectionTitle: { fontSize: '22px', fontWeight: '800', color: 'var(--text-strong)', margin: '0 0 6px' },
  sectionSub: { color: 'var(--text-2)', fontSize: '14px', margin: 0 },
  card: { background: 'var(--surface)', borderRadius: '14px', padding: '24px', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  cardHeader: { fontSize: '16px', fontWeight: '800', color: 'var(--text-strong)', margin: '0 0 16px' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: 'var(--text-2)' },
  input: { padding: '11px 14px', borderRadius: '8px', border: '1px solid var(--border-2)', fontSize: '14px', color: 'var(--text-strong)' },
  actionBtn: { marginTop: '16px', background: '#D9A55B', color: '#0b0b10', border: 'none', padding: '12px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  projectsList: { display: 'flex', flexDirection: 'column', gap: '14px' },
  emptyState: { padding: '30px', textAlign: 'center', background: 'var(--surface)', borderRadius: '12px', border: '1px dashed var(--border-2)', color: 'var(--text-3)' },
  projectCard: { background: 'var(--surface)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' },
  projectTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  projectName: { fontSize: '17px', fontWeight: '800', color: 'var(--text-strong)', margin: '0 0 4px' },
  projectAddress: { color: 'var(--text-2)', fontSize: '13px' },
  csvBtn: { background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', padding: '6px 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' },
  projectStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' },
  statBox: { background: 'var(--bg)', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statNumber: { fontSize: '16px', fontWeight: '800', color: 'var(--text-strong)' },
  statLabel: { fontSize: '11px', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: '600' },
  bulkNotice: { background: 'var(--info-soft)', border: '1px solid rgba(59, 130, 246, 0.35)', padding: '14px', borderRadius: '8px', color: 'var(--info)', fontSize: '13.5px', marginTop: '16px' },
  proformaCard: { background: 'var(--surface)', borderRadius: '14px', padding: '28px', border: '2px solid #22C55E' },
  proformaHeader: { marginBottom: '16px' },
  proformaTitle: { fontSize: '18px', fontWeight: '800', color: 'var(--success)', margin: '0 0 4px' },
  proformaStatus: { color: 'var(--text-2)', fontSize: '13px' },
  proformaSummary: { background: 'var(--bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' },
  proformaTotal: { fontSize: '16px', color: 'var(--brand-ink)', marginTop: '6px' },
  bankBox: { background: 'var(--warning-soft)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', lineHeight: '1.6' },
  bankTitle: { fontSize: '14px', fontWeight: '800', color: 'var(--warning)', margin: '0 0 8px' },
  pricingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' },
  pricingCard: { background: 'var(--surface)', borderRadius: '16px', padding: '28px', border: '2px solid var(--border)', display: 'flex', flexDirection: 'column' },
  pricingTag: { alignSelf: 'flex-start', background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: '11px', fontWeight: '800', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase', marginBottom: '12px' },
  pricingTitle: { fontSize: '19px', fontWeight: '800', color: 'var(--text-strong)', margin: '0 0 10px' },
  priceAmount: { fontSize: '28px', fontWeight: '900', color: 'var(--text-strong)', marginBottom: '8px' },
  pricePeriod: { fontSize: '14px', color: 'var(--text-2)', fontWeight: '500' },
  pricingDesc: { color: 'var(--text-2)', fontSize: '13px', margin: '0 0 16px' },
  pricingFeatures: { listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--text)' },
  subscribeBtn: { background: 'var(--surface)', color: 'var(--text-strong)', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' },
};
