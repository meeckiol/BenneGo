# Sauvegardes

Copies de fichiers prises avant une modification importante, pour pouvoir revenir à une version précédente.
Ces fichiers ne sont pas utilisés par l'application.

## accueil-avant-melange (28 octobre 2026)

Accueil client avant le mélange des maquettes A et B (tuiles de matériaux + liste des livraisons).

| Copie | Fichier de l'application |
| --- | --- |
| `accueil-avant-melange/HomePage.jsx` | `frontend-client/src/pages/HomePage.jsx` |
| `accueil-avant-melange/NewOrderPage.jsx` | `frontend-client/src/pages/NewOrderPage.jsx` |

Pour revenir à cette version, depuis la racine du dépôt :

```bash
cp sauvegarde/accueil-avant-melange/HomePage.jsx frontend-client/src/pages/HomePage.jsx
cp sauvegarde/accueil-avant-melange/NewOrderPage.jsx frontend-client/src/pages/NewOrderPage.jsx
```

Le fichier `frontend-client/src/styles/home.css` n'existait pas avant : il n'est plus importé une fois
l'ancien accueil remis, et peut être supprimé.

## accueil-melange-avant-repartition (28 octobre 2026)

Version « mélange A + B » de l'accueil, avant la répartition demandée : design B sur l'accueil (avec la cloche),
cartes du design A dans « Commandes », design C (carte) pour passer une commande.

| Copie | Fichier de l'application |
| --- | --- |
| `accueil-melange-avant-repartition/HomePage.jsx` | `frontend-client/src/pages/HomePage.jsx` |
| `accueil-melange-avant-repartition/OrdersPage.jsx` | `frontend-client/src/pages/OrdersPage.jsx` |
| `accueil-melange-avant-repartition/NewOrderPage.jsx` | `frontend-client/src/pages/NewOrderPage.jsx` |
| `accueil-melange-avant-repartition/home.css` | `frontend-client/src/styles/home.css` |

Pour revenir à cette version, depuis la racine du dépôt :

```bash
B=sauvegarde/accueil-melange-avant-repartition
cp $B/HomePage.jsx $B/OrdersPage.jsx $B/NewOrderPage.jsx frontend-client/src/pages/
cp $B/home.css frontend-client/src/styles/home.css
```

Les fichiers ajoutés ensuite (`components/delivery.jsx`, `components/OrderMap.jsx`, `components/NotificationBell.jsx`,
`styles/order.css`) ne sont plus importés une fois cette version remise.

## commande-avant-messages (28 octobre 2026)

Avant : le devis sur carte en 3 étapes, l'onglet « Messages » (à la place d'« Affiliation »), le bouton « Commander »,
le blocage du zoom et le retrait de la répartition BenneGo / prestataire côté client.

| Copie | Fichier de l'application |
| --- | --- |
| `commande-avant-messages/NewOrderPage.jsx` | `frontend-client/src/pages/NewOrderPage.jsx` |
| `commande-avant-messages/OrderDetailPage.jsx` | `frontend-client/src/pages/OrderDetailPage.jsx` |
| `commande-avant-messages/BottomNav.jsx` | `frontend-client/src/components/BottomNav.jsx` |
| `commande-avant-messages/App.jsx` | `frontend-client/src/App.jsx` |
| `commande-avant-messages/index.html` | `frontend-client/index.html` |
| `commande-avant-messages/theme.css` | `shared/theme.css` |

Pour revenir à cette version, depuis la racine du dépôt :

```bash
B=sauvegarde/commande-avant-messages
cp $B/NewOrderPage.jsx $B/OrderDetailPage.jsx frontend-client/src/pages/
cp $B/BottomNav.jsx frontend-client/src/components/
cp $B/App.jsx frontend-client/src/App.jsx
cp $B/index.html frontend-client/index.html
cp $B/theme.css shared/theme.css
```

## carte-avant-style (28 octobre 2026)

Avant : le style de carte façon plan de ville, la barre de recherche ancrée en en-tête au défilement,
l'appel à droite dans la discussion et le détail des montants côté chauffeur.

