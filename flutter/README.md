# Applications Flutter BenneGo (Android et iOS)

Trois applications mobiles et un package partagé :

| Dossier | Application | Public |
|---|---|---|
| `driver/` | BenneGo Chauffeur | Chauffeurs : missions, chargement, photos, pannes, position GPS |
| `client/` | BenneGo | Clients : commandes, paiement séquestre, suivi, avis, parrainage |
| `admin/` | BenneGo Admin | Équipe BenneGo : tableau de bord, litiges, reversements, relèves, baromètre, codes promo, avis |
| `bennego_core/` | Package partagé | Configuration, API, session, temps réel, formats, thème, composants |

Les applications utilisent la même API que les interfaces web. Identifiants de publication : `com.bennego.driver`, `com.bennego.client`, `com.bennego.admin`.

## Prérequis

- Flutter 3.47.8 (canal stable). Vérifiez avec `flutter --version`.
- Android : Android Studio, SDK Android, Java 17.
- iOS : macOS avec Xcode. iOS ne se compile pas sous Linux ni Windows.
- Un serveur BenneGo joignable (`npm run dev` à la racine du dépôt en développement).

## Démarrer en développement

```bash
cd flutter/driver
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000   # émulateur Android
flutter run --dart-define=API_URL=http://localhost:3000  # simulateur iOS
```

Sur un téléphone réel, utilisez l'adresse IP de votre ordinateur sur le réseau local, par exemple `http://192.168.1.20:3000`. Le trafic HTTP en clair n'est autorisé qu'en débogage.

## Configuration

| Variable (`--dart-define`) | Rôle | Valeur par défaut |
|---|---|---|
| `API_URL` | Adresse de l'API. En production : `https://api.votre-domaine.bj` | `http://localhost:3000` |
| `SUPPORT_WHATSAPP` (client) | Numéro du support, sans `+`. Le bouton « Assistance » est masqué s'il est absent | vide |

## Tests et analyse

```bash
for app in bennego_core driver client admin; do
  (cd flutter/$app && flutter analyze && flutter test)
done
```

Le workflow `.github/workflows/flutter.yml` refait ces contrôles, puis compile les applications pour Android (APK de debug) et iOS (sans signature).

## Publier sur Google Play (Android)

1. Créer la clé de publication, une seule fois, et la conserver précieusement :

   ```bash
   keytool -genkey -v -keystore ~/bennego-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bennego
   ```

2. Créer `flutter/<application>/android/key.properties`. Ce fichier n'est jamais versionné :

   ```properties
   storePassword=...
   keyPassword=...
   keyAlias=bennego
   storeFile=/chemin/absolu/bennego-upload.jks
   ```

3. Générer le paquet de publication :

   ```bash
   cd flutter/driver
   flutter build appbundle --release --dart-define=API_URL=https://api.votre-domaine.bj
   ```

4. Téléverser `build/app/outputs/bundle/release/app-release.aab` dans la Play Console.

## Publier sur l'App Store (iOS)

Sur macOS, ouvrez `flutter/<application>/ios/Runner.xcworkspace` dans Xcode, choisissez votre équipe Apple Developer dans « Signing & Capabilities », puis lancez :

```bash
flutter build ipa --release --dart-define=API_URL=https://api.votre-domaine.bj
```

Téléversez ensuite le fichier `.ipa` avec Transporter ou Xcode.

## Ce qui reste de votre côté

- Comptes : Google Play Console (frais unique) et Apple Developer Program (abonnement annuel).
- Identifiants à créer dans les consoles : `com.bennego.driver`, `com.bennego.client`, `com.bennego.admin`.
- Politique de confidentialité publique, qui couvre la localisation et les photos, puis fiches store et captures d'écran.
- Déclaration de collecte de données dans la Play Console (« Sécurité des données ») et dans l'App Store (« Confidentialité »).
- Clés de production : KKiaPay, passerelle SMS, Mobile Money, WhatsApp, comme indiqué dans le README racine.

## Suivi de position

Le chauffeur envoie sa position pendant qu'il est disponible ou en mission, écran verrouillé compris.

- **Android** : le suivi tourne dans un service de premier plan, avec une notification « Suivi de position ». Le service démarre pendant que l'application est ouverte, donc l'application ne demande pas `ACCESS_BACKGROUND_LOCATION`. Sous Android 13 et plus, la notification n'apparaît que si les notifications sont autorisées pour BenneGo Chauffeur.
- **iOS** : le mode « Localisation » est activé dans `Info.plist`, et la permission demandée est « Toujours ». Si le chauffeur choisit « Pendant l'utilisation », un bandeau l'avertit à l'accueil.
- **Batterie** : le suivi garde le processeur éveillé pour que les positions arrivent sans délai. C'est le principal coût en autonomie.

## Limites connues

- **Suivi écran verrouillé** : implémenté, mais pas encore vérifié sur téléphone réel. Testez-le sur plusieurs téléphones Android avant la mise en production : certains constructeurs suspendent les services en arrière-plan, même avec un service de premier plan.
- **Périmètre porté** : connexion, parcours de mission, commande et paiement, suivi, avis, parrainage pour le client, tableau de bord et opérations pour l'admin. Ne sont pas encore portés : le chat de commande, l'espace entreprise (B2B), les rapports mensuels, la gestion des abonnements.
- **Paiement** : le widget KKiaPay s'ouvre dans une WebView. À tester avec de vraies clés en mode bac à sable avant la production.
- **Test sur appareil** : rien n'a encore été installé sur un téléphone réel. Les compilations sont vérifiées par le workflow CI.
- **Application Expo** : `mobile-driver/` reste dans le dépôt tant que l'application Flutter conducteur n'est pas validée sur appareil. Elle sera alors retirée.

## Messagerie et splash

- **Messagerie** (`bennego_core/lib/src/messaging`) : onglet Messages (client et chauffeur), discussion par commande
  en cours, pastilles de non lus, bandeau « nouveau message » avec son et vibration, messages de l'assistance BenneGo.
  Mêmes routes que le web : `GET /orders/chat/unread`, `POST /orders/:id/chat/read`, temps réel `chat_message` et `chat_notify`.
- **Admin** : Outils → Messagerie (discussions en cours, litiges ou toutes ; message de l'assistance).
- **Chauffeur** : splash animé par tracé du logo (`TraceSplash`), onglets Accueil, Courses, Messages, Profil.
- **Écrans de lancement natifs** : fond noir uni, sans image, pour enchaîner sans flash.
- Les notifications quand l'application est fermée demandent Firebase Cloud Messaging (non configuré).
