// Модель «Дифракционная решётка» (код 3.6.11, 3.6.12).
// Формулы (CLAUDE.md, B4): d sin φ_m = mλ (нормальное падение); d = l/N; k_max — целая часть d/λ, всего 2k_max + 1;
// положение на экране x_m = L·tg φ_m, при малых углах x ≈ mλL/d.
// Если d/λ — целое, максимум m = d/λ шёл бы под 90° (на экран не попадает) → k_max = d/λ − 1 (см. CHECK в docs).
import * as L from './_lib.js';

const RAD2DEG = 180 / Math.PI;
const DEFAULTS = { N: 500, lam: 550, L: 1, white: false };
const WHITE = [];
for (let l = 380; l <= 760; l += 20) WHITE.push(l);
const LIST_MAX = 4; // сколько порядков показывать в таблице

function wlColor(nm, alpha = 1) {
  const l = L.clamp(nm, 380, 780);
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = (440 - l) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = (510 - l) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = (645 - l) / 65; } else { r = 1; }
  let f = 1;
  if (l < 420) f = 0.45 + 0.55 * (l - 380) / 40; else if (l > 700) f = 0.45 + 0.55 * (780 - l) / 80;
  const k = (v) => Math.round(255 * Math.pow(Math.max(0, v * f), 0.8));
  return `rgba(${k(r)},${k(g)},${k(b)},${alpha})`;
}

/** d/λ при N штрихов на мм и λ в нм (точно: d = 10⁶/N нм). */
const ratio = (N, lamNm) => 1e6 / (N * lamNm);

/** Наибольший наблюдаемый порядок (учтён случай целого d/λ). */
export function kMax(N, lamNm) {
  const q = ratio(N, lamNm);
  const r = Math.round(q);
  if (Math.abs(q - r) < 1e-9) return { k: r - 1, integer: true, q };
  return { k: Math.floor(q), integer: false, q };
}

/** Угол φ_m в градусах или null, если |mλ| ≥ d. */
export function phi(N, lamNm, m) {
  const s = m / ratio(N, lamNm); // sin φ = mλ/d
  if (Math.abs(s) >= 1 - 1e-12) return null;
  return Math.asin(s) * RAD2DEG;
}

