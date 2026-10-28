// Модель «Графики равноускоренного движения»: x(t), vₓ(t), aₓ(t).
// Формулы (CLAUDE.md, B1): 1.1.6 x = x₀ + v₀ₓt + aₓt²/2, vₓ = v₀ₓ + aₓt; 1.1.2 sₓ = x − x₀;
// лайфхак 1.1.6: наклон касательной к x(t) = vₓ, площадь под vₓ(t) = перемещение, наклон vₓ(t) = aₓ.
import * as L from './_lib.js';

const T_MAX = 10; // интервал графиков, с
const DEF = { x0: 0, v0: 5, a: -1, t: 3 };
const snap = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

/** Диапазон значений функции на [0; T_MAX] с обязательным включением нуля. */
function yRange(f) {
  let lo = 0, hi = 0;
  for (let i = 0; i <= 200; i++) {
    const y = f((T_MAX * i) / 200);
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  if (hi - lo < 1e-9) return [-1, 1];
  const pad = (hi - lo) * 0.12;
  return [lo < 0 ? lo - pad : 0, hi > 0 ? hi + pad : 0];
}

export default {
  id: 'motion-graphs',
  title: 'Графики равноускоренного движения',
  codes: ['1.1.3', '1.1.5', '1.1.6'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Вверху — тело на оси x. Площадь под графиком vₓ(t) равна перемещению sₓ (зелёная часть — выше оси, sₓ > 0; красная — ниже оси, sₓ < 0). '
        + 'Наклон касательной к графику x(t) равен vₓ, наклон графика vₓ(t) равен aₓ. Путь l учитывает разворот тела.',
    });
    const cv = L.canvas(ui.stage, { aspect: 1.15, minHeight: 360, maxHeight: 680, label: 'Тело на оси x и синхронные графики x(t), vₓ(t), aₓ(t)' });
    d.add(cv.destroy);

    let t = DEF.t;
    const sX0 = L.slider(ui.controls, { label: 'Начальная координата x<sub>0</sub>', min: -10, max: 10, step: 1, value: DEF.x0, unit: 'м', onInput: draw });
    const sV0 = L.slider(ui.controls, { label: 'Начальная скорость v<sub>0x</sub>', min: -10, max: 10, step: 1, value: DEF.v0, unit: 'м/с', onInput: draw });
    const sA = L.slider(ui.controls, { label: 'Ускорение a<sub>x</sub>', min: -4, max: 4, step: 0.5, value: DEF.a, unit: 'м/с²', onInput: draw });
    const sT = L.slider(ui.controls, { label: 'Момент времени t', min: 0, max: T_MAX, step: 'any', value: DEF.t, unit: 'с', onInput: (v) => { t = v; draw(); } });

    const anim = L.animator((dt) => {
      if (t >= T_MAX) t = 0; // повторный запуск после окончания — с начала
      t = Math.min(T_MAX, t + dt);
      if (t >= T_MAX) { anim.stop(); pb.sync(); }
      sT.set(t);
      draw();
    });
    d.add(anim.destroy);
    const pb = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      anim.stop(); pb.sync();
      sX0.set(DEF.x0); sV0.set(DEF.v0); sA.set(DEF.a);
      t = DEF.t; sT.set(t);
      draw();
    }, { reset: true });

    const ro = L.readout(ui.readout);
    let lastRO = '';

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const x0 = sX0.value, v0 = sV0.value, a = sA.value;
      const X = (tau) => x0 + v0 * tau + (a * tau * tau) / 2;
      const V = (tau) => v0 + a * tau;
      const A = () => a;
      ctx.clearRect(0, 0, W, H);

      const ml = 46, mr = 28, stripH = 62;
      const panelH = (H - stripH) / 3;
      const xr = yRange(X), vr = yRange(V), ar = yRange(A);

      // ---- полоса с телом на оси x ----
      const sy = 44, sx0 = ml, sx1 = W - mr;
      const XS = (x) => sx0 + ((x - xr[0]) / (xr[1] - xr[0])) * (sx1 - sx0);
      L.arrow(ctx, sx0 - 12, sy, sx1 + 14, sy, c.text, { width: 1.3, head: 7 });
      L.text(ctx, 'x, м', sx1 + 14, sy + 12, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'right' });
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1;
      ctx.beginPath();
      if (xr[0] <= 0 && xr[1] >= 0) { ctx.moveTo(XS(0), sy - 4); ctx.lineTo(XS(0), sy + 4); }
      ctx.moveTo(XS(x0), sy - 4); ctx.lineTo(XS(x0), sy + 4);
      ctx.stroke();
      ctx.restore();
      if (xr[0] <= 0 && xr[1] >= 0 && Math.abs(XS(0) - XS(x0)) > 20) L.text(ctx, '0', XS(0), sy + 11, c.muted, { font: '11px system-ui, sans-serif', align: 'center' });
      L.text(ctx, 'x_0', XS(x0), sy + 11, c.muted, { font: '12px system-ui, sans-serif', align: 'center' });
      const xt = X(t), vt = V(t);
      const bx = XS(xt);
      const vMaxAbs = Math.max(Math.abs(v0), Math.abs(V(T_MAX)), 1);
      const kv = 48 / vMaxAbs;
      if (Math.abs(vt) > 1e-9) L.arrow(ctx, bx, sy - 16, bx + vt * kv, sy - 16, c.velocity, { label: '→v', labelOffset: [vt < 0 ? -20 : 6, -6] });
      if (Math.abs(a) > 1e-9) L.arrow(ctx, bx, sy - 34, bx + a * 9, sy - 34, c.accel, { label: '→a', labelOffset: [a < 0 ? -20 : 6, 0] });
      L.dot(ctx, bx, sy, c.text, 6);

      // ---- три графика ----
      const rects = [0, 1, 2].map((i) => ({ x: ml, y: stripH + i * panelH + 22, w: W - ml - mr, h: Math.max(30, panelH - 44) }));
      const mk = (rect, r, yLabel) => L.graph(ctx, rect, {
        xMin: 0, xMax: T_MAX, yMin: r[0], yMax: r[1], xLabel: 't, с', yLabel, xTicks: 2, yTicks: L.niceStep(r[1] - r[0], 3),
      });
      const gx = mk(rects[0], xr, 'x, м');
      const gv = mk(rects[1], vr, 'v_x, м/с');
      const ga = mk(rects[2], ar, 'a_x, м/с²');

      // площадь под vₓ(t) от 0 до t (знак — цветом)
      if (t > 0) {
        const y0 = gv.Y(0), R = gv.rect;
        [[c.velocity, R.y - 30, y0], [c.force, y0, R.y + R.h + 30]].forEach(([col, ya, yb]) => {
          ctx.save();
          ctx.beginPath(); ctx.rect(R.x, ya, R.w, yb - ya); ctx.clip();
          ctx.beginPath();
          ctx.moveTo(gv.X(0), y0);
          const n = 80;
          for (let i = 0; i <= n; i++) { const tau = (t * i) / n; ctx.lineTo(gv.X(tau), gv.Y(V(tau))); }
          ctx.lineTo(gv.X(t), y0);
          ctx.closePath();
          ctx.globalAlpha = 0.28; ctx.fillStyle = col; ctx.fill();
          ctx.restore();
        });
      }

      L.plotFn(ctx, gx, X, c.accent, { width: 2.2 });
      L.plotFn(ctx, gv, V, c.accent, { width: 2.2 });
      L.plotFn(ctx, ga, A, c.accent, { width: 2.2 });

      // касательная к x(t) в момент t: наклон = vₓ(t)
      {
        const R = gx.rect, dT = T_MAX * 0.2;
        ctx.save();
        ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
        L.plotFn(ctx, gx, (tau) => xt + vt * (tau - t), c.velocity, { from: Math.max(0, t - dT), to: Math.min(T_MAX, t + dT), n: 2, width: 1.6, dash: [6, 4] });
        ctx.restore();
      }

      // вертикальная линия текущего момента и точки
      const px = gx.X(t);
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(px, rects[0].y); ctx.lineTo(px, rects[2].y + rects[2].h); ctx.stroke();
      ctx.restore();
      L.dot(ctx, px, gx.Y(xt), c.text, 4);
      L.dot(ctx, px, gv.Y(vt), c.text, 4);
      L.dot(ctx, px, ga.Y(a), c.text, 4);

      // ---- числа ----
      let tTurn = null;
      if (a !== 0) { const ts = -v0 / a; if (ts > 0 && ts < T_MAX) tTurn = ts; }
      const disp = xt - x0;
      const path = tTurn !== null && t > tTurn ? Math.abs(X(tTurn) - x0) + Math.abs(xt - X(tTurn)) : Math.abs(disp);
      const rows = [
        ['t', L.fmt(t) + ' с'],
        ['x(t) = x<sub>0</sub> + v<sub>0x</sub>t + a<sub>x</sub>t²/2', L.fmt(snap(xt)) + ' м'],
        ['v<sub>x</sub>(t) = v<sub>0x</sub> + a<sub>x</sub>t', L.fmt(snap(vt)) + ' м/с'],
        ['a<sub>x</sub>', L.fmt(a) + ' м/с²'],
        ['Перемещение s<sub>x</sub> = x − x<sub>0</sub>', L.fmt(snap(disp)) + ' м'],
        ['Путь l', L.fmt(snap(path)) + ' м'],
        ['Разворот (v<sub>x</sub> = 0)', tTurn !== null ? `при t = ${L.fmt(tTurn)} с, x = ${L.fmt(snap(X(tTurn)))} м` : 'нет на [0; 10] с'],
      ];
      const key = JSON.stringify(rows);
      if (key !== lastRO) { lastRO = key; ro.set(rows); }
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
