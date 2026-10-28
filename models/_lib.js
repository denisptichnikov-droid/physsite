// Общая библиотека для моделей (models/<id>.js). Автор — руководитель; моделисты её не меняют.
//
// Быстрый старт:
//   import * as L from './_lib.js';
//   export default {
//     id: 'demo', title: 'Демо', codes: ['1.1.1'],
//     mount(el) {
//       const d = L.disposer();
//       const ui = L.layout(el, { caption: 'Подпись к рисунку' });   // .model > .model-canvas + .model-controls + .model-readout
//       const cv = L.canvas(ui.stage, { aspect: 0.6 });                // HiDPI canvas, ResizeObserver; рисуем в CSS-пикселях
//       d.add(cv.destroy);
//       const s = L.slider(ui.controls, { label: 'Скорость v₀', min: 0, max: 30, step: 1, value: 10, unit: 'м/с', onInput: draw });
//       L.button(ui.controls, 'Сброс', () => { s.set(10); draw(); }, { reset: true });
//       const ro = L.readout(ui.readout);
//       function draw() {
//         const { ctx, width: W, height: H } = cv; const c = L.colors();
//         ctx.clearRect(0, 0, W, H);
//         L.arrow(ctx, 20, H / 2, 20 + s.value * 5, H / 2, c.velocity, { label: 'v' });
//         ro.set([['v₀', L.fmt(s.value) + ' м/с']]);
//       }
//       cv.onResize(draw); d.add(L.onThemeChange(draw)); draw();
//       return { destroy: d.run };
//     }
//   };
//
// Цвета: всегда через L.colors() внутри draw() (тема может смениться).
// Анимации: L.animator(step) — уважает prefers-reduced-motion (не стартует сам; step(dt) вызывается с dt в секундах).

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Значение CSS-переменной (например css('--accent')). */
export function css(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** Палитра из CSS-переменных контракта A6 (с запасными значениями). */
export function colors() {
  const g = (n, f) => css(n) || f;
  return {
    bg: g('--bg', '#ffffff'),
    surface: g('--surface', '#f6f7f9'),
    text: g('--text', '#1b1f24'),
    muted: g('--muted', '#5b6470'),
    accent: g('--accent', '#2457c5'),
    grid: g('--grid', '#d9dde3'),
    force: g('--vec-force', '#d1342f'),
    velocity: g('--vec-velocity', '#1f7a3a'),
    accel: g('--vec-accel', '#7a3fc0'),
    fieldE: g('--field-e', '#c9661a'),
    fieldB: g('--field-b', '#1769aa'),
  };
}

/** Собирает список функций очистки. */
export function disposer() {
  const fns = [];
  return {
    add(fn) { if (typeof fn === 'function') fns.push(fn); return fn; },
    run() { while (fns.length) { try { fns.pop()(); } catch (e) { console.error(e); } } },
  };
}

/** Подписка на смену темы; возвращает функцию отписки. */
export function onThemeChange(cb) {
  const h = () => cb();
  document.addEventListener('themechange', h);
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  mq?.addEventListener?.('change', h);
  return () => { document.removeEventListener('themechange', h); mq?.removeEventListener?.('change', h); };
}

/** Каркас модели внутри el. */
export function layout(el, { caption } = {}) {
  el.classList.add('model');
  el.innerHTML = '';
  const stage = document.createElement('div');
  stage.className = 'model-canvas';
  const controls = document.createElement('div');
  controls.className = 'model-controls';
  const readout = document.createElement('div');
  readout.className = 'model-readout';
  readout.setAttribute('aria-live', 'polite');
  el.append(stage, controls, readout);
  if (caption) {
    const cap = document.createElement('p');
    cap.className = 'model-caption';
    cap.textContent = caption;
    el.append(cap);
  }
  return { root: el, stage, controls, readout };
}

/**
 * HiDPI-canvas, растягивается по ширине контейнера; height = width * aspect (в пределах minHeight..maxHeight).
 * Свойства width/height — в CSS-пикселях, ctx уже отмасштабирован под devicePixelRatio.
 */
export function canvas(parent, { aspect = 0.6, minHeight = 180, maxHeight = 520, label = 'Рисунок модели' } = {}) {
  const c = document.createElement('canvas');
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', label);
  c.style.display = 'block';
  c.style.width = '100%';
  parent.append(c);
  const ctx = c.getContext('2d');
  const listeners = [];
  const api = {
    canvas: c, ctx, width: 0, height: 0,
    onResize(cb) { listeners.push(cb); return cb; },
    destroy() { ro.disconnect(); c.remove(); },
  };
  let raf = 0;
  function resize() {
    const w = Math.max(200, Math.floor(parent.clientWidth || 320));
    const h = Math.round(Math.min(maxHeight, Math.max(minHeight, w * aspect)));
    if (w === api.width && h === api.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    api.width = w; api.height = h;
    listeners.forEach((f) => f(w, h));
  }
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(resize); });
  ro.observe(parent);
  resize();
  return api;
}

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/** Слайдер с подписью и выводом значения. */
export function slider(parent, { label, min, max, step = 1, value, unit = '', format, onInput } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'model-control';
  const id = nextId('ms');
  const lab = document.createElement('label');
  lab.htmlFor = id;
  const name = document.createElement('span');
  name.className = 'model-control__label';
  name.innerHTML = label;
  const out = document.createElement('output');
  out.className = 'model-control__value';
  out.htmlFor = id;
  lab.append(name, out);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  Object.assign(input, { min, max, step, value });
  wrap.append(lab, input);
  parent.append(wrap);
  const show = () => { out.textContent = (format ? format(+input.value) : fmt(+input.value)) + (unit ? ' ' + unit : ''); };
  input.addEventListener('input', () => { show(); onInput?.(+input.value); });
  show();
  return {
    el: wrap, input,
    get value() { return +input.value; },
    set(v) { input.value = v; show(); },
  };
}

