// Модель «Бросок под углом к горизонту» (с высоты h₀ ≥ 0).
// Формулы (CLAUDE.md, B1, 1.1.7): x = v₀cosα·t, y = h₀ + v₀sinα·t − gt²/2, vₓ = v₀cosα, v_y = v₀sinα − gt,
// |v| = √(vₓ² + v_y²), t_п = v₀sinα/g; при h₀ = 0: T = 2v₀sinα/g, H = (v₀sinα)²/(2g), L = v₀²sin2α/g.
// При h₀ > 0 время полёта — корень уравнения y(T) = 0: T = (v₀sinα + √((v₀sinα)² + 2gh₀))/g, L = vₓT, H = h₀ + (v₀sinα)²/(2g).
import * as L from './_lib.js';

const G = 10;
const DEF = { v0: 20, al: 45, h0: 0 };
const snap = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

function physics(v0, al, h0) {
  const r = L.deg(al);
  const ca = al >= 90 ? 0 : al <= 0 ? 1 : Math.cos(r);
  const sa = al <= 0 ? 0 : al >= 90 ? 1 : Math.sin(r);
  const vx = v0 * ca, vy0 = v0 * sa;
  const tUp = vy0 / G;
  const T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * G * h0)) / G;
  const Hm = h0 + (vy0 * vy0) / (2 * G);
  return { ca, sa, vx, vy0, tUp, T, H: Hm, L: vx * T, vmax: Math.sqrt(v0 * v0 + 2 * G * h0) };
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
  id: 'projectile',
  title: 'Бросок под углом к горизонту',
  codes: ['1.1.7'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Формулы H = (v₀sinα)²/(2g), T = 2v₀sinα/g и L = v₀²sin2α/g верны только при h₀ = 0 (старт и финиш на одной высоте). '
        + 'При h₀ > 0 время полёта находится из уравнения y(T) = 0, а L = v₀cosα·T. H — наибольшая высота над землёй. Масштаб по осям x и y одинаковый.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 230, label: 'Траектория тела, брошенного под углом к горизонту, с векторами скорости' });
    d.add(cv.destroy);

    let t = 0, hold = 0;
    const sV = L.slider(ui.controls, { label: 'Начальная скорость v<sub>0</sub>', min: 0, max: 30, step: 1, value: DEF.v0, unit: 'м/с', onInput: changed });
    const sA = L.slider(ui.controls, { label: 'Угол α к горизонту', min: 0, max: 90, step: 1, value: DEF.al, unit: '°', onInput: changed });
    const sH = L.slider(ui.controls, { label: 'Высота старта h<sub>0</sub>', min: 0, max: 50, step: 1, value: DEF.h0, unit: 'м', onInput: changed });
    const sT = L.slider(ui.controls, { label: 'Момент времени t', min: 0, max: 1, step: 'any', value: 0, unit: 'с', onInput: (v) => { t = v; hold = 0; draw(); } });

    function changed() { hold = 0; draw(); }

    const anim = L.animator((dt) => {
      const p = physics(sV.value, sA.value, sH.value);
      if (t >= p.T) {
        hold += dt;
        if (hold > 0.8) { t = 0; hold = 0; }
      } else {
        t = Math.min(p.T, t + dt);
      }
      draw();
    }, { autoplay: true });
    d.add(anim.destroy);
    const pb = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sV.set(DEF.v0); sA.set(DEF.al); sH.set(DEF.h0);
      t = 0; hold = 0;
      pb.sync();
      draw();
    }, { reset: true });

    const ro = L.readout(ui.readout);
    let lastRO = '';

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const v0 = sV.value, al = sA.value, h0 = sH.value;
      const p = physics(v0, al, h0);
      if (+sT.input.max !== p.T) sT.input.max = String(p.T);
      if (t > p.T) t = p.T;
      sT.set(t);
      ctx.clearRect(0, 0, W, H);

      const ml = 44, mr = 34, mt = 34, mb = 36;
      const plotW = W - ml - mr, plotH = H - mt - mb;
      const s = Math.min(plotW / Math.max(p.L, 1), plotH / Math.max(p.H, 1));
      const ox = ml, oy = H - mb;
      const PX = (x) => ox + x * s, PY = (y) => oy - y * s;
      const xAt = (tau) => p.vx * tau;
      const yAt = (tau) => Math.max(0, h0 + p.vy0 * tau - (G * tau * tau) / 2);

      // земля и обрыв
      hatchLine(ctx, ox - 34, oy, W - 6, oy, c.muted, 1);
      if (h0 > 0) {
        ctx.save();
        ctx.fillStyle = c.grid; ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2;
        ctx.fillRect(ox - 22, PY(h0), 22, oy - PY(h0));
        ctx.strokeRect(ox - 22, PY(h0), 22, oy - PY(h0));
        ctx.restore();
        L.text(ctx, 'h_0', ox - 26, (PY(h0) + oy) / 2, c.text, { font: 'italic 14px system-ui, sans-serif', align: 'right' });
      }
      // оси
      L.arrow(ctx, ox, oy, W - 8, oy, c.text, { width: 1.3, head: 7 });
      L.arrow(ctx, ox, oy, ox, mt - 18, c.text, { width: 1.3, head: 7 });
      L.text(ctx, 'x, м', W - 8, oy - 12, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'right' });
      L.text(ctx, 'y, м', ox + 8, mt - 16, c.text, { font: 'italic 13px system-ui, sans-serif' });
      L.text(ctx, 'O', ox - 4, oy + 10, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'right' });

      // траектория: вся — штрихом, пройденная часть — сплошной
      const is45 = al === 45 && h0 === 0 && v0 > 0;
      const path = (from, to) => {
        ctx.beginPath();
        const n = 120;
        for (let i = 0; i <= n; i++) {
          const tau = from + ((to - from) * i) / n;
          const X = PX(xAt(tau)), Y = PY(yAt(tau));
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
      };
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
      path(0, p.T); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = c.accent; ctx.lineWidth = is45 ? 3 : 2.2;
      path(0, t); ctx.stroke();
      ctx.restore();

      // угол α
      const lx = PX(0), ly = PY(h0);
      if (al > 0 && v0 > 0) {
        const rr = L.deg(al);
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 46, ly); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = c.text;
        ctx.beginPath(); ctx.arc(lx, ly, 26, -rr, 0); ctx.stroke();
        ctx.restore();
        L.text(ctx, 'α', lx + 36 * Math.cos(rr / 2), ly - 36 * Math.sin(rr / 2), c.text, { font: 'italic 14px system-ui, sans-serif', align: 'center' });
      }

      // отметка H (над землёй)
      if (p.H > 0) {
        const xa = PX(xAt(p.tUp)), ya = PY(p.H);
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(ox, ya); ctx.lineTo(xa, ya); ctx.moveTo(xa, ya); ctx.lineTo(xa, oy); ctx.stroke();
        ctx.restore();
        L.text(ctx, 'H', xa + 5, (ya + oy) / 2, c.text, { font: 'italic 14px system-ui, sans-serif' });
      }
      // отметка L
      if (p.L > 1e-9) {
        const xL = PX(p.L), yb = oy + 18;
        ctx.save();
        ctx.strokeStyle = c.text; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ox, yb); ctx.lineTo(xL, yb);
        ctx.moveTo(ox, yb - 5); ctx.lineTo(ox, yb + 5);
        ctx.moveTo(xL, yb - 5); ctx.lineTo(xL, yb + 5);
        ctx.stroke();
        ctx.restore();
        L.text(ctx, 'L', (ox + xL) / 2, yb + 9, c.text, { font: 'italic 14px system-ui, sans-serif', align: 'center' });
        L.dot(ctx, xL, oy, c.muted, 3);
      }

      // тело и векторы скорости
      const bx = PX(xAt(t)), by = PY(yAt(t));
      const vx = snap(p.vx), vy = snap(p.vy0 - G * t);
      const kv = (Math.min(plotW, plotH) * 0.4) / Math.max(p.vmax, 1);
      if (Math.abs(vx) * kv > 2) L.arrow(ctx, bx, by, bx + vx * kv, by, c.velocity, { width: 1.6, dash: [5, 3], label: 'v_x', labelOffset: [2, 12] });
      if (Math.abs(vy) * kv > 2) L.arrow(ctx, bx, by, bx, by - vy * kv, c.velocity, { width: 1.6, dash: [5, 3], label: 'v_y', labelOffset: [-26, vy > 0 ? 4 : -4] });
      if (Math.hypot(vx, vy) * kv > 2) L.arrow(ctx, bx, by, bx + vx * kv, by - vy * kv, c.velocity, { width: 2.4, label: '→v', labelOffset: [6, -10] });
      L.dot(ctx, bx, by, c.text, 6);

      if (is45) L.text(ctx, 'α = 45°: дальность L максимальна', W - 8, 12, c.accent, { font: '600 13px system-ui, sans-serif', align: 'right' });
      else if (al === 45 && h0 > 0) L.text(ctx, 'при h₀ > 0 максимум L — при α < 45°', W - 8, 12, c.muted, { font: '12px system-ui, sans-serif', align: 'right' });

      // числа
      const vabs = Math.sqrt(vx * vx + vy * vy);
      const flat = h0 === 0;
      const rows = [
        ['t<sub>п</sub> = v<sub>0</sub>sinα / g (время подъёма)', L.fmt(snap(p.tUp)) + ' с'],
        [flat ? 'T = 2v<sub>0</sub>sinα / g (время полёта)' : 'T — корень y(T) = 0 (время полёта)', L.fmt(snap(p.T)) + ' с'],
        [flat ? 'H = (v<sub>0</sub>sinα)² / (2g)' : 'H = h<sub>0</sub> + (v<sub>0</sub>sinα)² / (2g)', L.fmt(snap(p.H)) + ' м'],
        [flat ? 'L = v<sub>0</sub>²sin2α / g' : 'L = v<sub>0</sub>cosα · T', L.fmt(snap(p.L)) + ' м'],
        ['t', L.fmt(snap(t)) + ' с'],
        ['x(t), y(t)', `${L.fmt(snap(xAt(t)))} м; ${L.fmt(snap(yAt(t)))} м`],
        ['v<sub>x</sub> = v<sub>0</sub>cosα', L.fmt(vx) + ' м/с'],
        ['v<sub>y</sub> = v<sub>0</sub>sinα − gt', L.fmt(vy) + ' м/с'],
        ['|v| = √(v<sub>x</sub>² + v<sub>y</sub>²)', L.fmt(snap(vabs)) + ' м/с'],
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
