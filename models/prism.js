// Модель «Дисперсия света в призме» (коды 3.6.4, 3.6.5, 3.6.12).
// Формулы (CLAUDE.md, B4): n₁ sin α = n₂ sin β на каждой грани; ПВО при sin β₂ ≥ 1/n.
// Геометрия: β₂ = A − β₁, отклонение δ = α + γ − A. n(λ): 1,51 (красный 700 нм) … 1,53 (фиолетовый 400 нм) — условно, см. CHECK в docs.
import * as L from './_lib.js';

const RAD2DEG = 180 / Math.PI;
const N_RED = 1.51, N_VIOLET = 1.53;
const LAMS = [700, 620, 580, 530, 470, 440, 400];
const DEFAULTS = { A: 60, alpha: 50 };

const nOf = (lam) => N_RED + ((700 - lam) / 300) * (N_VIOLET - N_RED);

function wlColor(nm, alpha = 1) {
  const l = L.clamp(nm, 380, 780);
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = (440 - l) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = (510 - l) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = (645 - l) / 65; } else { r = 1; }
  let f = 1;
  if (l < 420) f = 0.45 + 0.55 * (l - 380) / 40; else if (l > 700) f = 0.45 + 0.55 * (780 - l) / 80;
  const k = (v) => Math.round(255 * Math.pow(Math.max(0, v * f), 0.8));
  return `rgba(${k(r)},${k(g)},${k(b)},${alpha})`;
}

/** Ход луча по углам (градусы). Возвращает β₁, β₂, γ, δ или tir. */
export function trace(n, A, alpha) {
  const b1 = Math.asin(Math.sin(alpha / RAD2DEG) / n) * RAD2DEG;
  const b2 = A - b1;
  const s = n * Math.sin(b2 / RAD2DEG);
  if (Math.abs(s) >= 1) return { b1, b2, tir: true, gamma: null, delta: null };
  const gamma = Math.asin(s) * RAD2DEG;
  return { b1, b2, tir: false, gamma, delta: alpha + gamma - A };
}

/** Пересечение луча p + t·v с отрезком a–b: t > 0 или null. */
function hitSeg(p, v, a, b) {
  const ex = b[0] - a[0], ey = b[1] - a[1];
  const den = v[0] * ey - v[1] * ex;
  if (Math.abs(den) < 1e-12) return null;
  const wx = a[0] - p[0], wy = a[1] - p[1];
  const t = (wx * ey - wy * ex) / den;
  const s = (wx * v[1] - wy * v[0]) / den;
  return t > 1e-6 && s >= -1e-9 && s <= 1 + 1e-9 ? t : null;
}

function arcBetween(ctx, x, y, r, a, b, color, label, font) {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) < 0.004) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(x, y, r, a, a + diff, diff < 0); ctx.stroke();
  ctx.restore();
  if (label) { const m = a + diff / 2; L.text(ctx, label, x + Math.cos(m) * (r + 10), y + Math.sin(m) * (r + 10), color, { font, align: 'center' }); }
}