Les copies gardent l'arborescence : `client/` → `frontend-client/src/` (`components/` ou `pages/` ou `styles/`
selon le fichier), `driver/` → `frontend-driver/src/`, `backend/` → `backend/src/services/`.

```bash
B=sauvegarde/carte-avant-style
cp $B/client/OrderMap.jsx $B/client/TrackingMap.jsx $B/client/LocationPicker.jsx frontend-client/src/components/
cp $B/client/NewOrderPage.jsx $B/client/ChatPage.jsx frontend-client/src/pages/
cp $B/client/order.css $B/client/messages.css frontend-client/src/styles/
cp $B/driver/NewOrderAlert.jsx frontend-driver/src/components/
cp $B/driver/ActiveDeliveryPage.jsx frontend-driver/src/pages/
cp $B/backend/order-events.js backend/src/services/
```

## logo-or (28 octobre 2026)

Toutes les images de marque en or sur fond noir, avant le passage au logo sable doré sur fond blanc (variante B) :
logos et favicons web, icônes d'installation, icônes Android et iOS des applications Flutter, icônes Expo,
logos officiels de `assets/brand/`. Les chemins sous `sauvegarde/logo-or/` reprennent ceux du dépôt.

Pour revenir au logo or, depuis la racine du dépôt :

```bash
(cd sauvegarde/logo-or && find . -type f) | while read f; do cp "sauvegarde/logo-or/$f" "$f"; done
```

## profil-avant-fusion (28 octobre 2026)

Section Profil avant la fusion des maquettes A, B et C (en-tête de A, carte du code de B, « Informations
personnelles » de C, icônes en couleurs variées).

```bash
B=sauvegarde/profil-avant-fusion
cp $B/ProfilePage.jsx frontend-client/src/pages/ProfilePage.jsx
cp $B/App.jsx frontend-client/src/App.jsx
```

Les fichiers ajoutés ensuite (`pages/PersonalInfoPage.jsx`, `styles/profile.css`) ne sont plus utilisés une fois
cette version remise. La route serveur `PATCH /api/auth/me` peut rester : elle ne gêne pas l'ancienne page.

## commande-avant-etapes (28 octobre 2026)

Avant : la commande en 3 pages successives dans un volet fixe (la carte reste visible), et la correction
des blocs qui élargissaient la page (accueil, commandes, affiliation, confidentialité).

```bash
B=sauvegarde/commande-avant-etapes
cp $B/NewOrderPage.jsx frontend-client/src/pages/
cp $B/order.css $B/home.css frontend-client/src/styles/
cp $B/theme.css shared/theme.css
```

## messages-avant-design (28 octobre 2026)

Avant : la liste des discussions façon A (en-tête doré, étiquette commande), la discussion avec
l'en-tête sombre de C, la barre de progression et les réponses rapides de B.

```bash
B=sauvegarde/messages-avant-design
cp $B/MessagesPage.jsx $B/ChatPage.jsx frontend-client/src/pages/
cp $B/messages.css frontend-client/src/styles/
```

## chauffeur-avant-sections (28 octobre 2026)

Avant : l'app camionneur passe à 4 onglets (Accueil, Courses, Messages, Profil) sans passation de commande,
avec une session commune (disponibilité, GPS, nouvelles courses) et les alertes de messages.

```bash
B=sauvegarde/chauffeur-avant-sections
cp $B/App.jsx frontend-driver/src/
cp $B/ActiveDeliveryPage.jsx $B/DriverDashboard.jsx $B/DriverHistoryPage.jsx $B/DriverLoginPage.jsx frontend-driver/src/pages/
cp $B/useDriverSocket.js frontend-driver/src/hooks/
cp $B/socket.js frontend-driver/src/services/
cp $B/vite.config.js frontend-driver/
```

Les nouveaux fichiers (pages Courses, Messages, Profil…, `context/`, `utils/`, `styles/`) ne sont plus utilisés
une fois cette version remise. Le backend (non lus, push) peut rester : l'ancienne app l'ignore.

## splash camionneur (28 octobre 2026)

L'app camionneur a son propre splash (tracé du logo, `frontend-driver/src/components/DriverSplash.jsx`).
Pour revenir au splash du camion partagé avec le client, dans `frontend-driver/src/main.jsx` :

