// Оболочка SPA: навигация, страницы, поиск, «Все формулы», тема, оглавление.
import { onRoute, href, parseHash } from './router.js?v=4';
import { loadMarkdown, renderMarkdown, mountModels, destroyModels, escapeHtml, tex } from './render.js?v=4';
import { buildIndex, search } from './search.js?v=4';
import { applyPreset } from '../../models/_lib.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const sidebar = $('#sidebar');
const tocEl = $('.toc');
const SITE = 'ЕГЭ по физике';

let structure;
const flat = []; // все подразделы по порядку: { sec, sub }


/* ---------- Навигация ---------- */
function buildSidebar() {
  const extra = structure.extra.map((e) => `<li class="nav__extra"><a class="nav__link" href="${href(['extra', e.slug])}">${escapeHtml(e.title)}</a></li>`).join('');
  const secs = structure.sections.map((sec) => `
    <li class="nav__section" data-sec="${sec.slug}">
      <button class="nav__section-btn" type="button" aria-expanded="false" aria-controls="nav-${sec.slug}"><span class="nav__num">${sec.num}</span> ${escapeHtml(sec.title)}</button>
      <ul class="nav__list" id="nav-${sec.slug}" hidden>
        <li><a class="nav__link nav__link--overview" href="${href([sec.slug])}">Обзор раздела</a></li>
        ${sec.subsections.map((sub) => `<li><a class="nav__link" href="${href([sec.slug, sub.slug])}">${escapeHtml(sub.title)}</a></li>`).join('')}
      </ul>
    </li>`).join('');
  sidebar.innerHTML = `<ul class="nav">${extra}${secs}</ul>`;
  sidebar.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav__section-btn');
    if (btn) toggleSection(btn.parentElement, btn.getAttribute('aria-expanded') !== 'true');
    if (e.target.closest('.nav__link')) closeNav();
  });
}

function toggleSection(li, open) {
  li.classList.toggle('is-open', open);
  li.querySelector('.nav__section-btn').setAttribute('aria-expanded', String(open));
  li.querySelector('.nav__list').hidden = !open;
}

function markActive(hash) {
  sidebar.querySelectorAll('.nav__link').forEach((a) => {
    const on = a.getAttribute('href') === hash;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    if (on) { const li = a.closest('.nav__section'); if (li) toggleSection(li, true); }
  });
}

const navToggle = $('.nav-toggle');
const backdrop = $('.sidebar-backdrop');
function closeNav() {
  document.body.classList.remove('nav-open');
  navToggle.setAttribute('aria-expanded', 'false');
  backdrop.hidden = true;
}
navToggle.addEventListener('click', () => {
  const open = !document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  navToggle.setAttribute('aria-expanded', String(open));
  backdrop.hidden = !open;
  if (open) sidebar.querySelector('.is-active, .nav__link')?.focus();
});
backdrop.addEventListener('click', closeNav);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { closeNav(); navToggle.focus(); } });

/* ---------- Тема ---------- */
function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
$('.theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* приватный режим */ }
  updateThemeBtn();
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
});
function updateThemeBtn() {
  const t = currentTheme();
  const b = $('.theme-toggle');
  b.setAttribute('aria-label', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
  b.title = b.getAttribute('aria-label');
}

/* ---------- Поиск ---------- */
const searchInput = $('.search__input');
let searchTimer = 0;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const q = searchInput.value.trim();
    if (q) {
      const h = href(['search'], { params: { q } });
      if (location.hash.startsWith('#/search')) history.replaceState(null, '', h), route(); else location.hash = h;
    }
  }, 250);
});
$('.search').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) location.hash = href(['search'], { params: { q } });
});

/* ---------- Оглавление ---------- */
let tocObserver;
function buildToc(routeParts) {
  tocObserver?.disconnect();
  const hs = [...main.querySelectorAll('.content h2, .content h3, .content .model-wrap')];
  if (hs.length < 2) { tocEl.innerHTML = ''; tocEl.hidden = true; return; }
  tocEl.hidden = false;
  tocEl.innerHTML = `<p class="toc__title">На странице</p><ul class="toc__list">${hs.map((h) => `<li><a class="toc__link${h.tagName === 'H2' ? '' : ' toc__link--sub'}${h.tagName === 'FIGURE' ? ' toc__link--model' : ''}" href="${href(routeParts, { anchor: h.id })}" data-id="${h.id}">${h.tagName === 'FIGURE' ? 'Модель' : tocText(h)}</a></li>`).join('')}</ul>`;
  const links = new Map([...tocEl.querySelectorAll('.toc__link')].map((a) => [a.dataset.id, a]));
  tocObserver = new IntersectionObserver((entries) => {
    const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!vis) return;
    links.forEach((a) => a.classList.remove('is-active'));
    links.get(vis.target.id)?.classList.add('is-active');
  }, { rootMargin: '-10% 0px -75% 0px' });
  hs.forEach((h) => tocObserver.observe(h));
}
function tocText(h) {
  const c = h.cloneNode(true);
  c.querySelectorAll('.katex-mathml').forEach((n) => n.remove());
  return c.innerHTML;
}

