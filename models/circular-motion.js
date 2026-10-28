// Модель «Равномерное движение по окружности».
// Формулы (CLAUDE.md, B1, 1.1.8): v = ωR, ω = 2π/T = 2πν, T = 2πR/v, ν = 1/T, a_цс = v²/R = ω²R.
import * as L from './_lib.js';

const DEF = { R: 2, v: 4 };
const V_MAX = 10;
const OMEGA_VIS_MAX = 3; // рад/с — потолок скорости анимации (быстрее — «стробоскоп»)

export default {
  id: 'circular-motion',
  title: 'Равномерное движение по окружности',
  codes: ['1.1.8'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Скорость →v направлена по касательной к окружности, центростремительное ускорение →a_цс — к центру. '
        + 'Радиус и длины векторов на рисунке условные (длина →v растёт с v, длина →a_цс — с a_цс); при ω > 3 рад/с анимация показана замедленно.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.75, minHeight: 240, maxHeight: 460, label: 'Точка, равномерно движущаяся по окружности, с векторами скорости и центростремительного ускорения' });
    d.add(cv.destroy);

    let phi = Math.PI / 4;
    const sR = L.slider(ui.controls, { label: 'Радиус R', min: 0.5, max: 5, step: 0.1, value: DEF.R, unit: 'м', onInput: draw });
    const sV = L.slider(ui.controls, { label: 'Скорость v', min: 0, max: V_MAX, step: 0.5, value: DEF.v, unit: 'м/с', onInput: draw });

    const anim = L.animator((dt) => {
      const w = sV.value / sR.value;
      phi = (phi + Math.min(w, OMEGA_VIS_MAX) * dt) % (2 * Math.PI);
      draw();
    }, { autoplay: true });
    d.add(anim.destroy);
    const pb = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sR.set(DEF.R); sV.set(DEF.v);
      phi = Math.PI / 4;
      pb.sync();
      draw();
    }, { reset: true });

    const ro = L.readout(ui.readout);
    let lastRO = '';

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const R = sR.value, v = sV.value;
      const omega = v / R;          // R ≥ 0,5 — деления на 0 нет
      const acs = (v * v) / R;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2;
      const rMax = Math.max(30, Math.min(W, H) / 2 - 36);
      const rpx = rMax * (0.45 + (0.55 * (R - 0.5)) / 4.5);

      // окружность-траектория, центр, радиус
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, rpx, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      const px = cx + rpx * Math.cos(phi), py = cy - rpx * Math.sin(phi);
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.restore();
      L.dot(ctx, cx, cy, c.text, 3);
      L.text(ctx, 'O', cx - 6, cy + 10, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'right' });
      // подпись R — сбоку от середины радиуса
      const mx = (cx + px) / 2, my = (cy + py) / 2;
      L.text(ctx, 'R', mx - 10 * Math.sin(phi), my - 10 * Math.cos(phi), c.text, { font: 'italic 14px system-ui, sans-serif', align: 'center' });

      // направление движения — против часовой стрелки
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2;
      const arcR = rpx + 12;
      ctx.beginPath(); ctx.arc(cx, cy, arcR, -2.6, -2.0); ctx.stroke();
      ctx.restore();
      {
        const ex = cx + arcR * Math.cos(-2.6), ey = cy + arcR * Math.sin(-2.6);
        const tx = Math.sin(-2.6), ty = -Math.cos(-2.6); // касательная в сторону уменьшения угла (против часовой на экране)
        L.arrow(ctx, ex - tx * 2, ey - ty * 2, ex + tx * 6, ey + ty * 6, c.muted, { width: 1.2, head: 7 });
      }

      // векторы: скорость по касательной, ускорение к центру
      const tx = -Math.sin(phi), ty = -Math.cos(phi);
      const vLen = rMax * 0.8 * (v / V_MAX);
      if (vLen > 1) L.arrow(ctx, px, py, px + tx * vLen, py + ty * vLen, c.velocity, { width: 2.4, label: '→v', labelOffset: [6 + 6 * tx, -10 + 6 * ty] });
      const aLen = rpx * 0.85 * (acs / (acs + 5));
      if (aLen > 1) {
        const ux = (cx - px) / rpx, uy = (cy - py) / rpx;
        L.arrow(ctx, px, py, px + ux * aLen, py + uy * aLen, c.accel, { width: 2.4, label: '→a_{цс}', labelOffset: [ux > 0 ? 4 : -40, uy > 0 ? 10 : -10] });
      }
      L.dot(ctx, px, py, c.text, 6);

      const moving = v > 0;
      const T = moving ? (2 * Math.PI * R) / v : NaN;
      const rows = [
        ['T = 2πR / v', moving ? L.fmt(T) + ' с' : '— (тело покоится)'],
        ['ν = 1 / T', L.fmt(moving ? 1 / T : 0) + ' Гц'],
        ['ω = 2π / T = v / R', L.fmt(omega) + ' рад/с'],
        ['a<sub>цс</sub> = v² / R = ω²R', L.fmt(acs) + ' м/с²'],
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
