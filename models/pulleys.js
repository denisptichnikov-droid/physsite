// Модель «Системы тел с нитями и блоками».
// Нити невесомые и нерастяжимые, блоки невесомые и без трения (CLAUDE.md, B6: T₁ = T₂ = T; неподвижный блок — a₁ = a₂;
// подвижный блок — выигрыш в силе в 2 раза, проигрыш в расстоянии в 2 раза: a₂ = 2a₁). Законы: 1.2.4 m→a = Σ→F, 1.2.8 F_тр = μN.
//  (1) Машина Атвуда: a = |m₁ − m₂|g/(m₁ + m₂), T = 2m₁m₂g/(m₁ + m₂).
//  (2) Брусок m₁ на столе + груз m₂: если m₂g ≤ μm₁g — покой (a = 0, T = m₂g, F_тр.покоя = m₂g);
//      иначе a = (m₂ − μm₁)g/(m₁ + m₂), T = m₂(g − a), F_тр = μm₁g.
//  (3) Подвижный блок (нумерация как в content/mechanics/newton-laws.md и B6: a₂ = 2a₁): m₁ — на подвижном блоке,
//      m₂ — на свободном конце нити, другой конец нити закреплён.
//      m₂: m₂g − T = m₂a₂; m₁: 2T − m₁g = m₁a₁; связь a₂ = 2a₁ ⇒ a₁ = (2m₂ − m₁)g/(4m₂ + m₁), T = m₂(g − a₂).
import * as L from './_lib.js';

const G = 10;
const DEF = { scheme: 'atwood', m1: 2, m2: 3, mu: 0.2 };
const LABEL_FONT = '600 14px system-ui, sans-serif';
const PX_PER_M = 40;
const snap = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

/** a1 — проекция ускорения m₁ на «своё» направление: схемы 1 и 3 — вниз, схема 2 — вправо. */
function solve(scheme, m1, m2, mu) {
  if (scheme === 'atwood') {
    const a1 = snap(((m1 - m2) * G) / (m1 + m2));
    return { a1, a2: a1, T: (2 * m1 * m2 * G) / (m1 + m2), rest: a1 === 0 };
  }
  if (scheme === 'table') {
    const rest = m2 <= mu * m1 + 1e-12;
    const a1 = rest ? 0 : ((m2 - mu * m1) * G) / (m1 + m2);
    return { a1, a2: a1, T: rest ? m2 * G : m2 * (G - a1), Ftr: rest ? m2 * G : mu * m1 * G, N: m1 * G, rest };
  }
  // схема 3: m1 — на подвижном блоке (ускорение вверх aP), m2 — на свободном конце (ускорение вниз aF = 2aP).
  // Поле a1 = aF — смещение для анимации (как в других схемах: «первое» тело на конце нити).
  const aP = snap(((2 * m2 - m1) * G) / (4 * m2 + m1));
  const aF = 2 * aP;
  return { a1: aF, aF, aP, T: m2 * (G - aF), rest: aP === 0 };
}

function hatchLine(ctx, x1, y1, x2, y2, color, side = 1) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len, nx = -uy * side, ny = ux * side;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath();
  for (let s = 4; s < len; s += 8) {
    const px = x1 + ux * s, py = y1 + uy * s;
    ctx.moveTo(px, py); ctx.lineTo(px + nx * 7 - ux * 5, py + ny * 7 - uy * 5);
  }
  ctx.stroke();
  ctx.restore();
}

