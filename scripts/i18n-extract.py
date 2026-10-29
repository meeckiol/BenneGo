#!/usr/bin/env python3
"""
Extrait les textes français affichés par les applications BenneGo (web, Flutter, messages du serveur)
vers shared/i18n/keys.json : la liste des clés du dictionnaire de traduction.

Une clé est le texte français tel qu'il s'affiche ; les parties variables deviennent {0}, {1}…
(« Commande {0} en cours »). Usage : python3 scripts/i18n-extract.py
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIRS = ['frontend-client/src', 'frontend-driver/src', 'frontend-admin/src', 'shared']
DART_DIRS = ['flutter/bennego_core/lib', 'flutter/client/lib', 'flutter/driver/lib', 'flutter/admin/lib']
SERVER_DIRS = ['backend/src']
SKIP_FILES = ('googleMaps.js',)

ACCENTS = 'àâäéèêëîïôöùûüçœæÀÂÄÉÈÊËÎÏÔÖÙÛÜÇŒÆ'
FRENCH_HINT = re.compile(
    r"[%s]|\b(le|la|les|un|une|des|du|de|et|ou|vos|votre|vous|pour|sur|dans|avec|pas|est|sont|au|aux|en|à|ce|cette|"
    r"mon|ma|mes|son|sa|ses|nous|il|elle|on|qui|que|plus|par|sans|chez|depuis)\b" % ACCENTS,
    re.I,
)
CODE_LIKE = re.compile(r"=>|===|!==|&&|\|\||\bfunction\b|\breturn\b|\bconst\b|\bimport\b|;\s*$|^\s*[.#]?[a-z][\w-]*(\s+[.#]?[a-z][\w-]*)*\s*$")
CSS_LIKE = re.compile(r"\b\d+(px|rem|em|vh|vw|ms|s|%)\b|rgba?\(|var\(--|#[0-9a-f]{3,8}\b|^\s*[a-z-]+\s*:\s*[^:]+;$")


def keep(text):
    """Vrai si la chaîne ressemble à un texte affiché (pas un identifiant, une classe CSS, un chemin)."""
    t = text.strip()
    if len(t) < 2 or len(t) > 400:
        return False
    bare = re.sub(r"\{\d+\}", "", t)
    letters = re.findall(r"[A-Za-z%s]" % ACCENTS, bare)
    if len(letters) < 2:
        return False
    if re.search(r"[{};=<>]|&&|\?\.|\b(window|toast|navigate|setState|setBusy|document)\b|\$\{", bare) or '()' in t:
        return False  # morceau de code capturé entre deux chevrons
    if re.match(r"^[)(.,]", t) or t.endswith(('(', ' ?:')):
        return False
    if re.match(r"^(https?:|mailto:|tel:|data:|/|\.\.?/|@|#|\w+://)", t):
        return False
    if re.search(r"\.(jsx?|dart|png|jpe?g|svg|css|json|webp|html)\b", t):
        return False
    if CSS_LIKE.search(t) or ('--' in t and ' ' not in t):
        return False
    if re.match(r"^[a-z0-9_.\-/:]+$", t):  # identifiant, statut, clé d'API
        return False
    if re.match(r"^[A-Z0-9_]+$", t):  # constante (MATERIAL, ACCOUNT_DELETION_PENDING)
        return False
    if all(re.match(r"^[a-z0-9]+([-_][a-z0-9]+)+$", w) or w in ('is-on', 'is-active') for w in t.split()):
        return False  # classes CSS « bn-btn bn-btn--primary »
    if CODE_LIKE.search(t) and not FRENCH_HINT.search(t):
        return False
    # Texte français : accent, mot outil, ou mot en capitale (« Annuler », « Valider »)
    return bool(FRENCH_HINT.search(t) or re.match(r"^[A-ZÉÈÀÂÎÔ][a-zà-ÿ]", t) or ' ' in t)


def norm(text):
    t = re.sub(r"\s+", " ", text).strip()
    return t


def placeholders(template, pattern):
    """Remplace les parties variables (${…} en JS, $x / ${…} en Dart) par {0}, {1}…"""
    i = 0
    out = []
    pos = 0
    for m in pattern.finditer(template):
        out.append(template[pos:m.start()])
        out.append('{%d}' % i)
        i += 1
        pos = m.end()
    out.append(template[pos:])
    return ''.join(out)


def balanced_js_template(src, start):
    """Lit un gabarit `…` à partir de l'apostrophe inverse en tenant compte des ${…} imbriqués."""
    i = start + 1
    depth = 0
    while i < len(src):
        c = src[i]
        if c == '\\':
            i += 2
            continue
        if depth == 0 and c == '`':
            return src[start + 1:i], i + 1
        if c == '$' and i + 1 < len(src) and src[i + 1] == '{':
            depth += 1
            i += 2
            continue
        if depth and c == '{':
            depth += 1
        elif depth and c == '}':
            depth -= 1
        i += 1
    return None, len(src)


JS_STRING = re.compile(r"""'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)\"""")
JS_EXPR = re.compile(r"\$\{(?:[^{}]|\{[^{}]*\})*\}")
JSX_TEXT = re.compile(r">([^<>]+)<")


def unescape_js(s):
    return s.replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n')