/** Группа переключателей (радиокнопки). options: [{value, label}] */
export function choice(parent, { label, options, value, onChange } = {}) {
  const fs = document.createElement('fieldset');
  fs.className = 'model-control model-choice';
  const lg = document.createElement('legend');
  lg.className = 'model-control__label';
  lg.innerHTML = label || '';
  fs.append(lg);
  const name = nextId('mc');
  let current = value ?? options[0].value;
  const inputs = options.map((o) => {
    const l = document.createElement('label');
    l.className = 'model-choice__opt';
    const i = document.createElement('input');
    i.type = 'radio'; i.name = name; i.value = o.value; i.checked = o.value === current;
    i.addEventListener('change', () => { if (i.checked) { current = o.value; onChange?.(current); } });
    const s = document.createElement('span');
    s.innerHTML = o.label;
    l.append(i, s);
    fs.append(l);
    return i;
  });
  parent.append(fs);
  return {
    el: fs,
    get value() { return current; },
    set(v) { current = v; inputs.forEach((i) => { i.checked = i.value === String(v); }); },
  };
}

/** Флажок. */
export function checkbox(parent, { label, checked = false, onChange } = {}) {
  const l = document.createElement('label');
  l.className = 'model-control model-check';
  const i = document.createElement('input');
  i.type = 'checkbox'; i.checked = checked;
  i.addEventListener('change', () => onChange?.(i.checked));
  const s = document.createElement('span');
  s.innerHTML = label;
  l.append(i, s);
  parent.append(l);
  return { el: l, input: i, get value() { return i.checked; }, set(v) { i.checked = !!v; } };
}

/** Кнопка. { reset: true } — помечает кнопку «Сброс». */
export function button(parent, text, onClick, { reset = false } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'model-btn' + (reset ? ' model-btn--reset' : '');
  b.textContent = text;
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

/** Таблица значений. set([[label(html), value(text)], ...]) */
export function readout(parent) {
  const dl = document.createElement('dl');
  dl.className = 'model-readout__list';
  parent.append(dl);
  return {
    el: dl,
    set(rows) {
      dl.innerHTML = '';
      for (const [k, v] of rows) {
        const row = document.createElement('div');
        row.className = 'model-readout__row';
        const dt = document.createElement('dt'); dt.innerHTML = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        row.append(dt, dd);
        dl.append(row);
      }
    },
  };
}

/** Число по-русски: десятичная запятая, большие/малые — как 1,6·10⁻¹⁹. */
export function fmt(x, digits = 2) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '∞' : '−∞';
  if (x === 0) return '0';
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) {
    const e = Math.floor(Math.log10(ax));
    let m = x / 10 ** e;
    let ms = trim(m.toFixed(digits));
    if (Math.abs(parseFloat(ms)) >= 10) { m /= 10; ms = trim(m.toFixed(digits)); return `${ms.replace('.', ',').replace('-', '−')}·10${sup(e + 1)}`; }
    return `${ms.replace('.', ',').replace('-', '−')}·10${sup(e)}`;
  }
  return trim(x.toFixed(digits)).replace('.', ',').replace('-', '−');
}
function trim(s) { return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s; }
function sup(n) {
  const m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  return String(n).split('').map((ch) => m[ch]).join('');
}

