import React, { useState, useEffect } from 'react';

/**
 * Alerte plein écran quand une nouvelle commande arrive
 * Le chauffeur ou opérateur d'engin a timeoutSeconds secondes pour accepter ou refuser
 */
export default function NewOrderAlert({ order, onAccept, onRefuse, timeoutSeconds = 30 }) {
  const [remaining, setRemaining] = useState(timeoutSeconds);

  // Vibration haptique pour alerter le chauffeur dans la cabine du camion
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([300, 150, 300, 150, 500]);
      } catch (e) {
        // Ignorer si matériel non compatible
      }
    }
    return () => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(0); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      onRefuse();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onRefuse]);

  const progressPct = (remaining / timeoutSeconds) * 100;
  const isRental = order.order_type === 'RENTAL';
  const isEvacuation = order.order_type === 'EVACUATION';

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Countdown */}
        <div style={styles.countdownWrapper}>
          <svg width="80" height="80" style={styles.svg}>
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke={remaining > 10 ? '#FF6B00' : '#F44336'}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - progressPct / 100)}`}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <span style={styles.countdownNum}>{remaining}</span>
        </div>

        {/* Badge Service */}
        <div style={{
          ...styles.typeBadge,
          background: isRental ? '#1E3A8A' : isEvacuation ? '#065F46' : '#9A3412',
          color: isRental ? '#93C5FD' : isEvacuation ? '#6EE7B7' : '#FED7AA',
        }}>
          {isRental ? 'Location d\'Engin Lourd' : isEvacuation ? 'Évacuation de Gravats' : 'Transport de Matériaux'}
        </div>

        <h2 style={styles.title}>Nouvelle mission disponible !</h2>

        {/* Détails de la commande */}
        <div style={styles.details}>
          <div style={styles.detailRow}>
            <div>
              <div style={styles.detailLabel}>
                {isRental ? 'Site de l\'engin' : isEvacuation ? 'Chantier à nettoyer' : 'Carrière (Chargement)'}
              </div>
              <div style={styles.detailValue}>{order.pickup_address}</div>
            </div>
          </div>
          <div style={styles.arrow}>↓</div>
          <div style={styles.detailRow}>
            <div>
              <div style={styles.detailLabel}>
                {isRental ? 'Chantier de travail' : isEvacuation ? 'Décharge autorisée (Dépôt)' : 'Chantier de livraison'}
              </div>
              <div style={styles.detailValue}>{order.delivery_address}</div>
            </div>
          </div>
          {isRental && order.duration_hours && (
            <div style={styles.extraInfo}>Durée réservée : <strong>{order.duration_hours} heures</strong></div>
          )}
        </div>

        {/* Prix */}
        <div style={styles.priceBox}>
          <div style={styles.priceRow}>
            <span style={styles.priceLabel}>Votre part séquestre (90%)</span>
            <span style={styles.priceValue}>
              {parseFloat(order.driver_amount || 0).toLocaleString()} FCFA
            </span>
          </div>
          <div style={styles.priceRow}>
            <span style={styles.priceLabel}>Distance</span>
            <span style={styles.priceDistane}>{order.distance_km || 0} km</span>
          </div>
        </div>

        {/* Boutons */}
        <div style={styles.buttons}>
          <button onClick={onRefuse} style={styles.refuseBtn}>
            Ignorer
          </button>
          <button onClick={onAccept} style={styles.acceptBtn}>
            Accepter la mission
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
    backdropFilter: 'blur(4px)',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid rgba(255,107,0,0.3)',
    borderRadius: '20px',
    padding: '28px 24px',
    width: '100%',
    maxWidth: '380px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 20px 60px rgba(255,107,0,0.2)',
  },
  countdownWrapper: {
    position: 'relative',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: { position: 'absolute', top: 0, left: 0 },
  countdownNum: {
    fontSize: '26px',
    fontWeight: '800',
    color: 'white',
    position: 'relative',
    zIndex: 1,
  },
  typeBadge: {
    fontSize: '12px',
    fontWeight: '800',
    padding: '5px 12px',
    borderRadius: '20px',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: '20px',
    fontWeight: '800',
    color: 'white',
    margin: 0,
    textAlign: 'center',
  },
  details: {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailRow: { display: 'flex', gap: '12px', alignItems: 'flex-start' },
  detailLabel: { fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' },
  detailValue: { fontSize: '13.5px', color: 'white', fontWeight: '500' },
  extraInfo: { fontSize: '12px', color: 'var(--info)', marginTop: '4px' },
  arrow: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '16px' },
  priceBox: {
    width: '100%',
    background: 'rgba(255,107,0,0.1)',
    border: '1px solid rgba(255,107,0,0.3)',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: 'rgba(255,255,255,0.6)', fontSize: '13px' },
  priceValue: { color: '#FF6B00', fontSize: '20px', fontWeight: '800' },
  priceDistane: { color: 'white', fontSize: '14px', fontWeight: '600' },
  buttons: { display: 'flex', gap: '12px', width: '100%' },
  refuseBtn: {
    flex: 1,
    padding: '14px',
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
  },
  acceptBtn: {
    flex: 2,
    padding: '14px',
    background: 'linear-gradient(135deg, #4CAF50, #388E3C)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(76,175,80,0.4)',
  },
};
