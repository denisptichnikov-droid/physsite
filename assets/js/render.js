// Markdown страницы → HTML: KaTeX, директивы ::formula / ::model, callouts, <details>, оглавление.
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@12.0.2/lib/marked.esm.js';
import katex from 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs';

marked.setOptions({ gfm: true, breaks: false });

const CALLOUTS = {
  tip: 'Лайфхак',
  warning: 'Типичная ошибка',
  theory: 'Теория',
  task26: 'Обоснование (№26)',
  limits: 'Границы применимости',
  measure: 'Как это измеряют',
};

const mdCache = new Map();

/** Загрузка markdown-файла (с кэшем). */
export async function loadMarkdown(path) {
  if (!mdCache.has(path)) {
    mdCache.set(path, fetch(path, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`Не удалось загрузить ${path} (${r.status})`);
      return r.text();
    }).catch((e) => { mdCache.delete(path); throw e; }));
  }
  return mdCache.get(path);
}

export function tex(src, displayMode) {
  try {
    return katex.renderToString(src, { displayMode, throwOnError: false, strict: 'ignore', output: 'htmlAndMathml' });
  } catch (e) {
    return `<code class="math-error">${escapeHtml(src)}</code>`;
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Заголовок и метаданные из шапки файла. */
export function parseMeta(md) {
  const title = /^#\s+(.+)$/m.exec(md)?.[1]?.trim() || '';
  const m = /<!--\s*codes:\s*([^|]*?)\s*\|\s*level:\s*([^>]*?)\s*-->/.exec(md);
  return { title, codes: m ? m[1].split(/[,\s]+/).filter(Boolean) : [], level: m ? m[2].trim() : '' };
}

/**
 * Рендер markdown. Возвращает { title, html, meta } — html без заголовка h1.
 */
export function renderMarkdown(md, { collapse = true } = {}) {
  const meta = parseMeta(md);
  let src = md.replace(/\r\n?/g, '\n');
  // убрать h1 и комментарий с кодами
  src = src.replace(/^#\s+.+\n?/m, '').replace(/<!--\s*codes:[^>]*-->\n?/, '');

  // 1. Спрятать формулы от marked
  const math = [];
  src = src.replace(/(^|[^\\])\$\$([\s\S]+?)\$\$/g, (_, pre, t) => `${pre}@@D${math.push({ t, d: true }) - 1}@@`);
  src = src.replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, pre, t) => `${pre}@@I${math.push({ t, d: false }) - 1}@@`);

  // 2. Директивы → блоки-заглушки
  const blocks = [];
  const lines = src.split('\n');
  const out = [];
  let formulaIdx = 0;
  let taskIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fm = /^::formula\{name="([^"]*)"\}\s*$/.exec(line.trim());
    const mm = /^::model\{id="([^"]+)"\}\s*$/.exec(line.trim());
    const tk = /^::task\{(.*)\}\s*$/.exec(line.trim());
    const tr = /^::try\{(.*?)\}\s*(.*)$/.exec(line.trim());
    if (tk) {
      const inner = [];
      i++;
      while (i < lines.length && !/^::\s*$/.test(lines[i].trim())) inner.push(lines[i++]);
      out.push('', `@@B${blocks.push(renderTask(attrs(tk[1]), inner, taskIdx++)) - 1}@@`, '');
    } else if (tr) {
      const items = [tr];
      while (i + 1 < lines.length) {
        const nx = /^::try\{(.*?)\}\s*(.*)$/.exec(lines[i + 1].trim());
        if (!nx) break;
        items.push(nx);
        i++;
      }
      const lis = items.map((t) => {
        const a = attrs(t[1]);
        const txt = marked.parseInline(t[2]);
        return a.set ? `<li><button class="try-btn" type="button" data-model="${escapeHtml(a.model || '')}" data-set="${escapeHtml(a.set)}">${txt}</button></li>` : `<li>${txt}</li>`;
      }).join('');
      out.push('', `@@B${blocks.push(`<div class="model-tasks"><div class="model-tasks__title">Попробуй сам</div><ol>${lis}</ol></div>`) - 1}@@`, '');
    } else if (fm) {
      const inner = [];
      i++;
      while (i < lines.length && !/^::\s*$/.test(lines[i].trim())) inner.push(lines[i++]);
      const body = [], note = [];
      for (const l of inner) {
        const parts = l.trim().split(/(@@D\d+@@)/).filter((p) => p.trim());
        for (const p of parts) (/^@@D\d+@@$/.test(p) ? body : note).push(p);
      }
      const noteHtml = note.length ? `<div class="formula-card__note">${marked.parseInline(note.join(' '))}</div>` : '';
      const html = `<div class="formula-card" id="f-${formulaIdx++}"><div class="formula-card__name">${marked.parseInline(fm[1])}</div><div class="formula-card__body">${body.join('')}</div>${noteHtml}</div>`;
      out.push('', `@@B${blocks.push(html) - 1}@@`, '');
    } else if (mm) {
      const html = `<figure class="model-wrap"><figcaption class="model-title">Интерактивная модель</figcaption><div class="model" data-model="${escapeHtml(mm[1])}"><p class="model-loading">Загрузка модели…</p></div></figure>`;
      out.push('', `@@B${blocks.push(html) - 1}@@`, '');
    } else {
      out.push(line);
    }
  }

  // 3. Markdown
  let html = marked.parse(out.join('\n'));

  // 4. Вернуть блоки и формулы
  html = html.replace(/<p>@@B(\d+)@@<\/p>/g, (_, n) => blocks[+n]).replace(/@@B(\d+)@@/g, (_, n) => blocks[+n]);
  html = html.replace(/<p>\s*@@D(\d+)@@\s*<\/p>/g, (_, n) => tex(math[+n].t, true));
  html = html.replace(/@@([DI])(\d+)@@/g, (_, k, n) => tex(math[+n].t, k === 'D'));

  // 5. DOM-постобработка
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content;

  // задания к модели — внутрь её блока, над рисунком
  root.querySelectorAll('.model-tasks').forEach((t) => {
    const prev = t.previousElementSibling;
    if (prev?.classList.contains('model-wrap')) prev.insertBefore(t, prev.querySelector('.model'));
  });

  root.querySelectorAll('blockquote').forEach((bq) => {
    const first = bq.firstElementChild;
    if (!first || first.tagName !== 'P') return;
    const m = /^\s*\[!(\w+)\]\s*([^\n]*)\n?/.exec(first.innerHTML);
    if (!m) return;
    const type = m[1].toLowerCase();
    const aside = document.createElement('aside');
    aside.className = `callout callout--${CALLOUTS[type] ? type : 'theory'}`;
    const title = document.createElement('div');
    title.className = 'callout__title';
    title.innerHTML = m[2].trim() || CALLOUTS[type] || '';
    const body = document.createElement('div');
    body.className = 'callout__body';
    first.innerHTML = first.innerHTML.slice(m[0].length);
    if (!first.innerHTML.trim()) first.remove();
    body.append(...bq.childNodes);
    aside.append(title, body);
    bq.replaceWith(aside);
  });

  root.querySelectorAll('details').forEach((d) => {
    d.classList.add('quiz');
    const ans = document.createElement('div');
    ans.className = 'quiz__answer';
    [...d.childNodes].filter((n) => !(n.nodeType === 1 && n.tagName === 'SUMMARY')).forEach((n) => ans.append(n));
    d.append(ans);
  });

  // второстепенные блоки свёрнуты
  if (collapse) {
    root.querySelectorAll('.callout--limits, .callout--measure, .callout--task26').forEach((a) => {
      const d = document.createElement('details');
      d.className = `${a.className} callout--fold`;
      const sum = document.createElement('summary');
      sum.className = 'callout__title';
      sum.innerHTML = a.querySelector('.callout__title').innerHTML;
      d.append(sum, a.querySelector('.callout__body'));
      a.replaceWith(d);
    });
  }

  root.querySelectorAll('.model-wrap').forEach((f, n) => { f.id = `m-${n + 1}`; });

  root.querySelectorAll('table').forEach((t) => t.setAttribute('tabindex', '0'));

  let h = 0;
  // заголовки задач — вне общей нумерации: она совпадает с индексом поиска (заголовки markdown)
  root.querySelectorAll('h2, h3').forEach((el) => {
    const task = el.closest('.task');
    el.id = task ? `${task.id}-title` : `h-${++h}`;
  });

  const div = document.createElement('div');
  div.append(root);
  return { meta, html: div.innerHTML };
}

