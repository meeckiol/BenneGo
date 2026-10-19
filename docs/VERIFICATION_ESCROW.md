# Vérification du flux de paiement en séquestre

Demande : le client paie à la commande ; l'argent est bloqué sur la plateforme (pas chez le chauffeur) ; il suit le chauffeur ; il confirme la livraison ; **alors seulement** 10 % sont prélevés et le reste va au chauffeur ; il peut noter le chauffeur (1–5 ★), donner un avis chauffeur / plateforme.

## État constaté dans le code d'origine

| Exigence | Avant | Maintenant |
|---|---|---|
| Paiement à la commande | Commande créée **et diffusée aux chauffeurs sans paiement** ; paiement optionnel ensuite | Commande invisible/non acceptable tant que le paiement n'est pas confirmé par KKiaPay |
| Argent bloqué | Statut `escrow_held` posé sur la foi du **corps du webhook**, secret optionnel (`return true` si absent), mauvais en‑tête (HMAC `x-kkiapay-signature` alors que KKiaPay envoie `x-kkiapay-secret`) | Vérification serveur auprès de KKiaPay (statut + montant), secret obligatoire, transaction utilisable une seule fois |
| Suivi du chauffeur | Événements socket émis, **aucun écran client**, n'importe qui pouvait s'abonner à une commande, un chauffeur pouvait écrire dans la course d'un autre | Carte en direct côté client ; abonnement réservé au propriétaire ; positions validées (bornes, course active appartenant au chauffeur) |
| Bouton « confirmer » | Existait mais ne faisait que changer un statut : **aucune libération d'argent** (réservée à une action admin manuelle) | `POST /orders/:id/confirm-delivery` : seul le client, une seule fois, déclenche 10 % / 90 % |
| 10 % prélevés après confirmation | Jamais déclenché automatiquement | Fait au moment de la confirmation, dans une transaction SQL verrouillée |
| Reversement chauffeur | Appel à un endpoint non documenté (`/v1/transfers`) **avant** le commit SQL → risque de double paiement | Réservation atomique avant tout virement, idempotence, reprise possible, mode manuel traçable |
| Note 1–5 ★ + avis chauffeur | Colonnes en base, **aucune route, aucun écran** | Route + écran ; une fois par commande, uniquement après confirmation ; moyenne recalculée |
| Avis plateforme | Inexistant | Table, route, écran client, consultation admin |

## Autres correctifs faits en chemin

- Hôte sandbox KKiaPay erroné (`sandbox-api…` → `api-sandbox.kkiapay.me`) ; utilisation du SDK officiel.
- Faux hash de mot de passe admin et mot de passe admin documenté dans `init.sql` : supprimés, script `create-admin`.
- CORS `*` avec credentials, Socket.IO ouvert : origines explicites, obligatoires en production.
- `JWT_SECRET` et clés KKiaPay validés au démarrage ; compte désactivé = socket refusé.
- Scripts `migrate`/`seed` déclarés mais absents : `migrate` ajouté (schéma idempotent).
- Identifiants Docker en dur et Adminer exposé : variables d'environnement, ports liés à 127.0.0.1.
- Montants DECIMAL renvoyés en texte : convertis en nombres.
- Accès « chauffeurs disponibles » (positions) limité à l'admin ; numéro Mobile Money masqué dans la liste admin.
- Tableau de bord chauffeur : ne retrouvait la course active que si elle était « acceptée » ; corrigé.
- Appli mobile : authentification par service tiers, serveur tRPC/MySQL séparé, URL de logo externe et identifiants d'application générés automatiquement supprimés ; connexion par téléphone + mot de passe sur l'API unique.
