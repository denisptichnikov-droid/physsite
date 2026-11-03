// Поиск по темам, заголовкам, названиям формул и самим формулам (по символам TeX).
import { loadMarkdown, parseMeta, extractFormulas } from './render.js?v=4';

const GREEK = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', varepsilon: 'ε', epsilon: 'ε', eta: 'η', theta: 'θ',
  lambda: 'λ', mu: 'μ', nu: 'ν', rho: 'ρ', sigma: 'σ', tau: 'τ', varphi: 'φ', phi: 'φ', Phi: 'Φ', omega: 'ω',
  Omega: 'Ω', pi: 'π', upsilon: 'v', mathcal: '',
};

/** Нормализация TeX/запроса для поиска «по символу»: \lambda → λ, без пробелов, скобок и команд оформления. */
export function normTex(s) {
  return String(s)
    .replace(/\\(?:left|right|,|;|!|quad|qquad|text|mathrm|operatorname|limits|displaystyle|bigl|bigr)\b/g, '')
    .replace(/\\([A-Za-z]+)/g, (_, w) => (w in GREEK ? GREEK[w] : w))
    .replace(/[{}\s\\]/g, '')
    .replace(/[·⋅]/g, '')
    .toLowerCase();
}

const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');

function plain(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/^::.*$/gm, ' ')
    .replace(/\$\$[\s\S]+?\$\$/g, ' ')
    .replace(/\$[^$\n]+\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^>\s?\[!\w+\]/gm, ' ')
    .replace(/[#>*_`|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let indexPromise = null;

/** Построить индекс по structure (один раз). */
export function buildIndex(structure) {
  if (indexPromise) return indexPromise;
  const pages = [];
  for (const sec of structure.sections) {
    for (const sub of sec.subsections) pages.push({ path: `content/${sec.slug}/${sub.slug}.md`, route: [sec.slug, sub.slug], section: sec.title, title: sub.title, codes: sub.codes });
  }
  for (const e of structure.extra) {
    if (e.slug === 'all-formulas') continue;
    pages.push({ path: `content/extra/${e.slug}.md`, route: ['extra', e.slug], section: 'Справка', title: e.title, codes: [] });
  }
  indexPromise = Promise.all(pages.map(async (p) => {
    try {
      const md = await loadMarkdown(p.path);
      const headings = [...md.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m, i) => ({ text: m[1].replace(/\$([^$]+)\$/g, '$1'), id: `h-${i + 1}` }));
      const formulas = extractFormulas(md).map((f) => ({ ...f, ntex: f.tex.map(normTex).join(' '), nname: norm(f.name) }));
      return { ...p, title: parseMeta(md).title || p.title, headings, formulas, text: plain(md), ntext: norm(plain(md)) };
    } catch (e) {
      return { ...p, headings: [], formulas: [], text: '', ntext: '' };
    }
  }));
  return indexPromise;
}

/**
 * Поиск. Возвращает массив результатов:
 *  { kind: 'page'|'formula'|'heading'|'text', page, formula?, heading?, score, ctx? }
 */
export function search(index, query) {
  const q = norm(query.trim());
  if (q.length < 1) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const qt = normTex(query);
  const res = [];
  for (const page of index) {
    const nt = norm(page.title);
    if (words.every((w) => nt.includes(w)) || page.codes.includes(query.trim())) res.push({ kind: 'page', page, score: nt.startsWith(q) ? 100 : 80 });
    for (const f of page.formulas) {
      let s = 0;
      if (words.every((w) => f.nname.includes(w))) s = 70;
      else if (qt.length >= 1 && f.ntex.includes(qt)) s = qt.length >= 3 ? 60 : 40;
      if (s) res.push({ kind: 'formula', page, formula: f, score: s });
    }
    for (const h of page.headings) {
      if (words.every((w) => norm(h.text).includes(w))) res.push({ kind: 'heading', page, heading: h, score: 50 });
    }
    if (words.every((w) => page.ntext.includes(w)) && !res.some((r) => r.page === page)) {
      const i = page.ntext.indexOf(words[0]);
      const a = Math.max(0, i - 60);
      res.push({ kind: 'text', page, score: 10, ctx: (a > 0 ? '…' : '') + page.text.slice(a, i + 120) + '…' });
    }
  }
  return res.sort((a, b) => b.score - a.score).slice(0, 60);
}