export default {
  id: 'grating',
  title: 'Дифракционная решётка',
  codes: ['3.6.11', '3.6.12'],
  mount(el /* , { theme } */) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Свет падает на решётку нормально. Углы на рисунке истинные, расстояние до экрана — в масштабе (ширина рисунка ≈ 2,4 м); максимумы, не попавшие на экран, уходят за край рисунка.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 220, label: 'Дифракционная решётка, лучи к максимумам, экран' });
    d.add(cv.destroy);

    const sN = L.slider(ui.controls, { label: 'Число штрихов на 1 мм, N', min: 100, max: 1000, step: 50, value: DEFAULTS.N, unit: 'мм⁻¹', onInput: draw });
    const sL = L.slider(ui.controls, { label: 'Длина волны λ', min: 380, max: 760, step: 10, value: DEFAULTS.lam, unit: 'нм', onInput: draw });
    const sD = L.slider(ui.controls, { label: 'Расстояние до экрана L', min: 0.2, max: 2, step: 0.1, value: DEFAULTS.L, unit: 'м', onInput: draw });
    const cbW = L.checkbox(ui.controls, { label: 'белый свет (380–760 нм)', checked: DEFAULTS.white, onChange: draw });
    L.button(ui.controls, 'Сброс', () => {
      sN.set(DEFAULTS.N); sL.set(DEFAULTS.lam); sD.set(DEFAULTS.L); cbW.set(DEFAULTS.white); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const fs = Math.round(L.clamp(W / 42, 10, 13));
      const font = `${fs}px system-ui, sans-serif`;
      const fontI = `italic ${fs + 1}px system-ui, sans-serif`;
      const N = sN.value, lamNm = sL.value, Lm = sD.value, white = cbW.value;
      const dM = 1e-3 / N; // период, м

      const gx = Math.round(0.09 * W), y0 = H / 2;
      const kpx = (W * 0.84) / 2.0; // px на метр (по горизонтали)
      const sx = gx + Lm * kpx; // экран
      const Lpx = sx - gx;
      const hh = H / 2 - 12; // половина высоты экрана, px

      ctx.clearRect(0, 0, W, H);

      // падающий пучок
      const inCol = white ? c.text : wlColor(lamNm);
      for (const dy of [-18, 0, 18]) L.arrow(ctx, 4, y0 + dy, gx - 4, y0 + dy, inCol, { width: 1.6, head: 7 });

      // экран
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, y0 - hh); ctx.lineTo(sx, y0 + hh); ctx.stroke();
      ctx.restore();

      // луч из решётки под углом φ (градусы, + вверх)
      const rayTo = (phDeg, color, width) => {
        const p = phDeg / RAD2DEG;
        const dx = Math.cos(p), dy = -Math.sin(p);
        const yScr = y0 - Lpx * Math.tan(p);
        let ex, ey, onScreen = false;
        if (Math.abs(yScr - y0) <= hh) { ex = sx; ey = yScr; onScreen = true; } else {
          const ty = dy < 0 ? (2 - y0) / dy : (H - 2 - y0) / dy;
          const tx = (W - 2 - gx) / Math.max(dx, 1e-9);
          const t = Math.min(ty, tx);
          ex = gx + dx * t; ey = y0 + dy * t;
        }
        ctx.save();
        // подложка цветом текста — контраст спектральных цветов в любой теме
        ctx.globalAlpha = 0.22; ctx.strokeStyle = c.text; ctx.lineWidth = width + 1.6;
        ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 1; ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.restore();
        return onScreen ? yScr : null;
      };
      const mark = (y, color, w = 9) => { ctx.save(); ctx.fillStyle = color; ctx.fillRect(sx - 1, y - 1.5, w, 3); ctx.globalAlpha = 0.4; ctx.strokeStyle = c.text; ctx.lineWidth = 0.8; ctx.strokeRect(sx - 1.5, y - 2, w + 1, 4); ctx.restore(); };

      const km = kMax(N, lamNm);
      if (!white) {
        const col = wlColor(lamNm);
        const many = km.k > 8;
        let lastLabelY = -1e9;
        for (let m = -km.k; m <= km.k; m++) {
          const ph = phi(N, lamNm, m);
          if (ph === null) continue;
          const y = rayTo(ph, col, many ? 1 : 1.6);
          if (y !== null) {
            mark(y, col);
            if (Math.abs(y - lastLabelY) >= fs + 1 && m >= 0) {
              L.text(ctx, String(m), sx + 12, y, c.text, { font });
              lastLabelY = y;
            }
          }
        }
        // симметричные подписи снизу
        lastLabelY = 1e9;
        for (let m = -1; m >= -km.k; m--) {
          const ph = phi(N, lamNm, m);
          const yS = y0 - Lpx * Math.tan(ph / RAD2DEG);
          if (Math.abs(yS - y0) > hh) break;
          if (Math.abs(yS - lastLabelY) >= fs + 1 && yS - y0 >= fs) { L.text(ctx, '−' + (-m), sx + 12, yS, c.text, { font }); lastLabelY = yS; }
        }
        // дуга φ₁
        if (km.k >= 1) {
          const p1 = phi(N, lamNm, 1) / RAD2DEG;
          const ra = Math.min(46, Lpx * 0.4);
          ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(gx, y0, ra, -p1, 0); ctx.stroke(); ctx.restore();
          L.text(ctx, 'φ_1', gx + (ra + 12) * Math.cos(p1 / 2), y0 - (ra + 10) * Math.sin(p1 / 2), c.text, { font: fontI });
        }
      } else {
        const kv = kMax(N, 380).k; // хотя бы фиолетовая часть порядка видна
        rayTo(0, c.text, 1.8);
        mark(y0, c.text);
        L.text(ctx, '0', sx + 12, y0, c.text, { font });
        for (let m = 1; m <= kv; m++) {
          for (const sg of [1, -1]) {
            for (const l of WHITE) {
              const ph = phi(N, l, sg * m);
              if (ph === null) continue;
              const y = rayTo(ph, wlColor(l, 0.55), 1);
              if (y !== null) mark(y, wlColor(l), 7);
            }
          }
        }
      }

      // решётка
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, y0 - hh * 0.75); ctx.lineTo(gx, y0 + hh * 0.75); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = y0 - hh * 0.75; y <= y0 + hh * 0.75; y += 5) { ctx.moveTo(gx - 4, y); ctx.lineTo(gx + 4, y); }
      ctx.stroke();
      ctx.restore();

      // ось и L
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(sx, y0); ctx.stroke();
      ctx.restore();
      const yb = H - 6;
      L.arrow(ctx, (gx + sx) / 2, yb, gx, yb, c.muted, { width: 1, head: 6 });
      L.arrow(ctx, (gx + sx) / 2, yb, sx, yb, c.muted, { width: 1, head: 6 });
      L.text(ctx, 'L', (gx + sx) / 2, yb - 9, c.muted, { font: fontI, align: 'center' });

      // таблица
      const rows = [['Период d = 1/N', L.fmt(dM) + ' м']];
      if (!white) {
        rows.push(['Длина волны λ', L.fmt(lamNm * 1e-9) + ' м']);
        rows.push(['d/λ', L.fmt(km.q, 3)]);
        rows.push(['k<sub>max</sub>', String(km.k) + (km.integer ? ' (d/λ — целое: максимум под 90° не наблюдается)' : '')]);
        rows.push(['Всего максимумов 2k<sub>max</sub> + 1', String(2 * km.k + 1)]);
        rows.push(['m = 0', 'φ₀ = 0°, x₀ = 0']);
        for (let m = 1; m <= Math.min(km.k, LIST_MAX); m++) {
          const ph = phi(N, lamNm, m);
          const x = Lm * Math.tan(ph / RAD2DEG);
          const xa = (m * lamNm * 1e-9 * Lm) / dM;
          rows.push([`m = ±${m}`, `φ = ${L.fmt(ph, 2)}°; x = ${L.fmt(x, 3)} м (малые углы: ${L.fmt(xa, 3)} м)`]);
        }
        if (km.k > LIST_MAX) rows.push(['…', `и далее до m = ±${km.k}`]);
      } else {
        const kr = kMax(N, 760).k, kv = kMax(N, 380).k;
        rows.push(['Полных спектров (по красному 760 нм)', `${kr} с каждой стороны`]);
        rows.push(['Видна хотя бы фиолетовая часть до порядка', String(kv)]);
        rows.push(['m = 0', 'белая полоса (все λ при φ = 0)']);
        for (let m = 1; m <= Math.min(kv, 3); m++) {
          const pv = phi(N, 380, m), pr = phi(N, 760, m);
          rows.push([`Спектр m = ±${m}`, `φ от ${L.fmt(pv, 1)}° (фиол.) до ${pr === null ? '90° — неполный' : L.fmt(pr, 1) + '° (красн.)'}`]);
        }
        let overlap = null;
        for (let m = 1; m < kv; m++) {
          if ((m + 1) * 380 < m * 760) { overlap = m; break; }
        }
        rows.push(['Перекрытие спектров', overlap === null ? 'нет' : `спектры ${overlap}-го и ${overlap + 1}-го порядков перекрываются: (m+1)·380 нм < m·760 нм`]);
      }
      ro.set(rows);
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