function scrollToAnchor(anchor) {
  if (!anchor) { window.scrollTo(0, 0); return; }
  const el = document.getElementById(anchor);
  if (el) {
    el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (el.classList.contains('formula-card')) { el.classList.add('is-highlight'); setTimeout(() => el.classList.remove('is-highlight'), 2000); }
  }
}

/* ---------- Страницы ---------- */
function setPage(html, { title, crumbs = [], toc = null, pager = '' } = {}) {
  destroyModels();
  const crumbsHtml = crumbs.length
    ? `<nav class="breadcrumbs" aria-label="Путь"><a href="#/">Главная</a>${crumbs.map((c) => ` / ${c.href ? `<a href="${c.href}">${escapeHtml(c.text)}</a>` : `<span aria-current="page">${escapeHtml(c.text)}</span>`}`).join('')}</nav>`
    : '';
  main.innerHTML = `${crumbsHtml}<article class="content">${html}</article>${pager}`;
  document.title = title ? `${title} — ${SITE}` : `${SITE} — справочник`;
  if (toc) buildToc(toc); else { tocObserver?.disconnect(); tocEl.innerHTML = ''; tocEl.hidden = true; }
  mountModels(main);
}

function pageHeader(title) {
  return `<header class="page-header"><h1>${escapeHtml(title)}</h1></header>`;
}

function renderHome() {
  const cards = structure.sections.map((sec) => `
    <section class="section-card">
      <a class="section-card__head" href="${href([sec.slug])}"><span class="section-card__num">${sec.num}</span><span>${escapeHtml(sec.title)}</span></a>
      <ul class="section-card__list">${sec.subsections.map((s) => `<li><a href="${href([sec.slug, s.slug])}">${escapeHtml(s.title)}</a></li>`).join('')}</ul>
    </section>`).join('');
  setPage(`
    <div class="home-hero">
      <h1>Физика к ЕГЭ — коротко, точно, наглядно</h1>
      <p>Теория по всем темам ЕГЭ, все формулы, типичные ошибки, лайфхаки, шаблоны обоснования для задачи №26 и интерактивные модели «как выглядит рисунок в задании».</p>
      <div class="home-actions">
        <a class="btn btn--primary" href="${href(['extra', 'all-formulas'])}">Все формулы на одной странице</a>
        <a class="btn" href="${href(['extra', 'task26'])}">Обоснование №26</a>
        <a class="btn" href="${href(['extra', 'constants'])}">Константы</a>
      </div>
    </div>
    <div class="section-grid">${cards}</div>`, {});
}

function renderSection(sec) {
  const list = sec.subsections.map((s) => `
    <li><a href="${href([sec.slug, s.slug])}">${escapeHtml(s.title)}</a>${s.models.length ? ` <span class="search-result__meta">· моделей: ${s.models.length}</span>` : ''}</li>`).join('');
  setPage(`${pageHeader(`${sec.num}. ${sec.title}`, '', [])}<ol class="section-index">${list}</ol>`, {
    title: sec.title,
    crumbs: [{ text: sec.title }],
  });
}

async function renderSub(sec, sub, anchor, token) {
  const md = await loadMarkdown(`content/${sec.slug}/${sub.slug}.md`);
  if (token !== routeToken) return;
  const { html, meta } = renderMarkdown(md);
  const i = flat.findIndex((f) => f.sub === sub);
  const prev = flat[i - 1], next = flat[i + 1];
  const pager = `<nav class="pager" aria-label="Соседние темы">${prev ? `<a class="pager__prev" href="${href([prev.sec.slug, prev.sub.slug])}">← <span>${escapeHtml(prev.sub.title)}</span></a>` : '<span></span>'}${next ? `<a class="pager__next" href="${href([next.sec.slug, next.sub.slug])}"><span>${escapeHtml(next.sub.title)}</span> →</a>` : ''}</nav>`;
  setPage(`${pageHeader(meta.title || sub.title)}${html}<aside class="task-banks"><h2 id="banks">Настоящие задания ЕГЭ</h2><p>Потренируйся на заданиях из открытых банков: <a href="https://ege.fipi.ru/bank/" target="_blank" rel="noopener">открытый банк ФИПИ</a> и <a href="https://phys-ege.sdamgia.ru/" target="_blank" rel="noopener">«Решу ЕГЭ»</a>. Задачи на этой странице составлены по образцу экзамена, это не копии реальных заданий.</p></aside>`, {
    title: meta.title || sub.title,
    crumbs: [{ text: sec.title, href: href([sec.slug]) }, { text: sub.title }],
    toc: [sec.slug, sub.slug],
    pager,
  });
  scrollToAnchor(anchor);
}

