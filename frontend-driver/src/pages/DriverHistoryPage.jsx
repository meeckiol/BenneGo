import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../services/api';

export default function DriverHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, earnings: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/orders?limit=50').then(({ data }) => {
      const completed = data.orders.filter(
        (o) => ['delivered', 'validated', 'completed'].includes(o.status)
      );
      setOrders(data.orders);
      setStats({
        total: completed.length,
        earnings: completed.reduce((sum, o) => sum + parseFloat(o.driver_amount || 0), 0),
      });
      setLoading(false);
    });
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.back} aria-label="Retour à l'accueil"><ArrowLeft size={20} aria-hidden="true" /></button>
        <h2 style={styles.title}>Mes courses</h2>
      </header>

      {/* Résumé */}
      <div style={styles.summary}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{stats.total}</span>
          <span style={styles.summaryLabel}>Livraisons</span>
        </div>
        <div style={styles.summaryDivider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryValue}>{stats.earnings.toLocaleString()}</span>
          <span style={styles.summaryLabel}>FCFA gagnés</span>
        </div>
      </div>

      {/* Liste */}
      <div style={styles.list}>
        {loading && <div style={styles.center}>Chargement...</div>}
        {!loading && orders.length === 0 && (
          <div style={styles.center}>Aucune course pour l'instant</div>
        )}
        {orders.map((order) => (
          <div key={order.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardNum}>{order.order_number}</span>
              <span style={{
                ...styles.badge,
                color: order.status === 'completed' || order.status === 'validated' ? '#4CAF50' : '#FF9800',
              }}>
                {order.payment_status === 'released' ? 'Payé' : order.status === 'completed' || order.status === 'validated' ? 'Paiement en cours' : 'Attente confirmation client'}
              </span>
            </div>
            <p style={styles.cardAddr}>{order.delivery_address}</p>
            <div style={styles.cardFooter}>
              <span style={styles.cardAmount}>
                {parseFloat(order.driver_amount || 0).toLocaleString()} FCFA
              </span>
              <span style={styles.cardDate}>
                {new Date(order.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit', month: 'short',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--bg)', color: 'white' },
  header: { background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' },
  back: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' },
  title: { fontSize: '18px', fontWeight: '700', margin: 0 },
  summary: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '40px' },
  summaryItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  summaryValue: { fontSize: '28px', fontWeight: '800', color: '#FF6B00' },
  summaryLabel: { fontSize: '12px', color: 'var(--text-3)' },
  summaryDivider: { width: '1px', height: '40px', background: 'rgba(255,255,255,0.08)' },
  list: { padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' },
  center: { textAlign: 'center', color: 'var(--text-3)', padding: '40px 0' },
  card: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px' },
  cardNum: { fontWeight: '700', fontSize: '13px' },
  badge: { fontSize: '12px', fontWeight: '600' },
  cardAddr: { fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 8px' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardAmount: { color: '#FF6B00', fontWeight: '700', fontSize: '16px' },
  cardDate: { color: 'var(--text-3)', fontSize: '12px' },
};
