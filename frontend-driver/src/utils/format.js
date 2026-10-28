// Petits utilitaires d'affichage de l'app camionneur
export const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} FCFA`;

export const initialsOf = (name = '') => (
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C'
);

export { WHATSAPP_URL } from '../../../frontend-client/src/constants/contact';

export const TRUCK_LABELS = {
  double_benne: 'Double benne',
  simple_benne: 'Benne simple',
  plateau: 'Plateau',
  pickup: 'Pick-up léger',
};
