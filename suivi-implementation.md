# BenneGo — Suivi d'implémentation

> Dernière mise à jour : 2026-10-24

## Fonctions livrées et branchées

| Domaine | Fonction | Où |
|---|---|---|
| Inscription | Vérification du numéro par code SMS (5 min, 5 essais, 1 demande/min) | `backend/src/services/otp.service.js`, client `RegisterPage` |
| Chargement | Volume déclaré + photos avant départ, ticket de pesée facultatif | `POST /api/orders/:id/loading`, PWA chauffeur `ActiveDeliveryPage` |
| Litige | Refus de livraison avec photos ; séquestre bloqué ; décision admin | `POST /api/orders/:id/dispute`, console admin *Litiges* |
| Panne | Signalement en course ; réassignation à une benne de réserve | `POST /api/orders/:id/breakdown`, console admin *Pannes & relèves* |
| Versement | Automatique à la confirmation si `PAYOUT_MODE=webhook` ; relance des échecs | `payout-retry.service.js` |
| Baromètre | Indice hebdomadaire public, publié par l'admin | `GET /api/barometer`, console admin *Baromètre BTP* |
| WhatsApp | Webhook signé ; lecture de commandes écrites ; renvoi vers l'app | `POST /api/whatsapp/webhook` |
| Photos | Stockage fichier (plus de base64 en base) | `photo.service.js`, `/uploads` |

## Retiré

- **Page Carrières (offres d'emploi)** : routes, pages, tables et données de démonstration supprimées.
- **Avance carburant** : requête cassée (colonnes inversées), aucun partenaire station, aucun remboursement prévu.
- **Retrait instantané** : jamais branché ; le reversement reste celui de la confirmation.
- **Promesses commerciales non étayées** (« 100 % garanti », « 24/7 », « Suivi GPS certifié », commission « 3 à 5 % » ) reformulées ou retirées de l'interface.

## Reste à faire avant la mise en production

- Connecter une passerelle SMS (sans elle l'inscription est bloquée en production).
- Connecter un prestataire de virement MoMo (`PAYOUT_WEBHOOK_URL`).
- Déclarer le webhook WhatsApp chez Meta et renseigner les quatre variables `WHATSAPP_*`.
- Tester `mobile-driver/` sur appareil (chargement, photos, panne) avant distribution.
