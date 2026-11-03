# Сборка служебных файлов: models/keys.json, models/README.md, списки моделей в data/structure.json.
# Заодно проверяет, что все ключи в ::try и ::open существуют. Запуск: python tools/sync.py
import glob
import json
import os
import re

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

keys = {}
for f in sorted(glob.glob('models/*.js')):
    base = os.path.basename(f)[:-3]
    if base.startswith('_'):
        continue
    t = open(f, encoding='utf-8').read()
    found = re.findall(r"\bkey: '(\w+)'", t) + re.findall(r"dataset\.key = '(\w+)'", t) + re.findall(r"data-key=\"(\w+)\"", t)
    keys[base] = sorted(set(found))
json.dump(keys, open('models/keys.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

with open('models/README.md', 'w', encoding='utf-8') as out:
    out.write('# Модели\n\nСборник описаний из docs/ (генерируется tools/sync.py).\n')
    for f in sorted(glob.glob('models/docs/*.md')):
        out.write('\n' + open(f, encoding='utf-8').read() + '\n\n---\n')

st = json.load(open('data/structure.json', encoding='utf-8'))
problems = []
for sec in st['sections']:
    for sub in sec['subsections']:
        md = open(f"content/{sec['slug']}/{sub['slug']}.md", encoding='utf-8').read()
        ids = re.findall(r'^::model\{id="([^"]+)"\}', md, re.M)
        sub['models'] = list(dict.fromkeys(ids))
        for m in ids:
            if m not in keys:
                problems.append(f"{sub['slug']}: нет модели {m}")
        for model, sets in re.findall(r'^::(?:try|open)\{[^}]*?model="([^"]+)"[^}]*?set="([^"]*)"', md, re.M):
            if model not in ids:
                problems.append(f"{sub['slug']}: кнопка к модели {model}, которой нет на странице")
            for pair in filter(None, sets.split(',')):
                k = pair.split('=')[0].strip()
                if k not in keys.get(model, []):
                    problems.append(f"{sub['slug']}: {model} нет ключа {k}")
json.dump(st, open('data/structure.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('models', len(keys), 'problems', len(problems))
print('\n'.join(problems).encode('ascii', 'backslashreplace').decode())
