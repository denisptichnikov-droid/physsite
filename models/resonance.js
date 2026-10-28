// Модель «Вынужденные колебания. Резонанс» (1.5.3 — качественно; 1.5.2 — собственная частота).
import * as L from './_lib.js';

const F0 = 1;            // амплитуда вынуждающей силы, Н (только для формы кривой)
const NU_MAX = 8;        // Гц, правый край графика
const SLOW = 0.25;       // замедление анимации
const REF_BETAS = [0.5, 1, 2]; // с⁻¹, справочные кривые
const DEF = { m: 1, k: 100, beta: 0.5, nu: 1 };
const FONT = 'italic 13px system-ui, sans-serif';
const SMALL = '11px system-ui, sans-serif';

/** Амплитуда установившихся колебаний (только форма кривой, не формула ЕГЭ). */
function amp(w, w0, beta, m) {
  return (F0 / m) / Math.sqrt((w0 * w0 - w * w) ** 2 + (2 * beta * w) ** 2);
}

function hatchV(ctx, x, y1, y2, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath();
  for (let y = y1; y <= y2 - 7; y += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke(); ctx.restore();
}
function hatchFloor(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath();
  for (let x = x1 + 7; x <= x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke(); ctx.restore();
}
function spring(ctx, x1, y, x2, color, coils = 8, a = 6) {
  const len = x2 - x1, lead = Math.min(8, Math.abs(len) * 0.15), body = len - 2 * lead, n = coils * 2;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 + lead, y);
  for (let i = 1; i < n; i++) ctx.lineTo(x1 + lead + (body * i) / n, y + (i % 2 ? a : -a));
  ctx.lineTo(x2 - lead, y); ctx.lineTo(x2, y); ctx.stroke(); ctx.restore();
}

export default {
  id: 'resonance',
  title: 'Вынужденные колебания и резонанс',
  codes: ['1.5.3', '1.5.2'],
  mount(el) {
    const d = L.disposer();
    d.add(() => { el.innerHTML = ''; el.classList.remove('model'); });
    const ui = L.layout(el, {
      caption: 'Резонансная кривая (качественно): амплитуда вынужденных колебаний резко растёт, когда частота вынуждающей силы приближается к собственной частоте ν₀. Чем меньше затухание, тем выше и острее пик. Анимация замедлена в 4 раза.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.85, maxHeight: 560, label: 'Груз на пружине под действием периодической силы и резонансные кривые' });
    d.add(cv.destroy);

    let t = 0;
    const sM = L.slider(ui.controls, { label: 'Масса m', min: 0.2, max: 2, step: 0.1, value: DEF.m, unit: 'кг', onInput: () => update() });
    const sK = L.slider(ui.controls, { label: 'Жёсткость k', min: 20, max: 200, step: 5, value: DEF.k, unit: 'Н/м', onInput: () => update() });
    const sB = L.slider(ui.controls, { label: 'Затухание β', min: 0.2, max: 3, step: 0.1, value: DEF.beta, unit: 'с⁻¹', onInput: () => update() });
    const sNu = L.slider(ui.controls, { label: 'Частота силы ν', min: 0, max: NU_MAX, step: 0.02, value: DEF.nu, unit: 'Гц', onInput: () => update() });

    const anim = L.animator((dt) => { t += dt * SLOW; draw(); }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sM.set(DEF.m); sK.set(DEF.k); sB.set(DEF.beta); sNu.set(DEF.nu); t = 0;
      update(); play.sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function calc() {
      const m = sM.value, k = sK.value, beta = sB.value, nu = sNu.value;
      const w0 = Math.sqrt(k / m);          // ω₀ = √(k/m) (1.5.2)
      const nu0 = w0 / (2 * Math.PI);
      const w = 2 * Math.PI * nu;
      return { m, k, beta, nu, w0, nu0, w };
    }

    function curveMax(r) {
      let mx = 0;
      const betas = [r.beta, ...REF_BETAS];
      for (const b of betas) {
        for (let i = 0; i <= 400; i++) {
          const a = amp((2 * Math.PI * NU_MAX * i) / 400, r.w0, b, r.m);
          if (a > mx) mx = a;
        }
        // точно в окрестности пика
        const wr = Math.sqrt(Math.max(0, r.w0 * r.w0 - 2 * b * b));
        mx = Math.max(mx, amp(wr, r.w0, b, r.m));
      }
      return mx || 1;
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const r = calc();
      ctx.clearRect(0, 0, W, H);
      const amax = curveMax(r);
      const Acur = amp(r.w, r.w0, r.beta, r.m);
      const phase = Math.atan2(2 * r.beta * r.w, r.w0 * r.w0 - r.w * r.w);

      // ---- сцена
      const sh = H * 0.3, wx = 18, fy = sh - 10;
      const xEq = wx + (W - wx) * 0.5;
      const maxPx = (W - wx) * 0.3;
      const xpx = (Acur / amax) * maxPx * Math.cos(r.w * t - phase);
      const bw = 32, bh = 24, bxL = xEq - bw / 2 + xpx;
      hatchV(ctx, wx, fy - 52, fy, c.text);
      hatchFloor(ctx, wx, W - 8, fy, c.text);
      spring(ctx, wx, fy - bh / 2, bxL, c.text);
      ctx.save(); ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillRect(bxL, fy - bh, bw, bh); ctx.strokeRect(bxL, fy - bh, bw, bh); ctx.restore();
      L.text(ctx, 'm', bxL + bw / 2, fy - bh / 2, c.text, { font: FONT, align: 'center' });
      ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xEq, fy - bh - 30); ctx.lineTo(xEq, fy); ctx.stroke(); ctx.restore();
      const Fnow = Math.cos(r.w * t);
      const cxB = bxL + bw / 2;
      if (r.nu > 0 && Math.abs(Fnow) > 0.02) {
        L.arrow(ctx, cxB, fy - bh - 12, cxB + Fnow * 30, fy - bh - 12, c.force, { label: '→F', labelOffset: [3, -9], font: FONT });
      }

      // ---- график A(ν)
      const rect = { x: 46, y: sh + 34, w: Math.max(60, W - 46 - 30), h: H - sh - 34 - 24 };
      const g = L.graph(ctx, rect, {
        xMin: 0, xMax: NU_MAX, yMin: 0, yMax: amax * 1.12,
        xLabel: 'ν, Гц', yLabel: 'A, м', xTicks: 1, yTicks: L.niceStep(amax * 1.12, 3),
      });
      REF_BETAS.forEach((b) => {
        L.plotFn(ctx, g, (nu) => amp(2 * Math.PI * nu, r.w0, b, r.m), c.muted, { n: 300, width: 1.2, dash: [5, 4] });
      });
      L.plotFn(ctx, g, (nu) => amp(2 * Math.PI * nu, r.w0, r.beta, r.m), c.accent, { n: 400, width: 2.5 });
      // ν₀
      const x0 = g.X(r.nu0);
      ctx.save(); ctx.strokeStyle = c.text; ctx.setLineDash([2, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0, rect.y); ctx.lineTo(x0, rect.y + rect.h); ctx.stroke(); ctx.restore();
      L.text(ctx, 'ν_0', x0 + 3, rect.y + 6, c.text, { font: FONT });
      // текущая ν
      const xn = g.X(r.nu);
      ctx.save(); ctx.strokeStyle = c.force; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xn, rect.y + rect.h); ctx.lineTo(xn, g.Y(Acur)); ctx.stroke(); ctx.restore();
      L.dot(ctx, xn, g.Y(Acur), c.force, 5);
      L.text(ctx, 'пунктир: β = 0,5; 1; 2 с⁻¹', rect.x + rect.w, rect.y - 14, c.muted, { font: SMALL, align: 'right' });
    }

    function updateReadout() {
      const r = calc();
      let status;
      if (r.beta >= r.w0 / Math.SQRT2) status = 'затухание велико — резонансного пика нет';
      else if (r.nu === 0) status = 'сила не меняется (ν = 0) — колебаний нет';
      else if (Math.abs(r.w - r.w0) <= 0.05 * r.w0) status = 'резонанс: ω ≈ ω₀, амплитуда максимальна';
      else status = r.w < r.w0 ? 'ω < ω₀ — амплитуда меньше резонансной' : 'ω > ω₀ — амплитуда меньше резонансной';
      ro.set([
        ['ω₀ = √(k/m)', L.fmt(r.w0, 3) + ' рад/с'],
        ['ν₀ = ω₀/2π', L.fmt(r.nu0, 3) + ' Гц'],
        ['ν (вынуждающей силы)', L.fmt(r.nu, 3) + ' Гц'],
        ['ω = 2πν', L.fmt(r.w, 3) + ' рад/с'],
        ['ω/ω₀', L.fmt(r.w / r.w0, 3)],
        ['Состояние', status],
      ]);
    }

    function update() { draw(); updateReadout(); }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    update();
    return { destroy: d.run };
  },
};