/** Стрелка-вектор. opts: { width=2, head=9, label, labelOffset, dash, font } */
export function arrow(ctx, x1, y1, x2, y2, color, opts = {}) {
  const { width = 2, head = 9, label, dash, font = '600 14px system-ui, sans-serif' } = opts;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (len > 0.5) {
    const ux = dx / len, uy = dy / len;
    const h = Math.min(head, len * 0.6);
    ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * h * 0.8, y2 - uy * h * 0.8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * h - uy * h * 0.45, y2 - uy * h + ux * h * 0.45);
    ctx.lineTo(x2 - ux * h + uy * h * 0.45, y2 - uy * h - ux * h * 0.45);
    ctx.closePath(); ctx.fill();
  }
  if (label) {
    const [ox, oy] = opts.labelOffset || [8, -8];
    ctx.font = font; ctx.textBaseline = 'middle';
    text(ctx, label, x2 + ox, y2 + oy, color, { font });
  }
  ctx.restore();
}

/**
 * Текст с простыми индексами: 'v_x', 'a_{цс}', 'F_{тр}', 'x^2'. Вектор: префикс '→' рисует стрелку над буквой ('→v').
 * opts: { font, align: 'left'|'center'|'right', baseline }
 */
export function text(ctx, str, x, y, color, opts = {}) {
  const { font = '14px system-ui, sans-serif', align = 'left', baseline = 'middle' } = opts;
  ctx.save();
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = baseline;
  let vec = false;
  if (str.startsWith('→')) { vec = true; str = str.slice(1); }
  const parts = [];
  const re = /([_^])(\{([^}]*)\}|(.))/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) parts.push({ t: str.slice(last, m.index), k: 'n' });
    parts.push({ t: m[3] ?? m[4], k: m[1] === '_' ? 'sub' : 'sup' });
    last = re.lastIndex;
  }
  if (last < str.length) parts.push({ t: str.slice(last), k: 'n' });
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] || 14);
  const small = font.replace(/(\d+(?:\.\d+)?)px/, `${Math.round(size * 0.72)}px`);
  const widths = parts.map((p) => { ctx.font = p.k === 'n' ? font : small; return ctx.measureText(p.t).width; });
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const startX = cx;
  parts.forEach((p, i) => {
    ctx.font = p.k === 'n' ? font : small;
    const dy = p.k === 'sub' ? size * 0.3 : p.k === 'sup' ? -size * 0.4 : 0;
    ctx.fillText(p.t, cx, y + dy);
    cx += widths[i];
  });
  if (vec) {
    const w0 = widths[0] || total;
    const ay = y - size * 0.75;
    ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(startX, ay); ctx.lineTo(startX + w0, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(startX + w0, ay); ctx.lineTo(startX + w0 - 3, ay - 2.5); ctx.moveTo(startX + w0, ay); ctx.lineTo(startX + w0 - 3, ay + 2.5); ctx.stroke();
  }
  ctx.restore();
  return total;
}

/**
 * Координатная плоскость графика в прямоугольнике rect = {x, y, w, h}.
 * opts: { xMin, xMax, yMin, yMax, xLabel, yLabel, xTicks, yTicks (шаг), grid=true, origin=true }
 * Возвращает { X(x)->px, Y(y)->px, rect, opts }.
 */
