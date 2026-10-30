# Revue de sécurité — 30 octobre 2026

Revue du serveur (API, webhooks, Socket.IO), des applications web et de la configuration nginx de production.

## Vérifié, conforme

| Domaine | Constat |
|---|---|
| Authentification | JWT HS256 (algorithme imposé), secret de 32 caractères minimum exigé au démarrage, session vérifiée à chaque requête (appareil déconnecté = jeton refusé), compte désactivé ou en suppression refusé. |
| Mots de passe | bcrypt, 8 caractères minimum, même message pour « numéro inconnu » et « mauvais mot de passe ». |
| Limitation | Connexion 10 essais / 15 min, inscription, codes SMS (5 essais par code, demandes limitées), webhooks. |
| Droits d'accès | Commandes, suivi GPS, messagerie, reçus, photos de livraison : réservés au client, au chauffeur de la commande ou à l'admin. Toutes les routes /api/admin exigent le rôle admin. |
| Données personnelles | Numéro de l'autre partie masqué hors course ou sur demande, photo selon les réglages, montants internes cachés au client. |
| Base de données | Toutes les requêtes sont paramétrées ; les noms de colonnes dynamiques viennent de listes fixes. |
| Envois de photos | JPEG, PNG ou WebP, 2 Mo maximum, signature du fichier vérifiée, nom aléatoire, dossier non listable. |
| Webhooks | KKiaPay (secret) et WhatsApp (signature HMAC du corps brut) comparés en temps constant. |
| Erreurs | Pas de pile d'appels renvoyée ; message générique pour les erreurs 500 en production. |

## Corrigé lors de cette revue

1. **Carte du tableau de bord admin** : l'infobulle affichait le nom du chauffeur comme du HTML (injection possible dans la console). Elle l'affiche désormais comme du texte.
2. **Paiements de test** : le contournement de vérification KKiaPay n'était protégé que par `NODE_ENV=test`. Il exige maintenant d'être dans la suite Jest : un serveur mal configuré ne peut plus valider de faux paiements.
3. **nginx — en-têtes perdus** : les blocs `location` qui posent leur propre `add_header` (assets, photos, service worker) perdaient la CSP, X-Frame-Options et nosniff. Les en-têtes sont dans `docker/nginx/conf.d/security-*.inc`, inclus au niveau du serveur et dans ces blocs.
4. **nginx — cartes bloquées** : la CSP n'autorisait que les tuiles OpenStreetMap alors que les applications utilisent CARTO (`*.basemaps.cartocdn.com`) : les cartes auraient été vides en production.
5. **nginx — temps réel admin** : la console admin n'avait pas de proxy `/socket.io/` : le tableau de bord et les compteurs du menu n'auraient pas été mis à jour en direct.

La configuration a été validée avec `nginx -t` et les en-têtes contrôlés sur un serveur nginx de test.

## Recommandations (non bloquantes)

- **Jeton dans le navigateur** : le JWT est stocké dans localStorage (accessible à un script injecté). La CSP stricte limite le risque ; un cookie `HttpOnly` serait plus sûr mais demande de revoir l'authentification des trois applications.
- **Restriction de la console admin** : décommenter `allow <IP>; deny all;` dans le bloc admin de nginx si l'équipe travaille depuis des adresses fixes.
- **Double authentification admin** : un code SMS à la connexion des comptes admin.
- **Suivi** : brancher un outil de suivi des erreurs (Sentry ou équivalent) et des sauvegardes automatiques de PostgreSQL, puis tester une restauration.
- **Dépendances** : lancer `npm audit` et `flutter pub outdated` avant chaque mise en production.
