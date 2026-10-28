// Модель «Частица в однородном магнитном поле» (сила Лоренца, 3.3.4).
import * as L from './_lib.js';

const E_CH = 1.6e-19; // Кл
const PARTICLES = {
  e: { name: 'электрон', q: -E_CH, m: 9.1e-31, mark: '−' },
  p: { name: 'протон', q: E_CH, m: 1.673e-27, mark: '+' },
  a: { name: 'α-частица', q: 2 * E_CH, m: 6.64e-27, mark: '2+' }, // m ≈ 4 а.е.м.
};
const VIS_OMEGA = (2 * Math.PI) / 4; // на экране: один оборот за 4 с (условно)

/** Три значащие цифры. */
function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
}

/** Наименьшее «красивое» число (1, 2, 5 · 10^k) не меньше x. */
function niceAtLeast(x) {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  for (const k of [1, 2, 5, 10]) if (k * p >= x * (1 - 1e-9)) return k * p;
  return 10 * p;
}

/** Длина в удобных единицах: м, см, мм, мкм. */
function lengthText(m) {
  const units = [[1, 'м'], [1e-2, 'см'], [1e-3, 'мм'], [1e-6, 'мкм']];
  for (const [u, n] of units) if (m >= u * (1 - 1e-9)) return `${f3(m / u)} ${n}`;
  return `${f3(m)} м`;
}

/** Значок поля: ⊙ (к нам) или ⊗ (от нас). */
function fieldSymbol(ctx, x, y, r, out, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  if (out) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, r * 0.32), 0, Math.PI * 2); ctx.fill();
  } else {
    const k = r * 0.68;
    ctx.beginPath();
    ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
    ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
    ctx.stroke();
  }
  ctx.restore();
}

/** Смещение подписи у конца стрелки с направлением (ux, uy). */
function labelOff(ux, uy, w = 22) {
  return [ux >= -0.3 ? ux * 8 + 3 : ux * 8 - w, uy * 12];
}

