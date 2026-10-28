// Модель «Интерференция от двух когерентных источников» (код 3.6.10).
// Формулы (CLAUDE.md, B4): синфазные источники; максимум Δ = mλ, минимум Δ = (2m+1)λ/2; Δ = |r₂ − r₁|.
// Масштаб условный: вся сцена — 16 мкм в ширину, чтобы волновые фронты были видны. Δ считается по геометрии рисунка.
import * as L from './_lib.js';

const SCENE_W = 16; // мкм
const SCENE_H = 9.6; // мкм
const X_SRC = 2; // мкм — источники
const X_SCR = 14; // мкм — экран
const L_SCR = X_SCR - X_SRC; // расстояние до экрана, мкм
const TOL = 0.05; // допуск (в долях λ) для «максимум/минимум»
const DEFAULTS = { a: 4, lam: 500, y: 1.5 };

/** Цвет по длине волны (нм) — приближение видимого спектра. */
export function wlColor(nm, alpha = 1) {
  const l = L.clamp(nm, 380, 780);
  let r = 0, g = 0, b = 0;
  if (l < 440) { r = (440 - l) / 60; b = 1; } else if (l < 490) { g = (l - 440) / 50; b = 1; } else if (l < 510) { g = 1; b = (510 - l) / 20; } else if (l < 580) { r = (l - 510) / 70; g = 1; } else if (l < 645) { r = 1; g = (645 - l) / 65; } else { r = 1; }
  let f = 1;
  if (l < 420) f = 0.45 + 0.55 * (l - 380) / 40; else if (l > 700) f = 0.45 + 0.55 * (780 - l) / 80;
  const k = (v) => Math.round(255 * Math.pow(Math.max(0, v * f), 0.8));
  return `rgba(${k(r)},${k(g)},${k(b)},${alpha})`;
}

/** Разность хода для точки экрана y (мкм) при расстоянии между источниками a (мкм). */
export function pathDiff(a, y) {
  const r1 = Math.hypot(L_SCR, y - a / 2); // S₁ — верхний источник (y = +a/2)
  const r2 = Math.hypot(L_SCR, y + a / 2); // S₂ — нижний (y = −a/2)
  return { r1, r2, delta: Math.abs(r2 - r1) };
}

export function classify(q) {
  const m = Math.round(q);
  if (Math.abs(q - m) <= TOL) return { kind: 'max', m, text: `максимум (Δ = mλ), m = ${m}` };
  const k = Math.floor(q);
  if (Math.abs(q - k - 0.5) <= TOL) return { kind: 'min', m: k, text: `минимум (Δ = (2m+1)λ/2), m = ${k}` };
  return { kind: 'mid', m: null, text: 'промежуточная точка (ни максимум, ни минимум)' };
}

function pointerDrag(cnv, d, { hit, move }) {
  let active = null, pid = null;
  const pos = (e) => { const r = cnv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    const [x, y] = pos(e);
    const h = hit(x, y);
    if (h == null) return;
    active = h; pid = e.pointerId;
    try { cnv.setPointerCapture(pid); } catch (err) { /* ignore */ }
    e.preventDefault();
    move(active, x, y);
  };
  const onMove = (e) => {
    const [x, y] = pos(e);
    if (active == null) { cnv.style.cursor = hit(x, y) != null ? 'grab' : ''; return; }
    e.preventDefault();
    move(active, x, y);
  };
  const onUp = () => {
    if (active == null) return;
    active = null;
    try { cnv.releasePointerCapture(pid); } catch (err) { /* ignore */ }
  };
  cnv.style.touchAction = 'none';
  cnv.addEventListener('pointerdown', onDown);
  cnv.addEventListener('pointermove', onMove);
  cnv.addEventListener('pointerup', onUp);
  cnv.addEventListener('pointercancel', onUp);
  d.add(() => {
    cnv.removeEventListener('pointerdown', onDown);
    cnv.removeEventListener('pointermove', onMove);
    cnv.removeEventListener('pointerup', onUp);
    cnv.removeEventListener('pointercancel', onUp);
  });
}

