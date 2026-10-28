// Модель «Уровни энергии атома водорода (Бор)»: E_n = −13,6/n² эВ, переходы, серии, спектр.
// Формулы — CLAUDE.md, часть B, 4.2.2, 4.2.3, 4.1.2.
import * as L from './_lib.js';

const H = 6.6e-34;   // Дж·с
const C = 3e8;       // м/с
const EV = 1.6e-19;  // Дж
const E1 = 13.6;     // эВ, |E_1|
const LEVELS = [1, 2, 3, 4, 5, 6, Infinity];
const SERIES = { 1: 'Лаймана', 2: 'Бальмера', 3: 'Пашена', 4: 'Брэкета', 5: 'Пфунда', 6: 'Хамфри' };
const DEF = { from: '3', to: '2' };

const En = (n) => (Number.isFinite(n) ? -E1 / (n * n) : 0);           // эВ
const parseN = (v) => (v === 'inf' ? Infinity : Number(v));
const nStr = (n) => (Number.isFinite(n) ? String(n) : '∞');
/** λ (нм) перехода между уровнями n и m (по модулю разности энергий). */
const lamNm = (n, m) => {
  const dE = Math.abs(En(n) - En(m)) * EV;
  return dE > 0 ? ((H * C) / dE) * 1e9 : Infinity;
};
const region = (nm) => (nm < 380 ? 'УФ' : nm <= 780 ? 'видимый' : 'ИК');

/** Цвет света по длине волны (фиксированные цвета допустимы для света). */
function specColor(nm) {
  if (nm < 380 || nm > 780) return null;
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else { r = 1; }
  const f = nm < 420 ? 0.35 + 0.65 * (nm - 380) / 40 : nm > 700 ? 0.35 + 0.65 * (780 - nm) / 80 : 1;
  const k = (v) => Math.round(255 * Math.pow(v * f, 0.8));
  return `rgb(${k(r)}, ${k(g)}, ${k(b)})`;
}

