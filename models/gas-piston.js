// Модель «Газ под поршнем»: изопроцессы одноатомного идеального газа, синхронные pV-, pT-, VT-диаграммы.
// Формулы — CLAUDE.md, часть B: 2.1.10 (pV = νRT, U = 3/2·νRT), 2.1.12 (изопроцессы),
// 2.2.6 (A = pΔV, площадь под графиком), 2.2.7 (первый закон, Q для изопроцессов).
import * as L from './_lib.js';

const R = 8.31;            // Дж/(моль·К)
const NU = 1;              // количество вещества, моль (фиксировано)
const T0 = 300;            // начальная температура, К
const V0 = 0.02;           // начальный объём, м³ (20 л)
const P0 = (NU * R * T0) / V0; // начальное давление, Па (≈ 1,25·10⁵)
const V_LIM = [5, 40];     // диапазон V для изотермы, л
const T_LIM = [100, 600];  // диапазон T для изохоры и изобары, К
const N_PART = 48;         // число частиц в анимации (ν = const → N = const)
const V_VIS = 0.045;       // объём, соответствующий полной высоте цилиндра на рисунке, м³

const MODES = {
  T: { name: 'изотермический (T = const)', short: 'Изотерма: T = const' },
  V: { name: 'изохорный (V = const)', short: 'Изохора: V = const' },
  p: { name: 'изобарный (p = const)', short: 'Изобара: p = const' },
};

const SUPM = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
/** Число всегда в виде m·10ⁿ (d значащих цифр). */
function sci(x, d = 3) {
  if (!Number.isFinite(x)) return L.fmt(x);
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = +(x / 10 ** e).toFixed(d - 1);
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  const ms = L.fmt(m, d - 1);
  return e === 0 ? ms : `${ms}·10${String(e).split('').map((ch) => SUPM[ch]).join('')}`;
}
const en = (x) => L.fmt(Math.abs(x) < 0.05 ? 0 : x, 1); // энергия в Дж, 1 знак после запятой

/** Состояние газа по управляющему параметру x (V в литрах для изотермы, T в кельвинах иначе). */
function stateAt(mode, x) {
  if (mode === 'T') { const V = x / 1000; return { V, T: T0, p: (NU * R * T0) / V }; }
  if (mode === 'V') return { V: V0, T: x, p: (NU * R * x) / V0 };
  return { V: (NU * R * x) / P0, T: x, p: P0 };
}
const range = (mode) => (mode === 'T' ? V_LIM : T_LIM);
const start = (mode) => (mode === 'T' ? V0 * 1000 : T0);

/** Работа изотермы = площадь под гиперболой p(V) = νRT₀/V от Va до Vb (численно, формула Симпсона). */
function isoWork(Va, Vb) {
  const n = 200;
  const h = (Vb - Va) / n;
  if (h === 0) return 0;
  const f = (V) => (NU * R * T0) / V;
  let s = f(Va) + f(Vb);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(Va + i * h);
  return (s * h) / 3;
}

/** A газа, ΔU, Q для процесса 1 → текущее состояние (B2.2.6–2.2.7). */
function energies(mode, s) {
  const dT = s.T - T0;
  if (mode === 'T') { const A = isoWork(V0, s.V); return { A, dU: 0, Q: A }; }
  if (mode === 'V') { const dU = 1.5 * NU * R * dT; return { A: 0, dU, Q: dU }; }
  const A = P0 * (s.V - V0);
  return { A, dU: 1.5 * NU * R * dT, Q: 2.5 * NU * R * dT };
}

// Диаграммы: координаты в «удобных» единицах (л, кПа, К).
const DIAG = [
  { id: 'pV', xMax: 45, yMax: 550, xl: 'V, л', yl: 'p, кПа', xy: (s) => [s.V * 1000, s.p / 1000], prop: () => false },
  { id: 'pT', xMax: 650, yMax: 550, xl: 'T, К', yl: 'p, кПа', xy: (s) => [s.T, s.p / 1000], prop: (m) => m === 'V' },
  { id: 'VT', xMax: 650, yMax: 45, xl: 'T, К', yl: 'V, л', xy: (s) => [s.T, s.V * 1000], prop: (m) => m === 'p' },
];

