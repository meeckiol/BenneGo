#!/bin/sh
# Copie les dictionnaires de traduction (shared/i18n/<langue>.json) dans le socle Flutter.
# À relancer après chaque modification d'un dictionnaire ; un test Flutter vérifie que les copies sont à jour.
set -e
cd "$(dirname "$0")/.."
mkdir -p flutter/bennego_core/assets/i18n
for f in shared/i18n/??.json; do cp "$f" flutter/bennego_core/assets/i18n/; done
echo "Dictionnaires copiés : $(ls flutter/bennego_core/assets/i18n | tr '\n' ' ')"