let selUid = 0;
/** Локальный выпадающий список с <label> (в _lib.js его нет). */
function select(parent, { label, options, value, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'model-control';
  const id = `bohr-sel-${++selUid}-${Math.random().toString(36).slice(2, 7)}`;
  const lab = document.createElement('label');
  lab.htmlFor = id;
  const sp = document.createElement('span');
  sp.className = 'model-control__label';
  sp.innerHTML = label;
  lab.append(sp);
  const sel = document.createElement('select');
  sel.id = id;
  sel.className = 'model-select';
  for (const o of options) {
    const op = document.createElement('option');
    op.value = o.value; op.textContent = o.label;
    sel.append(op);
  }
  sel.value = value;
  sel.addEventListener('change', () => onChange?.(sel.value));
  wrap.append(lab, sel);
  parent.append(wrap);
  return { el: wrap, get value() { return sel.value; }, set(v) { sel.value = String(v); } };
}

export default {
  id: 'bohr-levels',
  title: 'Уровни энергии атома водорода',
  codes: ['4.2.1', '4.2.2', '4.2.3', '4.1.2'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Энергетические уровни атома водорода по Бору (масштаб по энергии нелинейный — чтобы различались верхние уровни). '
        + 'Клик по уровню: первый клик выбирает начальный уровень, второй — конечный. Стрелка вниз — излучение фотона, вверх — поглощение.',
    });
    const cvL = L.canvas(ui.stage, { aspect: 0.8, minHeight: 330, maxHeight: 480, label: 'Диаграмма уровней энергии атома водорода' });
    d.add(cvL.destroy);
    const cvS = L.canvas(ui.stage, { aspect: 0.2, minHeight: 100, maxHeight: 130, label: 'Спектральные линии выбранной серии' });
    d.add(cvS.destroy);
    cvL.canvas.style.cursor = 'pointer';

    const opts = LEVELS.map((n) => ({ value: Number.isFinite(n) ? String(n) : 'inf', label: `n = ${nStr(n)} (${L.fmt(En(n))} эВ)` }));
    const sFrom = select(ui.controls, { label: 'Начальный уровень n<sub>нач</sub>', options: opts, value: DEF.from, onChange: () => { nextPick = 'from'; update(); } });
    const sTo = select(ui.controls, { label: 'Конечный уровень n<sub>кон</sub>', options: opts, value: DEF.to, onChange: () => { nextPick = 'from'; update(); } });
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    let nextPick = 'from';
    let levelYs = []; // [{n, y}] для клика

    // геометрия диаграммы
    function geom() {
      const W = cvL.width, Hh = cvL.height;
      const top = 30, bottom = Hh - 22;
      const x0 = W < 420 ? 50 : 64;
      const x1 = W - (W < 420 ? 74 : 96);
      const yOf = (E) => top + Math.pow(-E / E1, 0.35) * (bottom - top);
      return { W, Hh, top, bottom, x0, x1, yOf };
    }

    function drawLevels() {
      const { ctx, width: W, height: Hh } = cvL;
      if (!W) return;
      const c = L.colors();
      const g = geom();
      const n1 = parseN(sFrom.value), n2 = parseN(sTo.value);
      const fs = W < 420 ? 11 : 13;
      const font = `${fs}px system-ui, sans-serif`;
      ctx.clearRect(0, 0, W, Hh);

      // область непрерывного спектра (E > 0)
      ctx.save();
      ctx.fillStyle = c.grid; ctx.globalAlpha = 0.45;
      ctx.fillRect(g.x0, 4, g.x1 - g.x0, g.top - 4);
      ctx.restore();
      L.text(ctx, 'E > 0: электрон свободен (ионизация)', (g.x0 + g.x1) / 2, (g.top + 4) / 2, c.muted, { font: `${fs - 1}px system-ui, sans-serif`, align: 'center' });

      // ось энергии
      L.arrow(ctx, g.x0 - 14, g.bottom + 12, g.x0 - 14, 6, c.text, { width: 1.3, head: 7 });
      L.text(ctx, 'E', g.x0 - 10, 10, c.text, { font: `italic ${fs + 1}px system-ui, sans-serif` });

      levelYs = [];
      for (const n of LEVELS) {
        const y = g.yOf(En(n));
        levelYs.push({ n, y });
        const sel = n === n1 || n === n2;
        ctx.save();
        ctx.strokeStyle = sel ? c.accent : Number.isFinite(n) ? c.text : c.muted;
        ctx.lineWidth = sel ? 3 : 1.6;
        if (!Number.isFinite(n)) ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(g.x0, y); ctx.lineTo(g.x1, y); ctx.stroke();
        ctx.restore();
        L.text(ctx, `n = ${nStr(n)}`, g.x0 - 20, y, sel ? c.accent : c.text, { font, align: 'right' });
        L.text(ctx, `${L.fmt(En(n))} эВ`, g.x1 + 6, y, sel ? c.accent : c.muted, { font });
      }

      if (n1 === n2) {
        L.text(ctx, 'выберите разные уровни', (g.x0 + g.x1) / 2, (g.yOf(En(2)) + g.yOf(En(1))) / 2, c.muted, { font, align: 'center' });
        return;
      }
      const emit = En(n1) > En(n2);
      const lam = lamNm(n1, n2);
      const col = specColor(lam) || (emit ? c.force : c.fieldB);
      const xa = g.x0 + (g.x1 - g.x0) * 0.38;
      const y1 = g.yOf(En(n1)), y2 = g.yOf(En(n2));
      if (specColor(lam)) { // обводка для контраста видимых цветов в обеих темах
        ctx.save(); ctx.globalAlpha = 0.45;
        L.arrow(ctx, xa, y1, xa, y2, c.text, { width: 5.5, head: 13 });
        ctx.restore();
      }
      L.arrow(ctx, xa, y1, xa, y2, col, { width: 3, head: 11 });
      // волнистая «фотон»-линия
      const ym = (y1 + y2) / 2;
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 1.8;
      ctx.beginPath();
      const wx0 = xa + 8, wx1 = xa + Math.min(70, (g.x1 - xa) * 0.45);
      for (let x = wx0; x <= wx1; x += 1) {
        const yy = ym + 4 * Math.sin(((x - wx0) / 7) * Math.PI);
        if (x === wx0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      ctx.restore();
      if (emit) L.arrow(ctx, wx1, ym, wx1 + 10, ym, col, { width: 1.8, head: 7 });
      else L.arrow(ctx, wx0 + 10, ym, wx0 - 2, ym, col, { width: 1.8, head: 7 });
      const dE = Math.abs(En(n1) - En(n2));
      L.text(ctx, `hν = ${L.fmt(dE)} эВ`, wx0, ym - 14, c.text, { font: `600 ${fs}px system-ui, sans-serif` });
      L.text(ctx, emit ? 'излучение' : 'поглощение', wx0, ym + 15, c.muted, { font });
    }

    function drawSpectrum() {
      const { ctx, width: W, height: Hs } = cvS;
      if (!W) return;
      const c = L.colors();
      const n1 = parseN(sFrom.value), n2 = parseN(sTo.value);
      const fs = W < 420 ? 11 : 12;
      const font = `${fs}px system-ui, sans-serif`;
      ctx.clearRect(0, 0, W, Hs);
      const m = Math.min(n1, n2);
      if (n1 === n2 || !Number.isFinite(m)) {
        L.text(ctx, 'Серия не определена: выберите разные уровни', W / 2, Hs / 2, c.muted, { font, align: 'center' });
        return;
      }
      // линии серии: n → m, n = m+1..6, и граница серии ∞ → m
      const lines = [];
      for (let n = m + 1; n <= 6; n++) lines.push({ n, lam: lamNm(n, m) });
      lines.push({ n: Infinity, lam: lamNm(Infinity, m) });
      const lamLo = Math.min(...lines.map((l) => l.lam));
      const lamHi = Math.max(...lines.map((l) => l.lam));
      const span = Math.max(lamHi - lamLo, lamHi * 0.2);
      const a = lamLo - span * 0.08, b = lamHi + span * 0.08;
      const rect = { x: 10, y: 20, w: W - 20, h: Hs - 20 - 24 };
      const X = (l) => rect.x + ((l - a) / (b - a)) * rect.w;

      L.text(ctx, `Серия ${SERIES[m]} (n → ${m}), λ в нм`, rect.x, 9, c.text, { font: `600 ${fs}px system-ui, sans-serif` });
      ctx.save();
      ctx.fillStyle = c.surface; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // видимый участок — радуга
      ctx.globalAlpha = 0.3;
      for (let px = 0; px < rect.w; px++) {
        const l = a + ((px + 0.5) / rect.w) * (b - a);
        const col = specColor(l);
        if (col) { ctx.fillStyle = col; ctx.fillRect(rect.x + px, rect.y, 1.2, rect.h); }
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
      ctx.restore();

      const selLam = lamNm(n1, n2);
      for (const ln of lines) {
        const x = X(ln.lam);
        const col = specColor(ln.lam) || c.muted;
        const isSel = Math.abs(ln.lam - selLam) < 1e-6;
        if (specColor(ln.lam)) { // обводка видимой линии цветом текста
          ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = c.text; ctx.lineWidth = isSel ? 6.5 : 4;
          ctx.beginPath(); ctx.moveTo(x, rect.y + 1); ctx.lineTo(x, rect.y + rect.h - 1); ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        ctx.strokeStyle = col; ctx.lineWidth = isSel ? 4 : 2;
        if (!Number.isFinite(ln.n)) ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(x, rect.y + 1); ctx.lineTo(x, rect.y + rect.h - 1); ctx.stroke();
        ctx.restore();
        if (isSel) {
          ctx.save();
          ctx.fillStyle = c.force;
          ctx.beginPath(); ctx.moveTo(x, rect.y + rect.h + 2); ctx.lineTo(x - 5, rect.y + rect.h + 10); ctx.lineTo(x + 5, rect.y + rect.h + 10); ctx.closePath(); ctx.fill();
          ctx.restore();
          const al = x > rect.x + rect.w * 0.75 ? 'right' : x < rect.x + rect.w * 0.25 ? 'left' : 'center';
          L.text(ctx, `${L.fmt(ln.lam, 1)} нм`, x, rect.y + rect.h + 17, c.force, { font: `600 ${fs}px system-ui, sans-serif`, align: al });
        }
      }
      // подписи краёв
      L.text(ctx, L.fmt(a, 0), rect.x, Hs - 4, c.muted, { font, align: 'left', baseline: 'bottom' });
      L.text(ctx, L.fmt(b, 0), rect.x + rect.w, Hs - 4, c.muted, { font, align: 'right', baseline: 'bottom' });
    }

    function updateReadout() {
      const n1 = parseN(sFrom.value), n2 = parseN(sTo.value);
      const f = L.fmt;
      const rows = [
        ['Переход', `n = ${nStr(n1)} → n = ${nStr(n2)}`],
        ['E<sub>нач</sub> = −13,6/n<sub>нач</sub>²', `${f(En(n1))} эВ`],
        ['E<sub>кон</sub> = −13,6/n<sub>кон</sub>²', `${f(En(n2))} эВ`],
      ];
      if (n1 === n2) {
        rows.push(['ΔE', 'переход не выбран (n_нач = n_кон)']);
      } else {
        const emit = En(n1) > En(n2);
        const dE = Math.abs(En(n1) - En(n2));
        const dEJ = dE * EV;
        const nu = dEJ / H;
        const lam = (H * C) / dEJ;
        const lamN = lam * 1e9;
        const m = Math.min(n1, n2);
        const big = Math.max(n1, n2);
        let proc;
        if (!Number.isFinite(n2)) proc = 'поглощение фотона — ионизация атома';
        else if (!Number.isFinite(n1)) proc = 'излучение фотона — захват свободного электрона';
        else proc = emit ? 'излучение фотона (стрелка вниз)' : 'поглощение фотона (стрелка вверх)';
        rows.push(
          ['Процесс', proc],
          ['ΔE = |E<sub>нач</sub> − E<sub>кон</sub>|', `${f(dE)} эВ = ${f(dEJ)} Дж`],
          ['ν = ΔE/h', `${f(nu)} Гц`],
          ['λ = hc/ΔE', `${f(lamN, 1)} нм = ${f(lam)} м`],
          ['Серия', `${SERIES[m]} (n → ${m})${Number.isFinite(big) ? '' : ', граница серии'} — ${region(lamN)} диапазон`],
        );
      }
      rows.push(['Энергия ионизации из основного состояния', `13,6 эВ = ${f(E1 * EV)} Дж`]);
      if (Number.isFinite(n1)) rows.push([`Энергия ионизации с уровня n = ${n1}`, `${f(-En(n1))} эВ`]);
      ro.set(rows);
    }

    function update() {
      drawLevels();
      drawSpectrum();
      updateReadout();
    }

    function onClick(ev) {
      const r = cvL.canvas.getBoundingClientRect();
      const y = ev.clientY - r.top;
      let best = null, bd = Infinity;
      for (const lv of levelYs) {
        const dd = Math.abs(lv.y - y);
        if (dd < bd) { bd = dd; best = lv; }
      }
      if (!best || bd > 14) return;
      const v = Number.isFinite(best.n) ? String(best.n) : 'inf';
      if (nextPick === 'from') { sFrom.set(v); nextPick = 'to'; }
      else { sTo.set(v); nextPick = 'from'; }
      update();
    }
    cvL.canvas.addEventListener('click', onClick);
    d.add(() => cvL.canvas.removeEventListener('click', onClick));

    function reset() {
      sFrom.set(DEF.from);
      sTo.set(DEF.to);
      nextPick = 'from';
      update();
    }

    cvL.onResize(drawLevels);
    cvS.onResize(drawSpectrum);
    d.add(L.onThemeChange(update));
    update();
    return { destroy: d.run };
  },
};
