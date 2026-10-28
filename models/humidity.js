// Модель «Насыщенный пар»: изотермическое сжатие водяного пара под поршнем, конденсация, относительная влажность.
// Формулы — CLAUDE.md, часть B: 2.1.10 (pV = (m/μ)RT), 2.1.13 (p_нас не зависит от V), 2.1.14 (φ = p/p_нас·100 %).
// Табличные p_нас — CHECK в docs/humidity.md.
import * as L from './_lib.js';

const R = 8.31;
const MU = 0.018;      // кг/моль
const V0 = 0.01;       // начальный объём, м³ (10 л)
const TABLE = [
  { t: 10, p: 1230 }, { t: 20, p: 2340 }, { t: 30, p: 4240 },
  { t: 40, p: 7380 }, { t: 50, p: 12300 }, { t: 100, p: 101300 },
];
const DEF = { t: '20', phi0: 40, V: 10 };
const N_MAX = 44;

const SUPM = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sci(x, d = 3) {
  if (!Number.isFinite(x)) return L.fmt(x);
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = +(x / 10 ** e).toFixed(d - 1);
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  const ms = L.fmt(m, d - 1);
  return e === 0 ? ms : `${ms}·10${String(e).split('').map((ch) => SUPM[ch]).join('')}`;
}
const pa = (x) => (x >= 1e5 ? sci(x, 4) : L.fmt(x, 0));

/** Состояние при объёме V (м³). */
function calc(tC, phi0, V) {
  const row = TABLE.find((r) => r.t === tC) || TABLE[1];
  const T = tC + 273;
  const pn = row.p;
  const p0 = (phi0 / 100) * pn;
  const Vs = V0 * (phi0 / 100);                 // объём, при котором пар становится насыщенным
  const mTot = (p0 * V0 * MU) / (R * T);        // вся масса воды (пар + жидкость)
  let p, mv;
  if (V >= Vs) { p = (p0 * V0) / V; mv = mTot; }
  else { p = pn; mv = (pn * V * MU) / (R * T); }
  const mw = Math.max(0, mTot - mv);
  return { T, pn, p0, Vs, mTot, p: Math.min(p, pn), mv, mw, phi: (Math.min(p, pn) / pn) * 100 };
}

