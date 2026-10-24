import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, LogOut } from 'lucide-react';
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
    // Course réassignée (panne) ou litige ouvert : on recharge la course en cours
    onOrderReassigned: () => loadActiveOrder(),
    onDisputeOpened: () => loadActiveOrder(),
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


  const truck = user?.truck_type === 'double_benne' ? 'Double benne'
    : user?.truck_type === 'simple_benne' ? 'Benne simple' : 'Plateau';

  return (
    <main className="bn-page">
      <header className="bn-hello">
        <div className="bn-hello__who">
          <span className="bn-avatar" aria-hidden="true">{initials(user?.full_name)}</span>
          <div>
            <p className="bn-kicker">Espace chauffeur</p>
            <h1 className="bn-hello__name">{user?.full_name || 'Chauffeur'}</h1>
            <p className="bn-subtitle">{truck} · {user?.truck_plate || '—'}</p>
          </div>
        </div>
        <button className="bn-icon-btn" onClick={logout} aria-label="Se déconnecter" title="Se déconnecter">
          <LogOut size={20} aria-hidden="true" />
        </button>
      </header>

      <section className={`bn-card bn-online${isAvailable ? ' is-online' : ''}`}>
        <button
          className="bn-online__switch"
          onClick={toggleAvailability}
          disabled={toggling}
          aria-pressed={isAvailable}
        >
          <span className="bn-online__label">{toggling ? '…' : isAvailable ? 'En ligne' : 'Hors ligne'}</span>
        </button>
        <div className="bn-online__text">
          <strong>{isAvailable ? 'Vous recevez les nouvelles commandes' : 'Mettez-vous en ligne pour recevoir des courses'}</strong>
          {isAvailable && (
            <span className={`bn-pill bn-pill--${gpsError ? 'danger' : 'success'}`}>
              {gpsError ? gpsError : position ? `GPS actif · précision ${accuracy} m` : 'Acquisition GPS…'}
            </span>
          )}
        </div>
      </section>

      {activeOrder && (
        <button
          className="bn-card bn-card--brand bn-mission"
          onClick={() => navigate(`/order/${activeOrder.id || activeOrder.order_id}`)}
        >
          <span className="bn-mission__head">
            <span className="bn-pill bn-mission__pill">En cours</span>
            <strong className="bn-mission__amount">{parseFloat(activeOrder.driver_amount || 0).toLocaleString()} FCFA</strong>
          </span>
          <span className="bn-mission__line">Chargement : {activeOrder.pickup_address}</span>
          <span className="bn-mission__line">Livraison : {activeOrder.delivery_address}</span>
          <span className="bn-mission__cta">Gérer la livraison <ArrowRight size={16} aria-hidden="true" /></span>
        </button>
      )}

      <section className="bn-kpis" aria-label="Indicateurs">
        <StatCard label="Aujourd'hui" value={`${earnings.today.toLocaleString()} FCFA`} />
        <StatCard label="Courses totales" value={summary?.total_trips ?? 0} />
        <StatCard
          label="Note"
          value={summary?.rating ? `${summary.rating.toFixed(1)} / 5` : 'Pas encore noté'}
          sub={summary?.rating_count ? `${summary.rating_count} avis` : null}
        />
        <StatCard label="En attente de paiement" value={`${earnings.pending.toLocaleString('fr-FR')} FCFA`} />
        <StatCard label="Historique" value="Voir" onClick={() => navigate('/history')} accent />
      </section>

      <section className="bn-card bn-referral">
        <h2 className="bn-steps__title">Programme de parrainage</h2>
        <p className="bn-subtitle">Parrainez un ami chauffeur et gagnez 2 500 FCFA chacun.</p>
        {referralCode ? (
          <>
            <div className="bn-code">
              <span className="bn-code__value">{referralCode}</span>
              <button className="bn-btn bn-code__copy" onClick={copyCode}>Copier</button>
            </div>
            <div className="bn-referral__stats">
              <span>{referralStats.total} filleul(s)</span>
              <span>{Number(referralStats.totalRewards).toLocaleString()} FCFA gagnés</span>
            </div>
            <button className="bn-btn bn-btn--primary bn-btn--block" onClick={shareWhatsApp}>
              Partager via WhatsApp
            </button>
          </>
        ) : (
          <p className="bn-subtitle">Chargement de votre code…</p>
        )}
      </section>

      {pendingOrder && (
        <NewOrderAlert
          order={pendingOrder}
          onAccept={() => acceptOrder(pendingOrder)}
          onRefuse={refuseOrder}
          timeoutSeconds={30}
        />
      )}
    </main>
  );
}

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'C';

function StatCard({ label, value, sub, onClick, accent }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`bn-card bn-kpi${accent ? ' bn-kpi--accent' : ''}`} onClick={onClick}>
      <span className="bn-kpi__label">{label}</span>
      <strong className="bn-kpi__value">{value}</strong>
      {sub && <span className="bn-kpi__sub">{sub}</span>}
    </Tag>
  );
}