function attrs(src) {
  const a = {};
  for (const m of src.matchAll(/(\w+)="([^"]*)"/g)) a[m[1]] = m[2];
  return a;
}

/** Кнопка ::open{model set label} — выставить параметры модели на этой странице. */
function openLine(line) {
  const m = /^::open\{(.*)\}\s*$/.exec(line.trim());
  if (!m) return line;
  const a = attrs(m[1]);
  return `\n<p><button class="try-btn try-btn--open" type="button" data-model="${escapeHtml(a.model || '')}" data-set="${escapeHtml(a.set || '')}">${escapeHtml(a.label || 'Открыть в модели с этими числами')}</button></p>\n`;
}

/**
 * ::task{title level line} условие ::step{title} … ::trap … ::answer … ::
 * Шаги решения открываются по одному (обработчик — в app.js).
 */
function renderTask(a, inner, idx) {
  const parts = [{ kind: 'cond', title: '', lines: [] }];
  for (const l of inner) {
    const st = /^::step\{title="([^"]*)"\}\s*$/.exec(l.trim());
    if (st) parts.push({ kind: 'step', title: st[1], lines: [] });
    else if (/^::trap\s*$/.test(l.trim())) parts.push({ kind: 'trap', title: 'Здесь часто ошибаются', lines: [] });
    else if (/^::answer\s*$/.test(l.trim())) parts.push({ kind: 'answer', title: 'Ответ', lines: [] });
    else parts[parts.length - 1].lines.push(openLine(l));
  }
  const body = (p) => marked.parse(p.lines.join('\n'));
  const rest = parts.slice(1).map((p) => `<div class="task__part task__part--${p.kind}" hidden><div class="task__part-title">${marked.parseInline(p.title)}</div>${body(p)}</div>`).join('');
  const lv = (a.level || '').toLowerCase();
  const cls = lv.startsWith('слож') ? 'hard' : lv.startsWith('повыш') ? 'mid' : 'base';
  return `<section class="task task--${cls}" id="t-${idx + 1}"><header class="task__head"><span class="task__level">${escapeHtml(a.level || 'База')}</span>${a.line ? `<span class="task__line">${escapeHtml(a.line)}</span>` : ''}<h3 class="task__title">${marked.parseInline(a.title || `Задача ${idx + 1}`)}</h3></header><div class="task__cond">${body(parts[0])}</div>${rest}<div class="task__actions"><button class="task__next" type="button">Сначала реши сам. Показать первый шаг</button><button class="task__all" type="button">Показать всё решение</button></div></section>`;
}

