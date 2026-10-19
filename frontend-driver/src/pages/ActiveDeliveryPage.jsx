import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import toast from 'react-hot-toast';
import api from '../services/api';
import useGPS from '../hooks/useGPS';
import useDriverSocket from '../hooks/useDriverSocket';
import { getSocket } from '../services/socket';
import useDriverAuthStore from '../store/authStore';

// Composant pour centrer la carte sur la position GPS
function MapCenter({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.lat, position.lng], map.getZoom());
  }, [position, map]);
  return null;
}

// Étapes de livraison dynamiques selon le type de service
const getDeliverySteps = (orderType) => {
  if (orderType === 'RENTAL') {
    return [
      {
        status: 'accepted',
        next: 'driver_en_route_pickup',
        label: 'Acheminer l\'engin vers le chantier',
        color: '#2196F3',
        description: 'Appuyez au départ du camion porte-char',
      },
      {
        status: 'driver_en_route_pickup',
        next: 'machine_operating',
        label: 'Arrivé sur site - Démarrer les travaux',
        color: '#FF9800',
        description: 'Appuyez pour lancer le décompte des heures de travail',
      },
      {
        status: 'machine_operating',
        next: 'delivered',
        label: 'Fin des heures - Confirmer l\'opération',
        color: '#4CAF50',
        description: 'Appuyez quand le temps de location est accompli',
      },
    ];
  }
  if (orderType === 'EVACUATION') {
    return [
      {
        status: 'accepted',
        next: 'driver_en_route_pickup',
        label: 'Partir vers le chantier à nettoyer',
        color: '#2196F3',
        description: 'Appuyez quand vous prenez la route',
      },
      {
        status: 'driver_en_route_pickup',
        next: 'loading',
        label: 'Arrivé au chantier - Chargement des gravats',
        color: '#FF9800',
        description: 'Appuyez dès que le chargement débute',
      },
      {
        status: 'loading',
        next: 'driver_en_route_delivery',
        label: 'Camion chargé - Partir vers la décharge',
        color: '#9C27B0',
        description: 'Appuyez au départ vers la décharge autorisée',
      },
      {
        status: 'driver_en_route_delivery',
        next: 'delivered',
        label: 'Confirmer le déversement à la décharge',
        color: '#4CAF50',
        description: 'Appuyez après déversement des gravats',
      },
    ];
  }
  // Standard MATERIAL
  return [
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
};

export default function ActiveDeliveryPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const user = useDriverAuthStore((s) => s.user);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ---- PoD states ----
  const [podPhotos, setPodPhotos] = useState([]);
  const [podNotes, setPodNotes] = useState('');
  const [podSubmitted, setPodSubmitted] = useState(false);

  // ---- Chat states ----
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  const { sendLocation } = useDriverSocket();

  // GPS actif pendant la course (le client suit le camion en direct)
  const tracking = !!order && ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'machine_operating'].includes(order.status);
  const { position, error: gpsError, accuracy } = useGPS({
    enabled: tracking,
    onPosition: useCallback((pos) => {
      sendLocation(pos, orderId);
    }, [sendLocation, orderId]),
    interval: 5000,
  });

  useEffect(() => {
    loadOrder();
    loadChatHistory();

    // Socket pour le chat
    const socket = getSocket();

    const handleChatMessage = (msg) => {
      if (String(msg.order_id) === String(orderId)) {
        setChatMessages((prev) => [...prev, msg]);
      }
    };

    socket.on('chat_message', handleChatMessage);

    return () => {
      socket.off('chat_message', handleChatMessage);
    };
  }, [orderId]);

  // Scroll chat vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    if (chatOpen && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatOpen]);

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

  const loadChatHistory = async () => {
    try {
      const { data } = await api.get(`/orders/${orderId}/chat`);
      if (data && Array.isArray(data.messages)) {
        setChatMessages(data.messages);
      }
    } catch {
      // historique non disponible, pas bloquant
    }
  };

  const deliverySteps = getDeliverySteps(order?.order_type);

  const advanceStatus = async () => {
    if (!order) return;
    const step = deliverySteps.find((s) => s.status === order.status);
    if (!step) return;

    setUpdating(true);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: step.next });
      await loadOrder();

      if (step.next === 'delivered') {
        toast.success(
          order.order_type === 'RENTAL'
            ? 'Fin des travaux enregistrée. Le client doit valider les heures pour libérer votre paiement séquestre.'
            : order.order_type === 'EVACUATION'
            ? 'Décharge enregistrée. Le client doit valider la propreté du chantier pour libérer votre paiement.'
            : 'Livraison enregistrée. Le client doit confirmer la réception pour libérer votre paiement.'
        );
      } else {
        toast.success('Statut mis à jour ✓');
      }
    } finally {
      setUpdating(false);
    }
  };

  // ---- PoD upload ----
  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    setPodPhotos(files);
  };

  const uploadPoD = async () => {
    if (podPhotos.length === 0) {
      toast.error('Sélectionnez au moins une photo');
      return;
    }
    const formData = new FormData();
    podPhotos.forEach(file => formData.append('photos', file));
    if (podNotes) formData.append('notes', podNotes);
    try {
      await api.post(`/orders/${orderId}/pod`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Photos soumises ✅');
      setPodSubmitted(true);
    } catch {
      toast.error('Échec de l\'envoi des photos');
    }
  };

  // ---- Chat send ----
  const sendChatMessage = () => {
    const msg = chatInput.trim();
    if (!msg) return;
    const socket = getSocket();
    socket.emit('chat_message', { order_id: orderId, message: msg });
    // Optimistic local add
    setChatMessages((prev) => [
      ...prev,
      { order_id: orderId, message: msg, sender: 'driver', created_at: new Date().toISOString() },
    ]);
    setChatInput('');
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
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

  const currentStep = deliverySteps.find((s) => s.status === order.status);
  const isDelivered = order.status === 'delivered' || order.status === 'validated' || order.status === 'completed';
  const showPoD = order.status === 'delivered' || order.status === 'validated' || order.status === 'completed';

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
              {order.status === 'completed' && order.payment_status === 'released'
                ? `Course terminée ! ${parseFloat(order.driver_amount).toLocaleString('fr-FR')} FCFA versés sur votre Mobile Money.`
                : order.status === 'validated' || order.status === 'completed'
                  ? `Le client a confirmé la réception ! ${parseFloat(order.driver_amount).toLocaleString('fr-FR')} FCFA vont vous être versés sur votre Mobile Money.`
                  : `Livraison enregistrée. Dès que le client confirme la réception, vos ${parseFloat(order.driver_amount).toLocaleString('fr-FR')} FCFA vous sont versés.`}
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

        {/* 📸 Section Preuve de Livraison (PoD) */}
        {showPoD && !podSubmitted && (
          <div style={styles.podSection}>
            <div style={styles.podTitle}>📸 Preuve de Livraison (PoD)</div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              style={styles.podFileInput}
            />
            {podPhotos.length > 0 && (
              <div style={styles.podPreviews}>
                {podPhotos.map((file, i) => (
                  <img
                    key={i}
                    src={URL.createObjectURL(file)}
                    alt={`preview-${i}`}
                    style={styles.podThumb}
                  />
                ))}
              </div>
            )}
            <textarea
              placeholder="Notes optionnelles (ex: palette laissée à gauche de l'entrée)"
              value={podNotes}
              onChange={(e) => setPodNotes(e.target.value)}
              rows={2}
              style={styles.podNotes}
            />
            <button onClick={uploadPoD} style={styles.podSubmitBtn}>
              Soumettre les photos
            </button>
          </div>
        )}

        {showPoD && podSubmitted && (
          <div style={{ ...styles.podSection, textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: '#4CAF50', fontWeight: '700' }}>
              ✅ Preuves de livraison envoyées
            </div>
          </div>
        )}
      </div>

      {/* 💬 Bouton flottant Chat */}
      <button
        onClick={() => setChatOpen((o) => !o)}
        style={styles.chatFab}
        aria-label="Chat"
      >
        💬
      </button>

      {/* Panneau Chat */}
      {chatOpen && (
        <div style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            💬 Discussion — {order.order_number}
          </div>
          <div style={styles.chatMessages}>
            {chatMessages.length === 0 && (
              <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
                Aucun message pour l'instant
              </div>
            )}
            {chatMessages.map((msg, i) => {
              const isDriver = msg.sender === 'driver' || msg.sender_id === user?.id;
              return (
                <div
                  key={i}
                  style={isDriver ? styles.chatMsgDriver : styles.chatMsgOther}
                >
                  {msg.message}
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <div style={styles.chatInputRow}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder="Écrire un message..."
              style={styles.chatInput}
            />
            <button onClick={sendChatMessage} style={styles.chatSendBtn}>
              ➤
            </button>
          </div>
        </div>
      )}
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
    overflowY: 'auto',
    maxHeight: '55vh',
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

  // PoD styles
  podSection: { background: 'white', borderRadius: '12px', padding: '16px', margin: '16px 0', border: '1px solid #E2E8F0' },
  podTitle: { fontSize: '15px', fontWeight: '800', color: '#1E293B', marginBottom: '12px' },
  podFileInput: { padding: '10px', border: '2px dashed #CBD5E1', borderRadius: '8px', width: '100%', cursor: 'pointer', boxSizing: 'border-box', fontSize: '13px' },
  podPreviews: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  podThumb: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' },
  podNotes: { marginTop: '10px', width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', color: '#1E293B' },
  podSubmitBtn: { marginTop: '12px', width: '100%', background: '#FF6B00', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },

  // Chat FAB
  chatFab: { position: 'fixed', bottom: '16px', right: '16px', background: '#FF6B00', color: 'white', border: 'none', borderRadius: '50%', width: '48px', height: '48px', fontSize: '20px', cursor: 'pointer', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },

  // Chat panel
  chatPanel: { position: 'fixed', bottom: '72px', right: '16px', width: '300px', height: '400px', background: 'white', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column', zIndex: 999 },
  chatHeader: { background: '#1E293B', color: 'white', padding: '12px', fontSize: '14px', fontWeight: '700' },
  chatMessages: { flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  chatMsgDriver: { alignSelf: 'flex-end', background: '#FF6B00', color: 'white', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: '13px', maxWidth: '80%', wordBreak: 'break-word' },
  chatMsgOther: { alignSelf: 'flex-start', background: '#F1F5F9', color: '#1E293B', borderRadius: '12px 12px 12px 4px', padding: '8px 12px', fontSize: '13px', maxWidth: '80%', wordBreak: 'break-word' },
  chatInputRow: { borderTop: '1px solid #E2E8F0', padding: '8px', display: 'flex', gap: '8px' },
  chatInput: { flex: 1, padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none' },
  chatSendBtn: { background: '#FF6B00', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },
};
