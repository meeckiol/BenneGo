#!/usr/bin/env python3
"""
Prépare le code Flutter à la traduction (à relancer sans risque, les fichiers déjà traités ne changent pas) :
  1. le widget Text de Flutter est remplacé par celui de bennego_core (même usage, texte traduit à l'affichage) ;
  2. les textes passés en paramètre à des widgets de Flutter (labelText, hintText, tooltip, onglets…), les
     messages de validation (return '…') et les branches de conditions (? '…' : '…') sont enveloppés dans tr() ;
  3. les mots-clés const devenus invalides sont retirés, d'après `flutter analyze`.
Usage : python3 scripts/i18n-flutter-codemod.py
"""
import importlib.util
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLUTTER = os.path.join(ROOT, 'flutter')
PACKAGES = ['bennego_core', 'client', 'driver', 'admin']
CORE_LIB = os.path.join(FLUTTER, 'bennego_core', 'lib')
I18N_DIR = os.path.join(CORE_LIB, 'src', 'i18n')
FLUTTER_BIN = os.environ.get('FLUTTER_BIN', '/opt/flutter/bin/flutter')

spec = importlib.util.spec_from_file_location('extract', os.path.join(ROOT, 'scripts', 'i18n-extract.py'))
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)

NAMED = ('labelText', 'hintText', 'helperText', 'errorText', 'counterText', 'prefixText', 'suffixText', 'tooltip',
         'label', 'text', 'semanticLabel', 'semanticsLabel', 'message')
STRING = re.compile(r"""(?<![\w$])(r?)('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")""")


def dart_files():
    for pkg in PACKAGES:
        for sub in ('lib', 'test'):
            base = os.path.join(FLUTTER, pkg, sub)
            for d, _, files in os.walk(base):
                if d.startswith(I18N_DIR):
                    continue
                for f in files:
                    if f.endswith('.dart'):
                        yield os.path.join(d, f)


def is_core_lib(path):
    return path.startswith(CORE_LIB + os.sep)


def rel_import(path, target):
    return os.path.relpath(target, os.path.dirname(path)).replace(os.sep, '/')


def mask_comments(src):
    """Remplace les commentaires par des espaces (mêmes positions) pour ne pas y toucher."""
    out = list(src)
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        if c in '\'"':
            q = c
            j = i + 1
            while j < n and src[j] != q and src[j] != '\n':
                j += 2 if src[j] == '\\' else 1
            i = j + 1
            continue
        if src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            for k in range(i, j):
                out[k] = ' '
            i = j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i)
            j = n if j < 0 else j + 2
            for k in range(i, j):
                if out[k] != '\n':
                    out[k] = ' '
            i = j
            continue
        i += 1
    return ''.join(out)


def french(literal):
    body = literal[1:-1]
    key = extract.placeholders(body.replace("\\'", "'").replace('\\"', '"'), extract.DART_EXPR)
    return extract.keep(extract.norm(key))


def wrap_literals(src):
    masked = mask_comments(src)
    edits = []
    for m in STRING.finditer(masked):
        if m.group(1):  # chaîne brute r'…'
            continue
        lit = m.group(2)
        start, end = m.start(2), m.end(2)
        before = masked[max(0, start - 60):start]
        line_start = masked.rfind('\n', 0, start) + 1
        line = masked[line_start:start]
        if re.search(r"\btr\(\s*$", before) or re.match(r"\s*(import|export|part)\b", line):
            continue
        # chaînes adjacentes 'a' 'b' : on laisse
        if re.search(r"['\"]\s*$", before) or re.match(r"\s*['\"]", masked[end:end + 3]):
            continue
        if not french(lit):
            continue
        ctx = None
        if re.search(r"\b(%s)\s*:\s*$" % '|'.join(NAMED), before):
            ctx = 'named'
        elif re.search(r"\breturn\s+$", before) or re.search(r"=>\s*$", before):
            ctx = 'return'
        elif re.search(r"\?\s*$", before):
            ctx = 'ternary'
        elif re.search(r"(?<![\w'\"\]\)]):\s*$", before) or re.search(r"\)\s*:\s*$", before):
            # « : '…' » après une condition (pas une clé de map « 'k': '…' »)
            prev = re.search(r"(['\"])[^'\"]*\1\s*:\s*$", before)
            if prev is None or french(prev.group(0).split(':')[0].strip()):
                ctx = 'ternary'
        if ctx:
            edits.append((start, end))
    for start, end in reversed(edits):
        src = src[:start] + 'tr(' + src[start:end] + ')' + src[end:]
    return src, len(edits)


