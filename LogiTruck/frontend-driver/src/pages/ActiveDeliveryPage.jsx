import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import toast from 'react-hot-toast';
import api from '../services/api';
import useGPS from '../hooks/useGPS';
import useDriverSocket from '../hooks/useDriverSocket';

// Composant pour centrer la carte sur la position GPS
function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);
  return null;
}

// Étapes de livraison avec les actions possibles
const DELIVERY_STEPS = [
  {
    status: 'accepted',
    next: 'driver_en_route_pickup',
    label: 'Partir vers la carrière',
    color: '#2196F3',
    description: 'Appuyez quand vous quittez votre position',
  },
  {
    status: 'driver_en_route_pickup',
    next: 'loading',
    label: 'Confirmer l\'arrivée à la carrière',
    color: '#FF9800',
    description: 'Appuyez quand vous êtes à la carrière',
  },
  {
    status: 'loading',
    next: 'driver_en_route_delivery',
    label: 'Chargement terminé - Partir livrer',
    color: '#9C27B0',
    description: 'Appuyez quand le camion est chargé',
  },
  {
    status: 'driver_en_route_delivery',
    next: 'delivered',
    label: 'Confirmer la livraison',
    color: '#4CAF50',
    description: 'Appuyez quand vous avez déversé la marchandise',
  },
];

export default function ActiveDeliveryPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const { sendLocation } = useDriverSocket();

  // GPS actif en permanence pendant la livraison
  const { position, error: gpsError, accuracy } = useGPS({
    enabled: true,
    onPosition: useCallback((pos) => {
      sendLocation(pos, orderId);
    }, [sendLocation, orderId]),
    interval: 5000,
  });

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}`);
      setOrder(data.order);
    } catch {
      toast.error('Commande introuvable');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const advanceStatus = async () => {
    if (!order) return;
    const step = DELIVERY_STEPS.find((s) => s.status === order.status);
    if (!step) return;

    setUpdating(true);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: step.next });
      await loadOrder();

      if (step.next === 'delivered') {
        toast.success('Livraison confirmée ! En attente de validation client.');
      } else {
        toast.success('Statut mis à jour ✓');
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Chargement...</p>
      </div>
    );
  }

  if (!order) return null;

  const currentStep = DELIVERY_STEPS.find((s) => s.status === order.status);
  const isDelivered = order.status === 'delivered' || order.status === 'validated' || order.status === 'completed';

  const mapCenter = position
    ? [position.lat, position.lng]
    : [parseFloat(order.pickup_lat), parseFloat(order.pickup_lng)];

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}>←</button>
        <div style={styles.headerCenter}>
          <div style={styles.orderNum}>{order.order_number}</div>
          <div style={styles.orderAmount}>
            {parseFloat(order.driver_amount).toLocaleString()} FCFA
          </div>
        </div>
        <a href={`tel:${order.client_phone}`} style={styles.callBtn}>Appeler</a>
      </header>

      {/* Carte OpenStreetMap */}
      <div style={styles.mapWrapper}>
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© OpenStreetMap'
          />

          {/* Position du chauffeur */}
          {position && (
            <Marker position={[position.lat, position.lng]}>
              <Popup>Votre position</Popup>
            </Marker>
          )}

          {/* Point de chargement */}
          <Marker
            position={[parseFloat(order.pickup_lat), parseFloat(order.pickup_lng)]}
          >
            <Popup>{order.pickup_address}</Popup>
          </Marker>

          {/* Point de livraison */}
          <Marker
            position={[parseFloat(order.delivery_lat), parseFloat(order.delivery_lng)]}
          >
            <Popup>{order.delivery_address}</Popup>
          </Marker>

          {position && <MapCenter position={position} />}
        </MapContainer>

        {/* GPS indicator */}
        <div style={{
          ...styles.gpsIndicator,
          background: gpsError ? 'rgba(244,67,54,0.9)' : 'rgba(76,175,80,0.9)',
        }}>
          {gpsError ? 'GPS indisponible' : `Précision GPS : ±${accuracy}m`}
        </div>
      </div>

      {/* Panel inférieur */}
      <div style={styles.bottomPanel}>
        {/* Adresses */}
        <div style={styles.addressRow}>
          <div style={styles.addressItem}>
            <div>
              <div style={styles.addressLabel}>Carrière</div>
              <div style={styles.addressText}>{order.pickup_address}</div>
            </div>
          </div>
          <div style={styles.addressDivider} />
          <div style={styles.addressItem}>
            <div>
              <div style={styles.addressLabel}>Chantier</div>
              <div style={styles.addressText}>{order.delivery_address}</div>
            </div>
          </div>
        </div>

        {/* Action principale */}
        {isDelivered ? (
          <div style={styles.completedBox}>
            <div style={styles.completedText}>
              {order.status === 'validated'
                ? `Livraison validée ! ${parseFloat(order.driver_amount).toLocaleString()} FCFA en route vers votre MoMo`
                : 'Livraison confirmée. En attente de validation client...'}
            </div>
            <button onClick={() => navigate('/')} style={styles.homeBtn}>
              Retour à l'accueil
            </button>
          </div>
        ) : currentStep ? (
          <div>
            <div style={styles.stepInfo}>
              <span style={{ ...styles.stepDot, background: currentStep.color }} />
              <div>
                <div style={styles.stepDescription}>{currentStep.description}</div>
              </div>
            </div>
            <button
              onClick={advanceStatus}
              disabled={updating}
              style={{ ...styles.actionBtn, background: currentStep.color }}
            >
              {updating ? 'Mise à jour...' : currentStep.label}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f0f1a' },
  loading: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: '12px' },
  header: {
    background: '#1a1a2e',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  backBtn: { background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' },
  headerCenter: { flex: 1, textAlign: 'center' },
  orderNum: { color: 'rgba(255,255,255,0.6)', fontSize: '12px' },
  orderAmount: { color: '#FF6B00', fontWeight: '800', fontSize: '18px' },
  callBtn: { background: 'rgba(76,175,80,0.2)', border: '1px solid rgba(76,175,80,0.3)', color: 'white', padding: '8px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '16px' },
  mapWrapper: { flex: 1, position: 'relative', minHeight: 0 },
  gpsIndicator: { position: 'absolute', top: '8px', right: '8px', zIndex: 1000, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', color: 'white', fontWeight: '600' },
  bottomPanel: {
    background: '#1a1a2e',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '16px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  addressRow: { display: 'flex', gap: '12px' },
  addressItem: { flex: 1, display: 'flex', gap: '8px', alignItems: 'flex-start' },
  addressLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' },
  addressText: { fontSize: '12px', color: 'white', lineHeight: '1.4' },
  addressDivider: { width: '1px', background: 'rgba(255,255,255,0.08)', flexShrink: 0 },
  stepInfo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  stepDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  stepDescription: { color: 'rgba(255,255,255,0.6)', fontSize: '13px' },
  actionBtn: { width: '100%', padding: '16px', border: 'none', borderRadius: '12px', color: 'white', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  completedBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' },
  completedText: { color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.5' },
  homeBtn: { padding: '12px 24px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' },
};
