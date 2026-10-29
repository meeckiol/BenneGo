#!/usr/bin/env python3
"""Liste numérotée des textes pas encore traduits dans une langue : python3 scripts/i18n-missing.py <langue> <sortie.json>"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lang, out = sys.argv[1], sys.argv[2]
keys = json.load(open(os.path.join(ROOT, 'shared/i18n/keys.json'), encoding='utf-8'))
path = os.path.join(ROOT, 'shared/i18n', f'{lang}.json')
done = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
# Textes jamais traduits ici (absents) ; ceux volontairement laissés tels quels sont notés "" dans le dictionnaire
missing = [k for k in keys if k not in done]
json.dump(missing, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
for i, k in enumerate(missing):
    print(i, k.replace('\n', '\\n'), sep='\t')
