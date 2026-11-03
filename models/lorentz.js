// Модель «Частица в однородном магнитном поле» (сила Лоренца, 3.3.4).
// Масштаб длины и времени постоянны для данного типа частицы: окружность на экране ∝ R, оборот на экране ∝ T.
import * as L from './_lib.js';

/** Показания: главные строки на виду, остальное — в раскрывающемся блоке. */
function moreReadout(parent) {
  const main = L.readout(parent);
  const det = document.createElement('details');
  det.className = 'model-more';
  det.style.marginTop = '8px';
  const sum = document.createElement('summary');
  sum.textContent = 'Ещё величины';
  sum.style.cursor = 'pointer';
  det.append(sum);
  parent.append(det);
  const more = L.readout(det);
  return { set(rows, extra = []) { main.set(rows); more.set(extra); det.hidden = !extra.length; } };
}

const E_CH = 1.6e-19; // Кл
const M_P = 1.673e-27; // кг
const PARTICLES = {
  e: { name: 'электрон', q: -E_CH, m: 9.1e-31, mark: '−', r: 6, group: 'e' },
  p: { name: 'протон', q: E_CH, m: M_P, mark: '+', r: 9, group: 'ion' },
  a: { name: 'α-частица', q: 2 * E_CH, m: 6.64e-27, mark: '2+', r: 11, group: 'ion' }, // m ≈ 4 а.е.м.
};
// Постоянные масштабы. Протон и α-частица сравнимы напрямую; у электрона и длина, и время растянуты ещё в 1000 раз,
// поэтому скорость на экране ∝ v для всех частиц.
const SCALE = {
  ion: { view: 0.3, ruler: 0.05, slow: 6e6 },   // край рисунка — 30 см; 1 мкс реального времени = 6 с на экране
  e: { view: 3e-4, ruler: 5e-5, slow: 6e9 },    // край рисунка — 300 мкм; 1 нс реального времени = 6 с на экране
};
const REF_F = 1.6e-14; // Н, сила для опорной длины стрелки (протон, v = 1·10⁶ м/с, B = 100 мТл)

/** Три значащие цифры. */
function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
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

/** Подпись на подложке, чтобы не сливалась со значками поля. */
function plated(ctx, str, x, y, color, bg, font) {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(str.replace(/[→_{}]/g, '')).width + 6;
  ctx.globalAlpha = 0.85; ctx.fillStyle = bg;
  ctx.fillRect(x - 3, y - 10, w, 20);
  ctx.restore();
  L.text(ctx, str, x, y, color, { font });
}

/** Текстовая плашка с переносом по словам. */
function noteBox(ctx, str, x, y, maxW, color, c) {
  const font = '600 12px system-ui, sans-serif';
  ctx.save();
  ctx.font = font;
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW - 12 && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  const h = lines.length * 16 + 6;
  ctx.globalAlpha = 0.92; ctx.fillStyle = c.bg; ctx.fillRect(x, y, maxW, h);
  ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, maxW - 1, h - 1);
  ctx.restore();
  lines.forEach((ln, i) => L.text(ctx, ln, x + 6, y + 11 + i * 16, color, { font }));
}

