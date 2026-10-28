// Модель «Проводник на рельсах в магнитном поле» (ЭДС в движущемся проводнике, правило Ленца, сила Ампера).
import * as L from './_lib.js';

const SLOW = 0.1; // анимация замедлена в 10 раз
const RAIL_LEN = 2.15; // длина рельсов на рисунке, м
const X_MIN = 0.15, X_MAX = 2.0; // пределы положения перемычки, м

/** Три значащие цифры. */
function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
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

export default {
  id: 'rails-induction',
  title: 'Проводник на рельсах в магнитном поле',
  codes: ['3.4.1', '3.4.3', '3.4.4', '3.4.5', '3.3.3'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Перемычка длиной l скользит по горизонтальным рельсам, замкнутым резистором R; поле B перпендикулярно плоскости рельсов. ' +
        'Сопротивлением перемычки и рельсов пренебрегаем. Индукционный ток направлен так, что его магнитное поле препятствует изменению потока (правило Ленца), ' +
        'а сила Ампера на перемычку всегда направлена против скорости — тормозит её. Анимация замедлена в 10 раз.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 230, maxHeight: 520, label: 'Перемычка на рельсах в магнитном поле, индукционный ток и сила Ампера' });
    d.add(cv.destroy);

    const DEF = { dir: 'in', B: 0.5, l: 0.4, v: 2, R: 2, x: 0.5 };
    let x = DEF.x; // расстояние от резистора до перемычки, м

    const onParam = () => { updRO(true); draw(); };
    const sDir = L.choice(ui.controls, {
      label: 'Вектор <i>B</i>', value: DEF.dir, onChange: onParam,
      options: [{ value: 'out', label: '⊙ к нам' }, { value: 'in', label: '⊗ от нас' }],
    });
    const sB = L.slider(ui.controls, { label: 'Индукция <i>B</i>', min: 0.1, max: 2, step: 0.1, value: DEF.B, unit: 'Тл', onInput: onParam });
    const sL = L.slider(ui.controls, { label: 'Длина перемычки <i>l</i>', min: 0.2, max: 1, step: 0.05, value: DEF.l, unit: 'м', onInput: onParam });
    const sV = L.slider(ui.controls, { label: 'Скорость <i>v</i> (+ вправо)', min: -5, max: 5, step: 0.5, value: DEF.v, unit: 'м/с', onInput: onParam });
    const sR = L.slider(ui.controls, { label: 'Сопротивление <i>R</i>', min: 0.5, max: 10, step: 0.5, value: DEF.R, unit: 'Ом', onInput: onParam });

    const anim = L.animator(step, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sDir.set(DEF.dir); sB.set(DEF.B); sL.set(DEF.l); sV.set(DEF.v); sR.set(DEF.R);
      x = DEF.x;
      play.sync(); updRO(true); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function phys() {
      const B = sB.value, l = sL.value, v = sV.value, R = sR.value;
      const emf = B * l * Math.abs(v); // |ℰ| = Blv
      const I = R > 0 ? emf / R : 0;
      const FA = I * B * l; // F_A = IBl (проводник ⊥ B)
      const S = l * x;
      const Phi = B * S;
      const dPhi = B * l * v; // скорость изменения потока: > 0 — растёт
      // +1 — ток по часовой стрелке (смотрим на рисунок), −1 — против, 0 — тока нет.
      // B к нам, v вправо: поток «к нам» растёт → поле тока внутри контура «от нас» → ток по часовой.
      const sense = v === 0 ? 0 : (sDir.value === 'out' ? 1 : -1) * Math.sign(v);
      return { B, l, v, R, emf, I, FA, S, Phi, dPhi, sense };
    }

    function step(dt) {
      const v = sV.value;
      if (v !== 0) {
        // у края — пауза; следующий «Пуск» начинает новый проход с начала рельсов
        if (v > 0 && x >= X_MAX) x = X_MIN;
        else if (v < 0 && x <= X_MIN) x = X_MAX;
        x += v * SLOW * dt;
        if (x >= X_MAX || x <= X_MIN) {
          x = L.clamp(x, X_MIN, X_MAX);
          anim.stop(); play.sync();
          updRO(true); draw();
          return;
        }
      }
      updRO(false);
      draw();
    }

    let roTime = 0;
    function updRO(force) {
      const now = performance.now();
      if (!force && now - roTime < 200) return;
      roTime = now;
      const p = phys();
      ro.set([
        ['<i>x</i> (от резистора до перемычки)', f3(x) + ' м'],
        ['<i>S</i> = <i>l</i>·<i>x</i>', f3(p.S) + ' м²'],
        ['Φ = <i>BS</i>', f3(p.Phi) + ' Вб'],
        ['|ΔΦ/Δ<i>t</i>| = <i>Blv</i>', p.v === 0 ? '0 (поток не меняется)' : `${f3(Math.abs(p.dPhi))} Вб/с (поток ${p.dPhi > 0 ? 'растёт' : 'убывает'})`],
        ['ℰ = <i>Blv</i>', f3(p.emf) + ' В'],
        ['<i>I</i> = ℰ/<i>R</i>', f3(p.I) + ' А'],
        ['<i>F</i><sub>A</sub> = <i>IBl</i>', f3(p.FA) + ' Н'],
        ['Ток в контуре', p.sense === 0 ? 'нет' : p.sense > 0 ? 'по часовой стрелке' : 'против часовой стрелки'],
        ['Сила Ампера', p.v === 0 ? '—' : `${p.v > 0 ? 'влево' : 'вправо'}, против скорости (тормозит)`],
      ]);
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const p = phys();
      const out = sDir.value === 'out';

      // поле
      const sp = L.clamp(W / 14, 24, 44);
      const r = L.clamp(sp * 0.16, 3.5, 6.5);
      const nx = Math.max(1, Math.floor(W / sp)), ny = Math.max(1, Math.floor(H / sp));
      const ox = (W - (nx - 1) * sp) / 2, oy = (H - (ny - 1) * sp) / 2;
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) fieldSymbol(ctx, ox + i * sp, oy + j * sp, r, out, c.fieldB);
      ctx.restore();

      // легенда
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = c.bg; ctx.fillRect(4, 4, 112, 26); ctx.restore();
      L.text(ctx, '→B', 10, 19, c.fieldB, { font: 'italic 600 15px system-ui, sans-serif' });
      L.text(ctx, out ? '⊙ к нам' : '⊗ от нас', 30, 19, c.fieldB, { font: '13px system-ui, sans-serif' });

      // геометрия
      const padL = 40, padR = 14, padT = 46, padB = 44;
      const k = Math.max(10, Math.min((W - padL - padR) / RAIL_LEN, H - padT - padB)); // px на метр
      const gap = p.l * k;
      const yMid = padT + (H - padT - padB) / 2;
      const yTop = yMid - gap / 2, yBot = yMid + gap / 2;
      const xRes = padL, xEnd = padL + RAIL_LEN * k, xr = padL + x * k;
      const loopW = xr - xRes;

      // площадь контура
      ctx.save();
      ctx.globalAlpha = 0.14; ctx.fillStyle = c.fieldB;
      ctx.fillRect(xRes, yTop, loopW, gap);
      ctx.restore();
      if (loopW > 44 && gap > 46) {
        L.text(ctx, 'S', xRes + loopW / 2, yMid + Math.min(gap * 0.28, 20), c.fieldB, { font: 'italic 600 14px system-ui, sans-serif', align: 'center' });
      }

      // рельсы
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xRes, yTop); ctx.lineTo(xEnd, yTop);
      ctx.moveTo(xRes, yBot); ctx.lineTo(xEnd, yBot);
      ctx.stroke();
      // провод с резистором
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xRes, yTop); ctx.lineTo(xRes, yBot); ctx.stroke();
      const rh = Math.min(34, gap * 0.6), rw = 12;
      ctx.fillStyle = c.bg;
      ctx.fillRect(xRes - rw / 2, yMid - rh / 2, rw, rh);
      ctx.strokeRect(xRes - rw / 2, yMid - rh / 2, rw, rh);
      ctx.restore();
      L.text(ctx, 'R', xRes - rw / 2 - 5, yMid, c.text, { font: 'italic 14px system-ui, sans-serif', align: 'right' });

      // перемычка
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(xr, yTop - 10); ctx.lineTo(xr, yBot + 10); ctx.stroke();
      ctx.restore();
      // подпись l — со стороны силы Ампера (стрелка тока у перемычки — с другой стороны)
      L.text(ctx, 'l', p.v >= 0 ? xr - 14 : xr + 9, yTop + Math.max(9, gap * 0.16), c.text, { font: 'italic 14px system-ui, sans-serif' });

      // размер x
      const yx = yBot + 26;
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRes, yx); ctx.lineTo(xr, yx);
      ctx.moveTo(xRes, yx - 4); ctx.lineTo(xRes, yx + 4);
      ctx.moveTo(xr, yx - 4); ctx.lineTo(xr, yx + 4);
      ctx.stroke();
      ctx.restore();
      L.text(ctx, 'x', xRes + loopW / 2, yx + 10, c.muted, { font: 'italic 13px system-ui, sans-serif', align: 'center' });

      const sv = Math.sign(p.v);
      // индукционный ток
      if (p.sense !== 0) {
        const cw = p.sense; // +1 по часовой: верх →, перемычка ↓, низ ←, резистор ↑
        const a = Math.min(14, loopW / 4);
        const ah = Math.min(14, gap / 4);
        const xm = (xRes + xr) / 2;
        const o = { width: 2, head: 7 };
        L.arrow(ctx, xm - cw * a, yTop + 9, xm + cw * a, yTop + 9, c.accent, { ...o, label: 'I', labelOffset: [cw > 0 ? 4 : -10, -2] });
        L.arrow(ctx, xm + cw * a, yBot - 9, xm - cw * a, yBot - 9, c.accent, o);
        const xc = xr + sv * 12; // стрелка тока у перемычки — с противоположной от силы Ампера стороны
        L.arrow(ctx, xc, yMid - cw * ah, xc, yMid + cw * ah, c.accent, o);
        L.arrow(ctx, xRes + 13, yMid + cw * ah, xRes + 13, yMid - cw * ah, c.accent, o);
      }

      // скорость и сила Ампера
      if (p.v !== 0) {
        const vlen = 16 + 9 * Math.abs(p.v);
        const yv = yTop - 18;
        L.arrow(ctx, xr, yv, xr + sv * vlen, yv, c.velocity, { width: 2.5, label: '→v', labelOffset: [sv > 0 ? 6 : -18, -10] });
        const flen = L.clamp(18 + 22 * Math.sqrt(p.FA), 18, 72);
        L.arrow(ctx, xr, yMid, xr - sv * flen, yMid, c.force, { width: 2.5, label: '→F_A', labelOffset: [sv > 0 ? -26 : 4, -12] });
      }
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    updRO(true);
    draw();
    return { destroy: d.run };
  },
};