```js
import SplashGate from '../../shared/SplashScreen';
```

L'ancien écran de lancement Android avait le fond `#0F172A` (`frontend-driver/public/manifest.json`).

## flutter-avant-messagerie (29 octobre 2026)

Avant : messagerie client ↔ chauffeur dans les apps Flutter (onglet Messages, discussion, pastilles, bandeau),
camionneur en 4 onglets (Accueil, Courses, Messages, Profil) avec splash par tracé du logo, profil client
avec parrainage, section Messagerie de l'admin, écrans de lancement natifs noirs sans image.

```bash
B=sauvegarde/flutter-avant-messagerie
for f in $(cd $B && find . -type f); do cp "$B/$f" "flutter/$f"; done
git rm -r flutter/bennego_core/lib/src/messaging flutter/bennego_core/lib/src/splash flutter/bennego_core/lib/src/profile \
  flutter/driver/lib/screens/{courses_screen,profile_screen,chat_route}.dart flutter/driver/lib/config \
  flutter/client/lib/screens/chat_route.dart flutter/admin/lib/screens/messages_screen.dart
```

## parrainage-avant-regles (29 octobre 2026)

Avant : nouvelles règles du parrainage (1 500 / 1 000 FCFA selon le type, réduction du filleul, crédit BenneGo),
page « Mes filleuls » commune (`shared/ReferralView.jsx`), case « Utiliser mon crédit » au devis, code parrain à l'inscription.

```bash
B=sauvegarde/parrainage-avant-regles
cp $B/client/*.jsx frontend-client/src/pages/
cp $B/driver/ProfilePage.jsx frontend-driver/src/pages/
cp $B/driver/App.jsx frontend-driver/src/
```
Les règles côté serveur (`backend/src/services/referral.service.js`) restent : l'ancienne interface affiche alors d'anciens textes.

## flutter-parrainage-avant-regles (29 octobre 2026)

Avant : splash animé du camion dans l'app client Flutter (`TruckSplash`), lancement natif blanc pour le client,
écran « Mes filleuls » commun (`bennego_core/lib/src/profile/referral_screen.dart`), nouveaux textes de parrainage,
réduction et crédit au prix, code parrain à l'inscription.

```bash
B=sauvegarde/flutter-parrainage-avant-regles
for f in $(cd $B && find . -type f); do cp "$B/$f" "flutter/$f"; done
git rm flutter/bennego_core/lib/src/splash/truck_splash.dart flutter/bennego_core/lib/src/profile/referral_screen.dart
```

## flutter-devis-avant-detail (29 octobre 2026)

Avant : détail ligne par ligne du devis dans l'app client Flutter (prise en charge, transport avec type de camion,
chargement, matériau, arrondi ou complément au prix minimum), distances au format français.

```bash
B=sauvegarde/flutter-devis-avant-detail
cp $B/new_order_screen.dart flutter/client/lib/screens/
cp $B/client_repository.dart flutter/client/lib/data/
git rm flutter/client/lib/domain/quote_lines.dart flutter/client/test/quote_lines_test.dart
```

## admin-devis-avant-detail (29 octobre 2026)

Avant : bloc « Détail du prix » dans la fiche commande de la console admin (lignes du devis, part du chauffeur,
commission, net après réductions), colonne `orders.price_breakdown` et détail partagé `shared/quoteLines.js`
(aussi utilisé par le devis du client web).

```bash
cp sauvegarde/admin-devis-avant-detail/OrdersPage.jsx frontend-admin/src/pages/
```
La colonne `price_breakdown` peut rester en base : l'ancienne fiche l'ignore.

## flutter-avant-traduction (29 octobre 2026)

Avant : passage des applications Flutter à la traduction (widget Text de bennego_core qui traduit, libellés
enveloppés dans tr() par scripts/i18n-flutter-codemod.py, écran Langue, dictionnaires dans assets/i18n).
La transformation touche une cinquantaine de fichiers : la version précédente se remet en place depuis git,
au commit d1e66097 (main avant cette étape).

```bash
git checkout d1e66097 -- flutter/
```
