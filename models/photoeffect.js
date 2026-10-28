// Модель «Фотоэффект»: фотоэлемент, уравнение Эйнштейна, ВАХ, красная граница.
// Формулы — CLAUDE.md, часть B, 4.1.1, 4.1.2, 4.1.4.
import * as L from './_lib.js';

const H = 6.6e-34;   // постоянная Планка, Дж·с
const C = 3e8;       // скорость света, м/с
const E = 1.6e-19;   // модуль заряда электрона, Кл
const EV = 1.6e-19;  // 1 эВ, Дж
const ME = 9.1e-31;  // масса электрона, кг

// Работа выхода (табличные приблизительные значения, эВ) — CHECK в docs.
const METALS = [
  { value: 'Cs', name: 'цезий', A: 1.9 },
  { value: 'K', name: 'калий', A: 2.2 },
  { value: 'Na', name: 'натрий', A: 2.3 },
  { value: 'Zn', name: 'цинк', A: 4.2 },
  { value: 'Pt', name: 'платина', A: 5.3 },
];

const U_SAT = 1;          // напряжение выхода на насыщение, В (условно, только для формы ВАХ)
const N_PER_PCT = 1e12;   // фотоэлектронов в 1 с на 1 % интенсивности (условно)
const Y_MAX_UA = 18;      // верх оси тока, мкА
const SPEED = 0.9;        // масштаб скорости частиц в анимации
const DEF = { metal: 'K', lam: 400, inten: 50, U: 0 };

