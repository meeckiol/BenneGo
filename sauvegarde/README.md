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