def from_js(src):
    keys = []
    # Commentaires retirés (les commentaires sont en français mais ne s'affichent pas)
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"(^|[^:'\"`])//[^\n]*", r"\1", src)
    src = re.sub(r"\{/\*.*?\*/\}", "", src, flags=re.S)
    # Gabarits `…${x}…`
    i = 0
    while True:
        j = src.find('`', i)
        if j < 0:
            break
        body, i = balanced_js_template(src, j)
        if body is None:
            break
        keys.append(placeholders(unescape_js(body), JS_EXPR))
        # chaînes '…' à l'intérieur des ${…} : extraites aussi
        for m in JS_EXPR.finditer(body):
            keys.extend(from_js(m.group(0)[2:-1]))
    no_tpl = re.sub(r"`(?:[^`\\]|\\.)*`", "``", src)
    for line in no_tpl.split('\n'):
        if re.match(r"\s*(import|export \{|} from)\b", line) or 'require(' in line:
            continue
        for m in JS_STRING.finditer(line):
            s = m.group(1) if m.group(1) is not None else m.group(2)
            before = line[:m.start()]
            if re.search(r"(className|style|key|type|name|id|href|to|path|icon|tone|variant|rel|target|role|"
                         r"inputMode|autoComplete|method|accept|position|mode)\s*[=:]\s*\{?\s*$", before):
                continue
            keys.append(unescape_js(s))
    # Textes JSX entre balises, découpés aux {expressions} (React crée un nœud de texte par morceau)
    for m in JSX_TEXT.finditer(no_tpl):
        chunk = m.group(1)
        if '=>' in chunk or ';' in chunk and '{' not in chunk and '}' not in chunk and len(chunk) > 80:
            continue
        for part in re.split(r"\{(?:[^{}]|\{[^{}]*\})*\}", chunk):
            keys.append(part)
    return keys


DART_STRING = re.compile(r"""(r?)'((?:[^'\\\n]|\\.)*)'|(r?)"((?:[^"\\\n]|\\.)*)\"""")
DART_EXPR = re.compile(r"\$\{(?:[^{}]|\{[^{}]*\})*\}|\$[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*(?:!)?")


def from_dart(src):
    keys = []
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    lines = []
    for line in src.split('\n'):
        if re.match(r"\s*(import|export|part|library)\b", line):
            continue
        line = re.sub(r"(^|[^:'\"])//[^\n]*", r"\1", line)
        lines.append(line)
    text = '\n'.join(lines)
    # Chaînes adjacentes 'a' 'b' sur plusieurs lignes : recollées
    text = re.sub(r"'\s*\n\s*'", "", text)
    for m in DART_STRING.finditer(text):
        raw = m.group(1) or m.group(3)
        s = m.group(2) if m.group(2) is not None else m.group(4)
        before = text[max(0, m.start() - 40):m.start()]
        if re.search(r"(\[|json|data|map|row|item|body|query|details|order|s|e|b|p|widget\.order)\[\s*$", before):
            continue  # clé de map : data['credit_balance']
        if raw:
            keys.append(s)
            continue
        s = s.replace("\\'", "'").replace('\\"', '"').replace('\\n', '\n').replace('\\$', '$')
        keys.append(placeholders(s, DART_EXPR))
    return keys


def from_server(src):
    keys = []
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    for pattern in (r"AppError\(\s*(['\"`])((?:\\.|(?!\1).)*)\1",
                    r"(?:message|error|title|body)\s*:\s*(['\"`])((?:\\.|(?!\1).)*)\1",
                    r"withMessage\(\s*(['\"])((?:\\.|(?!\1).)*)\1",
                    r"blockers\.push\(\{[^}]*message:\s*(['\"`])((?:(?!\1).)*)\1",
                    r"CLIENT_PUSH[\s\S]*?\[\s*(['\"])((?:(?!\1).)*)\1"):
        for m in re.finditer(pattern, src):
            keys.append(placeholders(unescape_js(m.group(2)), JS_EXPR))
    # Textes des notifications (tableaux [titre, texte, urgent])
    for m in re.finditer(r"^\s+\w+: \[('[^']*'|\"[^\"]*\"), ('[^']*'|\"[^\"]*\")", src, flags=re.M):
        keys.append(m.group(1)[1:-1])
        keys.append(m.group(2)[1:-1])
    return keys


def walk(dirs, exts):
    for d in dirs:
        for base, subdirs, files in os.walk(os.path.join(ROOT, d)):
            subdirs[:] = [s for s in subdirs if s not in ('node_modules', 'dist', 'build', '.dart_tool', 'i18n')]
            for f in files:
                if f.endswith(exts) and not f.endswith(('.test.js', '_test.dart')) and f not in SKIP_FILES:
                    yield os.path.join(base, f)


def main():
    found = {}
    for path in walk(WEB_DIRS, ('.js', '.jsx')):
        for k in from_js(open(path, encoding='utf-8').read()):
            found.setdefault(norm(k), set()).add('web')
    for path in walk(DART_DIRS, ('.dart',)):
        for k in from_dart(open(path, encoding='utf-8').read()):
            found.setdefault(norm(k), set()).add('flutter')
    for path in walk(SERVER_DIRS, ('.js',)):
        src = open(path, encoding='utf-8').read()
        # Messages renvoyés aux applications : chaînes et gabarits en français (hors requêtes SQL et journaux)
        src = re.sub(r"console\.(log|warn|error)\([^;]*\);", "", src)
        for k in from_server(src) + from_js(src):
            if re.search(r"\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|INTERVAL|COALESCE|RETURNING)\b", k):
                continue
            found.setdefault(norm(k), set()).add('server')
    keys = sorted(k for k in found if keep(k))
    out = os.path.join(ROOT, 'shared/i18n/keys.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(keys, fh, ensure_ascii=False, indent=0)
        fh.write('\n')
    print(f'{len(keys)} textes -> {os.path.relpath(out, ROOT)}', file=sys.stderr)


if __name__ == '__main__':
    main()
