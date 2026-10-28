# Consignes pour Claude

## Git

- Après chaque modification validée (compilation et vérifications passées), commiter sur la branche de travail,
  la pousser, puis mettre `main` à jour sans attendre de demande : avance rapide uniquement
  (`git push origin HEAD:refs/heads/main`), jamais de push forcé. Si l'avance rapide est impossible
  (`main` a divergé), s'arrêter et prévenir au lieu de forcer.
- Avant de modifier en profondeur un écran, copier les fichiers concernés dans `sauvegarde/<nom-de-la-version>/`
  et documenter la remise en place dans `sauvegarde/README.md`.

## Langue

- Échanges, commentaires de code et messages de commit en français.
