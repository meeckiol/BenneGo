// Formatage commun (français, FCFA)

const NUM = new Intl.NumberFormat('fr-FR');

export const num = (n) => NUM.format(Number(n || 0));
export const fcfa = (n) => `${num(n)} FCFA`;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const fullName = (u) =>
  [u?.prenom, u?.nom].filter(Boolean).join(' ') || u?.full_name || '—';

export const initials = (name) =>
  (name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

// Statuts de commande : libellé + ton de badge
export const ORDER_STATUS = {
  awaiting_payment: { label: 'À payer', tone: 'danger' },
  pending: { label: 'Payée · en attente', tone: 'warning' },
  accepted: { label: 'Acceptée', tone: 'info' },
  driver_en_route_pickup: { label: 'En route carrière', tone: 'violet' },
  loading: { label: 'Chargement', tone: 'pink' },
  driver_en_route_delivery: { label: 'En livraison', tone: 'info' },
  delivered: { label: 'Livrée', tone: 'success' },
  validated: { label: 'Validée', tone: 'success' },
  completed: { label: 'Terminée', tone: 'neutral' },
  cancelled: { label: 'Annulée', tone: 'danger' },
};

// Statuts de paiement
export const PAYMENT_STATUS = {
  unpaid: { label: 'Non payé', tone: 'warning' },
  escrow_held: { label: 'Séquestre', tone: 'info' },
  payout_pending: { label: 'À reverser', tone: 'warning' },
  released: { label: 'Versé', tone: 'success' },
  refunded: { label: 'Remboursé', tone: 'danger' },
};

export const PAYMENT_METHOD = {
  mtn_momo: 'MTN MoMo',
  moov_money: 'Moov Money',
};

export const TRUCK_TYPE = {
  double_benne: 'Double benne',
  simple_benne: 'Benne simple',
};
export const truckLabel = (t) => TRUCK_TYPE[t] || 'Plateau';
