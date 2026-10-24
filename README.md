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

## Design

Les trois frontends web (client, chauffeur, administration) partagent un thème sombre à accent orange, défini dans `shared/theme.css` : tokens de couleur, typographie, rayons, ombres, et composants `bn-*` (cartes, pastilles de statut, boutons, barre de navigation basse, timeline).

Pour changer une couleur de marque, modifiez ce fichier : les pages utilisent les variables `var(--surface)`, `var(--text-2)`, `var(--brand)`, etc. L'application mobile `mobile-driver/` (Expo) a son propre système de style et n'a pas été restylée dans cette itération.

## Flux de l'argent

1. **Commande + paiement** : le client commande et règle dans la foulée (KKiaPay, MTN MoMo / Moov Money). La commande reste `awaiting_payment`, **invisible des chauffeurs**, tant que KKiaPay n'a pas confirmé le paiement.
2. **Séquestre** : après vérification serveur auprès de KKiaPay (statut `SUCCESS` **et** montant exact), la commande passe `pending / escrow_held` et est publiée aux chauffeurs. **Le chauffeur ne reçoit rien à ce stade.**
3. **Course** : un chauffeur accepte (il doit avoir un numéro Mobile Money), puis avance : en route → chargement → en livraison → livré. Sa position GPS est diffusée en direct au client (carte).
4. **Confirmation** : le client voit « Livré » et appuie sur **Confirmer la réception** (seul lui peut le faire). C'est **uniquement à cet instant** que :
   - **10 %** sont prélevés par la plateforme (`platform_fee`),
   - **90 %** sont dus au chauffeur (`driver_payout`).
5. **Reversement chauffeur** : voir « Services externes » ci‑dessous (manuel par défaut, automatique si vous branchez un service de virement).
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
docker exec bennego_postgres createdb -U bennego_user bennego_test
DB_NAME=bennego_test npm run migrate                      # depuis la racine, avec backend/.env renseigné
DB_NAME=bennego_test npm test
```
⚠️ Les tests **vident les tables** : ils refusent de s'exécuter si le nom de la base ne contient pas « test ».

Ils rejouent sur un vrai PostgreSQL : le parcours complet (paiement séquestré → livraison → confirmation → 10 %/90 % → avis), le webhook, l'annulation/remboursement, les doubles clics et reversements concurrents, et le suivi temps réel Socket.IO. KKiaPay et OSRM y sont simulés.

## Services externes à connecter

| Service | Variables | Sans cette configuration |
|---|---|---|
| **SMS (vérification à l'inscription)** | `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | Dev : le code s'affiche dans la console du backend. **Production : inscription bloquée** (503). |
| **WhatsApp Cloud API (Meta)** | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Les messages entrants sont vérifiés et traités, les réponses sont seulement journalisées. |
| **Reversement MoMo automatique** | `PAYOUT_MODE=webhook`, `PAYOUT_WEBHOOK_URL`, `PAYOUT_WEBHOOK_TOKEN` | Mode `manual` : l'admin vire et saisit la référence. |
| **Photos** | `UPLOAD_DIR` (défaut `backend/uploads`) | Les fichiers sont écrits sur disque et servis par `/uploads`. En production, un volume persistant (`uploads_data`) est monté. |

URL du webhook WhatsApp à déclarer chez Meta : `https://<votre-domaine>/api/whatsapp/webhook`.

Le virement MoMo automatique demande un contrat avec un prestataire de transfert : le serveur appelle `PAYOUT_WEBHOOK_URL` avec une clé d'idempotence et relance automatiquement les virements en échec toutes les 10 minutes. Brancher un prestataire donné revient à écrire un adaptateur dans `backend/src/services/payout.service.js`.

## Fonctionnement des litiges et des pannes

- **Chargement** : le chauffeur saisit le volume chargé et envoie au moins une photo avant de partir. Le ticket de pesée (photo et poids net) est facultatif. Le départ est refusé sans ces éléments.
- **Refus de livraison** : le client peut refuser avant de confirmer, avec des photos et un motif. Le séquestre reste bloqué. L'admin rembourse ou valide depuis la console *Litiges*.
- **Panne** : le chauffeur signale une crevaison, une panne ou un accident. L'admin réassigne la course à une benne de réserve disponible (*Pannes & relèves*). Le reversement suit le chauffeur qui termine la course.

## Limites connues

- **Commandes WhatsApp en texte uniquement** : les messages vocaux ne sont pas transcrits. Le bot demande une commande écrite, et ne crée pas de commande : le client confirme et paie dans l'application.
- **Application mobile `mobile-driver/`** (Expo) : elle suit désormais le même parcours que la PWA (formulaire de chargement avant départ, signalement de panne, bandeau de litige, mise à jour à la réassignation). Elle a été vérifiée par typage et lint, mais **pas encore testée sur appareil** : à valider avant distribution (build EAS, permissions caméra et localisation).
- **Rétention GPS** : `order_tracking` grossit sans purge ; définir une durée de conservation et l'information des chauffeurs.
- **Jeton des fronts web** stocké en `localStorage` (risque XSS) ; à durcir si la surface d'attaque augmente.
- **Interfaces** : vérifiées dans un navigateur mobile pour les pages principales, pas sur appareils réels.