async function renderExtra(slug, anchor, token) {
  const e = structure.extra.find((x) => x.slug === slug);
  if (!e) return renderNotFound();
  if (slug === 'all-formulas') return renderAllFormulas(token);
  const md = await loadMarkdown(`content/extra/${slug}.md`);
  if (token !== routeToken) return;
  const { html, meta } = renderMarkdown(md, { collapse: false });
  setPage(pageHeader(meta.title || e.title, '', []) + html, { title: e.title, crumbs: [{ text: e.title }], toc: ['extra', slug] });
  scrollToAnchor(anchor);
}

async function renderAllFormulas(token) {
  main.innerHTML = '<p class="loading">Собираем формулы…</p>';
  const intro = renderMarkdown(await loadMarkdown('content/extra/all-formulas.md').catch(() => '# Все формулы на одной странице'));
  const parts = await Promise.all(structure.sections.map(async (sec) => {
    const subs = await Promise.all(sec.subsections.map(async (sub) => {
      try {
        const { html } = renderMarkdown(await loadMarkdown(`content/${sec.slug}/${sub.slug}.md`));
        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        const cards = [...tpl.content.querySelectorAll('.formula-card')];
        if (!cards.length) return '';
        cards.forEach((c) => { c.classList.add('formula-card--compact'); c.id = ''; });
        return `<section class="af-sub"><h3 id="af-${sub.slug}"><a href="${href([sec.slug, sub.slug])}">${escapeHtml(sub.title)}</a></h3><div class="af-grid">${cards.map((c) => c.outerHTML).join('')}</div></section>`;
      } catch { return ''; }
    }));
    return `<section class="af-section"><h2 id="af-${sec.slug}">${sec.num}. ${escapeHtml(sec.title)}</h2>${subs.join('')}</section>`;
  }));
  if (token !== routeToken) return;
  setPage(`${pageHeader('Все формулы на одной странице', '', [])}${intro.html}<p><button class="print-btn btn" type="button">Распечатать шпаргалку</button></p><div class="all-formulas">${parts.join('')}</div>`, {
    title: 'Все формулы', crumbs: [{ text: 'Все формулы' }],
  });
  // оглавление только по разделам
  const secs = [...main.querySelectorAll('.af-section > h2')];
  tocEl.hidden = false;
  tocEl.innerHTML = `<p class="toc__title">Разделы</p><ul class="toc__list">${secs.map((h) => `<li><a class="toc__link" href="${href(['extra', 'all-formulas'], { anchor: h.id })}">${h.innerHTML}</a></li>`).join('')}</ul>`;
  main.querySelector('.print-btn').addEventListener('click', () => window.print());
  const anchor = location.hash.split('#')[2];
  if (anchor) scrollToAnchor(anchor);
}

async function renderSearch(q, token) {
  searchInput.value = q;
  setPage(`${pageHeader(`Поиск: «${q}»`, '', [])}<p class="loading">Ищем…</p>`, { title: 'Поиск', crumbs: [{ text: 'Поиск' }] });
  const index = await buildIndex(structure);
  if (token !== routeToken) return;
  const res = search(index, q);
  const items = res.map((r) => {
    const p = r.page;
    const meta = `<span class="search-result__meta">${escapeHtml(p.section)} · ${escapeHtml(p.title)}</span>`;
    if (r.kind === 'formula') {
      const f = r.formula;
      return `<li class="search-result search-result--formula"><a class="search-result__title" href="${href(p.route, { anchor: `f-${f.idx}` })}">${hl(f.name, q)}</a>${meta}<div class="search-result__ctx">${f.tex.map((t) => tex(t, true)).join('')}</div></li>`;
    }
    if (r.kind === 'heading') return `<li class="search-result"><a class="search-result__title" href="${href(p.route, { anchor: r.heading.id })}">${hl(r.heading.text, q)}</a>${meta}</li>`;
    if (r.kind === 'page') return `<li class="search-result"><a class="search-result__title" href="${href(p.route)}">${hl(p.title, q)}</a><span class="search-result__meta">${escapeHtml(p.section)}</span></li>`;
    return `<li class="search-result"><a class="search-result__title" href="${href(p.route)}">${escapeHtml(p.title)}</a><span class="search-result__meta">${escapeHtml(p.section)}</span><p class="search-result__ctx">${hl(r.ctx, q)}</p></li>`;
  }).join('');
  main.querySelector('.content').innerHTML = `${pageHeader(`Поиск: «${q}»`, '', [])}${res.length ? `<p>Найдено: ${res.length}</p><ul class="search-results">${items}</ul>` : '<p class="search-empty">Ничего не нашлось. Попробуйте название величины («импульс»), закона («Ома») или символ формулы (\\lambda, F_A, mv^2).</p>'}`;
}

