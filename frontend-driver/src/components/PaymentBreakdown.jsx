import React from 'react';

const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

/**
 * Détail du paiement d'une course, réservé au chauffeur : ce que le client a payé,
 * les frais BenneGo et sa part. Si la commission manque, elle se déduit des deux autres montants.
 */
export default function PaymentBreakdown({ order, compact = false }) {
  const total = Number(order.total_amount) || 0;
  const share = Number(order.driver_amount) || 0;
  const fee = order.commission_amount != null ? Number(order.commission_amount) : Math.max(0, total - share);

  return (
    <div style={{ ...box, ...(compact ? { padding: '12px 14px' } : null) }} aria-label="Détail du paiement">
      {total > 0 && (
        <div style={row}>
          <span style={label}>Payé par le client</span>
          <span style={value}>{fcfa(total)}</span>
        </div>
      )}
      {total > 0 && (
        <div style={row}>
          <span style={label}>Frais BenneGo</span>
          <span style={value}>− {fcfa(fee)}</span>
        </div>
      )}
      <div style={{ ...row, ...(total > 0 ? divider : null) }}>
        <span style={{ ...label, color: 'var(--text-strong)', fontWeight: 800 }}>Votre part</span>
        <span style={{ color: 'var(--brand-ink)', fontSize: 20, fontWeight: 800 }}>{fcfa(share)}</span>
      </div>
    </div>
  );
}

const box = {
  display: 'grid',
  gap: 8,
  padding: '14px 16px',
  borderRadius: 16,
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
};
const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 };
const label = { color: 'var(--text-2)', fontSize: 13 };
const value = { color: 'var(--text-strong)', fontSize: 14, fontWeight: 700 };
const divider = { paddingTop: 8, borderTop: '1px dashed var(--border-2)' };
