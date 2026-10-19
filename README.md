# BenneGo

Plateforme de livraison de matériaux de chantier (sable, gravier, latérite…) au Bénin, avec **paiement en séquestre** :
le client paie à la commande, l'argent reste bloqué sur BenneGo, et n'est réparti qu'après sa confirmation de réception.

## Contenu

| Dossier | Rôle | Port dev |
|---|---|---|
| `backend/` | API Express + Socket.IO + PostgreSQL (source de vérité unique) | 3000 |
| `frontend-client/` | Web client : commander, payer, suivre le camion, confirmer, noter | 5173 |
| `frontend-driver/` | PWA chauffeur | 5174 |
| `frontend-admin/` | Back-office : commandes, reversements, avis | 5175 |
| `mobile-driver/` | Appli mobile chauffeur (Expo / React Native), branchée sur la même API | 8081 |
| `docker/init.sql` | Schéma SQL (idempotent) | |

## Flux de l'argent

1. **Commande + paiement** : le client commande et règle dans la foulée (KKiaPay, MTN MoMo / Moov Money). La commande reste `awaiting_payment`, **invisible des chauffeurs**, tant que KKiaPay n'a pas confirmé le paiement.
2. **Séquestre** : après vérification serveur auprès de KKiaPay (statut `SUCCESS` **et** montant exact), la commande passe `pending / escrow_held` et est publiée aux chauffeurs. **Le chauffeur ne reçoit rien à ce stade.**
3. **Course** : un chauffeur accepte (il doit avoir un numéro Mobile Money), puis avance : en route → chargement → en livraison → livré. Sa position GPS est diffusée en direct au client (carte).
4. **Confirmation** : le client voit « Livré » et appuie sur **Confirmer la réception** (seul lui peut le faire). C'est **uniquement à cet instant** que :
   - **10 %** sont prélevés par la plateforme (`platform_fee`),
   - **90 %** sont dus au chauffeur (`driver_payout`).
5. **Reversement chauffeur** : voir « Limites » ci‑dessous (manuel par défaut, automatique si vous branchez un service de virement).
6. **Avis** : après confirmation, le client note son chauffeur (1 à 5 ★ + commentaire) et peut donner son avis sur la plateforme. La moyenne du chauffeur est recalculée à partir des notes réelles.
7. **Annulation** : avant paiement → simple annulation ; payée mais pas encore acceptée → remboursement intégral (KKiaPay `refund`) ; après acceptation → litige géré par l'admin.

## Démarrage

```bash
cp .env.example .env                  # POSTGRES_PASSWORD
cp backend/.env.example backend/.env  # DB_PASSWORD identique, JWT_SECRET (openssl rand -hex 32), clés KKiaPay
npm install
docker compose up -d                  # PostgreSQL (127.0.0.1:5433), applique docker/init.sql
npm run migrate                       # (re)applique le schéma, sans risque : idempotent
ADMIN_PHONE=+229XXXXXXXX ADMIN_PASSWORD='mot-de-passe-de-12-caracteres-min' npm run create-admin -w backend
npm run dev                           # backend + client + chauffeur + admin
```

Appli mobile : `cd mobile-driver && cp .env.example .env && npm install && npx expo start` (renseigner `EXPO_PUBLIC_API_URL`).

## KKiaPay — configuration

1. Tableau de bord KKiaPay → **Clés API** : copier clé publique, privée, secrète dans `backend/.env`.
2. **Webhook** : URL `https://<votre-domaine>/api/payments/webhook/kkiapay`, et définir un « secret hash » = `KKIAPAY_WEBHOOK_SECRET`. KKiaPay le renvoie dans l'en‑tête `x-kkiapay-secret`.
3. Tester en sandbox (`KKIAPAY_SANDBOX=true`) avant de passer en production (`false`).

## Tests

```bash
docker exec logitruck_postgres createdb -U logitruck_user logitruck_test
DB_NAME=logitruck_test npm run migrate                      # depuis la racine, avec backend/.env renseigné
DB_NAME=logitruck_test npm test
```
⚠️ Les tests **vident les tables** : ils refusent de s'exécuter si le nom de la base ne contient pas « test ».

Ils rejouent sur un vrai PostgreSQL : le parcours complet (paiement séquestré → livraison → confirmation → 10 %/90 % → avis), le webhook, l'annulation/remboursement, les doubles clics et reversements concurrents, et le suivi temps réel Socket.IO. KKiaPay et OSRM y sont simulés.

## Limites connues (à traiter avant la mise en production)

- **Reversement automatique au chauffeur** : le SDK serveur officiel de KKiaPay n'expose que `verify` et `refund`, pas de virement vers un tiers. Par défaut (`PAYOUT_MODE=manual`) l'admin voit la liste « à reverser » (numéro MoMo du chauffeur, montant) dans *Paiements*, envoie le virement puis clique **Marquer payé** avec la référence. Pour l'automatiser, branchez un service de virement (`PAYOUT_MODE=webhook`, voir `backend/src/services/payout.service.js`) — l'idempotence et le verrouillage sont déjà gérés.
- **Widget de paiement** (`frontend-client/src/services/kkiapay.js`) : intégré selon la doc publique de KKiaPay mais **non testé contre leur sandbox** ici. À valider de bout en bout (paiement test, webhook).
- **Rétention GPS** : `order_tracking` grossit sans purge ; définir une durée de conservation et l'information/consentement des chauffeurs.
- **Interfaces** compilées mais non testées visuellement dans un navigateur / sur appareil.
- Jeton d'authentification des fronts web stocké en `localStorage` (risque XSS) ; à durcir si la surface d'attaque augmente.
