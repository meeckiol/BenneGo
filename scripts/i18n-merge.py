#!/usr/bin/env python3
"""
Fusionne des traductions numérotées (« numéro<TAB>traduction », numéros de la liste donnée) dans
shared/i18n/<langue>.json, dont les clés sont les textes français. Vérifie qu'aucune variable {n} n'est inventée.
Usage : python3 scripts/i18n-merge.py <langue> <liste.json> <fichier.tsv>...
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    lang, keys_file, *tsvs = sys.argv[1:]
    keys = json.load(open(keys_file, encoding='utf-8'))
    out_path = os.path.join(ROOT, 'shared/i18n', f'{lang}.json')
    dic = json.load(open(out_path, encoding='utf-8')) if os.path.exists(out_path) else {}
    errors = 0
    for tsv in tsvs:
        for n, line in enumerate(open(tsv, encoding='utf-8'), 1):
            line = line.rstrip('\n')
            if not line.strip():
                continue
            idx, _, text = line.partition('\t')
            key = keys[int(idx)]
            text = text.replace('\\n', '\n')
            if text == '-':  # à laisser tel quel (code, nom propre) : ne plus le proposer à la traduction
                dic[key] = ''
                continue
            # Une traduction peut omettre une variable (pluriel « s » en français) mais jamais en inventer
            if not set(re.findall(r'\{\d+\}', text)) <= set(re.findall(r'\{\d+\}', key)):
                print(f'{tsv}:{n}: variable inconnue : {key!r} → {text!r}', file=sys.stderr)
                errors += 1
                continue
            dic[key] = text
    with open(out_path, 'w', encoding='utf-8') as fh:
        json.dump(dict(sorted(dic.items())), fh, ensure_ascii=False, indent=1)
        fh.write('\n')
    print(f'{lang}: {len(dic)} traductions ({errors} erreur(s))', file=sys.stderr)
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
