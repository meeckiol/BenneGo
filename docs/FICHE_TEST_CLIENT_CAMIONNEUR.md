# Fiche de test : client et camionneur sur deux téléphones

But : vérifier qu'un client et un camionneur s'écrivent en direct, chacun sur son téléphone,
et parcourir les sections de l'app camionneur (Accueil, Courses, Messages, Profil).

## 1. Préparer le PC (une fois après la mise à jour)

```bash
git pull
npm install          # nouvelle dépendance du backend : web-push (notifications)
npm run migrate      # nouvelles tables : lecture des messages et abonnements aux notifications
npm run seed:demo    # comptes de démonstration et une course en cours entre eux
npm run online
```

`npm run online` affiche trois liens. Gardez :

- **Client Web** : à ouvrir sur le téléphone n° 1 ;
- **Chauffeur Web** : à ouvrir sur le téléphone n° 2.

Prenez les liens **Public HTTPS** : les notifications ne marchent qu'en HTTPS.

## 2. Comptes de démonstration

| Téléphone | Application | Numéro | Mot de passe |
|---|---|---|---|
| n° 1 | Client | +22997000003 | ClientPassword123! |
| n° 2 | Camionneur | +22997000002 | DriverPassword123! |

Le jeu de démonstration contient déjà une course **en route** entre ces deux comptes : la messagerie
est utilisable tout de suite, sans passer de commande.

## 3. Activer les notifications (facultatif, pour l'app fermée)

- **Android (Chrome)** : ouvrez le lien, puis Profil → Notifications → activer, et acceptez.
- **iPhone (iOS 16.4 ou plus)** : dans Safari, Partager → « Sur l'écran d'accueil », ouvrez BenneGo
  depuis cette icône, puis Profil → Notifications → activer. Sans l'icône sur l'écran d'accueil,
  l'iPhone ne permet pas les notifications web (la ligne l'indique).

Le lien du tunnel change à chaque `npm run online` : réactivez les notifications avec le nouveau lien.

## 4. Parcours de test

À chaque étape, ce que vous devez voir :

1. **Camionneur, Accueil** : 4 onglets en bas (Accueil, Courses, Messages, Profil), pas de bouton « + ».
   Carte noire de la course en cours avec votre part, tuiles Aujourd'hui / Ce mois / Note.
2. **Client, Messages** → ouvrir la discussion avec le chauffeur → écrire « Bonjour, portail bleu ».
3. **Camionneur, resté sur l'Accueil** : un bandeau noir « nouveau message » apparaît en haut, avec un son
   court et une vibration (Android). L'onglet Messages porte une pastille rouge « 1 ».
4. **Camionneur** : appuyer sur le bandeau → la discussion s'ouvre, la pastille disparaît.
   Appuyer sur la réponse rapide « J'arrive ».
5. **Client** : la réponse s'affiche aussitôt dans la discussion.
6. **Client** : revenir à l'Accueil. **Camionneur** : écrire « Je suis devant le chantier ».
   Côté client : bandeau, son, pastille sur l'onglet Messages et sur la conversation.
7. **App fermée** (notifications activées) : fermer l'app du client, écrire depuis le camionneur.
   Une notification système arrive ; un appui ouvre la discussion.
8. **Camionneur, Courses** : recherche, filtres Toutes / En cours / Terminées, cartes avec « Votre part ».
   Un appui ouvre la course (carte, étapes, bouton de discussion avec pastille).
9. **Camionneur, Profil** : photo ronde modifiable, carte de parrainage (copier, partager),
   Informations personnelles (modifiables, téléphone verrouillé), Véhicule (lecture seule,
   « Demander une modification » vers WhatsApp), chiffres (courses, FCFA ce mois, note), Notifications.
10. **Disponibilité** : sur l'Accueil camionneur, passer En ligne, changer d'onglet puis revenir :
    il reste en ligne. Une fois la course de démonstration terminée, une nouvelle commande payée
    côté client s'affiche chez le camionneur sur n'importe quel onglet (30 secondes pour accepter).
11. **Fin de course** : quand le client confirme la réception, la discussion disparaît des deux côtés
    (les messages restent en base).

## 5. En cas de souci

- Pas de bandeau : vérifiez que les deux téléphones utilisent les liens du même `npm run online`.
- Pas de notification : vérifiez l'autorisation dans les réglages du téléphone, et sur iPhone
  l'ouverture depuis l'icône de l'écran d'accueil.
- Ancienne interface : fermez l'onglet et rouvrez le lien (ou videz le cache du navigateur).
