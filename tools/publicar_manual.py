#!/usr/bin/env python3
"""Arma el manual de cada proyecto (plantilla docs/manual-agentes.md + docs/manual-valores.json)
y lo publica como cuerpo del issue #4 de su repo.
Uso: python3 tools/publicar_manual.py [repo ...]   (sin argumentos: todos)   ·   --ver repo  (solo imprime)"""
import json, subprocess, sys, tempfile, os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tpl = open(os.path.join(RAIZ, 'docs/manual-agentes.md'), encoding='utf-8').read()
vals = json.load(open(os.path.join(RAIZ, 'docs/manual-valores.json'), encoding='utf-8'))
def armar(repo):
    t = tpl.replace('{{REPO}}', repo)
    for k, v in vals[repo].items(): t = t.replace('{{' + k + '}}', v)
    if '{{' in t: sys.exit(f'Falta un valor en docs/manual-valores.json para {repo}')
    return t
if len(sys.argv) > 2 and sys.argv[1] == '--ver': print(armar(sys.argv[2])); sys.exit()
for repo in (sys.argv[1:] or list(vals)):
    with tempfile.NamedTemporaryFile('w', delete=False, suffix='.md', encoding='utf-8') as f: f.write(armar(repo))
    r = subprocess.run(['gh', 'api', '-X', 'PATCH', f'repos/gonzalolavin99/{repo}/issues/4', '-F', f'body=@{f.name}', '--jq', '.updated_at'], capture_output=True, text=True)
    print(repo, r.stdout.strip() or r.stderr.strip()); os.unlink(f.name)