export default {
  id: 'lorentz',
  title: 'Заряженная частица в магнитном поле',
  codes: ['3.3.4'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Однородное магнитное поле, →v ⊥ →B, частица движется по окружности. ' +
        'Правило левой руки: линии B входят в ладонь, четыре пальца — по скорости положительной частицы ' +
        '(для отрицательной частицы четыре пальца — против скорости), отогнутый большой палец показывает силу Лоренца. ' +
        'Анимация условная (один оборот за 4 с), реальный период T — в таблице; v ≪ c.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.75, minHeight: 240, maxHeight: 520, label: 'Движение заряженной частицы по окружности в однородном магнитном поле' });
    d.add(cv.destroy);

    const DEF = { part: 'p', dir: 'in', v: 1, B: 100 };
    let theta = Math.PI / 2; // угол положения частицы (математический, от оси x против часовой)
    let trav = 0; // пройденный угол для следа (≤ 2π)

    const onParam = () => { trav = 0; updateReadout(); draw(); };

    const sPart = L.choice(ui.controls, {
      label: 'Частица', value: DEF.part, onChange: onParam,
      options: [{ value: 'e', label: 'электрон' }, { value: 'p', label: 'протон' }, { value: 'a', label: 'α-частица' }],
    });
    const sDir = L.choice(ui.controls, {
      label: 'Вектор <i>B</i>', value: DEF.dir, onChange: onParam,
      options: [{ value: 'out', label: '⊙ к нам' }, { value: 'in', label: '⊗ от нас' }],
    });
    const sV = L.slider(ui.controls, { label: 'Скорость <i>v</i>', min: 0.1, max: 10, step: 0.1, value: DEF.v, unit: '·10⁶ м/с', onInput: onParam });
    const sB = L.slider(ui.controls, { label: 'Индукция <i>B</i>', min: 1, max: 500, step: 1, value: DEF.B, unit: 'мТл', onInput: onParam });

    const anim = L.animator(step, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sPart.set(DEF.part); sDir.set(DEF.dir); sV.set(DEF.v); sB.set(DEF.B);
      theta = Math.PI / 2; trav = 0;
      play.sync(); updateReadout(); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function phys() {
      const P = PARTICLES[sPart.value] || PARTICLES.p;
      const v = sV.value * 1e6; // м/с
      const B = sB.value * 1e-3; // Тл
      const qa = Math.abs(P.q);
      const F = qa * v * B;
      const R = B > 0 && qa > 0 ? (P.m * v) / (qa * B) : Infinity;
      const T = B > 0 && qa > 0 ? (2 * Math.PI * P.m) / (qa * B) : Infinity;
      // s = +1 — по часовой стрелке (смотрим на рисунок), −1 — против.
      // ω⃗ = −qB⃗/m: для q > 0 и B⃗ к нам вращение по часовой.
      const s = Math.sign(P.q) * (sDir.value === 'out' ? 1 : -1);
      return { P, v, B, F, R, T, s };
    }

    function step(dt) {
      const { s } = phys();
      theta -= s * VIS_OMEGA * dt;
      theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      trav = Math.min(2 * Math.PI, trav + VIS_OMEGA * dt);
      draw();
    }

    function updateReadout() {
      const { P, v, B, F, R, T, s } = phys();
      ro.set([
        ['Частица', P.name],
        ['Заряд <i>q</i>', L.fmt(P.q) + ' Кл'],
        ['Масса <i>m</i>', L.fmt(P.m, 3) + ' кг'],
        ['Скорость <i>v</i>', L.fmt(v) + ' м/с'],
        ['Индукция <i>B</i>', f3(B) + ' Тл'],
        ['<i>F</i><sub>Л</sub> = |<i>q</i>|<i>vB</i>', f3(F) + ' Н'],
        ['<i>R</i> = <i>mv</i>/(|<i>q</i>|<i>B</i>)', `${f3(R)} м (${lengthText(R)})`],
        ['<i>T</i> = 2π<i>m</i>/(|<i>q</i>|<i>B</i>)', f3(T) + ' с'],
        ['Вращение', s > 0 ? 'по часовой стрелке' : 'против часовой стрелки'],
      ]);
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const ph = phys();
      const out = sDir.value === 'out';
      const barH = 34; // полоса внизу под масштабную линейку
      const fieldH = H - barH;

      // поле: ⊙ / ⊗
      const sp = L.clamp(W / 12, 26, 46);
      const r = L.clamp(sp * 0.17, 4, 7);
      const nx = Math.max(1, Math.floor(W / sp)), ny = Math.max(1, Math.floor(fieldH / sp));
      const ox = (W - (nx - 1) * sp) / 2, oy = (fieldH - (ny - 1) * sp) / 2;
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) fieldSymbol(ctx, ox + i * sp, oy + j * sp, r, out, c.fieldB);
      ctx.restore();

      // легенда
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = c.bg; ctx.fillRect(4, 4, 112, 26); ctx.restore();
      L.text(ctx, '→B', 10, 19, c.fieldB, { font: 'italic 600 15px system-ui, sans-serif' });
      L.text(ctx, out ? '⊙ к нам' : '⊗ от нас', 30, 19, c.fieldB, { font: '13px system-ui, sans-serif' });

      // масштаб: окружность занимает 40–100 % от Rmax
      const cx = W / 2, cy = fieldH / 2 + 6;
      const Rmax = Math.max(24, Math.min(W * 0.4, fieldH / 2 - 18));
      const finite = Number.isFinite(ph.R) && ph.R > 0;
      const g = niceAtLeast(finite ? ph.R / 3 : 1);
      const gpx = Rmax / 3;
      const Rpx = finite ? (ph.R / g) * gpx : Rmax;

      // траектория (пунктир) и след
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(cx, cy, Rpx, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (trav > 0.01) {
        ctx.save();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, Rpx, -theta - ph.s * trav, -theta, ph.s < 0); ctx.stroke();
        ctx.restore();
      }

      // центр и радиус
      const px = cx + Rpx * Math.cos(theta), py = cy - Rpx * Math.sin(theta);
      L.dot(ctx, cx, cy, c.muted, 3);
      L.text(ctx, 'O', cx + 5, cy + 11, c.muted, { font: '12px system-ui, sans-serif' });
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'R', (cx + px) / 2 + 6, (cy + py) / 2 - 9, c.muted, { font: 'italic 13px system-ui, sans-serif' });

      // векторы скорости и силы Лоренца
      const vl = L.clamp(Rpx * 0.6, 30, 64);
      const vx = ph.s * Math.sin(theta), vy = ph.s * Math.cos(theta); // касательная (экранные координаты)
      const fx = -Math.cos(theta), fy = Math.sin(theta); // к центру
      L.arrow(ctx, px, py, px + vx * vl, py + vy * vl, c.velocity, { width: 2.5, label: '→v', labelOffset: labelOff(vx, vy, 14) });
      L.arrow(ctx, px, py, px + fx * vl, py + fy * vl, c.force, { width: 2.5, label: '→F_Л', labelOffset: labelOff(fx, fy, 30) });

      // частица
      ctx.save();
      ctx.fillStyle = c.text;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      L.text(ctx, ph.P.mark, px, py + 1, c.bg, { font: '700 11px system-ui, sans-serif', align: 'center' });

      // масштабная линейка
      const sbX = 14, sbY = H - 14;
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + gpx, sbY);
      ctx.moveTo(sbX, sbY - 5); ctx.lineTo(sbX, sbY + 5);
      ctx.moveTo(sbX + gpx, sbY - 5); ctx.lineTo(sbX + gpx, sbY + 5);
      ctx.stroke();
      ctx.restore();
      L.text(ctx, lengthText(g), sbX + gpx + 8, sbY, c.text, { font: '13px system-ui, sans-serif' });
      L.text(ctx, ph.s > 0 ? '↻ по часовой' : '↺ против часовой', W - 10, sbY, c.muted, { font: '13px system-ui, sans-serif', align: 'right' });
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    updateReadout();
    draw();
    return { destroy: d.run };
  },
};