function curve(ctx, g, P, a, b, color, width, dash) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const n = 80;
  for (let i = 0; i <= n; i++) {
    const q = P(a + ((b - a) * i) / n);
    const x = g.X(q[0]), y = g.Y(q[1]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Стрелка направления процесса посередине участка a → b. */
function midArrow(ctx, g, P, a, b, color) {
  if (Math.abs(b - a) < 1e-9) return;
  const q1 = P(a + (b - a) * 0.42), q2 = P(a + (b - a) * 0.58);
  const x1 = g.X(q1[0]), y1 = g.Y(q1[1]), x2 = g.X(q2[0]), y2 = g.Y(q2[1]);
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 2) return;
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  L.arrow(ctx, mx - ux * 8, my - uy * 8, mx + ux * 8, my + uy * 8, color, { width: 3, head: 10 });
}

export default {
  id: 'gas-piston',
  title: 'Газ под поршнем: изопроцессы',
  codes: ['2.1.10', '2.1.12', '2.2.6', '2.2.7'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Одноатомный идеальный газ, ν = 1 моль; начальное состояние 1: V₁ = 20 л, T₁ = 300 К. '
        + 'Число частиц на рисунке постоянно (ν = const), их скорость растёт как √T. '
        + 'Работа газа равна площади под графиком p(V) (закрашена); для изотермы она посчитана численно как площадь под гиперболой.',
    });
    const cv = L.canvas(ui.stage, { aspect: 1, minHeight: 320, maxHeight: 560, label: 'Цилиндр с газом под поршнем и диаграммы процесса pV, pT, VT' });
    d.add(cv.destroy);

    let mode = 'T';
    const ch = L.choice(ui.controls, {
      label: 'Процесс',
      options: [
        { value: 'T', label: 'изотермический' },
        { value: 'V', label: 'изохорный' },
        { value: 'p', label: 'изобарный' },
      ],
      value: 'T',
      onChange: (v) => { mode = v; sV.set(V0 * 1000); sT.set(T0); sync(); draw(); },
    });
    const sV = L.slider(ui.controls, { label: 'Объём V', min: V_LIM[0], max: V_LIM[1], step: 1, value: V0 * 1000, unit: 'л', onInput: () => draw() });
    const sT = L.slider(ui.controls, { label: 'Температура T', min: T_LIM[0], max: T_LIM[1], step: 10, value: T0, unit: 'К', onInput: () => draw() });
    const ro = L.readout(ui.readout);

    const cur = () => (mode === 'T' ? sV.value : sT.value);
    function sync() {
      sV.el.style.display = mode === 'T' ? '' : 'none';
      sT.el.style.display = mode === 'T' ? 'none' : '';
    }

    // Частицы: координаты нормированы на область газа (0..1), поэтому при сжатии плотность растёт.
    const parts = Array.from({ length: N_PART }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * Math.PI * 2 }));
    let box = { w: 100, h: 100 };
    function move(dt) {
      const T = stateAt(mode, cur()).T;
      const v = 45 * Math.sqrt(T / 300); // пикс/с, ~ √T
      const bw = Math.max(box.w, 1), bh = Math.max(box.h, 1);
      for (const q of parts) {
        q.x += (Math.cos(q.a) * v * dt) / bw;
        q.y += (Math.sin(q.a) * v * dt) / bh;
        if (q.x < 0) { q.x = -q.x; q.a = Math.PI - q.a; } else if (q.x > 1) { q.x = 2 - q.x; q.a = Math.PI - q.a; }
        if (q.y < 0) { q.y = -q.y; q.a = -q.a; } else if (q.y > 1) { q.y = 2 - q.y; q.a = -q.a; }
        q.x = L.clamp(q.x, 0, 1); q.y = L.clamp(q.y, 0, 1);
      }
    }

    const anim = L.animator((dt) => { move(dt); draw(); }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      mode = 'T';
      ch.set('T');
      sV.set(V0 * 1000); sT.set(T0);
      sync(); play.sync(); draw();
    }, { reset: true });

    function drawCylinder(ctx, r, s, e, c) {
      const cw = Math.min(r.w * 0.5, 120);
      const x0 = r.x + (r.w - cw) / 2;
      const top = r.y + 26, bottom = r.y + r.h - 30;
      const hMax = Math.max(20, bottom - top - 12);
      const gh = Math.max(8, (hMax * s.V) / V_VIS);
      const py = bottom - gh;

      L.text(ctx, MODES[mode].short, r.x + r.w / 2, r.y + 11, c.text, { font: '600 12px system-ui, sans-serif', align: 'center' });
      // газ
      ctx.save();
      ctx.globalAlpha = 0.12; ctx.fillStyle = c.accent;
      ctx.fillRect(x0 + 1, py, cw - 2, gh - 1);
      ctx.restore();
      box = { w: cw - 10, h: gh - 10 };
      for (const q of parts) L.dot(ctx, x0 + 5 + q.x * Math.max(box.w, 1), py + 5 + q.y * Math.max(box.h, 1), c.accent, 2.3);
      // стенки
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.lineTo(x0 + cw, bottom); ctx.lineTo(x0 + cw, top); ctx.stroke();
      // поршень
      ctx.fillStyle = c.muted;
      ctx.fillRect(x0 + 2, py - 8, cw - 4, 8);
      if (mode === 'p') {
        // груз на поршне — p = const
        const gw = cw * 0.5;
        ctx.fillRect(x0 + (cw - gw) / 2, py - 24, gw, 16);
        L.text(ctx, 'груз', x0 + cw / 2, py - 16, c.bg, { font: '10px system-ui, sans-serif', align: 'center' });
      } else {
        ctx.fillRect(x0 + cw / 2 - 2, Math.min(top - 8, py - 8), 4, Math.max(0, py - 8 - Math.min(top - 8, py - 8)));
      }
      if (mode === 'V') {
        // упоры над поршнем — V = const
        ctx.fillStyle = c.text;
        ctx.beginPath();
        ctx.moveTo(x0, py - 9); ctx.lineTo(x0 + 9, py - 9); ctx.lineTo(x0, py - 16); ctx.closePath();
        ctx.moveTo(x0 + cw, py - 9); ctx.lineTo(x0 + cw - 9, py - 9); ctx.lineTo(x0 + cw, py - 16); ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      L.text(ctx, `T = ${L.fmt(s.T, 0)} К`, x0 + cw / 2, Math.min(bottom - 10, py + gh / 2), c.text, { font: '600 12px system-ui, sans-serif', align: 'center' });
      // теплообмен: Q > 0 — газ получает теплоту, Q < 0 — отдаёт
      if (Math.abs(e.Q) > 0.05) {
        const ax = x0 + cw / 2;
        if (e.Q > 0) L.arrow(ctx, ax, bottom + 26, ax, bottom + 4, c.force, { width: 2.5, label: 'Q > 0', labelOffset: [8, 8], font: '600 12px system-ui, sans-serif' });
        else L.arrow(ctx, ax, bottom + 4, ax, bottom + 26, c.fieldB, { width: 2.5, label: 'Q < 0', labelOffset: [8, -8], font: '600 12px system-ui, sans-serif' });
      }
    }

    function drawDiagram(ctx, cell, sp, c) {
      const small = cell.w < 200;
      const left = small ? 30 : 38;
      const rect = { x: cell.x + left, y: cell.y + 24, w: cell.w - left - 20, h: cell.h - 24 - 22 };
      const g = L.graph(ctx, rect, {
        xMin: 0, xMax: sp.xMax, yMin: 0, yMax: sp.yMax, xLabel: sp.xl, yLabel: sp.yl,
        xTicks: L.niceStep(sp.xMax, rect.w < 140 ? 2 : 4), yTicks: L.niceStep(sp.yMax, rect.h < 120 ? 2 : 4),
      });
      const [a, b] = range(mode);
      const x0 = start(mode), x1 = cur();
      const P = (x) => sp.xy(stateAt(mode, x));
      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6); ctx.clip();
      if (sp.prop(mode)) {
        const q = P(a);
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(0)); ctx.lineTo(g.X(q[0]), g.Y(q[1])); ctx.stroke();
        ctx.restore();
      }
      if (sp.id === 'pV' && mode !== 'V' && x1 !== x0) {
        // площадь под графиком p(V) = работа газа
        ctx.save();
        ctx.globalAlpha = 0.2; ctx.fillStyle = c.accent;
        ctx.beginPath();
        const n = 60;
        const qa = P(x0);
        ctx.moveTo(g.X(qa[0]), g.Y(0));
        for (let i = 0; i <= n; i++) { const q = P(x0 + ((x1 - x0) * i) / n); ctx.lineTo(g.X(q[0]), g.Y(q[1])); }
        const qb = P(x1);
        ctx.lineTo(g.X(qb[0]), g.Y(0));
        ctx.closePath(); ctx.fill();
        ctx.restore();
        const wpx = Math.abs(g.X(qb[0]) - g.X(qa[0]));
        const pLow = Math.min(qa[1], qb[1]);
        const ty = (g.Y(0) + g.Y(pLow)) / 2;
        const lab = x1 > x0 ? 'A' : '|A|';
        if (wpx > 96) L.text(ctx, `${lab} = площадь`, (g.X(qa[0]) + g.X(qb[0])) / 2, ty, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
        else if (wpx > 22) L.text(ctx, lab, (g.X(qa[0]) + g.X(qb[0])) / 2, ty, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
      }
      curve(ctx, g, P, a, b, c.muted, 1.5);
      if (x1 !== x0) {
        curve(ctx, g, P, x0, x1, c.accent, 3);
        midArrow(ctx, g, P, x0, x1, c.accent);
      }
      ctx.restore();
      const q0 = P(x0), q1 = P(x1);
      L.dot(ctx, g.X(q0[0]), g.Y(q0[1]), c.text, 4);
      L.text(ctx, '1', g.X(q0[0]) + 6, g.Y(q0[1]) - 9, c.text, { font: '600 12px system-ui, sans-serif' });
      if (x1 !== x0) {
        L.dot(ctx, g.X(q1[0]), g.Y(q1[1]), c.accent, 5);
        L.text(ctx, '2', g.X(q1[0]) + 6, g.Y(q1[1]) - 9, c.accent, { font: '600 12px system-ui, sans-serif' });
      }
    }

    let lastKey = '';
    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const s = stateAt(mode, cur());
      const e = energies(mode, s);
      const hw = W / 2, hh = H / 2;
      const cells = [
        { x: 0, y: 0, w: hw, h: hh }, { x: hw, y: 0, w: hw, h: hh },
        { x: 0, y: hh, w: hw, h: hh }, { x: hw, y: hh, w: hw, h: hh },
      ];
      ctx.save();
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hw + 0.5, 6); ctx.lineTo(hw + 0.5, H - 6); ctx.moveTo(6, hh + 0.5); ctx.lineTo(W - 6, hh + 0.5); ctx.stroke();
      ctx.restore();
      drawCylinder(ctx, cells[0], s, e, c);
      DIAG.forEach((sp, i) => drawDiagram(ctx, cells[i + 1], sp, c));

      const key = `${mode}|${cur()}`;
      if (key === lastKey) return;
      lastKey = key;
      ro.set([
        ['Процесс', MODES[mode].name],
        ['Состояние 1', `p₁ = ${sci(P0)} Па, V₁ = ${sci(V0)} м³, T₁ = ${T0} К`],
        ['Давление p', `${sci(s.p)} Па`],
        ['Объём V', `${sci(s.V)} м³ (${L.fmt(s.V * 1000, 1)} л)`],
        ['Температура T', `${L.fmt(s.T, 0)} К (${L.fmt(s.T - 273, 0)} °C)`],
        ['pV/T (= νR = const)', `${L.fmt((s.p * s.V) / s.T, 2)} Дж/К`],
        ['U = 3/2·νRT', `${en(1.5 * NU * R * s.T)} Дж`],
        [mode === 'T' ? 'A газа (1→2) = площадь под графиком' : mode === 'V' ? 'A газа (1→2), изохора' : 'A газа (1→2) = pΔV', `${en(e.A)} Дж`],
        ['ΔU = 3/2·νRΔT', `${en(e.dU)} Дж`],
        [mode === 'T' ? 'Q = A (изотерма)' : mode === 'V' ? 'Q = 3/2·νRΔT' : 'Q = 5/2·νRΔT', `${en(e.Q)} Дж`],
      ]);
    }

    sync();
    cv.onResize(() => draw());
    d.add(L.onThemeChange(() => draw()));
    draw();
    return { destroy: d.run };
  },
};
