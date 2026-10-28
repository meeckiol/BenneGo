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