export default {
  id: 'double-slit',
  title: 'Интерференция от двух источников',
  codes: ['3.6.10'],
  mount(el /* , { theme } */) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Масштаб условный: расстояние до экрана всего 12 мкм, чтобы были видны волны. Разность хода Δ = |r₂ − r₁| считается по геометрии рисунка. Точку P можно тянуть по экрану.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.6, minHeight: 200, label: 'Два когерентных источника и экран' });
    d.add(cv.destroy);

    let phase = 0;
    const anim = L.animator((dt) => { phase = (phase + dt * 0.7) % 1; draw(); }, { autoplay: true });
    d.add(anim.destroy);

    const sA = L.slider(ui.controls, { label: 'Расстояние между источниками d', min: 1, max: 6, step: 0.5, value: DEFAULTS.a, unit: 'мкм', onInput: draw });
    const sL = L.slider(ui.controls, { label: 'Длина волны λ', min: 380, max: 760, step: 10, value: DEFAULTS.lam, unit: 'нм', onInput: draw });
    const sY = L.slider(ui.controls, { label: 'Точка P на экране, y', min: -4, max: 4, step: 0.1, value: DEFAULTS.y, unit: 'мкм', onInput: draw });
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sA.set(DEFAULTS.a); sL.set(DEFAULTS.lam); sY.set(DEFAULTS.y); phase = 0; draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function geom() {
      const W = cv.width, H = cv.height;
      const k = Math.min(W / SCENE_W, H / SCENE_H); // px на мкм
      const ox = (W - SCENE_W * k) / 2, oy = H / 2;
      return { W, H, k, X: (x) => ox + x * k, Y: (y) => oy - y * k, oy };
    }

    function draw() {
      const { ctx } = cv;
      const { W, H, k, X, Y } = geom();
      const c = L.colors();
      const fs = Math.round(L.clamp(W / 42, 10, 13));
      const font = `${fs}px system-ui, sans-serif`;
      const fontI = `italic ${fs + 1}px system-ui, sans-serif`;
      const a = sA.value, lamNm = sL.value, lam = lamNm / 1000; // λ в мкм
      const yP = sY.value;
      const col = wlColor(lamNm, 1);

      ctx.clearRect(0, 0, W, H);

      // волновые фронты (гребни) — дуги вправо от источников
      const s1 = [X(X_SRC), Y(a / 2)], s2 = [X(X_SRC), Y(-a / 2)];
      ctx.save();
      ctx.beginPath(); ctx.rect(X(X_SRC), 0, X(X_SCR) - X(X_SRC), H); ctx.clip();
      ctx.strokeStyle = wlColor(lamNm, 0.38); ctx.lineWidth = 1;
      const rMax = Math.hypot(L_SCR, SCENE_H);
      for (const s of [s1, s2]) {
        for (let r = phase * lam; r < rMax; r += lam) {
          if (r * k < 1) continue;
          ctx.beginPath(); ctx.arc(s[0], s[1], r * k, -Math.PI / 2, Math.PI / 2); ctx.stroke();
        }
      }
      ctx.restore();

      // экран: картина (яркость ∝ cos²(πΔ/λ)) и график интенсивности
      const xs = X(X_SCR);
      const yTop = SCENE_H / 2, step = 1 / k; // мкм на пиксель
      for (let y = -yTop; y <= yTop; y += step) {
        const { delta } = pathDiff(a, y);
        const I = Math.cos((Math.PI * delta) / lam) ** 2;
        ctx.fillStyle = wlColor(lamNm, I);
        ctx.fillRect(xs, Y(y) - 0.5, Math.max(4, 0.3 * k), 1.5);
      }
      ctx.save();
      ctx.globalAlpha = 0.35; ctx.strokeStyle = c.text; ctx.lineWidth = 0.8;
      ctx.strokeRect(xs, 0.5, Math.max(4, 0.3 * k), H - 1); // рамка полосы картины — контраст
      ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, H); ctx.stroke();
      ctx.restore();
      const gx0 = X(X_SCR + 0.45), gw = 1.3 * k;
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(gx0, 4); ctx.lineTo(gx0, H - 4); ctx.stroke();
      ctx.beginPath();
      let first = true;
      for (let y = -yTop; y <= yTop; y += step) {
        const { delta } = pathDiff(a, y);
        const I = Math.cos((Math.PI * delta) / lam) ** 2;
        const px = gx0 + I * gw, py = Y(y);
        if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
      }
      ctx.globalAlpha = 0.25; ctx.strokeStyle = c.text; ctx.lineWidth = 3.2; ctx.stroke(); // подложка
      ctx.globalAlpha = 1; ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
      L.text(ctx, 'I', gx0 + gw, 10, c.muted, { font: fontI, align: 'right' });
      L.text(ctx, 'экран', xs - 4, H - 10, c.muted, { font, align: 'right' });

      // ось симметрии
      ctx.save();
      ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(X(X_SRC), Y(0)); ctx.lineTo(xs, Y(0)); ctx.stroke();
      ctx.restore();

      // r₁, r₂ к точке P
      const P = [xs, Y(yP)];
      const { r1, r2, delta } = pathDiff(a, yP);
      ctx.save();
      ctx.lineWidth = 1.4; ctx.strokeStyle = c.text;
      ctx.beginPath(); ctx.moveTo(s1[0], s1[1]); ctx.lineTo(P[0], P[1]); ctx.stroke();
      ctx.setLineDash([6, 3]);
      ctx.beginPath(); ctx.moveTo(s2[0], s2[1]); ctx.lineTo(P[0], P[1]); ctx.stroke();
      ctx.restore();
      const lab = (s, t, dy) => [s[0] + (P[0] - s[0]) * t, s[1] + (P[1] - s[1]) * t + dy];
      const l1 = lab(s1, 0.35, -9), l2 = lab(s2, 0.35, 11);
      L.text(ctx, 'r_1', l1[0], l1[1], c.text, { font: fontI, align: 'center' });
      L.text(ctx, 'r_2', l2[0], l2[1], c.text, { font: fontI, align: 'center' });

      // источники
      for (const [s, name] of [[s1, 'S_1'], [s2, 'S_2']]) {
        L.dot(ctx, s[0], s[1], col, 5);
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s[0], s[1], 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        L.text(ctx, name, s[0] - 8, s[1], c.text, { font: fontI, align: 'right' });
      }

      // точка P
      const q = delta / lam;
      const cls = classify(q);
      const pCol = cls.kind === 'max' ? c.velocity : cls.kind === 'min' ? c.force : c.text;
      L.dot(ctx, P[0], P[1], pCol, 6);
      ctx.save(); ctx.strokeStyle = c.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(P[0], P[1], 2.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      L.text(ctx, 'P', P[0] - 8, P[1] - 10, pCol, { font: fontI, align: 'right' });

      const um = (x) => x * 1e-6; // мкм → м
      ro.set([
        ['Длина волны λ', L.fmt(lamNm * 1e-9) + ' м'],
        ['Расстояние между источниками d', L.fmt(um(a)) + ' м'],
        ['Расстояние до экрана L', L.fmt(um(L_SCR)) + ' м'],
        ['Координата точки P, y', L.fmt(um(yP)) + ' м'],
        ['r₁ / r₂', `${L.fmt(um(r1), 4)} / ${L.fmt(um(r2), 4)} м`],
        ['Разность хода Δ = |r₂ − r₁|', L.fmt(um(delta), 3) + ' м'],
        ['Δ/λ', L.fmt(q, 3)],
        ['В точке P', cls.text],
      ]);
    }

    pointerDrag(cv.canvas, d, {
      hit: (x) => { const { X } = geom(); return Math.abs(x - X(X_SCR)) < 22 ? 'P' : null; },
      move: (_h, x, y) => {
        const { k, oy } = geom();
        const yy = Math.round(((oy - y) / k) * 10) / 10;
        sY.set(L.clamp(yy, -4, 4));
        draw();
      },
    });

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    play.sync();
    draw();
    return { destroy: d.run };
  },
};
