// Модель «Брусок на наклонной плоскости».
// Формулы (CLAUDE.md, B1): 1.2.4 m→a = Σ→F; 1.2.8 F_тр.ск = μN, F_тр.покоя ≤ μN.
// Проекции: Oy (перпендикулярно плоскости): N − mg cosα = 0 → N = mg cosα;
// Ox (вдоль плоскости вниз): mg sinα − F_тр = ma.
// Покой, если mg sinα ≤ μmg cosα (tgα ≤ μ): F_тр = mg sinα, a = 0. Иначе скольжение: F_тр = μmg cosα, a = g(sinα − μcosα).
import * as L from './_lib.js';

const G = 10;
const DEF = { al: 30, mu: 0.3, m: 1 };
const SLOPE_M = 2.5; // условная длина наклонной для анимации, м
const LABEL_FONT = '600 14px system-ui, sans-serif';
const snap = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

function physics(al, mu, m) {
  const r = L.deg(al);
  const sa = al <= 0 ? 0 : al >= 90 ? 1 : Math.sin(r);
  const ca = al >= 90 ? 0 : al <= 0 ? 1 : Math.cos(r);
  const mg = m * G;
  const N = mg * ca;
  const rest = sa <= mu * ca + 1e-12;
  const Ftr = rest ? mg * sa : mu * N;
  const a = rest ? 0 : G * (sa - mu * ca);
  return { r, sa, ca, mg, N, Fmax: mu * N, rest, Ftr, a };
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
  id: 'incline',
  title: 'Брусок на наклонной плоскости',
  codes: ['1.2.3', '1.2.4', '1.2.8'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Ось x направлена вдоль наклонной вниз, ось y — перпендикулярно ей. Режим определяется сам: если tgα ≤ μ, брусок покоится и сила трения покоя '
        + 'равна mg sinα (она меньше или равна μN); если tgα > μ — брусок скользит, F_тр = μN = μmg cosα. Длины векторов — в одном масштабе.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.7, minHeight: 240, maxHeight: 480, label: 'Брусок на наклонной плоскости: силы тяжести, реакции опоры, трения и разложение силы тяжести по осям' });
    d.add(cv.destroy);

    let tau = 0, hold = 0; // время скольжения для анимации, с
    let doneSliding = false; // брусок доехал до низа наклонной
    const reset = () => { tau = 0; hold = 0; };
    const sAl = L.slider(ui.controls, { label: 'Угол наклона α', min: 0, max: 90, step: 1, value: DEF.al, unit: '°', onInput: () => { reset(); draw(); } });
    const sMu = L.slider(ui.controls, { label: 'Коэффициент трения μ', min: 0, max: 1, step: 0.05, value: DEF.mu, onInput: () => { reset(); draw(); } });
    const sM = L.slider(ui.controls, { label: 'Масса бруска m', min: 0.1, max: 10, step: 0.1, value: DEF.m, unit: 'кг', onInput: draw });
    const cbDec = L.checkbox(ui.controls, { label: 'Разложить m<i>g</i> по осям x и y', checked: true, onChange: draw });

    const anim = L.animator((dt) => {
      const p = physics(sAl.value, sMu.value, sM.value);
      if (p.rest) { tau = 0; } else if (doneSliding) {
        hold += dt;
        if (hold > 0.7) reset();
      } else tau += dt;
      draw();
    });
    d.add(anim.destroy);
    const pb = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      anim.stop(); pb.sync();
      sAl.set(DEF.al); sMu.set(DEF.mu); sM.set(DEF.m); cbDec.set(true);
      reset();
      draw();
    }, { reset: true });

    const ro = L.readout(ui.readout);
    let lastRO = '';

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const al = sAl.value, mu = sMu.value, m = sM.value;
      const p = physics(al, mu, m);
      ctx.clearRect(0, 0, W, H);

      // ---- геометрия наклонной: A — нижняя вершина с углом α, плоскость поднимается вправо ----
      const side = 26, mt = 34, mb = 28;
      const availW = W - 2 * side, availH = H - mt - mb;
      const Lpx = Math.min(p.ca > 1e-9 ? availW / p.ca : Infinity, p.sa > 1e-9 ? availH / p.sa : Infinity);
      const wT = Lpx * p.ca, hT = Lpx * p.sa;
      const xA = (W - wT) / 2, yA = H - mb;
      const ex = p.ca, ey = -p.sa;        // вдоль плоскости вверх
      const nx = -p.sa, ny = -p.ca;       // нормаль от поверхности
      const bs = L.clamp(Math.min(W, H) * 0.13, 26, 46);

      // клин и земля
      ctx.save();
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xA, yA); ctx.lineTo(xA + wT, yA - hT); ctx.lineTo(xA + wT, yA); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      hatchLine(ctx, Math.max(4, xA - 24), yA, Math.min(W - 4, xA + wT + 24), yA, c.muted, 1);
      if (al >= 80) hatchLine(ctx, xA, yA, xA + wT, yA - hT, c.muted, 1);
      if (al > 0) {
        ctx.save();
        ctx.strokeStyle = c.text; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(xA, yA, 26, -p.r, 0); ctx.stroke();
        ctx.restore();
        L.text(ctx, 'α', xA + 38 * Math.cos(p.r / 2), yA - 38 * Math.sin(p.r / 2), c.text, { font: 'italic 14px system-ui, sans-serif', align: 'center' });
      }

      // положение бруска вдоль плоскости
      const u0 = Lpx * 0.62;
      const kpx = Lpx / SLOPE_M;
      const uMin = bs / 2 + 2;
      let u = u0 - (p.a * tau * tau / 2) * kpx;
      doneSliding = u <= uMin;
      if (u < uMin) u = uMin;
      if (u > Lpx - bs / 2) u = Math.max(uMin, Lpx - bs / 2);
      const C0x = xA + ex * u, C0y = yA + ey * u;          // точка контакта (середина нижней грани)
      const Px = C0x + nx * bs / 2, Py = C0y + ny * bs / 2; // центр бруска

      ctx.save();
      ctx.translate(Px, Py); ctx.rotate(-p.r);
      ctx.fillStyle = c.grid; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillRect(-bs / 2, -bs / 2, bs, bs); ctx.strokeRect(-bs / 2, -bs / 2, bs, bs);
      ctx.restore();

      // ---- оси x (вдоль плоскости вниз) и y (перпендикулярно) ----
      const Fpx = L.clamp(Math.min(W, H) * 0.3, 50, 120);
      const k = Fpx / p.mg;
      const axLen = Fpx + 20;
      L.arrow(ctx, Px, Py, Px - ex * axLen, Py - ey * axLen, c.muted, { width: 1, head: 7 });
      L.arrow(ctx, Px, Py, Px + nx * axLen, Py + ny * axLen, c.muted, { width: 1, head: 7 });
      L.text(ctx, 'x', Px - ex * (axLen + 10), Py - ey * (axLen + 10), c.muted, { font: 'italic 14px system-ui, sans-serif', align: 'center' });
      L.text(ctx, 'y', Px + nx * (axLen + 10), Py + ny * (axLen + 10), c.muted, { font: 'italic 14px system-ui, sans-serif', align: 'center' });

      // ---- разложение mg ----
      const gx = Px, gy = Py + p.mg * k;
      if (cbDec.value) {
        const s1 = p.mg * p.sa * k, s2 = p.mg * p.ca * k;
        const ax1 = Px - ex * s1, ay1 = Py - ey * s1;   // mg sinα — вдоль x
        const ax2 = Px - nx * s2, ay2 = Py - ny * s2;   // mg cosα — против y
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(ax1, ay1); ctx.moveTo(gx, gy); ctx.lineTo(ax2, ay2); ctx.stroke();
        ctx.restore();
        if (s1 > 2) L.arrow(ctx, Px, Py, ax1, ay1, c.force, { width: 1.6, dash: [5, 3], label: 'mg sinα', labelOffset: [-58, 14], font: '600 12px system-ui, sans-serif' });
        if (s2 > 2) L.arrow(ctx, Px, Py, ax2, ay2, c.force, { width: 1.6, dash: [5, 3], label: 'mg cosα', labelOffset: [6, 10], font: '600 12px system-ui, sans-serif' });
      }

      // ---- силы ----
      L.arrow(ctx, Px, Py, gx, gy, c.force, { width: 2.4 });
      {
        const w = L.text(ctx, 'm', gx + 6, gy - 4, c.force, { font: LABEL_FONT });
        L.text(ctx, '→g', gx + 6 + w, gy - 4, c.force, { font: LABEL_FONT });
      }
      if (p.N * k > 2) L.arrow(ctx, Px, Py, Px + nx * p.N * k, Py + ny * p.N * k, c.force, { width: 2.4, label: '→N', labelOffset: [-24, -6] });
      if (p.Ftr * k > 2) L.arrow(ctx, C0x, C0y, C0x + ex * p.Ftr * k, C0y + ey * p.Ftr * k, c.force, { width: 2.4, label: '→F_{тр}', labelOffset: [4, 12] });
      if (!p.rest && p.a > 1e-9) {
        const aLen = L.clamp(p.a * 5, 14, 50);
        const off = bs + 12;
        const sx = C0x + ex * (bs / 2 + 8 + aLen) + nx * off, sy = C0y + ey * (bs / 2 + 8 + aLen) + ny * off;
        L.arrow(ctx, sx, sy, sx - ex * aLen, sy - ey * aLen, c.accel, { width: 2.4, label: '→a', labelOffset: [-6, -14] });
      }
      L.text(ctx, p.rest ? 'покой' : 'скольжение', 10, 14, p.rest ? c.muted : c.accel, { font: '600 13px system-ui, sans-serif' });

      // ---- числа ----
      const tg = al >= 90 ? 'не определён (α = 90°)' : L.fmt(snap(Math.tan(p.r)));
      const rows = [
        ['Режим', p.rest ? 'покой (tgα ≤ μ)' : 'скольжение (tgα > μ)'],
        ['tgα', tg + '  (μ = ' + L.fmt(mu) + ')'],
        ['mg', L.fmt(p.mg) + ' Н'],
        ['N = mg cosα', L.fmt(snap(p.N)) + ' Н'],
        ['mg sinα (вдоль наклонной)', L.fmt(snap(p.mg * p.sa)) + ' Н'],
        ['μN (наибольшая сила трения покоя)', L.fmt(snap(p.Fmax)) + ' Н'],
        [p.rest ? 'F<sub>тр</sub> покоя = mg sinα' : 'F<sub>тр</sub> скольжения = μmg cosα', L.fmt(snap(p.Ftr)) + ' Н'],
        [p.rest ? 'a' : 'a = g(sinα − μcosα)', L.fmt(snap(p.a)) + ' м/с²'],
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