function hl(text, q) {
  let s = escapeHtml(text);
  for (const w of q.trim().split(/\s+/).filter((x) => x.length > 1)) {
    const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    s = s.replace(re, '<mark>$1</mark>');
  }
  return s;
}

function renderNotFound() {
  setPage(`<div class="not-found"><h1>Страница не найдена</h1><p>Такой темы нет. <a href="#/">На главную</a></p></div>`, { title: 'Не найдено' });
}

/* ---------- Роутинг ---------- */
let routeToken = 0;
let lastKey = '';
async function route() {
  const r = parseHash();
  const key = r.parts.join('/') + '?' + r.params.toString();
  if (key === lastKey && r.anchor) { scrollToAnchor(r.anchor); return; }
  lastKey = key;
  const token = ++routeToken;
  const [a, b] = r.parts;
  markActive(href(r.parts.slice(0, 2)));
  try {
    if (!a) renderHome();
    else if (a === 'search') await renderSearch(r.params.get('q') || '', token);
    else if (a === 'extra') await renderExtra(b, r.anchor, token);
    else {
      const sec = structure.sections.find((s) => s.slug === a);
      if (!sec) renderNotFound();
      else if (!b) renderSection(sec);
      else {
        const sub = sec.subsections.find((s) => s.slug === b);
        if (!sub) renderNotFound(); else await renderSub(sec, sub, r.anchor, token);
      }
    }
    if (!r.anchor && token === routeToken) { window.scrollTo(0, 0); if (document.activeElement !== searchInput) main.focus({ preventScroll: true }); }
  } catch (e) {
    console.error(e);
    if (token === routeToken) setPage(`<div class="not-found"><h1>Ошибка загрузки</h1><p>${escapeHtml(e.message)}</p><p>Сайт нужно открывать через статический сервер (например, <code>python -m http.server</code>), а не как файл.</p></div>`, { title: 'Ошибка' });
  }
}

/* ---------- Задачи и пресеты моделей ---------- */
main.addEventListener('click', (e) => {
  const next = e.target.closest('.task__next');
  const all = e.target.closest('.task__all');
  if (next || all) {
    const task = e.target.closest('.task');
    const hidden = [...task.querySelectorAll('.task__part[hidden]')];
    (all ? hidden : hidden.slice(0, 1)).forEach((p) => { p.hidden = false; });
    if (task.querySelectorAll('.task__part[hidden]').length) task.querySelector('.task__next').textContent = 'Следующий шаг';
    else task.querySelector('.task__actions').hidden = true;
    return;
  }
  const t = e.target.closest('.try-btn');
  if (!t) return;
  const el = main.querySelector(`.model[data-model="${CSS.escape(t.dataset.model)}"]`);
  if (!el) return;
  if (t.dataset.set) applyPreset(el, t.dataset.set);
  el.closest('.model-wrap').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});

window.addEventListener('beforeprint', () => document.querySelectorAll('details.quiz, details.callout--fold').forEach((d) => d.setAttribute('open', '')));

async function init() {
  structure = await (await fetch('data/structure.json', { cache: 'no-cache' })).json();
  structure.sections.forEach((sec) => sec.subsections.forEach((sub) => flat.push({ sec, sub })));
  buildSidebar();
  updateThemeBtn();
  onRoute(route);
  // прогреть поисковый индекс в простое
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => buildIndex(structure));
}

init().catch((e) => {
  console.error(e);
  main.innerHTML = `<div class="not-found"><h1>Не удалось запустить сайт</h1><p>${escapeHtml(e.message)}</p></div>`;
});