export default {
  id: 'prism',
  title: 'Дисперсия света в призме',
  codes: ['3.6.4', '3.6.5', '3.6.12'],
  mount(el /* , { theme } */) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Белый луч падает на левую грань. Показатель преломления стекла зависит от λ (условно 1,51 для красного … 1,53 для фиолетового), поэтому фиолетовый отклоняется сильнее.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 220, label: 'Разложение белого света призмой' });
    d.add(cv.destroy);

    const sA = L.slider(ui.controls, { label: 'Преломляющий угол призмы A', min: 30, max: 70, step: 5, value: DEFAULTS.A, unit: '°', onInput: draw });
    const sAl = L.slider(ui.controls, { label: 'Угол падения α', min: 0, max: 90, step: 1, value: DEFAULTS.alpha, unit: '°', onInput: draw });
    L.button(ui.controls, 'Сброс', () => { sA.set(DEFAULTS.A); sAl.set(DEFAULTS.alpha); draw(); }, { reset: true });
    const ro = L.readout(ui.readout);

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const fs = Math.round(L.clamp(W / 40, 10, 13));
      const font = `${fs}px system-ui, sans-serif`;
      const fontI = `italic ${fs + 1}px system-ui, sans-serif`;
      const A = sA.value, alpha = sAl.value;
      const hA = A / 2 / RAD2DEG;
      // y-up угол θ → направление на canvas
      const dir = (thDeg) => [Math.cos(thDeg / RAD2DEG), -Math.sin(thDeg / RAD2DEG)];

      const hp = Math.min(0.66 * H, (0.26 * W) / Math.tan(hA));
      const cx = 0.42 * W, top = (H - hp) / 2;
      const T = [cx, top], BL = [cx - hp * Math.tan(hA), top + hp], BR = [cx + hp * Math.tan(hA), top + hp];

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(T[0], T[1]); ctx.lineTo(BL[0], BL[1]); ctx.lineTo(BR[0], BR[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'A', T[0], T[1] + 22, c.text, { font: fontI, align: 'center' });

      // точка входа и падающий белый луч
      const P1 = [T[0] + 0.3 * (BL[0] - T[0]), T[1] + 0.3 * (BL[1] - T[1])];
      const thIn = -A / 2 + alpha;
      const vin = dir(thIn);
      let len = (P1[0] - 4) / Math.max(vin[0], 1e-6);
      if (vin[1] < 0) len = Math.min(len, (H - 4 - P1[1]) / -vin[1]);
      else if (vin[1] > 0) len = Math.min(len, (P1[1] - 4) / vin[1]);
      const S = [P1[0] - vin[0] * len, P1[1] - vin[1] * len];
      const mid = [S[0] + vin[0] * len * 0.55, S[1] + vin[1] * len * 0.55];
      L.arrow(ctx, S[0], S[1], mid[0], mid[1], c.text, { width: 2.4, head: 10 });
      ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(mid[0], mid[1]); ctx.lineTo(P1[0], P1[1]); ctx.stroke(); ctx.restore();

      // нормаль на входе
      const nOutIn = 180 - A / 2; // y-up угол внешней нормали левой грани
      const nv = dir(nOutIn);
      ctx.save(); ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(P1[0] + nv[0] * 45, P1[1] + nv[1] * 45); ctx.lineTo(P1[0] - nv[0] * 35, P1[1] - nv[1] * 35); ctx.stroke(); ctx.restore();
      arcBetween(ctx, P1[0], P1[1], 26, -nOutIn / RAD2DEG, -(thIn + 180) / RAD2DEG, c.text, 'α', fontI);

      const nR = dir(A / 2); // внешняя нормаль правой грани (canvas)
      const res = {};
      let baseHit = false;
      for (const lam of LAMS) {
        const n = nOf(lam);
        const tr = trace(n, A, alpha);
        res[lam] = tr;
        const col = wlColor(lam);
        const v1 = dir(-A / 2 + tr.b1);
        const tR = hitSeg(P1, v1, T, BR), tB = hitSeg(P1, v1, BL, BR);
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        // подложка цветом текста под каждым отрезком — контраст в любой теме
        delete ctx.stroke;
        const baseStroke = ctx.stroke.bind(ctx);
        ctx.stroke = () => {
          ctx.save(); ctx.globalAlpha = 0.22; ctx.strokeStyle = c.text; ctx.lineWidth += 1.6; baseStroke(); ctx.restore();
          baseStroke();
        };
        if (tR === null || (tB !== null && tB < tR)) {
          const t = tB ?? 0;
          ctx.beginPath(); ctx.moveTo(P1[0], P1[1]); ctx.lineTo(P1[0] + v1[0] * t, P1[1] + v1[1] * t); ctx.stroke();
          ctx.restore(); tr.base = true; baseHit = true; continue;
        }
        const P2 = [P1[0] + v1[0] * tR, P1[1] + v1[1] * tR];
        ctx.beginPath(); ctx.moveTo(P1[0], P1[1]); ctx.lineTo(P2[0], P2[1]); ctx.stroke();
        if (tr.tir) {
          const dt = v1[0] * nR[0] + v1[1] * nR[1];
          const v2 = [v1[0] - 2 * dt * nR[0], v1[1] - 2 * dt * nR[1]];
          const ts = [hitSeg(P2, v2, BL, BR), hitSeg(P2, v2, T, BL)].filter((t) => t !== null);
          const t = ts.length ? Math.min(...ts) : 0;
          ctx.beginPath(); ctx.moveTo(P2[0], P2[1]); ctx.lineTo(P2[0] + v2[0] * t, P2[1] + v2[1] * t); ctx.stroke();
        } else {
          const v3 = dir(A / 2 - tr.gamma);
          ctx.beginPath(); ctx.moveTo(P2[0], P2[1]); ctx.lineTo(P2[0] + v3[0] * W * 1.5, P2[1] + v3[1] * W * 1.5); ctx.stroke();
          if (lam === 700) {
            ctx.setLineDash([5, 4]); ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(P2[0] - nR[0] * 30, P2[1] - nR[1] * 30); ctx.lineTo(P2[0] + nR[0] * 50, P2[1] + nR[1] * 50); ctx.stroke();
            ctx.restore(); ctx.save();
            arcBetween(ctx, P2[0], P2[1], 30, -A / 2 / RAD2DEG * 1, -(A / 2 - tr.gamma) / RAD2DEG, c.text, 'γ', fontI);
          }
        }
        ctx.restore();
      }
      delete ctx.stroke; // вернуть штатный stroke
      const anyTir =LAMS.some((l) => res[l].tir && !res[l].base);
      if (anyTir) L.text(ctx, 'ПВО на второй грани', 8, 14, c.force, { font: `600 ${fs}px system-ui, sans-serif` });
      if (baseHit) L.text(ctx, 'часть лучей падает на основание', 8, 14 + fs + 4, c.muted, { font });

      const r = res[700], v = res[400];
      const f = (x) => (x === null ? '—' : L.fmt(x, 2) + '°');
      const g = (t, x) => (t.base ? 'на основание' : t.tir ? 'ПВО' : f(x));
      ro.set([
        ['Угол падения α / угол призмы A', `${L.fmt(alpha, 0)}° / ${L.fmt(A, 0)}°`],
        ['n красн. / фиол.', `${L.fmt(N_RED)} / ${L.fmt(N_VIOLET)}`],
        ['β₁ (кр / ф)', `${f(r.b1)} / ${f(v.b1)}`],
        ['β₂ = A − β₁ (кр / ф)', `${r.base ? '—' : f(r.b2)} / ${v.base ? '—' : f(v.b2)}`],
        ['α<sub>пр</sub> стекла (кр / ф)', `${f(Math.asin(1 / N_RED) * RAD2DEG)} / ${f(Math.asin(1 / N_VIOLET) * RAD2DEG)}`],
        ['γ — угол выхода (кр / ф)', `${g(r, r.gamma)} / ${g(v, v.gamma)}`],
        ['δ = α + γ − A (кр / ф)', `${g(r, r.delta)} / ${g(v, v.delta)}`],
        ['Δδ = δ<sub>ф</sub> − δ<sub>кр</sub>', r.delta !== null && v.delta !== null && !r.base && !v.base ? L.fmt(v.delta - r.delta, 2) + '°' : '—'],
      ]);
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
