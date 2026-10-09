import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { payOrder } from '../services/kkiapay';
import { getSocket } from '../services/socket';
import TrackingMap from '../components/TrackingMap';
import ReviewCard from '../components/ReviewCard';
import StarRating from '../components/StarRating';

const STEPS = [
  { key: 'awaiting_payment', label: 'Paiement' },
  { key: 'pending', label: 'Paiement sécurisé · recherche d\'un chauffeur' },
  { key: 'accepted', label: 'Chauffeur assigné' },
  { key: 'driver_en_route_pickup', label: 'Chauffeur en route vers la carrière' },
  { key: 'loading', label: 'Chargement' },
  { key: 'driver_en_route_delivery', label: 'En livraison' },
  { key: 'delivered', label: 'Livré — à confirmer par vous' },
  { key: 'validated', label: 'Réception confirmée' },
];

const PAYMENT_LABELS = {
  unpaid: 'Non payé',
  escrow_held: 'Bloqué en sécurité sur LogiTruck',
  payout_pending: 'Libéré — transmission au chauffeur',
  released: 'Versé au chauffeur',
  refunded: 'Remboursé',
};

const LIVE_STATUSES = ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'delivered'];
const fcfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} FCFA`;

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [driverPos, setDriverPos] = useState(null);
  const [route, setRoute] = useState([]);

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Après un paiement fermé trop vite : le webhook peut confirmer ; on revérifie régulièrement
  useEffect(() => {
    if (order?.status !== 'awaiting_payment') return undefined;
    const t = setInterval(fetchOrder, 5000);
    return () => clearInterval(t);
  }, [order?.status, fetchOrder]);

  // Suivi en direct : trajet déjà parcouru + positions en temps réel
  const isLive = order && LIVE_STATUSES.includes(order.status);
  useEffect(() => {
    if (!isLive) return undefined;
    let cancelled = false;
    api.get(`/orders/${id}/tracking`).then(({ data }) => {
      if (cancelled) return;
      setRoute(data.route);
      if (data.last) setDriverPos(data.last);
    });

    const socket = getSocket();
    if (!socket) return undefined;
    const join = () => socket.emit('track_order', id);
    const onPosition = (p) => {
      if (p.order_id !== id) return;
      setDriverPos({ lat: p.lat, lng: p.lng });
      setRoute((r) => [...r.slice(-299), { lat: p.lat, lng: p.lng }]);
    };
    const onStatus = (e) => { if (e.order_id === id) fetchOrder(); };
    socket.on('connect', join);
    if (socket.connected) join();
    socket.on('driver_position', onPosition);
    socket.on('order_status', onStatus);
    socket.on('order_accepted', onStatus);
    return () => {
      cancelled = true;
      socket.off('connect', join);
      socket.off('driver_position', onPosition);
      socket.off('order_status', onStatus);
      socket.off('order_accepted', onStatus);
    };
  }, [isLive, id, fetchOrder]);

  const pay = async () => {
    setBusy(true);
    try {
      const res = await payOrder(id);
      if (res.ok) toast.success('Paiement sécurisé ! Votre argent est bloqué jusqu\'à la livraison.');
      await fetchOrder();
    } catch (e) {
      toast.error(e?.message || 'Paiement impossible pour le moment');
    } finally {
      setBusy(false);
    }
  };

  const confirmReception = async () => {
    const ok = window.confirm(
      `Confirmer que vous avez bien reçu votre commande ?\n\n` +
      `Le paiement sera libéré : ${fcfa(order.driver_amount)} pour le chauffeur ` +
      `et ${fcfa(order.commission_amount)} de frais de service LogiTruck.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/orders/${id}/confirm-delivery`);
      toast.success('Réception confirmée. Merci ! Vous pouvez maintenant noter votre chauffeur.');
      await fetchOrder();
    } catch { /* message affiché par l'intercepteur */ } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const paid = order.payment_status === 'escrow_held';
    if (!window.confirm(paid ? 'Annuler et être remboursé intégralement ?' : 'Annuler cette commande ?')) return;
    setBusy(true);
    try {
      await api.post(`/orders/${id}/cancel`, {});
      toast.success(paid ? 'Commande annulée, remboursement en cours.' : 'Commande annulée.');
      await fetchOrder();
    } catch { /* idem */ } finally {
      setBusy(false);
    }
  };

  const pickup = useMemo(() => order && ({ lat: Number(order.pickup_lat), lng: Number(order.pickup_lng) }), [order?.pickup_lat, order?.pickup_lng]);
  const delivery = useMemo(() => order && ({ lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) }), [order?.delivery_lat, order?.delivery_lng]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Chargement...</div>;
  if (!order) return <div style={{ padding: '40px', textAlign: 'center' }}>Commande introuvable</div>;

  const stepKey = order.status === 'completed' ? 'validated' : order.status;
  const currentStepIdx = STEPS.findIndex((st) => st.key === stepKey);
  const cancelled = order.status === 'cancelled';
  const canCancel = !cancelled && (order.status === 'awaiting_payment' || order.status === 'pending');
  const confirmed = ['validated', 'completed'].includes(order.status);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button onClick={() => navigate('/orders')} style={styles.back}>← Retour</button>
        <h2 style={styles.title}>{order.order_number}</h2>
      </header>

      <div style={styles.content}>
        {order.payment_status === 'escrow_held' && !confirmed && (
          <div style={styles.secure}>
            🔒 Votre paiement de <strong>{fcfa(order.total_amount)}</strong> est bloqué en sécurité.
            Le chauffeur n'est payé qu'après votre confirmation de réception.
          </div>
        )}

        {cancelled && <div style={styles.cancelled}>Commande annulée{order.payment_status === 'refunded' ? ' — remboursée' : ''}.</div>}

        {/* Suivi du trajet en direct */}
        {isLive && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Suivi du chauffeur en direct</h3>
            <TrackingMap pickup={pickup} delivery={delivery} driver={driverPos} route={route} />
            <p style={styles.mapHint}>
              {driverPos ? 'Position mise à jour en temps réel.' : 'En attente de la première position du chauffeur…'}
            </p>
          </div>
        )}

        {/* Progression */}
        {!cancelled && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Suivi de la commande</h3>
            <div style={styles.steps}>
              {STEPS.map((step, idx) => (
                <div key={step.key} style={styles.step}>
                  <div style={{ ...styles.stepDot, background: idx <= currentStepIdx ? '#FF6B00' : '#ddd' }} />
                  <span style={{
                    ...styles.stepLabel,
                    color: idx <= currentStepIdx ? '#333' : '#999',
                    fontWeight: idx === currentStepIdx ? '700' : '400',
                  }}>
                    {step.label}{idx === currentStepIdx && ' ←'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Détails */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Détails</h3>
          <InfoRow label="De" value={order.pickup_address} />
          <InfoRow label="Vers" value={order.delivery_address} />
          <InfoRow label="Matériau" value={order.material_description || order.material_name} />
          <InfoRow label="Distance" value={`${order.distance_km} km`} />
          {order.driver_name && <InfoRow label="Chauffeur" value={order.driver_name} />}
          {order.driver_name && order.driver_rating_count > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ color: '#666', fontSize: 14 }}>Note du chauffeur</span>
              <span style={{ fontSize: 13 }}>
                <StarRating value={Math.round(order.driver_rating_avg)} size={16} label="Note du chauffeur" /> {Number(order.driver_rating_avg).toFixed(1)} ({order.driver_rating_count})
              </span>
            </div>
          )}
          {order.driver_phone && <InfoRow label="Tel. chauffeur" value={order.driver_phone} />}
        </div>

        {/* Prix */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Paiement</h3>
          <InfoRow label="Total" value={fcfa(order.total_amount)} bold />
          <InfoRow label="Part chauffeur (90 %)" value={fcfa(order.driver_amount)} />
          <InfoRow label="Frais de service LogiTruck (10 %)" value={fcfa(order.commission_amount)} />
          <InfoRow label="Statut" value={PAYMENT_LABELS[order.payment_status] || order.payment_status} />
        </div>

        {/* Actions */}
        {order.status === 'awaiting_payment' && (
          <button onClick={pay} disabled={busy} style={styles.primaryBtn}>
            {busy ? 'Ouverture du paiement…' : `Payer ${fcfa(order.total_amount)} (MTN MoMo / Moov Money)`}
          </button>
        )}

        {order.status === 'delivered' && (
          <button onClick={confirmReception} disabled={busy} style={styles.successBtn}>
            {busy ? 'Validation…' : '✓ Confirmer la réception de ma commande'}
          </button>
        )}

        {confirmed && <ReviewCard order={order} onDone={fetchOrder} />}

        {canCancel && (
          <button onClick={cancel} disabled={busy} style={styles.linkBtn}>
            {order.payment_status === 'escrow_held' ? 'Annuler et me faire rembourser' : 'Annuler la commande'}
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
  secure: { background: '#E8F5E9', border: '1px solid #A5D6A7', color: '#1B5E20', borderRadius: '12px', padding: '14px 16px', fontSize: '14px' },
  cancelled: { background: '#FFEBEE', border: '1px solid #EF9A9A', color: '#B71C1C', borderRadius: '12px', padding: '14px 16px', fontSize: '14px' },
  mapHint: { margin: '10px 0 0', fontSize: '13px', color: '#666' },
  linkBtn: { background: 'none', border: 'none', color: '#B71C1C', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', padding: '8px' },
  successBtn: { padding: '16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },
};