/** Извлечь формулы (для поиска): [{ name, tex, note, idx }] — напрямую из markdown. */
export function extractFormulas(md) {
  const res = [];
  const re = /^::formula\{name="([^"]*)"\}\s*\n([\s\S]*?)\n::\s*$/gm;
  let m, idx = 0;
  while ((m = re.exec(md))) {
    const inner = m[2];
    const texs = [...inner.matchAll(/\$\$([\s\S]+?)\$\$/g)].map((x) => x[1].trim());
    const note = inner.replace(/\$\$[\s\S]+?\$\$/g, '').trim();
    res.push({ name: m[1], tex: texs, note, idx: idx++ });
  }
  return res;
}

const live = new Set();

/** Смонтировать все модели внутри root. */
export function mountModels(root) {
  root.querySelectorAll('.model[data-model]').forEach(async (el) => {
    const id = el.dataset.model;
    const fig = el.closest('.model-wrap');
    try {
      const mod = await import(new URL(`../../models/${id}.js`, import.meta.url).href);
      if (!el.isConnected) return;
      const model = mod.default;
      if (fig && model.title) fig.querySelector('.model-title').textContent = `Модель: ${model.title}`;
      el.innerHTML = '';
      const handle = model.mount(el, { theme: document.documentElement.dataset.theme || 'light' });
      live.add(handle);
    } catch (e) {
      console.warn(`Модель «${id}» не загрузилась`, e);
      el.innerHTML = `<p class="model-error">Модель «${escapeHtml(id)}» пока недоступна.</p>`;
    }
  });
}

/** Снять все модели (при смене страницы). */
export function destroyModels() {
  for (const h of live) { try { h?.destroy?.(); } catch (e) { console.error(e); } }
  live.clear();
}