def fix_imports(path, src):
    uses_text = re.search(r"(?<![\w.])Text(\.rich)?\(", mask_comments(src)) is not None
    uses_tr = 'tr(' in src
    if not (uses_text or uses_tr):
        return src
    if uses_text:
        src = re.sub(r"import 'package:flutter/material\.dart';", "import 'package:flutter/material.dart' hide Text;", src)
    imports_core = "package:bennego_core/bennego_core.dart" in src
    if is_core_lib(path):
        needed = []
        if uses_text and 'i18n/text.dart' not in src:
            needed.append(rel_import(path, os.path.join(I18N_DIR, 'text.dart')))
        if uses_tr and 'i18n/lang.dart' not in src:
            needed.append(rel_import(path, os.path.join(I18N_DIR, 'lang.dart')))
        if os.path.abspath(path) == os.path.join(CORE_LIB, 'bennego_core.dart'):
            needed = []
    else:
        needed = [] if imports_core else ['package:bennego_core/bennego_core.dart']
    if needed:
        imports = list(re.finditer(r"^import [^;]+;\n", src, flags=re.M))
        at = imports[-1].end() if imports else 0
        src = src[:at] + ''.join(f"import '{n}';\n" for n in needed) + src[at:]
    return src


CONST_ERRORS = ('invalid_constant', 'const_initialized_with_non_constant_value', 'non_constant_list_element',
                'non_constant_map_value', 'non_constant_map_element', 'const_with_non_constant_argument',
                'const_eval_method_invocation', 'non_constant_set_element', 'const_constructor_param_type_mismatch')


def analyze(pkg):
    res = subprocess.run([FLUTTER_BIN, 'analyze', '--no-pub', '--no-fatal-infos', '--no-fatal-warnings'],
                         cwd=os.path.join(FLUTTER, pkg), capture_output=True, text=True)
    errors = []
    for line in res.stdout.splitlines():
        m = re.match(r"\s*error • (.*) • (\S+):(\d+):(\d+) • (\w+)", line)
        if m:
            errors.append((os.path.join(FLUTTER, pkg, m.group(2)), int(m.group(3)), int(m.group(4)), m.group(5), m.group(1)))
    return errors


def offset_of(src, line, col):
    lines = src.split('\n')
    return sum(len(l) + 1 for l in lines[:line - 1]) + col - 1


def matching_end(src, open_at):
    pairs = {'(': ')', '[': ']', '{': '}'}
    stack = []
    i = open_at
    while i < len(src):
        c = src[i]
        if c in '\'"':
            q = c
            i += 1
            while i < len(src) and src[i] != q:
                i += 2 if src[i] == '\\' else 1
        elif c in pairs:
            stack.append(pairs[c])
        elif stack and c == stack[-1]:
            stack.pop()
            if not stack:
                return i
        i += 1
    return len(src)


def remove_enclosing_const(src, pos):
    """Retire le « const » le plus proche dont l'expression contient la position fautive."""
    masked = mask_comments(src)
    for m in reversed(list(re.finditer(r"\bconst\b", masked[:pos + 1]))):
        after = m.end()
        # « const x = … ; » (déclaration) : on passe à final
        decl = re.match(r"\s+(?:[\w<>?,\s]+\s+)?(\w+)\s*=", masked[after:])
        opener = re.search(r"[(\[{]", masked[after:])
        if decl and (not opener or decl.end() <= opener.start() + 1):
            end = masked.find(';', after)
            if end >= pos:
                return src[:m.start()] + 'final' + src[m.end():]
            continue
        if not opener:
            continue
        open_at = after + opener.start()
        if open_at > pos:
            continue
        if matching_end(masked, open_at) >= pos:
            return src[:m.start()] + src[after:].lstrip(' ') if src[after] == ' ' else src[:m.start()] + src[after:]
    return None


def main():
    total = 0
    for path in dart_files():
        src = open(path, encoding='utf-8').read()
        new, n = wrap_literals(src)
        new = fix_imports(path, new)
        if new != src:
            open(path, 'w', encoding='utf-8').write(new)
            total += n
    print(f'{total} texte(s) enveloppé(s) dans tr()', file=sys.stderr)

    for pkg in PACKAGES:
        for round_ in range(25):
            errors = [e for e in analyze(pkg) if e[3] in CONST_ERRORS or 'non_constant_default_value' == e[3]]
            if not errors:
                break
            by_file = {}
            for e in errors:
                by_file.setdefault(e[0], []).append(e)
            changed = False
            for path, errs in by_file.items():
                src = open(path, encoding='utf-8').read()
                # Une correction par fichier et par tour (les positions changent ensuite)
                f, line, col, code, _ = errs[0]
                pos = offset_of(src, line, col)
                if code == 'non_constant_default_value':
                    m = re.match(r"tr\((('(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"))\)", src[pos:])
                    fixed = src[:pos] + m.group(1) + src[pos + m.end():] if m else None
                else:
                    fixed = remove_enclosing_const(src, pos)
                if fixed and fixed != src:
                    open(path, 'w', encoding='utf-8').write(fixed)
                    changed = True
            if not changed:
                print(f'{pkg} : erreurs restantes non corrigées automatiquement', file=sys.stderr)
                for e in errors[:20]:
                    print('  ', e, file=sys.stderr)
                break
        remaining = analyze(pkg)
        print(f'{pkg} : {len(remaining)} erreur(s) après correction', file=sys.stderr)
        for e in remaining[:15]:
            print('  ', os.path.relpath(e[0], FLUTTER), e[1], e[3], e[4][:100], file=sys.stderr)


if __name__ == '__main__':
    main()
