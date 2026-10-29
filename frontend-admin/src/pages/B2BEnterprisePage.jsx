import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { Check } from 'lucide-react';

const fcfa = (amount) => `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;

export default function B2BEnterprisePage() {
  const [activeTab, setActiveTab] = useState('bulk'); // 'bulk', 'companies', 'deviations'
  const [loading, setLoading] = useState(false);
  const [bulkOrders, setBulkOrders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [deviations, setDeviations] = useState([]);
  const [validatingId, setValidatingId] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bulkRes, compRes, devRes] = await Promise.all([
        api.get('/admin/bulk-orders'),
        api.get('/admin/companies'),
        api.get('/admin/route-deviations'),
      ]);
      setBulkOrders(bulkRes.data.bulk_orders || []);
      setCompanies(compRes.data.companies || []);
      setDeviations(devRes.data.deviations || []);
    } catch {
      toast.error('Erreur lors du chargement des données B2B');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Validation manuelle de la réception du virement bancaire / chèque
  const validateBulkEscrow = async (bulkGroupId, proformaNum) => {
    const ref = window.prompt(
      `Confirmer la réception des fonds sur le compte séquestre pour le proforma ${proformaNum} ?\n\nSaisissez la référence du virement bancaire ou numéro de chèque :`,
      `VIR-BOA-${Date.now().toString().slice(-6)}`
    );
    if (!ref) return;

    setValidatingId(bulkGroupId);
    try {
      const { data } = await api.post(`/admin/bulk-orders/${bulkGroupId}/validate-escrow`, {
        payment_reference: ref,
        bank_note: 'Virement bancaire validé par administration BenneGo',
      });
      toast.success(data.message);
      loadData();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Échec de la validation');
    } finally {
      setValidatingId(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Navigation onglets */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('bulk')}
          style={{ ...styles.tab, ...(activeTab === 'bulk' ? styles.tabActive : {}) }}
        >
          {`Factures Proforma & Commandes Groupées (${bulkOrders.length})`}
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          style={{ ...styles.tab, ...(activeTab === 'companies' ? styles.tabActive : {}) }}
        >
          {`Entreprises BTP Partenaires (${companies.length})`}
        </button>
        <button
          onClick={() => setActiveTab('deviations')}
          style={{ ...styles.tab, ...(activeTab === 'deviations' ? styles.tabActive : {}) }}
        >
          {`Alertes Déviation GPS (${deviations.length})`}
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Chargement des données...</div>
      ) : (
        <>
          {/* ONGLET 1 : PROFORMAS ET COMMANDES GROUPÉES (SÉQUESTRE) */}
          {activeTab === 'bulk' && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Validation des Séquestres Proforma (Virements & Chèques)</h3>
                <p style={styles.cardSub}>
                  Validez manuellement les fonds déposés par les entreprises sur le compte séquestre BenneGo pour débloquer les rotations de camions aux chauffeurs.
                </p>
              </div>

              {bulkOrders.length === 0 ? (
                <div style={styles.empty}>Aucune commande groupée en attente.</div>
              ) : (
                <div style={styles.tableWrapper} tabIndex={0}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>N° Proforma</th>
                        <th style={styles.th}>Entreprise / Chantier</th>
                        <th style={styles.th}>Rotations</th>
                        <th style={styles.th}>Montant Global</th>
                        <th style={styles.th}>Commission (4%)</th>
                        <th style={styles.th}>Statut Séquestre</th>
                        <th style={styles.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkOrders.map((b) => (
                        <tr key={b.bulk_group_id} style={styles.tr}>
                          <td style={styles.td}><strong>{b.proforma_invoice_number}</strong></td>
                          <td style={styles.td}>
                            <div>{b.company_name || 'Client B2B'}</div>
                            <small style={{ color: 'var(--text-3)' }}>{b.project_name || 'Chantier direct'}</small>
                          </td>
                          <td style={styles.td}>{b.orders_count} camions</td>
                          <td style={styles.td}><strong>{fcfa(b.total_amount)}</strong></td>
                          <td style={styles.td}>{fcfa(b.total_commission)}</td>
                          <td style={styles.td}>
                            {b.payment_status === 'escrow_held' ? (
                              <span style={styles.badgeSuccess}><Check size={14} aria-hidden="true" /> Séquestre Débloqué</span>
                            ) : (
                              <span style={styles.badgePending}>En attente de virement</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            {b.payment_status === 'unpaid' ? (
                              <button
                                onClick={() => validateBulkEscrow(b.bulk_group_id, b.proforma_invoice_number)}
                                disabled={validatingId === b.bulk_group_id}
                                style={styles.validateBtn}
                              >
                                {validatingId === b.bulk_group_id ? 'Validation...' : 'Valider le Virement'}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-2)', fontSize: '13px' }}>Courses actives</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ONGLET 2 : ENTREPRISES */}
          {activeTab === 'companies' && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Répertoire des Entreprises BTP & Promoteurs</h3>
                <p style={styles.cardSub}>Entreprises ayant souscrit un abonnement SaaS ou un Pack Chantier.</p>
              </div>

              {companies.length === 0 ? (
                <div style={styles.empty}>Aucune entreprise enregistrée.</div>
              ) : (
                <div style={styles.tableWrapper} tabIndex={0}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Entreprise</th>
                        <th style={styles.th}>IFU</th>
                        <th style={styles.th}>Contact</th>
                        <th style={styles.th}>Chantiers</th>
                        <th style={styles.th}>Courses</th>
                        <th style={styles.th}>Volume Dépensé</th>
                        <th style={styles.th}>Formule B2B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id} style={styles.tr}>
                          <td style={styles.td}><strong>{c.name}</strong></td>
                          <td style={styles.td}>{c.ifu || 'Non renseigné'}</td>
                          <td style={styles.td}>{c.phone || c.email || 'N/A'}</td>
                          <td style={styles.td}>{c.total_projects || 0}</td>
                          <td style={styles.td}>{c.total_orders || 0}</td>
                          <td style={styles.td}><strong>{fcfa(c.total_volume_xof)}</strong></td>
                          <td style={styles.td}>
                            <span style={c.subscription_status === 'active' ? styles.badgeSuccess : styles.badgeInactive}>
                              {c.subscription_plan === 'monthly_saas' ? 'SaaS (45 000 F/m)' :
                               c.subscription_plan === 'site_pack' ? 'Pack (75 000 F)' : 'Inactif'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ONGLET 3 : ALERTES DE DÉVIATION GPS */}
          {activeTab === 'deviations' && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Surveillance GPS Certifiée (Déviations &gt; 15%)</h3>
                <p style={styles.cardSub}>
                  Alertes automatiques levées en temps réel lorsqu'un chauffeur s'écarte anormalement de l'itinéraire OSRM (protection anti-vol et détournement de sable/gravier).
                </p>
              </div>

              {deviations.length === 0 ? (
                <div style={styles.empty}><Check size={14} aria-hidden="true" /> Aucune déviation anormale détectée. Tous les camions suivent les tracés OSRM.</div>
              ) : (
                <div style={styles.tableWrapper} tabIndex={0}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>N° Commande</th>
                        <th style={styles.th}>Client</th>
                        <th style={styles.th}>Chauffeur / Camion</th>
                        <th style={styles.th}>Écart Trajet</th>
                        <th style={styles.th}>Détails de l'alerte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deviations.map((d) => {
                        const details = d.route_deviation_details || {};
                        return (
                          <tr key={d.id} style={styles.trAlert}>
                            <td style={styles.td}><strong>{d.order_number}</strong></td>
                            <td style={styles.td}>{d.client_name} ({d.client_phone})</td>
                            <td style={styles.td}>
                              <div>{d.driver_name || 'Chauffeur'} ({d.driver_phone})</div>
                              <small style={{ color: 'var(--text-3)' }}>Plaque : {d.truck_plate || 'N/A'}</small>
                            </td>
                            <td style={styles.td}>
                              <span style={styles.badgeAlert}>
                                +{details.deviation_percentage || 15}% d'écart
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={{ fontSize: '13px', color: 'var(--danger)' }}>
                                {details.message || 'Écart important par rapport au tracé prévu.'}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px' },
  tabs: { display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-2)', paddingBottom: '10px' },
  tab: { background: 'transparent', border: 'none', color: 'var(--text-3)', padding: '10px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  tabActive: { background: 'var(--surface)', color: 'var(--brand-ink)', border: '1px solid var(--border-2)' },
  card: { background: 'var(--surface)', borderRadius: '14px', padding: '24px', border: '1px solid var(--border-2)' },
  cardHeader: { marginBottom: '20px' },
  cardTitle: { color: 'var(--text-strong)', fontSize: '18px', fontWeight: '800', margin: '0 0 6px' },
  cardSub: { color: 'var(--text-3)', fontSize: '13.5px', margin: 0 },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text)', fontSize: '14px' },
  th: { padding: '12px 14px', borderBottom: '1px solid var(--border-2)', color: 'var(--text-3)', fontWeight: '600', fontSize: '12.5px', textTransform: 'uppercase' },
  td: { padding: '14px', borderBottom: '1px solid var(--border-2)' },
  tr: { transition: 'background 0.15s' },
  trAlert: { background: 'rgba(239, 68, 68, 0.08)', borderBottom: '1px solid rgba(239, 68, 68, 0.2)' },
  empty: { padding: '30px', textAlign: 'center', color: 'var(--text-3)', fontSize: '14px' },
  loading: { padding: '40px', textAlign: 'center', color: 'var(--text-3)' },
  badgeSuccess: { background: 'rgba(34, 197, 94, 0.15)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  badgePending: { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  badgeInactive: { background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-3)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' },
  badgeAlert: { background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '800' },
  validateBtn: { background: '#D9A55B', color: '#0b0b10', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
};