export function graph(ctx, rect, opts) {
  const c = colors();
  const { xMin, xMax, yMin, yMax, xLabel = '', yLabel = '', grid = true } = opts;
  const X = (v) => rect.x + ((v - xMin) / (xMax - xMin)) * rect.w;
  const Y = (v) => rect.y + rect.h - ((v - yMin) / (yMax - yMin)) * rect.h;
  const xt = opts.xTicks || niceStep(xMax - xMin);
  const yt = opts.yTicks || niceStep(yMax - yMin);
  ctx.save();
  ctx.font = '11px system-ui, sans-serif';
  if (grid) {
    ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let v = Math.ceil(xMin / xt) * xt; v <= xMax + 1e-9; v += xt) { const px = Math.round(X(v)) + 0.5; ctx.moveTo(px, rect.y); ctx.lineTo(px, rect.y + rect.h); }
    for (let v = Math.ceil(yMin / yt) * yt; v <= yMax + 1e-9; v += yt) { const py = Math.round(Y(v)) + 0.5; ctx.moveTo(rect.x, py); ctx.lineTo(rect.x + rect.w, py); }
    ctx.stroke();
  }
  // оси через 0 (или по краю)
  const ax0 = yMin <= 0 && yMax >= 0 ? Y(0) : rect.y + rect.h;
  const ay0 = xMin <= 0 && xMax >= 0 ? X(0) : rect.x;
  arrow(ctx, rect.x, ax0, rect.x + rect.w + 10, ax0, c.text, { width: 1.3, head: 7 });
  arrow(ctx, ay0, rect.y + rect.h, ay0, rect.y - 10, c.text, { width: 1.3, head: 7 });
  ctx.fillStyle = c.muted;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let v = Math.ceil(xMin / xt) * xt; v <= xMax + 1e-9; v += xt) {
    if (Math.abs(v) < 1e-9 && ay0 === X(0)) continue;
    ctx.fillText(fmt(v, 2), X(v), ax0 + 3);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (let v = Math.ceil(yMin / yt) * yt; v <= yMax + 1e-9; v += yt) {
    if (Math.abs(v) < 1e-9) { ctx.fillText('0', ay0 - 4, ax0 + 7); continue; }
    ctx.fillText(fmt(v, 2), ay0 - 4, Y(v));
  }
  ctx.restore();
  if (xLabel) text(ctx, xLabel, rect.x + rect.w + 4, ax0 - 12, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'right' });
  if (yLabel) text(ctx, yLabel, ay0 + 8, rect.y - 6, c.text, { font: 'italic 13px system-ui, sans-serif' });
  return { X, Y, rect, opts };
}

/** «Красивый» шаг сетки для диапазона. */
export function niceStep(range, target = 5) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

/** Ломаная/кривая по функции f(x) на графике g (из graph()). */
export function plotFn(ctx, g, f, color, { from = g.opts.xMin, to = g.opts.xMax, n = 200, width = 2, dash } = {}) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= n; i++) {
    const x = from + ((to - from) * i) / n;
    const y = f(x);
    if (!Number.isFinite(y)) { started = false; continue; }
    const px = g.X(x), py = g.Y(y);
    if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** Точка-маркер. */
export function dot(ctx, x, y, color, r = 4) {
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/**
 * Анимационный цикл. step(dt) вызывается каждый кадр (dt в секундах, ≤ 0.05).
 * При prefers-reduced-motion autoplay игнорируется — пользователь запускает кнопкой.
 * Возвращает { start, stop, toggle, get running, destroy }.
 */
export function animator(step, { autoplay = false } = {}) {
  let raf = 0, last = 0, running = false;
  const frame = (t) => {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    step(dt);
    if (running) raf = requestAnimationFrame(frame);
  };
  const api = {
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    toggle() { running ? api.stop() : api.start(); return running; },
    get running() { return running; },
    destroy() { api.stop(); },
  };
  const onVis = () => { if (document.hidden && running) { api.stop(); api._paused = true; } else if (!document.hidden && api._paused) { api._paused = false; api.start(); } };
  document.addEventListener('visibilitychange', onVis);
  const d = api.destroy;
  api.destroy = () => { d(); document.removeEventListener('visibilitychange', onVis); };
  if (autoplay && !prefersReducedMotion()) api.start();
  return api;
}

/** Кнопка «Пуск/Пауза», связанная с animator. */
export function playButton(parent, anim) {
  const b = button(parent, anim.running ? 'Пауза' : 'Пуск', () => { anim.toggle(); sync(); });
  b.classList.add('model-btn--play');
  const sync = () => { b.textContent = anim.running ? 'Пауза' : 'Пуск'; b.setAttribute('aria-pressed', String(anim.running)); };
  sync();
  return { el: b, sync };
}

export const deg = (a) => (a * Math.PI) / 180;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