/** Цвет света по длине волны (фиксированные цвета допустимы для света). */
function specColor(nm) {
  if (nm < 380 || nm > 780) return null; // УФ/ИК — цвет из темы
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
const region = (nm) => (nm < 380 ? 'УФ' : nm > 780 ? 'ИК' : 'видимый');

export default {
  id: 'photoeffect',
  title: 'Фотоэффект',
  codes: ['4.1.1', '4.1.2', '4.1.3', '4.1.4'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Фотоэлемент: свет выбивает электроны из катода. Ток насыщения пропорционален интенсивности, '
        + 'запирающее напряжение и максимальная скорость электронов зависят только от частоты света и металла. '
        + 'Форма ВАХ между −Uзап и насыщением показана качественно; число частиц в анимации условно.',
    });
    const cvT = L.canvas(ui.stage, { aspect: 0.5, minHeight: 220, maxHeight: 360, label: 'Фотоэлемент: свет падает на катод, фотоэлектроны летят к аноду' });
    d.add(cvT.destroy);
    const cvG = L.canvas(ui.stage, { aspect: 0.5, minHeight: 210, maxHeight: 320, label: 'Вольт-амперная характеристика фотоэлемента I(U)' });
    d.add(cvG.destroy);

    const metal = L.choice(ui.controls, {
      label: 'Металл катода (A<sub>вых</sub>)',
      options: METALS.map((m) => ({ value: m.value, label: `${m.name} (${L.fmt(m.A)} эВ)` })),
      value: DEF.metal,
      onChange: update,
    });
    const sLam = L.slider(ui.controls, {
      label: 'Длина волны λ', min: 100, max: 800, step: 5, value: DEF.lam,
      format: (v) => `${L.fmt(v, 0)} нм (${region(v)})`, onInput: update,
    });
    const sI = L.slider(ui.controls, { label: 'Интенсивность света', min: 0, max: 100, step: 5, value: DEF.inten, unit: '%', onInput: update });
    const sU = L.slider(ui.controls, {
      label: 'Напряжение U = φ<sub>анода</sub> − φ<sub>катода</sub>', min: -12, max: 12, step: 0.1, value: DEF.U,
      format: (v) => L.fmt(v, 1), unit: 'В', onInput: update,
    });

    let parts = [];
    let acc = 0;
    const anim = L.animator(step, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    function phys() {
      const m = METALS.find((x) => x.value === metal.value) || METALS[0];
      const lamNm = sLam.value;
      const lam = lamNm * 1e-9;           // м
      const nu = C / lam;                 // Гц
      const Eph = H * nu;                 // Дж, E = hν = hc/λ
      const A = m.A * EV;                 // Дж
      const nuKr = A / H;                 // A = hν_кр
      const lamKr = (H * C) / A;          // A = hc/λ_кр
      const Ek = Eph - A;                 // E_кин max = hν − A
      const has = Ek > 0;
      const Uz = has ? Ek / E : 0;        // eU_зап = E_кин max
      const v = has ? Math.sqrt((2 * Ek) / ME) : 0;
      const n = has ? sI.value * N_PER_PCT : 0; // фотоэлектронов в 1 с
      const Isat = E * n;                 // I_нас = e·n
      return { m, lamNm, lam, nu, Eph, A, nuKr, lamKr, Ek, has, Uz, v, n, Isat };
    }

    /** Ток при напряжении U (А): 0 при U ≤ −U_зап, I_нас при U ≥ U_SAT, между — гладкий рост (качественно). */
    function current(U, p) {
      if (!p.has || p.Isat <= 0) return 0;
      if (U <= -p.Uz) return 0;
      if (U >= U_SAT) return p.Isat;
      const x = (U + p.Uz) / (p.Uz + U_SAT);
      return p.Isat * (1 - (1 - x) * (1 - x));
    }

    function spawn(p) {
      const E0 = (p.Ek / EV) * Math.random();          // эВ, от 0 до E_кин max
      const th = (Math.random() * 2 - 1) * 1.2;          // угол вылета к нормали
      const sp = SPEED * Math.sqrt(E0);
      parts.push({ x: 0.002, y: (Math.random() * 2 - 1) * 0.4, vx: sp * Math.cos(th), vy: sp * Math.sin(th) * 0.6, age: 0 });
    }

    function step(dt) {
      const p = phys();
      if (p.has && sI.value > 0) {
        acc += dt * 0.8 * sI.value; // ≤ 80 частиц/с
        while (acc >= 1 && parts.length < 400) { acc -= 1; spawn(p); }
        if (acc >= 1) acc = 0;
      } else acc = 0;
      // v_x² = S²(E0 cos²θ + U·x): поле между пластинами однородно
      const ax = (SPEED * SPEED * sU.value) / 2;
      for (const q of parts) {
        q.x += q.vx * dt + (ax * dt * dt) / 2;
        q.vx += ax * dt;
        q.y += q.vy * dt;
        q.age += dt;
      }
      parts = parts.filter((q) => q.x >= 0 && q.x <= 1 && Math.abs(q.y) <= 0.85 && q.age < 8);
      drawTube();
    }

    function drawTube() {
      const { ctx, width: W, height: Ht } = cvT;
      if (!W) return;
      const c = L.colors();
      const p = phys();
      const U = sU.value;
      ctx.clearRect(0, 0, W, Ht);
      const fs = W < 420 ? 11 : 13;
      const font = `${fs}px system-ui, sans-serif`;
      const cx = W * 0.54, cy = Ht * 0.44, rx = W * 0.32, ry = Ht * 0.29;
      const xc = cx - rx * 0.62, xa = cx + rx * 0.62;
      const ys = ry * 0.88;
      const X = (x) => xc + x * (xa - xc);
      const Y = (y) => cy + y * ys;
      const yW = Ht - 22; // нижний провод

      // колба
      ctx.save();
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.muted; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // цепь: выводы, источник, амперметр
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xc, Y(0.45)); ctx.lineTo(xc, yW); ctx.lineTo(cx - 5, yW);
      ctx.moveTo(cx + 5, yW); ctx.lineTo(xa, yW); ctx.lineTo(xa, Y(0.6));
      ctx.stroke();
      // источник: длинная пластина «+», короткая «−»
      const plusRight = U >= 0;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const hl = 11, hs = 6;
      ctx.moveTo(cx - 5, yW - (plusRight ? hs : hl)); ctx.lineTo(cx - 5, yW + (plusRight ? hs : hl));
      ctx.moveTo(cx + 5, yW - (plusRight ? hl : hs)); ctx.lineTo(cx + 5, yW + (plusRight ? hl : hs));
      ctx.stroke();
      ctx.restore();
      L.text(ctx, plusRight ? '−' : '+', cx - 12, yW - 12, c.text, { font, align: 'center' });
      L.text(ctx, plusRight ? '+' : '−', cx + 12, yW - 12, c.text, { font, align: 'center' });
      L.text(ctx, `U = ${L.fmt(U, 1)} В`, cx, yW + 15, c.text, { font, align: 'center' });
      // амперметр
      const xA = (cx + 5 + xa) / 2;
      ctx.save();
      ctx.fillStyle = c.bg; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(xA, yW, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'A', xA, yW + 1, c.text, { font: `600 ${fs}px system-ui, sans-serif`, align: 'center' });

      // свет
      const lamNm = p.lamNm;
      const col = specColor(lamNm) || (lamNm < 380 ? c.accent : c.muted);
      const vis = lamNm >= 380 && lamNm <= 780;
      L.text(ctx, `λ = ${L.fmt(lamNm, 0)} нм (${region(lamNm)})`, 6, 11, c.text, { font });
      if (sI.value > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * (sI.value / 100);
        for (let i = 0; i < 4; i++) {
          const x1 = Math.max(4, xc - W * 0.26) + i * W * 0.03;
          const y1 = 26 + i * 3;
          if (vis) { // полупрозрачная обводка цветом текста — контраст в обеих темах
            ctx.save(); ctx.globalAlpha *= 0.45;
            L.arrow(ctx, x1, y1, xc - 3, Y(-0.33 + i * 0.2), c.text, { width: 4, head: 10 });
            ctx.restore();
          }
          L.arrow(ctx, x1, y1, xc - 3, Y(-0.33 + i * 0.2), col, { width: 2, head: 8, dash: vis ? null : [5, 4] });
        }
        ctx.restore();
      } else {
        L.text(ctx, 'свет выключен', 6, 28, c.muted, { font });
      }

      // катод и анод
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xc, Y(-0.45)); ctx.quadraticCurveTo(xc - 12, cy, xc, Y(0.45)); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(xa, Y(-0.6)); ctx.lineTo(xa, Y(0.6)); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'катод', xc - 10, Y(0.3), c.muted, { font, align: 'right' });
      L.text(ctx, p.m.name, xc - 10, Y(0.3) + fs + 2, c.muted, { font, align: 'right' });
      L.text(ctx, 'анод', xa + 8, Y(0.35), c.muted, { font });

      // электроны
      for (const q of parts) L.dot(ctx, X(q.x), Y(q.y), c.accent, 2.6);
      if (p.has && parts.length) L.text(ctx, 'e^−', xa + 8, Y(-0.35), c.accent, { font });

      if (!p.has) {
        L.text(ctx, 'фотоэффекта нет', cx, cy - fs * 0.7, c.force, { font: `600 ${fs}px system-ui, sans-serif`, align: 'center' });
        L.text(ctx, 'hν < A_{вых}', cx, cy + fs * 0.8, c.force, { font, align: 'center' });
      }
    }

    function drawGraph() {
      const { ctx, width: W, height: Hg } = cvG;
      if (!W) return;
      const c = L.colors();
      const p = phys();
      const U = sU.value;
      ctx.clearRect(0, 0, W, Hg);
      const xMin = -Math.max(2, Math.ceil(p.Uz * 1.25 + 0.2), Math.ceil(-U));
      const xMax = Math.max(3, Math.ceil(U));
      const rect = { x: 40, y: 24, w: W - 40 - 34, h: Hg - 24 - 28 };
      const g = L.graph(ctx, rect, { xMin, xMax, yMin: 0, yMax: Y_MAX_UA, xLabel: 'U, В', yLabel: 'I, мкА', yTicks: W < 420 ? 6 : 3 });
      const font = '12px system-ui, sans-serif';
      if (p.has && p.Isat > 0) {
        // −U_зап
        ctx.save();
        ctx.strokeStyle = c.force; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(g.X(-p.Uz), g.Y(0)); ctx.lineTo(g.X(-p.Uz), g.Y(Y_MAX_UA * 0.35)); ctx.stroke();
        // I_нас
        const yS = g.Y(p.Isat * 1e6);
        ctx.strokeStyle = c.muted;
        ctx.beginPath(); ctx.moveTo(g.X(xMin), yS); ctx.lineTo(g.X(xMax), yS); ctx.stroke();
        ctx.restore();
        L.text(ctx, '−U_{зап}', g.X(-p.Uz) - 3, g.Y(Y_MAX_UA * 0.35) - 8, c.force, { font, align: 'right' });
        L.text(ctx, 'I_{нас}', g.X(xMax) - 2, yS - 9, c.muted, { font, align: 'right' });
      } else if (!p.has) {
        L.text(ctx, 'фотоэффекта нет: I = 0 при любом U', rect.x + rect.w / 2, rect.y + rect.h * 0.4, c.force, { font, align: 'center' });
      }
      L.plotFn(ctx, g, (u) => current(u, p) * 1e6, c.accent, { n: 400, width: 2.5 });
      L.dot(ctx, g.X(U), g.Y(current(U, p) * 1e6), c.force, 5);
    }

    function updateReadout() {
      const p = phys();
      const U = sU.value;
      const I = current(U, p);
      const f = L.fmt;
      ro.set([
        ['Металл катода', p.m.name],
        ['λ', `${f(p.lamNm, 0)} нм = ${f(p.lam)} м`],
        ['ν = c/λ', `${f(p.nu)} Гц`],
        ['E<sub>ф</sub> = hν = hc/λ', `${f(p.Eph / EV)} эВ = ${f(p.Eph)} Дж`],
        ['A<sub>вых</sub>', `${f(p.m.A)} эВ = ${f(p.A)} Дж`],
        ['ν<sub>кр</sub> = A<sub>вых</sub>/h', `${f(p.nuKr)} Гц`],
        ['λ<sub>кр</sub> = hc/A<sub>вых</sub>', `${f(p.lamKr * 1e9, 1)} нм`],
        ['E<sub>кин max</sub> = hν − A<sub>вых</sub>', p.has ? `${f(p.Ek / EV)} эВ = ${f(p.Ek)} Дж` : 'фотоэффекта нет (hν ≤ Aвых)'],
        ['U<sub>зап</sub> = E<sub>кин max</sub>/e', p.has ? `${f(p.Uz)} В` : '—'],
        ['v<sub>max</sub> = √(2E<sub>кин max</sub>/m<sub>e</sub>)', p.has ? `${f(p.v)} м/с` : '—'],
        ['n (фотоэлектронов в 1 с)', p.has ? `${f(p.n)} с⁻¹` : '0'],
        ['I<sub>нас</sub> = e·n', `${f(p.Isat)} А`],
        [`I при U = ${f(U, 1)} В`, `${f(I)} А`],
      ]);
    }

    function update() {
      drawTube();
      drawGraph();
      updateReadout();
    }

    function reset() {
      metal.set(DEF.metal);
      sLam.set(DEF.lam);
      sI.set(DEF.inten);
      sU.set(DEF.U);
      parts = [];
      acc = 0;
      update();
      play.sync();
    }

    cvT.onResize(drawTube);
    cvG.onResize(drawGraph);
    d.add(L.onThemeChange(update));
    update();
    return { destroy: d.run };
  },
};
