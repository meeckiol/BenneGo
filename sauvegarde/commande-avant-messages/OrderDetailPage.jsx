import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Check } from 'lucide-react';
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
  escrow_held: 'Bloqué en sécurité sur BenneGo',
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
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputePhotos, setDisputePhotos] = useState([]);

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await api.get(`/orders/${id}`);
      setOrder(data.order);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  // Charger historique du chat si commande assignée
  useEffect(() => {
    if (!order?.driver_id) return;
    api.get(`/orders/${id}/chat`)
      .then(({ data }) => setChatMessages(data.messages || []))
      .catch(() => {});

    const socket = getSocket();
    if (!socket) return;
    socket.emit('chat_join', { order_id: id });
    const onChatMsg = (msg) => {
      if (msg.order_id === id) {
        setChatMessages((prev) => [...prev, msg]);
      }
    };
    socket.on('chat_message', onChatMsg);
    return () => socket.off('chat_message', onChatMsg);
  }, [order?.driver_id, id]);

  const sendChatMessage = (e) => {
    if (e) e.preventDefault();
    const msg = chatInput.trim();
    if (!msg) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('chat_message', { order_id: id, message: msg });
    }
    setChatInput('');
  };

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
    let confirmMsg = `Confirmer la réception de vos matériaux ?\n\nLe paiement séquestré de ${fcfa(order.driver_amount)} sera libéré au chauffeur.`;
    let endpoint = `/orders/${id}/confirm-delivery`;

    if (order.order_type === 'RENTAL') {
      confirmMsg = `Valider que l'engin a bien travaillé sur votre chantier pour la durée convenue (${order.duration_hours || 4} heures) ?\n\nLe paiement séquestré de ${fcfa(order.driver_amount)} sera transmis au propriétaire de la machine.`;
      endpoint = `/orders/${id}/confirm-rental`;
    } else if (order.order_type === 'EVACUATION') {
      confirmMsg = `Valider que votre chantier est entièrement propre et que les gravats ont été évacués ?\n\nLe paiement séquestré de ${fcfa(order.driver_amount)} sera libéré au chauffeur.`;
      endpoint = `/orders/${id}/confirm-evacuation`;
    }

    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const { data } = await api.post(endpoint);
      toast.success(data.message || 'Validation effectuée avec succès !');
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

  const openDispute = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      body.append('reason', disputeReason.trim());
      disputePhotos.forEach((file) => body.append('photos', file));
      // Content-Type fixé à undefined : le navigateur ajoute la frontière multipart
      const { data } = await api.post(`/orders/${id}/dispute`, body, { headers: { 'Content-Type': undefined } });
      toast.success(data.message);
      setDisputeOpen(false);
      setDisputeReason('');
      setDisputePhotos([]);
      await fetchOrder();
    } catch { /* message affiché par l'intercepteur */ } finally {
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
  const disputeOpenNow = order.dispute_status === 'open';
  const loadingPhotos = (order.photos || []).filter((p) => p.kind === 'loading');
  const weighbridgePhotos = (order.photos || []).filter((p) => p.kind === 'weighbridge');
  const disputePhotosShown = (order.photos || []).filter((p) => p.kind === 'dispute');
  const canDispute = order.status === 'delivered' && order.payment_status === 'escrow_held' && !order.dispute_status;

  return (
    <div style={styles.container}>
      <header className="bn-page-head bn-detail-head">
        <button className="bn-icon-btn" onClick={() => navigate('/orders')} aria-label="Retour aux commandes"><ArrowLeft size={20} aria-hidden="true" /></button>
        <div className="bn-detail-head__text">
          <p className="bn-kicker">Commande</p>
          <h2 className="bn-title">{order.order_number}</h2>
        </div>
        {cancelled
          ? <span className="bn-pill bn-pill--danger">Annulée</span>
          : <span className="bn-pill bn-pill--brand">{STEPS[currentStepIdx]?.label?.split(' · ')[0] || order.status}</span>}
      </header>

      <div style={styles.content}>
        {/* Alerte Déviation GPS Certifié (Anti-détournement / anti-vol) */}
        {order.route_deviation_alert && (
          <div style={styles.deviationAlert}>
            <div style={styles.deviationTitle}>ALERTE GPS CERTIFIÉ : Détournement Potentiel Détecté</div>
            <p style={styles.deviationText}>
              Le camion s'est écarté de plus de 15% de l'itinéraire optimal calculé par OSRM.
              Vérifiez sa position en direct pour prévenir toute revente frauduleuse de marchandise.
            </p>
          </div>
        )}

        {order.payment_status === 'escrow_held' && !confirmed && (
          <div style={styles.secure}>
            Votre paiement de <strong>{fcfa(order.total_amount)}</strong> est bloqué en sécurité sur BenneGo.
            {order.order_type === 'RENTAL' && ' Les fonds sont libérés uniquement après validation des heures de l\'engin sur le chantier.'}
            {order.order_type === 'EVACUATION' && ' Les fonds sont libérés uniquement après confirmation de la propreté de votre site.'}
            {(!order.order_type || order.order_type === 'MATERIAL') && ' Le chauffeur n\'est payé qu\'après déchargement et vérification des matériaux.'}
          </div>
        )}

        {cancelled && <div style={styles.cancelled}>Commande annulée{order.payment_status === 'refunded' ? ' — remboursée' : ''}.</div>}

        {/* Suivi du trajet en direct */}
        {isLive && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Suivi GPS certifié en direct</h3>
            <TrackingMap pickup={pickup} delivery={delivery} driver={driverPos} route={route} />
            <p style={styles.mapHint}>
              {driverPos ? 'Position mise à jour en temps réel via Socket.IO.' : 'En attente de la première position du chauffeur…'}
            </p>
          </div>
        )}

        {/* Progression */}
        {!cancelled && (
          <div className="bn-card">
            <h3 className="bn-steps__title">Suivi de la mission</h3>
            <ol className="bn-timeline">
              {STEPS.map((step, idx) => (
                <li
                  key={step.key}
                  className={idx < currentStepIdx ? 'is-done' : idx === currentStepIdx ? 'is-current' : ''}
                >
                  {step.label}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Chargement constaté avant départ */}
        {(order.loading_volume_m3 || loadingPhotos.length > 0) && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Chargement constaté avant départ</h3>
            {order.loading_volume_m3 && <InfoRow label="Volume chargé déclaré" value={`${Number(order.loading_volume_m3)} m³`} bold />}
            {order.weighbridge_net_kg && <InfoRow label="Poids net (ticket de pesée)" value={`${Number(order.weighbridge_net_kg).toLocaleString('fr-FR')} kg`} />}
            <PhotoStrip photos={loadingPhotos} label="Photos du chargement" />
            <PhotoStrip photos={weighbridgePhotos} label="Ticket de pesée" />
          </div>
        )}

        {/* Litige */}
        {order.dispute_status && (
          <div style={order.dispute_status === 'open' ? styles.deviationAlert : styles.secure}>
            <div style={styles.cardTitle}>
              {order.dispute_status === 'open' && 'Litige ouvert'}
              {order.dispute_status === 'refunded' && 'Litige résolu : vous êtes remboursé'}
              {order.dispute_status === 'released' && 'Litige résolu : livraison validée'}
            </div>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.5' }}>
              {order.dispute_status === 'open' && 'BenneGo examine votre dossier avec les photos. Le paiement reste bloqué jusqu\'à la décision.'}
              {order.dispute_status === 'refunded' && 'Le remboursement intégral a été demandé à KKiaPay.'}
              {order.dispute_status === 'released' && 'Le paiement est transmis au chauffeur.'}
            </p>
            <PhotoStrip photos={disputePhotosShown} label="Vos photos" />
          </div>
        )}

        {/* Détails */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Détails de la mission</h3>
          <InfoRow
            label="Service"
            value={
              order.order_type === 'RENTAL' ? 'Location d\'Engin Lourd' :
              order.order_type === 'EVACUATION' ? 'Évacuation de Gravats' :
              'Transport de Matériaux'
            }
            bold
          />
          {order.project_name && <InfoRow label="Chantier rattaché" value={order.project_name} />}
          <InfoRow label="Point de ramassage / départ" value={order.pickup_address} />
          <InfoRow label="Chantier de livraison / décharge" value={order.delivery_address} />
          {order.material_description || order.material_name ? (
            <InfoRow label="Matériau" value={order.material_description || order.material_name} />
          ) : null}
          {order.vehicle_name && <InfoRow label="Véhicule / Engin" value={order.vehicle_name} />}
          {order.duration_hours && <InfoRow label="Durée de location" value={`${order.duration_hours} heures`} />}
          {order.evacuation_debris_type && <InfoRow label="Type de débris" value={order.evacuation_debris_type} />}
          {order.distance_km > 0 && <InfoRow label="Distance calculée" value={`${order.distance_km} km`} />}
          {order.driver_name && <InfoRow label="Prestataire assigné" value={order.driver_name} />}
          {order.driver_name && order.driver_rating_count > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-2)', fontSize: 14 }}>Note du prestataire</span>
              <span style={{ fontSize: 13 }}>
                <StarRating value={Math.round(order.driver_rating_avg)} size={16} label="Note du chauffeur" /> {Number(order.driver_rating_avg).toFixed(1)} ({order.driver_rating_count})
              </span>
            </div>
          )}
          {order.driver_phone && <InfoRow label="Tel. prestataire" value={order.driver_phone} />}
        </div>

        {/* Prix */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Paiement & Séquestre</h3>
          <InfoRow label="Montant Total" value={fcfa(order.total_amount)} bold />
          <InfoRow label="Part Prestataire" value={fcfa(order.driver_amount)} />
          <InfoRow label="Frais de service BenneGo" value={fcfa(order.commission_amount)} />
          <InfoRow label="Statut Paiement" value={PAYMENT_LABELS[order.payment_status] || order.payment_status} />
        </div>

        {/* Section Chat avec le Chauffeur */}
        {order.driver_id && (
          <div style={styles.card}>
            <div
              onClick={() => setChatOpen(!chatOpen)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <h3 style={{ ...styles.cardTitle, margin: 0 }}>
                Chat en direct avec le chauffeur
              </h3>
              <span style={{ fontSize: '13px', color: 'var(--brand-ink)', fontWeight: '700' }}>
                {chatOpen ? 'Masquer ▲' : `Ouvrir (${chatMessages.length}) ▼`}
              </span>
            </div>

            {chatOpen && (
              <div style={{ marginTop: '16px' }}>
                <div style={styles.chatBox}>
                  {chatMessages.length === 0 ? (
                    <div style={styles.chatEmpty}>Aucun message échangé pour l'instant. Posez une question au chauffeur !</div>
                  ) : (
                    chatMessages.map((m, i) => {
                      const isMe = m.sender_id === order.client_id || m.sender_role === 'client';
                      return (
                        <div key={i} style={isMe ? styles.chatMsgMe : styles.chatMsgThem}>
                          <div style={styles.chatSender}>{m.sender_name || (isMe ? 'Vous' : 'Chauffeur')}</div>
                          <div>{m.message}</div>
                          <div style={styles.chatTime}>
                            {m.created_at ? new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={sendChatMessage} style={styles.chatForm}>
                  <input
                    type="text"
                    placeholder="Écrivez un message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    style={styles.chatInput}
                  />
                  <button type="submit" style={styles.chatSendBtn}>Envoyer</button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {order.status === 'awaiting_payment' && (
          <button onClick={pay} disabled={busy} style={styles.primaryBtn}>
            {busy ? 'Ouverture du paiement…' : `Payer ${fcfa(order.total_amount)} (MTN MoMo / Moov Money)`}
          </button>
        )}

        {order.status === 'delivered' && !disputeOpenNow && (
          <button onClick={confirmReception} disabled={busy} style={styles.successBtn}>
            {busy ? 'Validation en cours…' : (
              <>
                <Check size={16} aria-hidden="true" />{' '}
                {order.order_type === 'RENTAL' ? 'Valider les heures travaillées de l\'engin (Libérer le séquestre)' :
                  order.order_type === 'EVACUATION' ? 'Valider la propreté du chantier (Libérer le séquestre)' :
                  'Confirmer la réception des matériaux (Libérer le séquestre)'}
              </>
            )}
          </button>
        )}

        {canDispute && !disputeOpen && (
          <button onClick={() => setDisputeOpen(true)} disabled={busy} style={styles.linkBtn}>
            Un problème avec la livraison ? Refuser avec photos
          </button>
        )}

        {canDispute && disputeOpen && (
          <form onSubmit={openDispute} style={{ ...styles.card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={styles.cardTitle}>Refuser la livraison</h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-2)' }}>
              Votre paiement reste bloqué. Décrivez le problème et joignez des photos de la marchandise livrée.
            </p>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Ex. : sable argileux, volume inférieur au ticket de pesée…"
              minLength={10}
              maxLength={1000}
              required
              rows={4}
              style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-2)', fontSize: '14px', fontFamily: 'inherit' }}
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              required
              onChange={(e) => setDisputePhotos(Array.from(e.target.files || []).slice(0, 5))}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setDisputeOpen(false)} style={styles.linkBtn}>Annuler</button>
              <button type="submit" disabled={busy || disputePhotos.length === 0} style={styles.primaryBtn}>
                {busy ? 'Envoi…' : 'Ouvrir le litige'}
              </button>
            </div>
          </form>
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

function PhotoStrip({ photos, label }) {
  if (!photos.length) return null;
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '8px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {photos.map((p) => (
          <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer">
            <img src={p.url} alt={label} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
          </a>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--text-2)', fontSize: '14px' }}>{label}</span>
      <span style={{ color: 'var(--text-strong)', fontSize: '14px', fontWeight: bold ? '700' : '400', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: 'var(--surface-2)' },
  header: { background: '#F6A906', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' },
  back: { background: 'none', border: 'none', color: 'var(--text-strong)', fontSize: '16px', cursor: 'pointer' },
  title: { color: 'var(--text-strong)', fontSize: '18px', fontWeight: '700', margin: 0 },
  content: { padding: '20px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' },
  card: { background: 'var(--surface)', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  cardTitle: { fontSize: '16px', fontWeight: '700', color: 'var(--text-strong)', marginBottom: '16px', marginTop: 0 },
  steps: { display: 'flex', flexDirection: 'column', gap: '12px' },
  step: { display: 'flex', alignItems: 'center', gap: '12px' },
  stepDot: { width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0 },
  stepLabel: { fontSize: '14px' },
  primaryBtn: { padding: '16px', background: '#F6A906', color: '#0b0b10', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },
  secure: { background: 'var(--success-soft)', border: '1px solid rgba(34, 197, 94, 0.35)', color: 'var(--success)', borderRadius: '12px', padding: '14px 16px', fontSize: '14px', lineHeight: '1.5' },
  cancelled: { background: 'var(--danger-soft)', border: '1px solid rgba(239, 68, 68, 0.35)', color: 'var(--danger)', borderRadius: '12px', padding: '14px 16px', fontSize: '14px' },
  mapHint: { margin: '10px 0 0', fontSize: '13px', color: 'var(--text-2)' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--danger)', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px', padding: '8px' },
  successBtn: { padding: '16px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', width: '100%' },
  deviationAlert: { background: 'var(--danger-soft)', border: '2px solid #EF4444', borderRadius: '12px', padding: '16px', color: 'var(--danger)' },
  deviationTitle: { fontWeight: '800', fontSize: '15px', marginBottom: '6px' },
  deviationText: { fontSize: '13.5px', lineHeight: '1.5', margin: 0 },

  // Chat styles
  chatBox: { maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '12px' },
  chatEmpty: { textAlign: 'center', color: 'var(--text-3)', fontSize: '13px', padding: '16px 0' },
  chatMsgMe: { alignSelf: 'flex-end', background: '#F6A906', color: '#0b0b10', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: '13px', maxWidth: '80%', wordBreak: 'break-word' },
  chatMsgThem: { alignSelf: 'flex-start', background: 'var(--surface-3)', color: 'var(--text-strong)', borderRadius: '12px 12px 12px 4px', padding: '8px 12px', fontSize: '13px', maxWidth: '80%', wordBreak: 'break-word' },
  chatSender: { fontSize: '10px', fontWeight: '700', opacity: 0.8, marginBottom: '2px' },
  chatTime: { fontSize: '9px', textAlign: 'right', marginTop: '4px' },
  chatForm: { display: 'flex', gap: '8px' },
  chatInput: { flex: 1, padding: '10px 12px', border: '1px solid var(--border-2)', borderRadius: '8px', fontSize: '13px', outline: 'none' },
  chatSendBtn: { background: '#F6A906', color: '#0b0b10', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: '700', fontSize: '13px' },
};