export default {
  id: 'humidity',
  title: 'Насыщенный пар: сжатие и конденсация',
  codes: ['2.1.13', '2.1.14', '2.1.15'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Водяной пар под поршнем сжимают при постоянной температуре. Пока пар ненасыщенный, p = p₀V₀/V растёт; '
        + 'когда p достигает p_нас, давление перестаёт меняться — лишний пар конденсируется. Слой воды на рисунке сильно увеличен.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 270, maxHeight: 460, label: 'Цилиндр с паром и график p(V)' });
    d.add(cv.destroy);

    let tC = +DEF.t;
    const ch = L.choice(ui.controls, {
      label: 'Температура t (T = const)',
      options: TABLE.map((r) => ({ value: String(r.t), label: `${r.t} °C` })),
      value: DEF.t,
      onChange: (v) => { tC = +v; draw(); },
    });
    const sPhi = L.slider(ui.controls, { label: 'Начальная влажность φ<sub>0</sub> (при V<sub>0</sub> = 10 л)', min: 10, max: 100, step: 5, value: DEF.phi0, unit: '%', onInput: () => draw() });
    const sV = L.slider(ui.controls, { label: 'Объём V', min: 1, max: 10, step: 0.1, value: DEF.V, unit: 'л', onInput: () => draw() });
    const ro = L.readout(ui.readout);

    const parts = Array.from({ length: N_MAX }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * Math.PI * 2 }));
    let box = { w: 100, h: 100 };
    const anim = L.animator((dt) => {
      const v = 40 * Math.sqrt((tC + 273) / 300);
      const bw = Math.max(box.w, 1), bh = Math.max(box.h, 1);
      for (const q of parts) {
        q.x += (Math.cos(q.a) * v * dt) / bw; q.y += (Math.sin(q.a) * v * dt) / bh;
        if (q.x < 0) { q.x = -q.x; q.a = Math.PI - q.a; } else if (q.x > 1) { q.x = 2 - q.x; q.a = Math.PI - q.a; }
        if (q.y < 0) { q.y = -q.y; q.a = -q.a; } else if (q.y > 1) { q.y = 2 - q.y; q.a = -q.a; }
        q.x = L.clamp(q.x, 0, 1); q.y = L.clamp(q.y, 0, 1);
      }
      draw();
    }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      tC = +DEF.t; ch.set(DEF.t); sPhi.set(DEF.phi0); sV.set(DEF.V); play.sync(); draw();
    }, { reset: true });

    function drawCylinder(ctx, r, s, c) {
      const cw = Math.min(r.w * 0.62, 110);
      const x0 = r.x + (r.w - cw) / 2;
      const top = r.y + 20, bottom = r.y + r.h - 24;
      const hMax = bottom - top - 10;
      const V = sV.value / 1000;
      const gh = Math.max(10, (hMax * V) / V0);
      const py = bottom - gh;
      const frac = s.mTot > 0 ? s.mw / s.mTot : 0;
      const wh = frac * Math.min(14, gh * 0.4); // слой воды (условно увеличен)
      ctx.save();
      ctx.globalAlpha = 0.1; ctx.fillStyle = c.accent; ctx.fillRect(x0 + 1, py, cw - 2, gh - wh);
      ctx.globalAlpha = 0.55; ctx.fillStyle = c.fieldB; ctx.fillRect(x0 + 1, bottom - wh, cw - 2, wh);
      ctx.restore();
      box = { w: cw - 10, h: Math.max(1, gh - wh - 10) };
      const n = Math.round(N_MAX * (s.mTot > 0 ? s.mv / s.mTot : 1));
      for (let i = 0; i < n; i++) {
        const q = parts[i];
        L.dot(ctx, x0 + 5 + q.x * box.w, py + 5 + q.y * box.h, c.accent, 2.3);
      }
      // капли на стенках
      const drops = Math.ceil(8 * frac);
      for (let i = 0; i < drops; i++) {
        const y = py + 8 + ((i * 0.37) % 1) * Math.max(1, gh - wh - 16);
        L.dot(ctx, i % 2 ? x0 + 4 : x0 + cw - 4, y, c.fieldB, 2.8);
      }
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x0, bottom); ctx.lineTo(x0 + cw, bottom); ctx.lineTo(x0 + cw, top); ctx.stroke();
      ctx.fillStyle = c.muted;
      ctx.fillRect(x0 + 2, py - 8, cw - 4, 8);
      ctx.fillRect(x0 + cw / 2 - 2, top - 14, 4, Math.max(0, py - 8 - (top - 14)));
      ctx.restore();
      L.text(ctx, `t = ${tC} °C`, x0 + cw / 2, bottom + 13, c.text, { font: '600 12px system-ui, sans-serif', align: 'center' });
    }

    let lastKey = '';
    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const V = sV.value / 1000;
      const s = calc(tC, sPhi.value, V);
      const cylW = W < 480 ? W * 0.3 : W * 0.32;
      drawCylinder(ctx, { x: 0, y: 0, w: cylW, h: H }, s, c);

      const left = cylW + (W < 480 ? 34 : 46);
      const rect = { x: left, y: 26, w: W - left - 22, h: H - 26 - 24 };
      const yMax = (s.pn * 1.3) / 1000;
      const g = L.graph(ctx, rect, {
        xMin: 0, xMax: 10.5, yMin: 0, yMax, xLabel: 'V, л', yLabel: 'p, кПа',
        xTicks: rect.w < 200 ? 5 : 2, yTicks: L.niceStep(yMax, rect.h < 160 ? 3 : 5),
      });
      const pk = (Vl) => calc(tC, sPhi.value, Vl / 1000).p / 1000;
      const p0V0 = s.p0 * V0; // Дж = кПа·л
      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x, rect.y - 4, rect.w + 6, rect.h + 4); ctx.clip();
      // линия p_нас
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(s.pn / 1000)); ctx.lineTo(g.X(10.5), g.Y(s.pn / 1000)); ctx.stroke();
      // гипербола без конденсации (что было бы)
      const VsL = s.Vs * 1000;
      if (VsL > 1) {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) { const Vl = 1 + ((VsL - 1) * i) / 60; const y = g.Y(Math.min(p0V0 / Vl, yMax * 2)); if (i) ctx.lineTo(g.X(Vl), y); else ctx.moveTo(g.X(Vl), y); }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // полный график процесса и пройденная часть
      const path = (a, b, color, w) => {
        const vs = [];
        for (let i = 0; i <= 120; i++) vs.push(a + ((b - a) * i) / 120);
        if (VsL < a && VsL > b) vs.push(VsL);
        vs.sort((x, y) => y - x);
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath();
        vs.forEach((Vl, i) => { const x = g.X(Vl), y = g.Y(pk(Vl)); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.stroke();
      };
      path(10, 1, c.muted, 1.5);
      if (sV.value < 10) path(10, sV.value, c.accent, 3);
      ctx.restore();
      L.text(ctx, 'p_{нас}', rect.x + 6, g.Y(s.pn / 1000) - 10, c.muted, { font: '12px system-ui, sans-serif' });
      if (sV.value < 9.9) {
        const m = (10 + sV.value) / 2;
        const xa = g.X(m + 0.3), xb = g.X(m - 0.3);
        L.arrow(ctx, xa, g.Y(pk(m + 0.3)), xb, g.Y(pk(m - 0.3)), c.accent, { width: 2.5, head: 10 });
      }
      L.dot(ctx, g.X(10), g.Y(pk(10)), c.text, 4);
      L.text(ctx, '1', g.X(10) + 2, g.Y(pk(10)) - 12, c.text, { font: '600 12px system-ui, sans-serif' });
      L.dot(ctx, g.X(sV.value), g.Y(s.p / 1000), c.accent, 5);

      const key = `${tC}|${sPhi.value}|${sV.value}`;
      if (key === lastKey) return;
      lastKey = key;
      const sat = V < s.Vs - 1e-12 || sPhi.value >= 100;
      ro.set([
        ['Температура', `${s.T} К (${tC} °C)`],
        ['Объём V', `${sci(V)} м³ (${L.fmt(sV.value, 1)} л)`],
        ['p<sub>пара</sub>', `${pa(s.p)} Па`],
        ['p<sub>нас</sub> (табл.)', `${pa(s.pn)} Па`],
        ['φ = p/p<sub>нас</sub>·100 %', `${L.fmt(s.phi, 1)} %`],
        ['Состояние', sat ? 'пар насыщенный, при сжатии идёт конденсация' : 'пар ненасыщенный, p = p₀V₀/V'],
        ['m<sub>пара</sub> = p<sub>пара</sub>Vμ/(RT)', `${sci(s.mv)} кг`],
        ['m<sub>воды</sub> (сконденсировалось)', `${s.mw > 0 ? sci(s.mw) : '0'} кг`],
        ['Полная масса (из p₀V₀)', `${sci(s.mTot)} кг`],
      ]);
    }

    cv.onResize(() => draw());
    d.add(L.onThemeChange(() => draw()));
    draw();
    return { destroy: d.run };
  },
};