export default {
  id: 'lorentz',
  title: 'Заряженная частица в магнитном поле',
  codes: ['3.3.4'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'При v ⊥ B частица идёт по окружности. Масштаб постоянный: вдвое больше v — вдвое больше окружность, а время оборота то же; вдвое больше B — и радиус, и время вдвое меньше.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 290, maxHeight: 420, label: 'Движение заряженной частицы по окружности в однородном магнитном поле' });
    d.add(cv.destroy);

    const DEF = { part: 'p', dir: 'in', v: 1, B: 100 };
    let theta = Math.PI / 2; // угол положения частицы (математический, от оси x против часовой)
    let trav = 0;            // пройденный угол для следа (≤ 2π)
    let committed = null;    // последнее «отпущенное» состояние { R, group }
    let ghost = null;        // окружность «было»
    let dragging = false;

    const onSlider = () => {
      if (!dragging) { dragging = true; ghost = committed; }
      trav = 0; updateReadout(); draw();
    };
    const onRelease = () => { dragging = false; commit(); };
    const onChoice = () => { ghost = committed; commit(); trav = 0; updateReadout(); draw(); };

    const sPart = L.choice(ui.controls, { key: 'sPart',
      label: 'Частица', value: DEF.part, onChange: onChoice,
      options: [{ value: 'e', label: 'электрон' }, { value: 'p', label: 'протон' }, { value: 'a', label: 'α-частица' }],
    });
    const sDir = L.choice(ui.controls, { key: 'sDir',
      label: 'Вектор <i>B</i>', value: DEF.dir, onChange: onChoice,
      options: [{ value: 'out', label: '⊙ к нам' }, { value: 'in', label: '⊗ от нас' }],
    });
    const sV = L.slider(ui.controls, { key: 'sV', label: 'Скорость <i>v</i>', min: 0.1, max: 10, step: 0.1, value: DEF.v, unit: '·10⁶ м/с', onInput: onSlider });
    const sB = L.slider(ui.controls, { key: 'sB', label: 'Индукция <i>B</i>', min: 1, max: 500, step: 1, value: DEF.B, unit: 'мТл', onInput: onSlider });
    for (const s of [sV, sB]) {
      s.input.addEventListener('change', onRelease);
      d.add(() => s.input.removeEventListener('change', onRelease));
    }

    const anim = L.animator(step, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sPart.set(DEF.part); sDir.set(DEF.dir); sV.set(DEF.v); sB.set(DEF.B);
      theta = Math.PI / 2; trav = 0; ghost = null; dragging = false; commit();
      play.sync(); updateReadout(); draw();
    }, { reset: true });
    const ro = moreReadout(ui.readout);

    function phys() {
      const P = PARTICLES[sPart.value] || PARTICLES.p;
      const v = sV.value * 1e6; // м/с
      const B = sB.value * 1e-3; // Тл
      const qa = Math.abs(P.q);
      const F = qa * v * B;
      const R = (P.m * v) / (qa * B);
      const T = (2 * Math.PI * P.m) / (qa * B);
      // s = +1 — по часовой стрелке (смотрим на рисунок), −1 — против.
      // ω⃗ = −qB⃗/m: для q > 0 и B⃗ к нам вращение по часовой.
      const s = Math.sign(P.q) * (sDir.value === 'out' ? 1 : -1);
      const sc = SCALE[P.group];
      return { P, v, B, F, R, T, s, sc, Tscreen: T * sc.slow };
    }

    function commit() { const p = phys(); committed = { R: p.R, group: p.P.group }; }

    function step(dt) {
      const { s, Tscreen } = phys();
      const om = (2 * Math.PI) / Tscreen;
      theta -= s * om * dt;
      theta = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      trav = Math.min(2 * Math.PI, trav + om * dt);
      draw();
    }

    function updateReadout() {
      const { P, v, B, F, R, T, s, sc, Tscreen } = phys();
      const rows = [
        ['<i>R</i> = <i>mv</i>/(|<i>q</i>|<i>B</i>)', R >= 1 ? `${f3(R)} м` : `${f3(R)} м (${lengthText(R)})`],
        ['<i>T</i> = 2π<i>m</i>/(|<i>q</i>|<i>B</i>)', f3(T) + ' с'],
        ['Один оборот на экране', `${L.fmt(Tscreen, 1)} с (от v не зависит)`],
        ['<i>F</i><sub>Л</sub> = |<i>q</i>|<i>vB</i>', f3(F) + ' Н'],
        ['Вращение', s > 0 ? 'по часовой стрелке' : 'против часовой стрелки'],
      ];
      if (P !== PARTICLES.p) {
        const ratio = (P.m / Math.abs(P.q)) / (M_P / E_CH);
        rows.push(['Сравнение с протоном при тех же <i>v</i> и <i>B</i>', ratio < 1
          ? `R и T в ${L.fmt(1 / ratio, 0)} раз меньше`
          : `R и T в ${L.fmt(ratio, 2)} раза больше`]);
      }
      ro.set(rows, [
        ['Заряд <i>q</i>', L.fmt(P.q) + ' Кл'],
        ['Масса <i>m</i>', L.fmt(P.m, 3) + ' кг'],
        ['Скорость <i>v</i>', L.fmt(v) + ' м/с'],
        ['Индукция <i>B</i>', f3(B) + ' Тл'],
        ['Масштаб рисунка', `край рисунка — ${lengthText(sc.view)} от центра`],
        ['Правило левой руки', 'линии B входят в ладонь, четыре пальца — по скорости положительной частицы (для отрицательной — против скорости), отогнутый большой палец показывает силу'],
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
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) fieldSymbol(ctx, ox + i * sp, oy + j * sp, r, out, c.fieldB);
      ctx.restore();

      // постоянный масштаб: от него зависит только тип частицы
      const cx = W / 2, cy = fieldH / 2;
      const Rmax = Math.max(24, fieldH / 2 - 6);
      const pxPerM = Rmax / ph.sc.view;
      const Rpx = ph.R * pxPerM;
      const tooBig = Rpx > Rmax;
      const tooSmall = Rpx < 8;

      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, fieldH); ctx.clip();

      // окружность «было»
      if (ghost && ghost.group === ph.P.group && Math.abs(ghost.R - ph.R) > ph.R * 1e-6) {
        const gr = ghost.R * pxPerM;
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]);
        ctx.beginPath(); ctx.arc(cx, cy, gr, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        if (gr <= Rmax) plated(ctx, 'было', cx + gr * 0.71 + 3, cy + gr * 0.71, c.muted, c.bg, '12px system-ui, sans-serif');
      }

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
      if (!tooSmall) {
        L.text(ctx, 'O', cx + 5, cy + 11, c.muted, { font: '12px system-ui, sans-serif' });
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
        ctx.restore();
        if (!tooBig) L.text(ctx, 'R', (cx + px) / 2 + 6, (cy + py) / 2 - 9, c.muted, { font: 'italic 13px system-ui, sans-serif' });
      }

      // векторы: длина растёт с v и с F (условно, но в одной шкале для всех частиц)
      const vl = L.clamp(22 + 8 * sV.value, 22, 90);
      const fl = L.clamp(26 * Math.sqrt(ph.F / REF_F), 14, 90);
      const vx = ph.s * Math.sin(theta), vy = ph.s * Math.cos(theta); // касательная (экранные координаты)
      const fx = -Math.cos(theta), fy = Math.sin(theta); // к центру
      const font = '600 14px system-ui, sans-serif';
      L.arrow(ctx, px, py, px + vx * vl, py + vy * vl, c.velocity, { width: 2.5 });
      L.arrow(ctx, px, py, px + fx * fl, py + fy * fl, c.force, { width: 2.5 });
      const lx = (x, ux, w) => (ux >= -0.3 ? x + ux * 8 + 3 : x + ux * 8 - w);
      plated(ctx, '→v', lx(px + vx * vl, vx, 16), py + vy * vl + vy * 12, c.velocity, c.bg, font);
      plated(ctx, '→F_Л', lx(px + fx * fl, fx, 32), py + fy * fl + fy * 12, c.force, c.bg, font);

      // частица: электрон, протон и α-частица различаются размером, цветом и знаком
      ctx.save();
      ctx.fillStyle = ph.P.group === 'e' ? c.accent : c.text;
      ctx.beginPath(); ctx.arc(px, py, ph.P.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      L.text(ctx, ph.P.mark, px, py + 1, c.bg, { font: `700 ${ph.P.r >= 9 ? 11 : 10}px system-ui, sans-serif`, align: 'center' });
      ctx.restore();

      // легенда
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = c.bg; ctx.fillRect(4, 4, 112, 26); ctx.restore();
      L.text(ctx, '→B', 10, 19, c.fieldB, { font: 'italic 600 15px system-ui, sans-serif' });
      L.text(ctx, out ? '⊙ к нам' : '⊗ от нас', 30, 19, c.fieldB, { font: '13px system-ui, sans-serif' });
      if (ph.P.group === 'e') {
        plated(ctx, 'увеличено в 1000 раз', Math.max(122, W - 140), 17, c.accent, c.bg, '600 11px system-ui, sans-serif');
      }

      // подсказки: масштаб не подстраивается
      const hintW = Math.min(W - 16, 420);
      if (tooBig) {
        noteBox(ctx, `Окружность не помещается: R = ${lengthText(ph.R)}. Масштаб постоянный — уменьши v или увеличь B.`, (W - hintW) / 2, 36, hintW, c.force, c);
      } else if (tooSmall) {
        noteBox(ctx, `Окружность слишком мала для этого масштаба: R = ${lengthText(ph.R)}. Увеличь v или уменьши B.`, (W - hintW) / 2, 36, hintW, c.force, c);
      }

      // масштабная линейка: не зависит от v и B
      const gpx = ph.sc.ruler * pxPerM;
      const sbX = 14, sbY = H - 14;
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sbX, sbY); ctx.lineTo(sbX + gpx, sbY);
      ctx.moveTo(sbX, sbY - 5); ctx.lineTo(sbX, sbY + 5);
      ctx.moveTo(sbX + gpx, sbY - 5); ctx.lineTo(sbX + gpx, sbY + 5);
      ctx.stroke();
      ctx.restore();
      L.text(ctx, lengthText(ph.sc.ruler), sbX + gpx + 8, sbY, c.text, { font: '13px system-ui, sans-serif' });
      L.text(ctx, `оборот: ${L.fmt(ph.Tscreen, 1)} с ${ph.s > 0 ? '↻' : '↺'}`, W - 10, sbY, c.muted, { font: '13px system-ui, sans-serif', align: 'right' });
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    commit();
    updateReadout();
    draw();
    return { destroy: d.run };
  },
};
