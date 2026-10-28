// Модель «Математический и пружинный маятники» (1.5.1, 1.5.2).
import * as L from './_lib.js';

const G = 10; // м/с²
const PHI0 = Math.PI / 2; // начальная фаза: старт из крайнего положения, x(0) = A
const DEF = { type: 'math', l: 1, alpha: 10, m: 0.5, k: 50, A: 0.1, slow: false };
const FONT = 'italic 13px system-ui, sans-serif';
const SMALL = '12px system-ui, sans-serif';

function hatchH(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x1 + 7; x <= x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 7); }
  ctx.stroke();
  ctx.restore();
}
function hatchFloor(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x1 + 7; x <= x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke();
  ctx.restore();
}
function hatchV(ctx, x, y1, y2, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = y1; y <= y2 - 7; y += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke();
  ctx.restore();
}
function spring(ctx, x1, y1, x2, y2, color, coils = 8, amp = 6) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const lead = Math.min(8, len * 0.15), body = len - 2 * lead, n = coils * 2;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
  for (let i = 1; i < n; i++) {
    const s = lead + (body * i) / n, o = (i % 2 ? 1 : -1) * amp;
    ctx.lineTo(x1 + ux * s + nx * o, y1 + uy * s + ny * o);
  }
  ctx.lineTo(x2 - ux * lead, y2 - uy * lead); ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export default {
  id: 'pendulums',
  title: 'Математический и пружинный маятники',
  codes: ['1.5.1', '1.5.2'],
  mount(el) {
    const d = L.disposer();
    d.add(() => { el.innerHTML = ''; el.classList.remove('model'); });
    const ui = L.layout(el, {
      caption: 'Гармонические колебания x(t) = A·sin(ωt + φ₀), φ₀ = π/2 (маятник отпущен из крайнего положения). Графики x(t), v_x(t), a_x(t) синхронны с движением; столбики — E_к и E_п.',
    });
    const cv = L.canvas(ui.stage, { aspect: 1.3, maxHeight: 680, label: 'Маятник, графики x(t), v(t), a(t) и диаграмма энергий' });
    d.add(cv.destroy);

    let t = 0;

    const type = L.choice(ui.controls, {
      label: 'Маятник',
      options: [{ value: 'math', label: 'математический' }, { value: 'spring', label: 'пружинный' }],
      value: DEF.type,
      onChange: () => { syncVis(); restart(); },
    });
    const sL = L.slider(ui.controls, { label: 'Длина нити l', min: 0.1, max: 2.5, step: 0.05, value: DEF.l, unit: 'м', onInput: () => restart() });
    const sAl = L.slider(ui.controls, { label: 'Угол отклонения α<sub>0</sub>', min: 2, max: 40, step: 1, value: DEF.alpha, unit: '°', onInput: () => restart() });
    const sM = L.slider(ui.controls, { label: 'Масса m', min: 0.1, max: 2, step: 0.1, value: DEF.m, unit: 'кг', onInput: () => restart() });
    const sK = L.slider(ui.controls, { label: 'Жёсткость k', min: 10, max: 200, step: 5, value: DEF.k, unit: 'Н/м', onInput: () => restart() });
    const sA = L.slider(ui.controls, { label: 'Амплитуда A', min: 0.02, max: 0.2, step: 0.01, value: DEF.A, unit: 'м', onInput: () => restart() });
    const cbSlow = L.checkbox(ui.controls, { label: 'Замедлить в 5 раз', checked: DEF.slow });

    const anim = L.animator((dt) => { t += dt * (cbSlow.value ? 0.2 : 1); draw(); }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      type.set(DEF.type); sL.set(DEF.l); sAl.set(DEF.alpha); sM.set(DEF.m); sK.set(DEF.k); sA.set(DEF.A); cbSlow.set(DEF.slow);
      syncVis(); restart(); play.sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function syncVis() {
      const math = type.value === 'math';
      sL.el.style.display = math ? '' : 'none';
      sAl.el.style.display = math ? '' : 'none';
      sK.el.style.display = math ? 'none' : '';
      sA.el.style.display = math ? 'none' : '';
    }

    function calc() {
      const math = type.value === 'math';
      const m = sM.value;
      let w, A, l = null, alpha0 = null, k;
      if (math) {
        l = sL.value; alpha0 = sAl.value;
        w = Math.sqrt(G / l);            // ω = √(g/l)
        A = l * L.deg(alpha0);           // амплитуда смещения (дуга) при малом угле
        k = m * w * w;                   // «эффективная жёсткость» mg/l
      } else {
        k = sK.value; A = sA.value;
        w = Math.sqrt(k / m);            // ω = √(k/m)
      }
      const T = (2 * Math.PI) / w, nu = 1 / T;
      const vmax = w * A, amax = w * w * A;
      const E = (m * vmax * vmax) / 2;   // = kA²/2
      return { math, m, l, alpha0, k, w, A, T, nu, vmax, amax, E };
    }

    function state(r, tt) {
      const ph = r.w * tt + PHI0;
      const x = r.A * Math.sin(ph);
      const v = r.A * r.w * Math.cos(ph);
      const a = -r.w * r.w * x;
      return { x, v, a };
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const r = calc();
      const s = state(r, t);
      ctx.clearRect(0, 0, W, H);

      const sh = H * 0.34;          // высота сцены
      const barsW = Math.min(96, W * 0.28);
      const sceneW = W - barsW;

      // ---- сцена
      if (r.math) {
        const px = sceneW / 2, py = 14;
        hatchH(ctx, px - 46, px + 46, py, c.text);
        const Lpx = (sh - 34) * (0.35 + (0.65 * r.l) / 2.5);
        ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + Lpx + 14); ctx.stroke(); ctx.restore();
        const al = s.x / r.l; // угол, рад
        const bx = px + Lpx * Math.sin(al), by = py + Lpx * Math.cos(al);
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(bx, by); ctx.stroke(); ctx.restore();
        const tx = Math.cos(al), ty = -Math.sin(al); // касательная в сторону роста угла (px)
        if (Math.abs(s.v) > 1e-3 * r.vmax) L.arrow(ctx, bx, by, bx + tx * (s.v / r.vmax) * 30, by + ty * (s.v / r.vmax) * 30, c.velocity, { label: '→v', labelOffset: [3, -9], font: FONT });
        if (Math.abs(s.a) > 1e-3 * r.amax) L.arrow(ctx, bx, by + 12, bx + tx * (s.a / r.amax) * 30, by + 12 + ty * (s.a / r.amax) * 30, c.accel, { label: 'a_τ', labelOffset: [3, 9], font: FONT });
        ctx.save(); ctx.fillStyle = c.accent; ctx.strokeStyle = c.text; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        L.text(ctx, 'l', px + (bx - px) * 0.5 - 8, py + (by - py) * 0.5, c.muted, { font: FONT, align: 'right' });
        if (r.alpha0 > 15) {
          L.text(ctx, 'α₀ > 15°: T = 2π√(l/g) — приближённо', 6, sh - 4, c.force, { font: '11px system-ui, sans-serif' });
        }
      } else {
        const wx = 18, fy = sh - 14;
        const xEq = wx + (sceneW - wx) * 0.55;
        const kx = ((sceneW - wx) * 0.3) / 0.2;
        const bw = 30, bh = 24;
        const bxL = xEq - bw / 2 + s.x * kx;
        hatchV(ctx, wx, fy - 56, fy, c.text);
        hatchFloor(ctx, wx, sceneW - 6, fy, c.text);
        spring(ctx, wx, fy - bh / 2, bxL, fy - bh / 2, c.text);
        ctx.save(); ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
        ctx.fillRect(bxL, fy - bh, bw, bh); ctx.strokeRect(bxL, fy - bh, bw, bh); ctx.restore();
        L.text(ctx, 'm', bxL + bw / 2, fy - bh / 2, c.text, { font: FONT, align: 'center' });
        ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xEq, fy - bh - 44); ctx.lineTo(xEq, fy); ctx.stroke(); ctx.restore();
        L.text(ctx, '0', xEq - 4, fy - bh - 44, c.muted, { font: SMALL, align: 'right' });
        const cxB = bxL + bw / 2;
        if (Math.abs(s.v) > 1e-3 * r.vmax) L.arrow(ctx, cxB, fy - bh - 10, cxB + (s.v / r.vmax) * 32, fy - bh - 10, c.velocity, { label: '→v', labelOffset: [3, -8], font: FONT });
        if (Math.abs(s.a) > 1e-3 * r.amax) L.arrow(ctx, cxB, fy - bh - 28, cxB + (s.a / r.amax) * 32, fy - bh - 28, c.accel, { label: '→a', labelOffset: [3, -8], font: FONT });
      }

      // ---- столбики энергии
      const Ek = (r.m * s.v * s.v) / 2;
      const Ep = (r.k * s.x * s.x) / 2;
      const base = sh - 14, top = 26, hmax = base - top;
      const bw = Math.min(26, (barsW - 24) / 2);
      const bx0 = sceneW + 8;
      ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx0 - 2, base); ctx.lineTo(W - 6, base); ctx.stroke(); ctx.restore();
      [[Ek, c.velocity, 'E_к'], [Ep, c.fieldB, 'E_п']].forEach(([E, col, lab], i) => {
        const x = bx0 + 4 + i * (bw + 10);
        const h = r.E > 0 ? (E / r.E) * hmax : 0;
        ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(x, base - h, bw, h); ctx.restore();
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, top + 0.5, bw - 1, hmax - 1); ctx.restore();
        L.text(ctx, lab, x + bw / 2, base + 8, c.text, { font: SMALL, align: 'center' });
      });
      L.text(ctx, 'E = ' + L.fmt(r.E, 3) + ' Дж', bx0, 12, c.muted, { font: '11px system-ui, sans-serif' });

      // ---- графики
      const gTop = sh + 8;
      const slot = (H - gTop - 4) / 3;
      const gx = 46, gw = Math.max(60, W - gx - 30);
      const tm = t % (2 * r.T);
      const plots = [
        { f: (tt) => state(r, tt).x, ymax: r.A, lab: 'x, м', col: c.accent },
        { f: (tt) => state(r, tt).v, ymax: r.vmax, lab: 'v_x, м/с', col: c.velocity },
        { f: (tt) => state(r, tt).a, ymax: r.amax, lab: 'a_x, м/с²', col: c.accel },
      ];
      plots.forEach((p, i) => {
        const rect = { x: gx, y: gTop + i * slot + 16, w: gw, h: slot - 24 };
        const ym = p.ymax * 1.2;
        const g = L.graph(ctx, rect, {
          xMin: 0, xMax: 2 * r.T, yMin: -ym, yMax: ym,
          xLabel: 't, с', yLabel: p.lab,
          xTicks: L.niceStep(2 * r.T, 4), yTicks: L.niceStep(2 * ym, 2),
        });
        L.plotFn(ctx, g, p.f, p.col, { n: 160 });
        const px = g.X(tm);
        ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px, rect.y); ctx.lineTo(px, rect.y + rect.h); ctx.stroke(); ctx.restore();
        L.dot(ctx, px, g.Y(p.f(tm)), p.col, 4.5);
      });
    }

    function updateReadout() {
      const r = calc();
      const rows = r.math
        ? [['T = 2π√(l/g)', L.fmt(r.T, 3) + ' с']]
        : [['T = 2π√(m/k)', L.fmt(r.T, 3) + ' с']];
      rows.push(
        ['ν = 1/T', L.fmt(r.nu, 3) + ' Гц'],
        [r.math ? 'ω = √(g/l)' : 'ω = √(k/m)', L.fmt(r.w, 3) + ' рад/с'],
        [r.math ? 'A ≈ l·α₀ (α₀ в радианах)' : 'A', L.fmt(r.A, 3) + ' м'],
        ['v<sub>max</sub> = ωA', L.fmt(r.vmax, 3) + ' м/с'],
        ['a<sub>max</sub> = ω²A', L.fmt(r.amax, 3) + ' м/с²'],
        ['E = mv<sub>max</sub>²/2 = kA²/2', L.fmt(r.E, 3) + ' Дж'],
        ['Период изменения энергии T/2', L.fmt(r.T / 2, 3) + ' с'],
      );
      if (r.math && r.alpha0 > 15) {
        rows.push(['Внимание', `α₀ = ${r.alpha0}° > 15°: формула T = 2π√(l/g) верна только для малых колебаний; реальный период больше`]);
      }
      ro.set(rows);
    }

    function restart() { t = 0; draw(); updateReadout(); }

    syncVis();
    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    restart();
    return { destroy: d.run };
  },
};