export default {
  id: 'pulleys',
  title: 'Система тел: нити и блоки',
  codes: ['1.2.4', '1.2.5', '1.2.8'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Нити невесомые и нерастяжимые, блоки невесомые, трения в блоках нет — поэтому натяжение T одинаково по всей нити. '
        + 'Через неподвижный блок тела движутся с одинаковыми по модулю ускорениями; с подвижным блоком свободный конец нити проходит вдвое больший путь: a₂ = 2a₁ (тело 1 — на подвижном блоке, тело 2 — на свободном конце).',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.8, minHeight: 300, maxHeight: 520, label: 'Система грузов, связанных нитью через блоки, с силами и ускорениями' });
    d.add(cv.destroy);

    let tau = 0, hold = 0, atEnd = false;
    const restart = () => { tau = 0; hold = 0; atEnd = false; };
    const changed = () => { restart(); sync(); draw(); };
    const ch = L.choice(ui.controls, {
      label: 'Схема',
      value: DEF.scheme,
      options: [
        { value: 'atwood', label: 'Два груза через неподвижный блок' },
        { value: 'table', label: 'Брусок на столе + висящий груз' },
        { value: 'movable', label: 'Подвижный блок' },
      ],
      onChange: changed,
    });
    const sM1 = L.slider(ui.controls, { label: 'Масса m<sub>1</sub>', min: 0.1, max: 5, step: 0.1, value: DEF.m1, unit: 'кг', onInput: changed });
    const sM2 = L.slider(ui.controls, { label: 'Масса m<sub>2</sub>', min: 0.1, max: 5, step: 0.1, value: DEF.m2, unit: 'кг', onInput: changed });
    const sMu = L.slider(ui.controls, { label: 'Коэффициент трения μ (брусок — стол)', min: 0, max: 1, step: 0.05, value: DEF.mu, onInput: changed });
    function sync() { sMu.el.style.display = ch.value === 'table' ? '' : 'none'; }

    const anim = L.animator((dt) => {
      const r = solve(ch.value, sM1.value, sM2.value, sMu.value);
      if (r.a1 === 0) tau = 0;
      else if (atEnd) { hold += dt; if (hold > 0.7) restart(); }
      else tau += dt;
      draw();
    });
    d.add(anim.destroy);
    const pb = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      anim.stop(); pb.sync();
      ch.set(DEF.scheme); sM1.set(DEF.m1); sM2.set(DEF.m2); sMu.set(DEF.mu);
      restart(); sync(); draw();
    }, { reset: true });

    const ro = L.readout(ui.readout);
    let lastRO = '';

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const scheme = ch.value, m1 = sM1.value, m2 = sM2.value, mu = sMu.value;
      const r = solve(scheme, m1, m2, mu);
      ctx.clearRect(0, 0, W, H);

      const bw = L.clamp(W * 0.11, 30, 52);
      const rp = L.clamp(bw * 0.75, 22, 38);
      const bh = (m) => bw * (0.6 + 0.5 * Math.sqrt(m / 5));
      const h1 = bh(m1), h2 = bh(m2);
      const Fpx = L.clamp(H * 0.15, 34, 80);

      // список сил для общего масштаба
      let Fmax = Math.max(m1 * G, m2 * G, Math.abs(r.T));
      if (scheme === 'table') Fmax = Math.max(Fmax, r.N, r.Ftr);
      const k = Fpx / Fmax;
      let s1 = (r.a1 * tau * tau) / 2 * PX_PER_M; // смещение m₁ в «своём» направлении, px

      const rope = (pts) => {
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1.3;
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        ctx.restore();
      };
      const ropeArc = (x, y, rr, a0, a1) => {
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(x, y, rr, a0, a1); ctx.stroke(); ctx.restore();
      };
      const pulley = (x, y) => {
        ctx.save();
        ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, rp - 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        L.dot(ctx, x, y, c.text, 3);
      };
      const box = (cx, cy, w, h, label) => {
        ctx.save();
        ctx.fillStyle = c.grid; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
        ctx.fillRect(cx - w / 2, cy - h / 2, w, h); ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
        ctx.restore();
        L.text(ctx, label, cx, cy, c.text, { font: 'italic 14px system-ui, sans-serif', align: 'center' });
      };
      const force = (x, y, ux, uy, F, label, off) => {
        const len = F * k;
        if (len < 2) return;
        L.arrow(ctx, x, y, x + ux * len, y + uy * len, c.force, { width: 2.2, label, labelOffset: off });
      };
      const weight = (x, y, m, idx) => {
        const len = m * G * k;
        L.arrow(ctx, x, y, x, y + len, c.force, { width: 2.2 });
        const w = L.text(ctx, `m_${idx}`, x + 6, y + len - 6, c.force, { font: LABEL_FONT });
        L.text(ctx, '→g', x + 6 + w, y + len - 6, c.force, { font: LABEL_FONT });
      };
      const accel = (x, y, ux, uy, a, label) => {
        if (Math.abs(a) < 1e-9) return;
        const len = L.clamp((Math.abs(a) / G) * 40, 12, 50);
        const sx = x - (ux * len) / 2, sy = y - (uy * len) / 2;
        L.arrow(ctx, sx, sy, sx + ux * len, sy + uy * len, c.accel, { width: 2.2, label, labelOffset: [ux < 0 ? -26 : 4, uy !== 0 ? 0 : -12] });
      };
      const limitTravel = (lim) => {
        const t = Math.max(6, lim);
        atEnd = Math.abs(s1) >= t;
        if (atEnd) s1 = Math.sign(s1) * t;
      };

      if (scheme === 'atwood') {
        const yc = 14;
        hatchLine(ctx, W / 2 - 60, yc, W / 2 + 60, yc, c.muted, -1);
        const px = W / 2, py = yc + 22 + rp;
        rope([[px, yc], [px, py]]);
        const yBase = py + rp + H * 0.22;
        const lim = Math.min(H * 0.16, s1 >= 0 ? H - 6 - Fpx - (yBase + h1 / 2) : H - 6 - Fpx - (yBase + h2 / 2), yBase - Math.max(h1, h2) / 2 - (py + 10));
        limitTravel(lim);
        const y1 = yBase + s1, y2 = yBase - s1;
        const x1 = px - rp, x2 = px + rp;
        rope([[x1, py], [x1, y1 - h1 / 2]]);
        rope([[x2, py], [x2, y2 - h2 / 2]]);
        ropeArc(px, py, rp, Math.PI, 2 * Math.PI);
        pulley(px, py);
        box(x1, y1, bw, h1, 'm_1');
        box(x2, y2, bw, h2, 'm_2');
        force(x1, y1 - h1 / 2, 0, -1, r.T, '→T', [-24, 2]);
        force(x2, y2 - h2 / 2, 0, -1, r.T, '→T', [6, 2]);
        weight(x1, y1 + h1 / 2, m1, 1);
        weight(x2, y2 + h2 / 2, m2, 2);
        accel(x1 - bw / 2 - 14, y1, 0, Math.sign(r.a1), r.a1, '→a_1');
        accel(x2 + bw / 2 + 14, y2, 0, -Math.sign(r.a1), r.a1, '→a_2');
      } else if (scheme === 'table') {
        const tableY = H * 0.38, tableR = W * 0.6;
        hatchLine(ctx, 6, tableY, tableR, tableY, c.muted, 1);
        hatchLine(ctx, tableR, tableY, tableR, H - 4, c.muted, 1);
        const hs = bw * 0.33;                       // высота крепления нити над столом
        const px = tableR + rp * 0.6, py = tableY - hs + rp;
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(tableR, tableY); ctx.lineTo(px, py); ctx.stroke(); ctx.restore();
        const w1 = bw * 1.25;
        const y2Base = tableY + H * 0.16;
        const travel = L.clamp(Math.min(W * 0.2, H - 6 - Fpx - (y2Base + h2 / 2)), 6, 160);
        limitTravel(travel);
        const x1Base = tableR - rp * 0.4 - 8 - w1 / 2 - travel;
        const x1 = x1Base + s1, y1 = tableY - h1 / 2;
        const x2 = px + rp, y2 = y2Base + s1;
        rope([[x1 + w1 / 2, tableY - hs], [px, py - rp]]);
        rope([[x2, py], [x2, y2 - h2 / 2]]);
        ropeArc(px, py, rp, 1.5 * Math.PI, 2 * Math.PI);
        pulley(px, py);
        box(x1, y1, w1, h1, 'm_1');
        box(x2, y2, bw, h2, 'm_2');
        force(x1, y1, 0, -1, r.N, '→N', [6, 0]);
        weight(x1, y1, m1, 1);
        force(x1 + w1 / 2, tableY - hs, 1, 0, r.T, '→T', [-8, -12]);
        force(x1 - w1 / 2, tableY - 3, -1, 0, r.Ftr, '→F_{тр}', [-14, -14]);
        force(x2, y2 - h2 / 2, 0, -1, r.T, '→T', [6, 2]);
        weight(x2, y2 + h2 / 2, m2, 2);
        accel(x1, y1 - h1 / 2 - 14, 1, 0, r.a1, '→a_1');
        accel(x2 + bw / 2 + 14, y2, 0, 1, r.a1, '→a_2');
        L.text(ctx, r.rest ? 'покой' : 'движение', 10, 14, r.rest ? c.muted : c.accel, { font: '600 13px system-ui, sans-serif' });
      } else {
        const yc = 14;
        const xm = W * 0.34, xf = xm + 2 * rp, yf = yc + 16 + rp;
        hatchLine(ctx, xm - rp - 30, yc, xf + 40, yc, c.muted, -1);
        rope([[xf, yc], [xf, yf]]);
        const hF = bh(m2), hP = bh(m1); // F — тело на свободном конце (m₂), P — на подвижном блоке (m₁)
        const ymBase = H * 0.4, y1Base = H * 0.55;
        const hang = rp + 10;
        let lim;
        if (r.a1 >= 0) lim = Math.min(H - 6 - Fpx - (y1Base + hF / 2), 2 * (ymBase - rp - (yc + 30)));
        else lim = Math.min(y1Base - hF / 2 - (yf + rp + 12), 2 * (H - 6 - Fpx - (ymBase + hang + hP)));
        limitTravel(Math.min(lim, 150));
        const ym = ymBase - s1 / 2, y1 = y1Base + s1;
        const x1 = xf + rp;
        rope([[xm - rp, yc], [xm - rp, ym]]);
        ropeArc(xm, ym, rp, 0, Math.PI);
        rope([[xm + rp, ym], [xf - rp, yf]]);
        ropeArc(xf, yf, rp, Math.PI, 2 * Math.PI);
        rope([[x1, yf], [x1, y1 - hF / 2]]);
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xm, ym); ctx.lineTo(xm, ym + hang); ctx.stroke(); ctx.restore();
        pulley(xf, yf);
        pulley(xm, ym);
        const y2 = ym + hang + hP / 2;
        box(x1, y1, bw, hF, 'm_2');
        box(xm, y2, bw, hP, 'm_1');
        force(x1, y1 - hF / 2, 0, -1, r.T, '→T', [6, 2]);
        weight(x1, y1 + hF / 2, m2, 2);
        force(xm - rp, ym, 0, -1, r.T, '→T', [-24, 2]);
        force(xm + rp, ym, 0, -1, r.T, '→T', [6, 2]);
        weight(xm, y2 + hP / 2, m1, 1);
        accel(x1 + bw / 2 + 14, y1, 0, Math.sign(r.aF), r.aF, '→a_2');
        accel(xm - bw / 2 - 14, y2, 0, -Math.sign(r.aP), r.aP, '→a_1');
        L.text(ctx, 'a₂ = 2a₁ (нить нерастяжима: Δl₂ = 2Δl₁)', 8, H - 10, c.accent, { font: '600 12px system-ui, sans-serif' });
      }

      // ---- числа ----
      let rows;
      const A = (x) => L.fmt(snap(x)) + ' м/с²', N = (x) => L.fmt(snap(x)) + ' Н';
      if (scheme === 'atwood') {
        rows = [
          ['a = |m<sub>1</sub> − m<sub>2</sub>|g / (m<sub>1</sub> + m<sub>2</sub>)', A(Math.abs(r.a1))],
          ['a<sub>1</sub> = a<sub>2</sub> (неподвижный блок)', r.a1 > 0 ? 'm₁ вниз, m₂ вверх' : r.a1 < 0 ? 'm₁ вверх, m₂ вниз' : 'a = 0 (m₁ = m₂)'],
          ['T = 2m<sub>1</sub>m<sub>2</sub>g / (m<sub>1</sub> + m<sub>2</sub>)', N(r.T)],
          ['m<sub>1</sub>g; m<sub>2</sub>g', `${N(m1 * G)}; ${N(m2 * G)}`],
        ];
      } else if (scheme === 'table') {
        rows = [
          ['m<sub>2</sub>g и μm<sub>1</sub>g', `${N(m2 * G)} и ${N(mu * m1 * G)}`],
          ['Режим', r.rest ? 'покой (m₂g ≤ μm₁g)' : 'движение (m₂g > μm₁g)'],
          [r.rest ? 'a' : 'a = (m<sub>2</sub> − μm<sub>1</sub>)g / (m<sub>1</sub> + m<sub>2</sub>)', A(r.a1)],
          [r.rest ? 'T = m<sub>2</sub>g' : 'T = m<sub>2</sub>(g − a)', N(r.T)],
          [r.rest ? 'F<sub>тр</sub> покоя = T = m<sub>2</sub>g' : 'F<sub>тр</sub> = μN = μm<sub>1</sub>g', N(r.Ftr)],
          ['N = m<sub>1</sub>g', N(r.N)],
        ];
      } else {
        rows = [
          ['a<sub>1</sub> = |2m<sub>2</sub> − m<sub>1</sub>|g / (4m<sub>2</sub> + m<sub>1</sub>) (груз на подвижном блоке)', A(Math.abs(r.aP))],
          ['a<sub>2</sub> = 2a<sub>1</sub> (свободный конец нити)', A(Math.abs(r.aF))],
          ['Направление', r.aF > 0 ? 'm₂ вниз, m₁ вверх' : r.aF < 0 ? 'm₂ вверх, m₁ вниз' : 'равновесие (m₁ = 2m₂)'],
          ['T = m<sub>2</sub>(g − a<sub>2x</sub>), ось x вниз', N(r.T)],
          ['2T (действует на подвижный блок)', N(2 * r.T)],
        ];
      }
      const key = JSON.stringify(rows);
      if (key !== lastRO) { lastRO = key; ro.set(rows); }
    }

    sync();
    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
