import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';

const STEPS = [
  { key: 'pending', label: 'Commande créée' },
  { key: 'accepted', label: 'Chauffeur assigné' },
  { key: 'driver_en_route_pickup', label: 'Chauffeur en route' },
  { key: 'loading', label: 'Chargement' },
  { key: 'driver_en_route_delivery', label: 'En livraison' },
  { key: 'delivered', label: 'Livré' },
  { key: 'validated', label: 'Validé' },
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);

  const fetchOrder = async () => {
    const { data } = await api.get(`/orders/${id}`);
    setOrder(data.order);
    setLoading(false);
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const validateDelivery = async () => {
    setValidating(true);
    try {
      await api.patch(`/orders/${id}/status`, { status: 'validated' });
      toast.success('Livraison validée ! Le paiement va être libéré au chauffeur.');
      fetchOrder();
    } finally {
      setValidating(false);
    }
  };

  const pay = async () => {
    const { data } = await api.post(`/payments/orders/${id}/pay`, { payment_method: 'mtn_momo' });
    toast.success('Lien KKiaPay généré ! Ouvrez-le sur votre téléphone.');
    window.open(data.payment_url, '_blank');
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>;
  if (!order) return <div style={{ padding: '40px', textAlign: 'center' }}>Commande introuvable</div>;

  const currentStepIdx = STEPS.findIndex(s => s.key === order.status);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/orders')} style={styles.back}>← Retour</button>
        <h2 style={styles.title}>{order.order_number}</h2>
      </header>

      <div style={styles.content}>
        {/* Progression */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Suivi de la commande</h3>
          <div style={styles.steps}>
            {STEPS.map((step, idx) => (
              <div key={step.key} style={styles.step}>
                <div style={{
                  ...styles.stepDot,
                  background: idx <= currentStepIdx ? '#FF6B00' : '#ddd',
                }} />
                <span style={{
                  ...styles.stepLabel,
                  color: idx <= currentStepIdx ? '#333' : '#999',
                  fontWeight: idx === currentStepIdx ? '700' : '400',
                }}>
                  {step.label}
                  {idx === currentStepIdx && ' ←'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Détails */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Détails</h3>
          <InfoRow label="De" value={order.pickup_address} />
          <InfoRow label="Vers" value={order.delivery_address} />
          <InfoRow label="Matériau" value={order.material_description || order.material_name} />
          <InfoRow label="Distance" value={`${order.distance_km} km`} />
          {order.driver_name && <InfoRow label="Chauffeur" value={order.driver_name} />}
          {order.driver_phone && <InfoRow label="Tel. chauffeur" value={order.driver_phone} />}
        </div>

        {/* Prix */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Paiement</h3>
          <InfoRow label="Total" value={`${order.total_amount?.toLocaleString()} FCFA`} bold />
          <InfoRow label="Statut paiement" value={order.payment_status} />
          <InfoRow label="Méthode" value={order.payment_method || 'Non définie'} />
        </div>

        {/* Actions */}
        {order.status === 'pending' && order.payment_status === 'unpaid' && (
          <button onClick={pay} style={styles.primaryBtn}>
            Payer via Mobile Money
          </button>
        )}

        {order.status === 'delivered' && user?.role === 'client' && (
          <button onClick={validateDelivery} disabled={validating} style={styles.successBtn}>
            {validating ? 'Validation...' : 'Confirmer la réception'}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ color: '#666', fontSize: '14px' }}>{label}</span>
      <span style={{ color: '#333', fontSize: '14px', fontWeight: bold ? '700' : '400', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f5f5f5' },
  header: { background: '#FF6B00', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' },
  back: { background: 'none', border: 'none', color: 'white', fontSize: '16px', cursor: 'pointer' },
  title: { color: 'white', fontSize: '18px', fontWeight: '700', margin: 0 },
  content: { padding: '20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  card: { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: '#333', marginBottom: '16px', marginTop: 0 },
  steps: { display: 'flex', flexDirection: 'column', gap: '12px' },
  step: { display: 'flex', alignItems: 'center', gap: '12px' },
  stepDot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  stepLabel: { fontSize: '14px' },
  primaryBtn: { padding: '16px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },
  successBtn: { padding: '16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },
};
