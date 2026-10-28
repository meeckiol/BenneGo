import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import api from '../services/api';
import PaymentBreakdown from '../components/PaymentBreakdown';
import { useDriverSession } from '../context/DriverSession';
import { useUnread, badgeText } from '../../../shared/messaging';
import RouteMap from '../components/RouteMap';

// Étapes de livraison dynamiques selon le type de service
const getDeliverySteps = (orderType) => {
  if (orderType === 'RENTAL') {
    return [
      {
        status: 'accepted',
        next: 'driver_en_route_pickup',
        label: 'Acheminer l\'engin vers le chantier',
        color: 'var(--info)',
        description: 'Appuyez au départ du camion porte-char',
      },
      {
        status: 'driver_en_route_pickup',
        next: 'machine_operating',
        label: 'Arrivé sur site - Démarrer les travaux',
        color: 'var(--warning)',
        description: 'Appuyez pour lancer le décompte des heures de travail',
      },
      {
        status: 'machine_operating',
        next: 'delivered',
        label: 'Fin des heures - Confirmer l\'opération',
        color: 'var(--success)',
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
        color: 'var(--info)',
        description: 'Appuyez quand vous prenez la route',
      },
      {
        status: 'driver_en_route_pickup',
        next: 'loading',
        label: 'Arrivé au chantier - Chargement des gravats',
        color: 'var(--warning)',
        description: 'Appuyez dès que le chargement débute',
      },
      {
        status: 'loading',
        next: 'driver_en_route_delivery',
        label: 'Camion chargé - Partir vers la décharge',
        color: 'var(--violet)',
        description: 'Appuyez au départ vers la décharge autorisée',
      },
      {
        status: 'driver_en_route_delivery',
        next: 'delivered',
        label: 'Confirmer le déversement à la décharge',
        color: 'var(--success)',
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
      color: 'var(--info)',
      description: 'Appuyez quand vous quittez votre position',
    },
    {
      status: 'driver_en_route_pickup',
      next: 'loading',
      label: 'Confirmer l\'arrivée à la carrière',
      color: 'var(--warning)',
      description: 'Appuyez quand vous êtes à la carrière',
    },
    {
      status: 'loading',
      next: 'driver_en_route_delivery',
      label: 'Chargement terminé - Partir livrer',
      color: 'var(--violet)',
      description: 'Appuyez quand le camion est chargé',
    },
    {
      status: 'driver_en_route_delivery',
      next: 'delivered',
      label: 'Confirmer la livraison',
      color: 'var(--success)',
      description: 'Appuyez quand vous avez déversé la marchandise',
    },
  ];
};

export default function ActiveDeliveryPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ---- PoD states ----
  const [podPhotos, setPodPhotos] = useState([]);
  const [podNotes, setPodNotes] = useState('');
  const [podSubmitted, setPodSubmitted] = useState(false);

  // ---- Chargement avant départ ----
  const [loadingVolume, setLoadingVolume] = useState('');
  const [loadingPhotos, setLoadingPhotos] = useState([]);
  const [weighbridgePhoto, setWeighbridgePhoto] = useState(null);
  const [weighbridgeKg, setWeighbridgeKg] = useState('');
  const [submittingLoading, setSubmittingLoading] = useState(false);

  // Messages non lus de cette course (la discussion s'ouvre en plein écran)
  const unread = useUnread((s) => s.byOrder[orderId] || 0);

  // GPS et envoi de la position : gérés par la session du camionneur, sur tous les écrans
  const { position, gpsError, accuracy, reloadActive } = useDriverSession();
  const tracking = !!order && ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'machine_operating'].includes(order.status);

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

  const deliverySteps = getDeliverySteps(order?.order_type);

  const advanceStatus = async () => {
    if (!order) return;
    const step = deliverySteps.find((s) => s.status === order.status);
    if (!step) return;
    if (order.status === 'loading' && !order.loading_volume_m3) {
      toast.error('Enregistrez le volume chargé et les photos avant de partir');
      return;
    }

    setUpdating(true);
    try {
      await api.patch(`/orders/${orderId}/status`, { status: step.next });
      await loadOrder();
      reloadActive();

      if (step.next === 'delivered') {
        toast.success(
          order.order_type === 'RENTAL'
            ? 'Fin des travaux enregistrée. Le client doit valider les heures pour libérer votre paiement séquestre.'
            : order.order_type === 'EVACUATION'
            ? 'Décharge enregistrée. Le client doit valider la propreté du chantier pour libérer votre paiement.'
            : 'Livraison enregistrée. Le client doit confirmer la réception pour libérer votre paiement.'
        );
      } else {
        toast.success('Statut mis à jour');
      }
    } finally {
      setUpdating(false);
    }
  };

  const submitLoading = async (e) => {
    e.preventDefault();
    setSubmittingLoading(true);
    try {
      const formData = new FormData();
      formData.append('volume_m3', loadingVolume);
      loadingPhotos.forEach((file) => formData.append('photos', file));
      if (weighbridgePhoto) formData.append('weighbridge', weighbridgePhoto);
      if (weighbridgeKg) formData.append('weighbridge_net_kg', weighbridgeKg);
      // Content-Type fixé à undefined : le navigateur ajoute la frontière multipart
      await api.post(`/orders/${orderId}/loading`, formData, { headers: { 'Content-Type': undefined } });
      toast.success('Chargement enregistré');
      await loadOrder();
    } catch { /* message affiché par l'intercepteur */ } finally {
      setSubmittingLoading(false);
    }
  };

  const reportBreakdown = (reason) => {
    if (!navigator.geolocation) {
      toast.error('Position GPS indisponible sur cet appareil');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        await api.post(`/orders/${orderId}/breakdown`, {
          reason, lat: pos.coords.latitude, lng: pos.coords.longitude,
        });
        toast.success('Panne signalée : BenneGo cherche une benne de réserve');
      } catch { /* message affiché par l'intercepteur */ }
    }, () => toast.error('Activez la localisation pour signaler une panne'), { enableHighAccuracy: true, timeout: 10000 });
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
      toast.success('Photos soumises');
      setPodSubmitted(true);
    } catch {
      toast.error('Échec de l\'envoi des photos');
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

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <button onClick={() => navigate('/')} style={styles.backBtn}><ArrowLeft size={20} aria-hidden="true" /></button>
        <div style={styles.headerCenter}>
          <div style={styles.orderNum}>{order.order_number}</div>
          <div style={styles.orderAmount}>
            {parseFloat(order.driver_amount).toLocaleString()} FCFA
          </div>
        </div>
        <a href={`tel:${order.client_phone}`} style={styles.callBtn}>Appeler</a>
      </header>

      {/* Carte de la course (Google Maps avec une clé, sinon OpenStreetMap) */}
      <div style={styles.mapWrapper}>
        <RouteMap order={order} position={position} />

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
        <PaymentBreakdown order={order} />

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
            {order.status === 'loading' && !order.loading_volume_m3 && (
              <form onSubmit={submitLoading} style={styles.loadingForm}>
                <div style={styles.loadingTitle}>Avant de partir : volume et photos du chargement</div>
                <label style={styles.loadingLabel}>
                  Volume chargé (m³)
                  <input
                    type="number" inputMode="decimal" min="0.5" max="100" step="0.5"
                    value={loadingVolume} onChange={(e) => setLoadingVolume(e.target.value)} required
                    style={styles.loadingInput}
                  />
                </label>
                <label style={styles.loadingLabel}>
                  Photos du camion chargé (1 à 5)
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp" multiple required
                    onChange={(e) => setLoadingPhotos(Array.from(e.target.files || []).slice(0, 5))}
                    style={styles.loadingInput}
                  />
                </label>
                <label style={styles.loadingLabel}>
                  Ticket de pesée (facultatif) : photo
                  <input
                    type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setWeighbridgePhoto((e.target.files || [])[0] || null)}
                    style={styles.loadingInput}
                  />
                </label>
                <label style={styles.loadingLabel}>
                  Poids net du ticket (kg, facultatif)
                  <input
                    type="number" inputMode="numeric" min="1" step="1"
                    value={weighbridgeKg} onChange={(e) => setWeighbridgeKg(e.target.value)}
                    style={styles.loadingInput}
                  />
                </label>
                <button
                  type="submit"
                  disabled={submittingLoading || !loadingVolume || loadingPhotos.length === 0}
                  style={{ ...styles.actionBtn, background: '#9C27B0', marginTop: '8px' }}
                >
                  {submittingLoading ? 'Enregistrement…' : 'Enregistrer le chargement'}
                </button>
              </form>
            )}
            <button
              onClick={advanceStatus}
              disabled={updating || (order.status === 'loading' && !order.loading_volume_m3)}
              style={{ ...styles.actionBtn, background: currentStep.color }}
            >
              {updating ? 'Mise à jour...' : currentStep.label}
            </button>
            {tracking && (
              <div style={styles.breakdownBox}>
                <div style={styles.breakdownTitle}>Problème sur la route ?</div>
                <div style={styles.breakdownRow}>
                  <button onClick={() => reportBreakdown('crevaison')} style={styles.breakdownBtn}>Crevaison</button>
                  <button onClick={() => reportBreakdown('panne_moteur')} style={styles.breakdownBtn}>Panne</button>
                  <button onClick={() => reportBreakdown('accident')} style={styles.breakdownBtn}>Accident</button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {order.dispute_status === 'open' && (
          <div style={styles.disputeBox}>
            Le client a refusé la livraison. BenneGo examine le litige avec les photos ; le paiement reste bloqué jusqu'à la décision.
          </div>
        )}

        {/* Section Preuve de Livraison (PoD) */}
        {showPoD && !podSubmitted && (
          <div style={styles.podSection}>
            <div style={styles.podTitle}>Preuve de Livraison (PoD)</div>
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
            <div style={{ fontSize: '14px', color: 'var(--success)', fontWeight: '700' }}>
              Preuves de livraison envoyées
            </div>
          </div>
        )}
      </div>

      {/* Discussion avec le client, en plein écran */}
      <button
        type="button"
        onClick={() => navigate(`/messages/${orderId}`)}
        style={styles.chatFab}
        aria-label={unread ? `Messages, ${unread} non lu(s)` : 'Messages'}
      >
        <MessageCircle size={22} aria-hidden="true" />
        {unread > 0 && <span className="bn-badge bn-badge--tab" style={styles.chatBadge}>{badgeText(unread)}</span>}
      </button>
    </div>
  );
}

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' },
  loading: { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-strong)', gap: '12px' },
  header: {
    background: 'var(--surface)',
    borderBottom: '1px solid rgba(17, 24, 39, 0.08)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexShrink: 0,
  },
  backBtn: { background: 'rgba(17, 24, 39, 0.08)', border: 'none', color: 'var(--text-strong)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px' },
  headerCenter: { flex: 1, textAlign: 'center' },
  orderNum: { color: 'var(--text-2)', fontSize: '12px' },
  orderAmount: { color: 'var(--brand-ink)', fontWeight: '800', fontSize: '18px' },
  callBtn: { background: 'rgba(76,175,80,0.2)', border: '1px solid rgba(76,175,80,0.3)', color: 'var(--text-strong)', padding: '8px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '16px' },
  mapWrapper: { flex: 1, position: 'relative', minHeight: 0 },
  gpsIndicator: { position: 'absolute', top: '8px', right: '8px', zIndex: 1000, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', color: 'var(--text-strong)', fontWeight: '600' },
  bottomPanel: {
    background: 'var(--surface)',
    borderTop: '1px solid rgba(17, 24, 39, 0.08)',
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
  addressLabel: { fontSize: '10px', color: 'var(--text-3)', marginBottom: '2px' },
  addressText: { fontSize: '12px', color: 'var(--text-strong)', lineHeight: '1.4' },
  addressDivider: { width: '1px', background: 'rgba(17, 24, 39, 0.08)', flexShrink: 0 },
  stepInfo: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  stepDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  stepDescription: { color: 'var(--text-2)', fontSize: '13px' },
  loadingForm: { display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--surface)', borderRadius: '12px', padding: '16px', marginBottom: '14px' },
  loadingTitle: { fontSize: '15px', fontWeight: '800', color: 'var(--text-strong)' },
  loadingLabel: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-2)', fontWeight: '600' },
  loadingInput: { padding: '10px', border: '1px solid var(--border-2)', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', width: '100%' },
  breakdownBox: { marginTop: '14px', background: 'rgba(17, 24, 39, 0.06)', borderRadius: '12px', padding: '12px' },
  breakdownTitle: { color: 'var(--text-strong)', fontSize: '13px', fontWeight: '700', marginBottom: '8px' },
  breakdownRow: { display: 'flex', gap: '8px' },
  breakdownBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(17, 24, 39, 0.25)', background: 'transparent', color: 'var(--text-strong)', fontWeight: '700', cursor: 'pointer' },
  disputeBox: { marginTop: '14px', background: 'var(--danger-soft)', border: '1px solid rgba(239, 68, 68, 0.35)', color: 'var(--danger)', borderRadius: '12px', padding: '12px', fontSize: '14px', lineHeight: '1.5' },
  actionBtn: { width: '100%', padding: '16px', border: 'none', borderRadius: '12px', color: 'var(--text-strong)', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  completedBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' },
  completedText: { color: 'var(--text)', fontSize: '14px', lineHeight: '1.5' },
  homeBtn: { padding: '12px 24px', background: '#D9A55B', color: '#0b0b10', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '4px' },

  // PoD styles
  podSection: { background: 'var(--surface)', borderRadius: '12px', padding: '16px', margin: '16px 0', border: '1px solid var(--border)' },
  podTitle: { fontSize: '15px', fontWeight: '800', color: 'var(--text-strong)', marginBottom: '12px' },
  podFileInput: { padding: '10px', border: '2px dashed var(--border-2)', borderRadius: '8px', width: '100%', cursor: 'pointer', boxSizing: 'border-box', fontSize: '13px' },
  podPreviews: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' },
  podThumb: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' },
  podNotes: { marginTop: '10px', width: '100%', padding: '10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', color: 'var(--text-strong)' },
  podSubmitBtn: { marginTop: '12px', width: '100%', background: '#D9A55B', color: '#0b0b10', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px' },

  // Chat FAB
  chatFab: { position: 'fixed', bottom: 'calc(16px + env(safe-area-inset-bottom))', right: '16px', display: 'grid', placeItems: 'center', background: 'var(--brand-grad)', color: '#0b0b10', border: 'none', borderRadius: '50%', width: '48px', height: '48px', fontSize: '20px', cursor: 'pointer', zIndex: 1000, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },

  chatBadge: { top: '-4px', left: 'auto', right: '-4px' },
};
