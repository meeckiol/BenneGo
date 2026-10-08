# Audit LogiTruck — constats et réponse apportée

## Conclusion rapide

L’archive fournie ne doit **pas être déployée telle quelle**. Elle mélange trois interfaces web, un backend Express et des données/configurations de démonstration ; surtout, elle expose des risques critiques autour des secrets, des paiements et du suivi GPS.

La réponse livrée dans ce projet est une **nouvelle application mobile chauffeur Expo/React Native**, séparée de l’ancien backend. Elle ne réutilise ni les secrets, ni les paiements KKiaPay, ni les identifiants ou dépendances exportés dans l’archive.

## Ce qui ne va pas dans l’archive d’origine

| Priorité | Problème constaté | Pourquoi c’est dangereux / bloquant |
|---|---|---|
| Critique | `backend/.env` est inclus dans l’archive. | Tout secret présent doit être considéré comme compromis : révocation et remplacement nécessaires avant toute réutilisation de l’ancien système. |
| Critique | Le webhook KKiaPay accepte les requêtes si le secret est absent ; l’ordre des middlewares ne permet pas une vérification fiable du corps brut. | Un tiers pourrait simuler un paiement ou faire progresser une commande sans preuve cryptographique valide. |
| Critique | Le versement chauffeur appelle le prestataire avant le commit SQL, sans verrouillage/idempotence fournisseur robuste. | Une erreur ou deux appels concurrents peuvent entraîner un double versement. |
| Élevée | La table de transactions ne porte pas la contrainte d’unicité attendue par le code. | La déduplication de paiements n’est pas garantie. |
| Élevée | CORS HTTP et Socket.IO autorisent largement les origines, avec une configuration de credentials incohérente. | Surface d’exposition excessive et comportement navigateur imprévisible. |
| Élevée | Les mises à jour GPS temps réel ne vérifient pas complètement bornes, ownership de la mission et statut actif. | Un chauffeur authentifié peut injecter une position dans une mission qui ne lui appartient pas. |
| Élevée | Le socket ne revalide pas l’existence/l’état actif du compte après émission du jeton. | Un compte désactivé peut conserver son canal temps réel jusqu’à expiration du token. |
| Élevée | Validation serveur incomplète des inscriptions et profils chauffeur. | Données métier incohérentes, profils incomplets et erreurs d’exploitation. |
| Élevée | Progression de mission lue puis écrite sans verrouillage transactionnel suffisant. | États de mission incohérents sous concurrence. |
| Moyenne | Scripts de migration/seed déclarés mais absents, compte admin de démonstration, identifiants Docker de démonstration. | Déploiement non reproductible et risque d’exposition si exécuté hors environnement local contrôlé. |
| Moyenne | La PWA stocke le jeton dans `localStorage` et ne garantit ni le fonctionnement hors réseau ni le suivi quand le téléphone est verrouillé. | Surface XSS accrue et comportement chauffeur non fiable sur mobile. |
| Moyenne | Le tableau de bord ne recharge qu’un seul statut actif après rafraîchissement. | Une livraison en cours peut disparaître de l’interface. |
| Moyenne | Pas de politique visible de consentement/rétention GPS ; des informations Mobile Money remontent dans des données administratives. | Risque de minimisation des données et de conformité à traiter avant usage réel. |

## Ce qui a été livré dans la nouvelle application

### Périmètre fonctionnel

- Application **chauffeur seulement** : Accueil, Missions, Détail, Historique et Profil.
- Connexion via **Manus OAuth** ; aucun nouveau mot de passe ni compte de démonstration.
- Profils chauffeur activés uniquement par une procédure d’opérations réservée à un administrateur.
- Disponibilité explicite, listes « À prendre / En cours / Terminées », rafraîchissement manuel et historique.
- Progression de mission contrôlée : `offered → accepted → en_route_pickup → loading → en_route_delivery → delivered → validated`.
- Position GPS demandée **au premier plan et après une action explicite** ; aucun suivi en arrière-plan.
- Lien vers l’application de navigation du téléphone pour l’adresse pertinente de la mission.

### Protections mises en place

- Nouvelles migrations Drizzle versionnées : profils chauffeur, missions, événements idempotents et positions GPS avec expiration à 30 jours.
- Toutes les procédures chauffeur sont protégées côté serveur ; un profil chauffeur actif et l’ownership de la mission sont exigés.
- Acceptation et progression sérialisées au sein d’une transaction, avec verrouillage de la ligne chauffeur et de la mission, clés d’idempotence uniques et invariant d’une seule mission active.
- Coordonnées GPS bornées et enregistrées seulement pour une mission active attribuée au chauffeur.
- Aucun flux KKiaPay, aucun paiement réel et aucun secret de l’archive ne sont embarqués.
- Permission de notification retirée ; seules les permissions de localisation au premier plan sont déclarées.

## Vérifications réalisées

| Contrôle | Résultat |
|---|---|
| Migrations Drizzle | Générées et appliquées localement (`0001`, `0002`) sans suppression de données. |
| TypeScript | `pnpm check` réussi. |
| Lint Expo | `pnpm lint` réussi. |
| Tests | `29` tests réussis, `1` test existant ignoré. |
| Services | API `3000` et Expo Web `8081` répondent en HTTP `200`. |
| Interface mobile | Écran de connexion contrôlé à 390 × 844 ; identité LogiTruck, action OAuth et message d’accès vérifiés. |
| Secrets/versionnement | Aucun `.env`, identifiant de paiement ou secret de l’archive n’est inclus dans les changements. |

## Limites à connaître avant production

1. **Les secrets de l’ancien dépôt doivent être révoqués** ; cette action concerne le système historique et n’est pas réalisée par cette application.
2. Les paiements, KKiaPay, les notifications push, les portails client/administrateur et la localisation en arrière-plan sont volontairement exclus.
3. Une build Android/iOS et les scénarios OAuth/GPS sur appareil physique restent à valider avant une distribution mobile réelle.
4. La migration de données depuis PostgreSQL/Express historique vers le nouveau modèle doit faire l’objet d’un projet distinct, réversible et validé.
5. La rétention des positions est implémentée par une date d’expiration et une purge côté opérations ; la politique juridique de conservation/consentement doit être validée par l’organisation avant collecte réelle.
