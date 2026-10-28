// Модель «Закон Архимеда и условие плавания» (1.3.5, 1.3.6).
import * as L from './_lib.js';

const G = 10; // м/с²
const LIQUIDS = { water: 1000, kerosene: 800, mercury: 13600 }; // кг/м³
const DEF = { liquid: 'water', rhoL: 1000, rhoB: 600, V: 2, hang: false }; // V — в дм³ (на слайдере)
const V_MAX = 5; // дм³
const FONT = 'italic 13px system-ui, sans-serif';

function hatchH(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x1 + 7; x <= x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke();
  ctx.restore();
}

/** Подпись «m→g» (стрелка только над g). */
function mgLabel(ctx, x, y, color, alignRight = false) {
  ctx.save(); ctx.font = FONT;
  const wm = ctx.measureText('m').width;
  ctx.restore();
  const wg = 9;
  const x0 = alignRight ? x - wm - wg : x;
  L.text(ctx, 'm', x0, y, color, { font: FONT });
  L.text(ctx, '→g', x0 + wm + 1, y, color, { font: FONT });
}

export default {
  id: 'archimedes',
  title: 'Тело в жидкости: сила Архимеда и условие плавания',
  codes: ['1.3.5', '1.3.6', '1.2.2'],
  mount(el) {
    const d = L.disposer();
    d.add(() => { el.innerHTML = ''; el.classList.remove('model'); });
    const ui = L.layout(el, {
      caption: 'Брусок в сосуде с жидкостью. F_A = ρ_ж·g·V_погр. Сравните плотности тела и жидкости: тонет, плавает внутри или всплывает.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.75, label: 'Брусок в сосуде с жидкостью: сила тяжести, сила Архимеда, сила реакции дна или натяжения нити' });
    d.add(cv.destroy);

    const liq = L.choice(ui.controls, {
      label: 'Жидкость',
      options: [
        { value: 'water', label: 'вода' },
        { value: 'kerosene', label: 'керосин' },
        { value: 'mercury', label: 'ртуть' },
        { value: 'custom', label: 'своя' },
      ],
      value: DEF.liquid,
      onChange: (v) => { if (LIQUIDS[v]) sRhoL.set(LIQUIDS[v]); update(); },
    });
    const sRhoL = L.slider(ui.controls, {
      label: 'Плотность жидкости ρ<sub>ж</sub>', min: 500, max: 14000, step: 100, value: DEF.rhoL, unit: 'кг/м³',
      format: (v) => L.fmt(v, 0),
      onInput: (v) => {
        const key = Object.keys(LIQUIDS).find((k) => LIQUIDS[k] === v);
        liq.set(key || 'custom');
        update();
      },
    });
    const sRhoB = L.slider(ui.controls, {
      label: 'Плотность тела ρ<sub>т</sub>', min: 100, max: 20000, step: 100, value: DEF.rhoB, unit: 'кг/м³',
      format: (v) => L.fmt(v, 0), onInput: () => update(),
    });
    const sV = L.slider(ui.controls, {
      label: 'Объём тела V', min: 0.1, max: V_MAX, step: 0.1, value: DEF.V, unit: 'дм³', onInput: () => update(),
    });
    const cbHang = L.checkbox(ui.controls, { label: 'Тело на нити (динамометр)', checked: DEF.hang, onChange: () => update() });
    L.button(ui.controls, 'Сброс', () => {
      liq.set(DEF.liquid); sRhoL.set(DEF.rhoL); sRhoB.set(DEF.rhoB); sV.set(DEF.V); cbHang.set(DEF.hang);
      update();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function calc() {
      const rl = sRhoL.value, rb = sRhoB.value;
      const V = sV.value / 1000; // м³
      const m = rb * V;
      const mg = m * G;
      const regime = rb < rl ? 'float' : rb === rl ? 'inside' : 'sink';
      const frac = regime === 'float' ? rb / rl : 1; // V_погр / V из ρ_т·V = ρ_ж·V_погр
      const Vsub = frac * V;
      const FA = rl * G * Vsub;
      const rest = regime === 'sink' ? Math.max(0, mg - FA) : 0; // N или T
      const hang = cbHang.value && regime === 'sink';
      return { rl, rb, V, m, mg, frac, Vsub, FA, rest, regime, hang };
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const r = calc();
      ctx.clearRect(0, 0, W, H);

      // сосуд
      const vx0 = W * 0.1, vx1 = W * 0.9;
      const vyTop = H * 0.26, vyBot = H - 22;
      const yl = vyTop + (vyBot - vyTop) * 0.12; // уровень жидкости
      const cx = (vx0 + vx1) / 2;

      hatchH(ctx, vx0 - 12, vx1 + 12, vyBot + 1.5, c.text);
      ctx.save();
      ctx.globalAlpha = r.rl > 5000 ? 0.28 : 0.16;
      ctx.fillStyle = r.rl > 5000 ? c.muted : c.accent;
      ctx.fillRect(vx0, yl, vx1 - vx0, vyBot - yl);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(vx0, yl); ctx.lineTo(vx1, yl); ctx.stroke();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(vx0, vyTop); ctx.lineTo(vx0, vyBot); ctx.lineTo(vx1, vyBot); ctx.lineTo(vx1, vyTop); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'ρ_ж', vx1 - 8, yl + 14, c.muted, { font: FONT, align: 'right' });

      // брусок (куб), сторона ∝ ∛V
      const depth = vyBot - yl;
      const sMax = Math.min((vx1 - vx0) * 0.3, depth * 0.5);
      const s = Math.max(14, sMax * Math.cbrt(r.V / (V_MAX / 1000)));
      let top;
      if (r.regime === 'float') top = yl - s * (1 - r.frac);
      else if (r.regime === 'inside') top = yl + (depth - s) / 2;
      else if (r.hang) top = yl + (depth - s) * 0.4;
      else top = vyBot - s;
      const bx = cx - s / 2;
      const cy = top + s / 2;

      // нить и динамометр
      if (r.hang) {
        const dynH = Math.max(18, vyTop * 0.55), dynY = 4;
        ctx.save();
        ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
        ctx.strokeRect(cx - 8, dynY, 16, dynH);
        ctx.beginPath(); ctx.moveTo(cx, dynY + dynH); ctx.lineTo(cx, top); ctx.stroke();
        ctx.restore();
        L.text(ctx, L.fmt(r.rest) + ' Н', cx + 14, dynY + dynH / 2, c.text, { font: '12px system-ui, sans-serif' });
      }

      ctx.save();
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillRect(bx, top, s, s); ctx.strokeRect(bx, top, s, s);
      ctx.restore();

      // глубина погружения
      if (r.regime === 'float') {
        const hx = bx + s + 10, yb = top + s;
        if (yb - yl > 8) {
          L.arrow(ctx, hx, (yl + yb) / 2, hx, yl, c.muted, { width: 1, head: 5 });
          L.arrow(ctx, hx, (yl + yb) / 2, hx, yb, c.muted, { width: 1, head: 5 });
          L.text(ctx, 'h_{погр}', hx + 4, (yl + yb) / 2, c.muted, { font: '12px system-ui, sans-serif' });
        }
      }

      // силы
      const maxF = Math.max(r.mg, r.FA, r.rest, 1e-9);
      const k = Math.min(H * 0.24, 80) / maxF;
      const len = (F) => (F > 0 ? Math.max(6, F * k) : 0);
      L.dot(ctx, cx, cy, c.force, 2.5);
      // m→g
      const lg = len(r.mg);
      L.arrow(ctx, cx, cy, cx, cy + lg, c.force);
      mgLabel(ctx, cx + 6, cy + lg - 4, c.force);
      // F_A
      const xa = cx - s * 0.28, la = len(r.FA);
      if (la > 0) {
        L.arrow(ctx, xa, cy, xa, cy - la, c.force);
        L.text(ctx, '→F_A', xa - 6, cy - la + 4, c.force, { font: FONT, align: 'right' });
      }
      // N или T
      if (r.regime === 'sink' && r.rest > 0) {
        const lr = len(r.rest);
        if (r.hang) {
          L.arrow(ctx, cx, top, cx, top - lr, c.force);
          L.text(ctx, '→T', cx + 6, top - lr + 6, c.force, { font: FONT });
        } else {
          const xn = cx + s * 0.28;
          L.arrow(ctx, xn, top + s, xn, top + s - lr, c.force);
          L.text(ctx, '→N', xn + 6, top + s - lr + 6, c.force, { font: FONT });
        }
      }
    }

    function updateReadout() {
      const r = calc();
      const rows = [
        ['ρ<sub>ж</sub>', L.fmt(r.rl, 0) + ' кг/м³'],
        ['ρ<sub>т</sub>', L.fmt(r.rb, 0) + ' кг/м³'],
        ['V', L.fmt(r.V, 4) + ' м³'],
        ['m = ρ<sub>т</sub>V', L.fmt(r.m, 3) + ' кг'],
        ['mg', L.fmt(r.mg) + ' Н'],
        ['Доля погружения V<sub>погр</sub>/V', L.fmt(r.frac, 3)],
        ['F<sub>A</sub> = ρ<sub>ж</sub>gV<sub>погр</sub>', L.fmt(r.FA) + ' Н'],
      ];
      if (r.regime === 'sink') {
        rows.push(r.hang
          ? ['Показание динамометра T = mg − F<sub>A</sub>', L.fmt(r.rest) + ' Н']
          : ['Сила реакции дна N = mg − F<sub>A</sub>', L.fmt(r.rest) + ' Н']);
      } else if (cbHang.value) {
        rows.push(['Нить', 'не натянута, T = 0 Н']);
      }
      let verdict;
      if (r.regime === 'sink') verdict = 'ρ_т > ρ_ж — тонет' + (r.hang ? ' (удерживается нитью)' : ', лежит на дне');
      else if (r.regime === 'inside') verdict = 'ρ_т = ρ_ж — плавает внутри жидкости';
      else verdict = 'ρ_т < ρ_ж — всплывает и плавает на поверхности (F_A = mg)';
      rows.push(['Вывод', verdict]);
      ro.set(rows);
    }

    function update() { draw(); updateReadout(); }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    update();
    return { destroy: d.run };
  },
};
