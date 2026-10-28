// Applications testées en build de production, chacune sur son port de prévisualisation.
// storageKey / role / fullName : session simulée (store Zustand persisté).
// routes : écrans statiques parcourus par les tests (sans paramètre d'URL).
const APPS = {
  client: {
    dir: 'frontend-client', port: 4173,
    storageKey: 'bennego-auth', role: 'client', fullName: 'Ing. Koffi (Entreprise BTP)',
    routes: ['/', '/orders', '/orders/new', '/messages', '/referral', '/profil', '/profil/infos', '/code-promo', '/confidentialite'],
  },
  admin: {
    dir: 'frontend-admin', port: 4174,
    storageKey: 'bennego-admin-auth', role: 'admin', fullName: 'Superviseur BenneGo',
    routes: ['/', '/orders', '/messages', '/b2b', '/drivers', '/clients', '/payments', '/reviews', '/report', '/referrals', '/promos', '/disputes', '/reliefs', '/barometer'],
  },
  driver: {
    dir: 'frontend-driver', port: 4175,
    storageKey: 'bennego-driver-auth', role: 'driver', fullName: 'Chauffeur Test',
    routes: ['/', '/courses', '/messages', '/profil', '/profil/infos', '/profil/vehicule'],
  },
};

module.exports = { APPS };
