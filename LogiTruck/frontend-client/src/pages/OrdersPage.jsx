import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const STATUS_LABELS = {
  pending: { label: 'En attente', color: '#FF9800', bg: '#FFF3E0' },
  accepted: { label: 'Acceptée', color: '#2196F3', bg: '#E3F2FD' },
  driver_en_route_pickup: { label: 'Chauffeur en route', color: '#9C27B0', bg: '#F3E5F5' },
  loading: { label: 'Chargement', color: '#FF5722', bg: '#FBE9E7' },
  driver_en_route_delivery: { label: 'En livraison', color: '#3F51B5', bg: '#E8EAF6' },
  delivered: { label: 'Livré', color: '#4CAF50', bg: '#E8F5E9' },
  validated: { label: 'Validé', color: '#4CAF50', bg: '#E8F5E9' },
  completed: { label: 'Terminé', color: '#607D8B', bg: '#ECEFF1' },
  cancelled: { label: 'Annulé', color: '#F44336', bg: '#FFEBEE' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/orders').then(({ data }) => {
      setOrders(data.orders);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={styles.loading}>Chargement...</div>;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.back}>← Accueil</button>
        <h2 style={styles.title}>Mes commandes</h2>
      </header>

      <div style={styles.content}>
        {orders.length === 0 ? (
          <div style={styles.empty}>
            <p>Aucune commande pour l'instant</p>
            <button onClick={() => navigate('/orders/new')} style={styles.btn}>
              Passer ma première commande
            </button>
          </div>
        ) : (
          orders.map((order) => {
            const st = STATUS_LABELS[order.status] || { label: order.status, color: '#666', bg: '#eee' };
            return (
              <div key={order.id} style={styles.orderCard}
                onClick={() => navigate(`/orders/${order.id}`)}>
                <div style={styles.orderHeader}>
                  <span style={styles.orderNum}>{order.order_number}</span>
                  <span style={{ ...styles.badge, color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>
                <p style={styles.addresses}>
                  Chargement : {order.pickup_address}
                  <br />Livraison : {order.delivery_address}
                </p>
                <div style={styles.orderFooter}>
                  <span style={styles.amount}>{order.total_amount?.toLocaleString()} FCFA</span>
                  <span style={styles.date}>
                    {new Date(order.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#FF6B00', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' },
  back: { background: 'none', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' },
  title: { color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 },
  content: { padding: '20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' },
  loading: { padding: '40px', textAlign: 'center', color: '#666' },
  empty: { textAlign: 'center', padding: '60px 20px', color: '#666' },
  btn: { marginTop: '16px', padding: '12px 24px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' },
  orderCard: { background: 'white', borderRadius: '12px', padding: '16px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  orderNum: { fontWeight: '700', color: '#333' },
  badge: { padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  addresses: { fontSize: '13px', color: '#555', lineHeight: '1.6', margin: '0 0 8px' },
  orderFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  amount: { fontWeight: '800', color: '#FF6B00', fontSize: '16px' },
  date: { color: '#999', fontSize: '12px' },
};
