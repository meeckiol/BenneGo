import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useDriverAuthStore from '../store/authStore';
import useGPS from '../hooks/useGPS';
import useDriverSocket from '../hooks/useDriverSocket';
import api from '../services/api';
import NewOrderAlert from '../components/NewOrderAlert';

export default function DriverDashboard() {
  const user = useDriverAuthStore((s) => s.user);
  const logout = useDriverAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [isAvailable, setIsAvailable] = useState(user?.is_available || false);
  const [pendingOrder, setPendingOrder] = useState(null); // Alerte nouvelle commande
  const [activeOrder, setActiveOrder] = useState(null);   // Commande en cours
  const [earnings, setEarnings] = useState({ today: 0, pending: 0, paid: 0 });
  const [summary, setSummary] = useState(null);
  const [toggling, setToggling] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [referralStats, setReferralStats] = useState({ total: 0, totalRewards: 0 });

  // Ref pour eviter les closures dans les callbacks socket
  const isAvailableRef = useRef(isAvailable);
  isAvailableRef.current = isAvailable;

  // Callback quand une nouvelle commande arrive via WebSocket
  const handleNewOrder = useCallback((order) => {
    if (isAvailableRef.current && !activeOrder) {
      setPendingOrder(order);
      // Vibration sur mobile si supporté
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
  }, [activeOrder]);

  const handleOrderCancelled = useCallback(() => {
    setActiveOrder(null);
    toast('Commande annulée par le client');
  }, []);

  const { setAvailable, setUnavailable, sendLocation } = useDriverSocket({
    onNewOrder: handleNewOrder,
    onOrderCancelled: handleOrderCancelled,
    onOrderTaken: (d) => setPendingOrder((cur) => (cur && cur.order_id === d.order_id ? null : cur)),
  });

  // GPS actif seulement quand disponible ou en course
  const { position, error: gpsError, accuracy } = useGPS({
    enabled: isAvailable || !!activeOrder,
    onPosition: useCallback((pos) => {
      sendLocation(pos, activeOrder && activeOrder.status !== 'delivered' ? (activeOrder.id || activeOrder.order_id) : null);
    }, [sendLocation, activeOrder]),
    interval: 5000,
  });

  // Charger les stats et la commande active au démarrage
  useEffect(() => {
    loadStats();
    loadActiveOrder();
    loadReferral();
  }, []);

  const loadReferral = async () => {
    try {
      const { data } = await api.get('/referrals/me');
      setReferralCode(data.referral_code);
      setReferralStats({
        total: data.total_referrals || 0,
        totalRewards: data.total_rewards || 0,
      });
    } catch {
      // ignore
    }
  };

  const copyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode).then(() => toast.success('Code copié !'));
  };

  const shareWhatsApp = () => {
    if (!referralCode) return;
    window.open(
      'https://wa.me/?text=' + encodeURIComponent(`Rejoins BenneGo comme chauffeur avec mon code ${referralCode} et gagne 2500 FCFA !`),
      '_blank'
    );
  };

  const loadStats = async () => {
    try {
      const [sum, list] = await Promise.all([
        api.get('/drivers/me/summary'),
        api.get('/orders?limit=100'),
      ]);
      setSummary(sum.data);
      const today = new Date().toDateString();
      const todayTotal = list.data.orders
        .filter((o) => o.driver_id === user?.id && ['validated', 'completed'].includes(o.status)
          && new Date(o.validated_at || o.created_at).toDateString() === today)
        .reduce((sum2, o) => sum2 + Number(o.driver_amount || 0), 0);
      setEarnings({
        today: todayTotal,
        paid: sum.data.earnings.paid,
        pending: sum.data.earnings.pending_payout + sum.data.earnings.awaiting_confirmation,
      });
    } catch {
      // ignore
    }
  };

  // Course en cours, quel que soit son avancement (et pas seulement "acceptée")
  const loadActiveOrder = async () => {
    try {
      const { data } = await api.get('/orders?limit=50');
      const active = data.orders.find((o) => o.driver_id === user?.id
        && ['accepted', 'driver_en_route_pickup', 'loading', 'driver_en_route_delivery', 'delivered'].includes(o.status));
      if (active) setActiveOrder(active);
    } catch {
      // ignore
    }
  };

  // Toggle disponibilité
  const toggleAvailability = async () => {
    setToggling(true);
    try {
      if (isAvailable) {
        setUnavailable();
        setIsAvailable(false);
        toast('Mode hors-ligne activé');
      } else {
        // Demander accès GPS avant de se mettre disponible
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {
              setAvailable();
              setIsAvailable(true);
              toast.success('Vous êtes en ligne ! En attente de commandes...');
            },
            () => {
              toast.error('Activez le GPS pour vous mettre disponible');
            }
          );
        } else {
          setAvailable();
          setIsAvailable(true);
          toast.success('Vous êtes en ligne !');
        }
      }
    } finally {
      setToggling(false);
    }
  };

  // Accepter une commande
  const acceptOrder = async (order) => {
    try {
      await api.patch(`/orders/${order.order_id}/accept`);
      setActiveOrder(order);
      setPendingOrder(null);
      setIsAvailable(false);
      toast.success('Commande acceptée ! Direction la carrière.');
      navigate(`/order/${order.order_id}`);
    } catch (err) {
      setPendingOrder(null);
    }
  };

  // Refuser une commande
  const refuseOrder = () => {
    setPendingOrder(null);
    toast('Commande ignorée');
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <div style={styles.headerName}>{user?.full_name}</div>
          <div style={styles.headerSub}>
            {user?.truck_type === 'double_benne' ? 'Double benne' :
             user?.truck_type === 'simple_benne' ? 'Benne simple' : 'Plateau'}
            {' · '}{user?.truck_plate || '—'}
          </div>
        </div>
        <button onClick={logout} style={styles.logoutBtn}>Déconnexion</button>
      </header>

      {/* Bouton ON/OFF principal */}
      <div style={styles.toggleSection}>
        <div style={{
          ...styles.toggleRing,
          boxShadow: isAvailable
            ? '0 0 0 12px rgba(76,175,80,0.15), 0 0 0 24px rgba(76,175,80,0.08)'
            : '0 0 0 12px rgba(255,107,0,0.1)',
        }}>
          <button
            onClick={toggleAvailability}
            disabled={toggling}
            style={{
              ...styles.toggleBtn,
              background: isAvailable
                ? 'linear-gradient(135deg, #4CAF50, #388E3C)'
                : 'linear-gradient(135deg, #FF6B00, #E65100)',
            }}
          >
            <span style={styles.toggleText}>
              {toggling ? '...' : isAvailable ? 'EN LIGNE' : 'HORS LIGNE'}
            </span>
          </button>
        </div>
        <p style={styles.toggleHint}>
          {isAvailable
            ? 'Vous recevrez les nouvelles commandes'
            : 'Appuyez pour vous mettre disponible'}
        </p>
      </div>

      {/* GPS Status */}
      {isAvailable && (
        <div style={{
          ...styles.gpsBar,
          background: gpsError ? '#FFEBEE' : '#E8F5E9',
          borderColor: gpsError ? '#EF9A9A' : '#A5D6A7',
        }}>
          {gpsError
            ? gpsError
            : position
              ? `GPS actif · précision ${accuracy}m`
              : 'Acquisition GPS...'}
        </div>
      )}

      {/* Commande active */}
      {activeOrder && (
        <div style={styles.activeOrderCard} onClick={() => navigate(`/order/${activeOrder.id || activeOrder.order_id}`)}>
          <div style={styles.activeOrderHeader}>
            <span style={styles.activeBadge}>EN COURS</span>
            <span style={styles.activeAmount}>
              {parseFloat(activeOrder.driver_amount || 0).toLocaleString()} FCFA
            </span>
          </div>
          <p style={styles.activeAddress}>Chargement : {activeOrder.pickup_address}</p>
          <p style={styles.activeAddress}>Livraison : {activeOrder.delivery_address}</p>
          <div style={styles.activeBtn}>Gérer la livraison →</div>
        </div>
      )}

      {/* Stats du jour */}
      <div style={styles.statsGrid}>
        <StatCard
          label="Aujourd'hui"
          value={`${earnings.today.toLocaleString()} FCFA`}
        />
        <StatCard
          label="Courses totales"
          value={summary?.total_trips ?? 0}
        />
        <StatCard
          label="Note"
          value={summary?.rating ? `${summary.rating.toFixed(1)}/5 (${summary.rating_count})` : 'Pas encore noté'}
        />
        <StatCard
          label="En attente de paiement"
          value={`${earnings.pending.toLocaleString('fr-FR')} FCFA`}
        />
        <StatCard
          label="Historique"
          value="Voir →"
          onClick={() => navigate('/history')}
        />
      </div>

      {/* 🎁 Section Programme de Parrainage */}
      <div style={styles.referralCard}>
        <h3 style={styles.referralTitle}>🎁 Programme de Parrainage</h3>
        <p style={styles.referralDesc}>Parrainez un ami chauffeur et gagnez 2 500 FCFA chacun !</p>
        {referralCode ? (
          <>
            <div style={styles.referralCodeBox}>
              <span style={styles.referralCode}>{referralCode}</span>
              <button onClick={copyCode} style={styles.copyBtn}>📋 Copier</button>
            </div>
            <div style={styles.referralStats}>
              <span>👥 {referralStats.total} filleul(s)</span>
              <span>💰 {Number(referralStats.totalRewards).toLocaleString()} FCFA gagnés</span>
            </div>
            <button onClick={shareWhatsApp} style={styles.whatsappBtn}>
              📲 Partager via WhatsApp
            </button>
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Chargement de votre code...</div>
        )}
      </div>

      {/* Alerte nouvelle commande */}
      {pendingOrder && (
        <NewOrderAlert
          order={pendingOrder}
          onAccept={() => acceptOrder(pendingOrder)}
          onRefuse={refuseOrder}
          timeoutSeconds={30}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, onClick }) {
  return (
    <div style={{ ...styles.statCard, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f0f1a',
    color: 'white',
    paddingBottom: '40px',
  },
  header: {
    background: 'rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '16px 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerName: { fontWeight: '700', fontSize: '16px' },
  headerSub: { color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '2px' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    color: 'white',
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  toggleSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px 24px',
  },
  toggleRing: {
    borderRadius: '50%',
    transition: 'box-shadow 0.3s ease',
    marginBottom: '16px',
  },
  toggleBtn: {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s ease',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  toggleText: { fontSize: '13px', fontWeight: '800', color: 'white', letterSpacing: '1px' },
  toggleHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '13px',
    textAlign: 'center',
    margin: 0,
  },
  gpsBar: {
    margin: '0 16px 16px',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px',
    color: '#333',
  },
  activeOrderCard: {
    margin: '0 16px 20px',
    background: 'linear-gradient(135deg, #FF6B00, #E65100)',
    borderRadius: '16px',
    padding: '16px',
    cursor: 'pointer',
  },
  activeOrderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  activeBadge: {
    background: 'rgba(255,255,255,0.2)',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700',
  },
  activeAmount: { fontWeight: '800', fontSize: '18px' },
  activeAddress: { fontSize: '13px', opacity: 0.9, margin: '3px 0' },
  activeBtn: {
    marginTop: '10px',
    textAlign: 'right',
    fontSize: '13px',
    fontWeight: '700',
    opacity: 0.9,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    margin: '0 16px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statValue: { fontWeight: '700', fontSize: '18px' },
  statLabel: { color: 'rgba(255,255,255,0.4)', fontSize: '12px' },
  referralCard: {
    margin: '16px 16px 0',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '20px',
  },
  referralTitle: { fontSize: '16px', fontWeight: '800', color: 'white', margin: '0 0 8px' },
  referralDesc: { color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: '0 0 16px' },
  referralCodeBox: { display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' },
  referralCode: { flex: 1, fontSize: '18px', fontWeight: '900', color: '#FF6B00', letterSpacing: '2px' },
  copyBtn: { background: '#FF6B00', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' },
  referralStats: { display: 'flex', gap: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '12px' },
  whatsappBtn: { background: '#25D366', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', width: '100%' },
};
