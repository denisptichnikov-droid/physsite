// Модель «Изображение в плоском зеркале» (коды 3.6.1, 3.6.2, 3.6.3).
// Формулы (CLAUDE.md, B4): закон отражения α = β (углы от нормали); изображение мнимое, прямое,
// симметрично предмету относительно плоскости зеркала, в натуральную величину.
import * as L from './_lib.js';

const RAD2DEG = 180 / Math.PI;
const SCENE_M = 2; // ширина рисунка соответствует 2 м (масштаб условный)
const MIRROR = { v: 0.62, h: 0.6 }; // положение зеркала (доля ширины / высоты)
const START = {
  v: { obj: [0.32, 0.66], eye: [0.14, 0.3] },
  h: { obj: [0.28, 0.42], eye: [0.78, 0.2] },
};

function arcBetween(ctx, x, y, r, a, b, color, label, font) {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) < 0.004) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, r, a, a + diff, diff < 0); ctx.stroke();
  ctx.restore();
  if (label) {
    const m = a + diff / 2;
    L.text(ctx, label, x + Math.cos(m) * (r + 10), y + Math.sin(m) * (r + 10), color, { font, align: 'center' });
  }
}

function pointerDrag(cnv, d, { hit, start, move }) {
  let active = null, pid = null;
  const pos = (e) => { const r = cnv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    const [x, y] = pos(e);
    const h = hit(x, y);
    if (h == null) return;
    active = h; pid = e.pointerId;
    try { cnv.setPointerCapture(pid); } catch (err) { /* ignore */ }
    e.preventDefault();
    start?.(active, x, y);
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
  id: 'plane-mirror',
  title: 'Изображение в плоском зеркале',
  codes: ['3.6.1', '3.6.2', '3.6.3'],
  mount(el /* , { theme } */) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Перетаскивайте предмет S и глаз. Изображение S′ мнимое: за зеркалом сходятся только продолжения лучей (штрих). Масштаб условный: ширина рисунка — 2 м.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 220, label: 'Плоское зеркало, предмет, изображение и глаз' });
    d.add(cv.destroy);

    // состояние: положения в долях ширины/высоты холста (переживают resize)
    const state = { obj: [...START.v.obj], eye: [...START.v.eye] };
    let grabOff = [0, 0];

    const chOr = L.choice(ui.controls, {
      label: 'Зеркало',
      options: [{ value: 'v', label: 'вертикальное' }, { value: 'h', label: 'горизонтальное' }],
      value: 'v',
      onChange: () => { resetPositions(); draw(); },
    });
    const chObj = L.choice(ui.controls, {
      label: 'Предмет',
      options: [{ value: 'point', label: 'точка' }, { value: 'arrow', label: 'стрелка' }],
      value: 'point',
      onChange: () => { clampAll(); draw(); },
    });
    L.button(ui.controls, 'Сброс', () => {
      chOr.set('v'); chObj.set('point'); resetPositions(); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function resetPositions() {
      const s = START[chOr.value];
      state.obj = [...s.obj]; state.eye = [...s.eye];
      clampAll();
    }

    function geom() {
      const W = cv.width, H = cv.height;
      const vert = chOr.value === 'v';
      const m = vert ? MIRROR.v * W : MIRROR.h * H; // координата линии зеркала, px
      const seg = vert ? [0.1 * H, 0.9 * H] : [0.06 * W, 0.94 * W]; // концы зеркала вдоль него
      const hArrow = Math.round(0.16 * Math.min(W, H)); // высота стрелки, px
      const mpp = SCENE_M / W; // метров на пиксель
      // отражение точки
      const refl = vert ? (p) => [2 * m - p[0], p[1]] : (p) => [p[0], 2 * m - p[1]];
      // расстояние до зеркала (со стороны предмета) и координата вдоль зеркала
      const u = vert ? (p) => m - p[0] : (p) => m - p[1];
      const w = vert ? (p) => p[1] : (p) => p[0];
      return { W, H, vert, m, seg, hArrow, mpp, refl, u, w };
    }

    function clampPt(p, kind) {
      const g = geom();
      const { W, H, vert, m, hArrow } = g;
      let [x, y] = [p[0] * W, p[1] * H];
      const isArrow = kind === 'obj' && chObj.value === 'arrow';
      if (vert) {
        const minX = kind === 'obj' ? Math.max(8, 2 * m - (W - 8)) : 8;
        x = L.clamp(x, minX, m - 12);
        y = L.clamp(y, isArrow ? hArrow + 8 : 8, H - 8);
      } else {
        x = L.clamp(x, 10, W - 10);
        const minY = kind === 'obj' ? Math.max(8, 2 * m - (H - 8)) + (isArrow ? hArrow : 0) : 10;
        y = L.clamp(y, Math.min(minY, m - 12), m - 12);
      }
      return [x / W, y / H];
    }
    function clampAll() {
      state.obj = clampPt(state.obj, 'obj');
      state.eye = clampPt(state.eye, 'eye');
    }

    /** Точка отражения луча от P к глазу E: пересечение отрезка P′E с зеркалом. */
    function reflectionPoint(g, P, E) {
      const I = g.refl(P);
      const t = g.vert ? (g.m - I[0]) / (E[0] - I[0]) : (g.m - I[1]) / (E[1] - I[1]);
      return [I[0] + (E[0] - I[0]) * t, I[1] + (E[1] - I[1]) * t];
    }

    function line(ctx, a, b, color, width = 1.8, dash) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.restore();
    }
    function rayWithArrow(ctx, a, b, color) {
      const mid = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55];
      L.arrow(ctx, a[0], a[1], mid[0], mid[1], color, { width: 1.8, head: 9 });
      line(ctx, mid, b, color, 1.8);
    }

    function drawEye(ctx, x, y, c) {
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, 12, 7, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      L.dot(ctx, x, y, c.text, 3.5);
    }

    function draw() {
      const { ctx } = cv;
      const g = geom();
      const { W, H, vert, m, seg, hArrow, mpp } = g;
      const c = L.colors();
      const fs = Math.round(L.clamp(W / 40, 11, 14));
      const font = `${fs}px system-ui, sans-serif`;
      const fontI = `italic ${fs}px system-ui, sans-serif`;
      const isArrow = chObj.value === 'arrow';

      const O = [state.obj[0] * W, state.obj[1] * H]; // точка (или основание стрелки)
      const T = isArrow ? [O[0], O[1] - hArrow] : O; // вершина стрелки
      const E = [state.eye[0] * W, state.eye[1] * H];
      const Oi = g.refl(O), Ti = g.refl(T);

      ctx.clearRect(0, 0, W, H);

      // зеркало со штриховкой с тыльной стороны
      const A = vert ? [m, seg[0]] : [seg[0], m];
      const B = vert ? [m, seg[1]] : [seg[1], m];
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.beginPath();
      const len = vert ? seg[1] - seg[0] : seg[1] - seg[0];
      for (let s = 0; s <= len; s += 9) {
        if (vert) { ctx.moveTo(m, seg[0] + s); ctx.lineTo(m + 7, seg[0] + s + 7); } else { ctx.moveTo(seg[0] + s, m); ctx.lineTo(seg[0] + s - 7, m + 7); }
      }
      ctx.stroke();
      ctx.restore();
      line(ctx, A, B, c.text, 3);
      // мнимое пространство за зеркалом — слегка затенено
      ctx.save();
      ctx.globalAlpha = 0.35; ctx.fillStyle = c.surface;
      if (vert) ctx.fillRect(m + 8, 0, W - m - 8, H); else ctx.fillRect(0, m + 8, W, H - m - 8);
      ctx.restore();

      // симметрия предмет — изображение (тонкий штрих)
      line(ctx, T, Ti, c.grid, 1, [2, 4]);

      // лучи
      const rays = isArrow ? [{ P: T, I: Ti, main: true }, { P: O, I: Oi, main: false }] : [{ P: O, I: Oi, main: true }];
      const results = rays.map((r) => {
        const R = reflectionPoint(g, r.P, E);
        const along = vert ? R[1] : R[0];
        const onMirror = along >= seg[0] - 1e-6 && along <= seg[1] + 1e-6;
        return { ...r, R, onMirror };
      });
      for (const r of results) {
        const col = r.onMirror ? c.accent : c.muted;
        rayWithArrow(ctx, r.P, r.R, col);
        rayWithArrow(ctx, r.R, E, col);
        line(ctx, r.R, r.I, col, 1.2, [5, 4]);
      }

      // нормаль и углы для основного луча
      const main = results[0];
      const R = main.R;
      const nAng = vert ? Math.PI : -Math.PI / 2; // нормаль в сторону предмета (угол canvas)
      const nl = Math.max(40, 0.14 * Math.min(W, H));
      line(ctx, R, [R[0] + Math.cos(nAng) * nl, R[1] + Math.sin(nAng) * nl], c.muted, 1, [6, 5]);
      const angP = Math.atan2(main.P[1] - R[1], main.P[0] - R[0]);
      const angE = Math.atan2(E[1] - R[1], E[0] - R[0]);
      const ra = Math.max(22, nl * 0.55);
      arcBetween(ctx, R[0], R[1], ra, nAng, angP, c.text, 'α', fontI);
      arcBetween(ctx, R[0], R[1], ra * 0.75, nAng, angE, c.text, 'β', fontI);

      // нужная часть зеркала (для стрелки)
      if (isArrow && results.every((r) => r.onMirror)) line(ctx, results[0].R, results[1].R, c.velocity, 5);

      // предмет и изображение
      const objCol = c.force, imgCol = c.accel;
      if (isArrow) {
        L.arrow(ctx, O[0], O[1], T[0], T[1], objCol, { width: 2.6, head: 10 });
        L.arrow(ctx, Oi[0], Oi[1], Ti[0], Ti[1], imgCol, { width: 2.2, head: 10, dash: [6, 4] });
      } else {
        L.dot(ctx, O[0], O[1], objCol, 5);
        ctx.save(); ctx.strokeStyle = imgCol; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(Oi[0], Oi[1], 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      L.text(ctx, 'S', T[0] - 8, T[1] - 10, objCol, { font: fontI, align: 'right' });
      L.text(ctx, 'S′', Ti[0] + 8, Ti[1] + (vert ? -10 : 12), imgCol, { font: fontI });
      drawEye(ctx, E[0], E[1], c);

      const allVisible = results.every((r) => r.onMirror);
      if (!allVisible) {
        L.text(ctx, 'луч не попадает на зеркало', 8, 14, c.force, { font: `600 ${Math.max(11, fs - 1)}px system-ui, sans-serif` });
      }

      // величины
      const P = main.P;
      const uP = g.u(P), uE = g.u(E);
      const alpha = Math.atan2(Math.abs(g.w(R) - g.w(P)), uP) * RAD2DEG; // угол падения
      const beta = Math.atan2(Math.abs(g.w(E) - g.w(R)), uE) * RAD2DEG; // угол отражения
      const dObj = g.u(O) * mpp; // предмет — зеркало
      const dImg = -g.u(Oi) * mpp; // изображение — зеркало (по другую сторону)
      const rows = [
        ['Предмет — зеркало, a', L.fmt(dObj, 2) + ' м'],
        ['Изображение — зеркало, a′', L.fmt(dImg, 2) + ' м'],
        ['Угол падения α', L.fmt(alpha, 1) + '°'],
        ['Угол отражения β', L.fmt(beta, 1) + '°'],
      ];
      if (isArrow) {
        const hObj = hArrow * mpp;
        rows.push(['Высота предмета = высота изображения', L.fmt(hObj, 2) + ' м']);
        if (allVisible) {
          const part = Math.hypot(results[0].R[0] - results[1].R[0], results[0].R[1] - results[1].R[1]) * mpp;
          rows.push(['Нужная часть зеркала (выделена)', L.fmt(part, 3) + ' м']);
        }
      }
      rows.push(['Видимость', allVisible ? 'глаз видит изображение' : 'точка отражения вне зеркала — изображение (целиком) не видно']);
      ro.set(rows);
    }

    pointerDrag(cv.canvas, d, {
      hit: (x, y) => {
        const { W, H, hArrow } = geom();
        const E = [state.eye[0] * W, state.eye[1] * H];
        if (Math.hypot(x - E[0], y - E[1]) < 18) return 'eye';
        const O = [state.obj[0] * W, state.obj[1] * H];
        if (chObj.value === 'arrow') {
          if (Math.abs(x - O[0]) < 14 && y <= O[1] + 12 && y >= O[1] - hArrow - 12) return 'obj';
        } else if (Math.hypot(x - O[0], y - O[1]) < 18) return 'obj';
        return null;
      },
      start: (h, x, y) => {
        const { W, H } = geom();
        const p = state[h];
        grabOff = [x - p[0] * W, y - p[1] * H];
      },
      move: (h, x, y) => {
        const { W, H } = geom();
        state[h] = clampPt([(x - grabOff[0]) / W, (y - grabOff[1]) / H], h);
        draw();
      },
    });

    // клавиатура: фокус на рисунке, стрелки двигают выбранный объект (Shift — крупный шаг)
    const chKey = L.choice(ui.controls, {
      label: 'Стрелки клавиатуры двигают',
      options: [{ value: 'obj', label: 'предмет' }, { value: 'eye', label: 'глаз' }],
      value: 'obj',
    });
    const cnv = cv.canvas;
    cnv.tabIndex = 0;
    cnv.setAttribute('aria-label', 'Плоское зеркало. Стрелки ←↑→↓ двигают предмет или глаз (выбор под рисунком), Shift — крупный шаг');
    const onKey = (e) => {
      const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const v = dirs[e.key];
      if (!v) return;
      e.preventDefault();
      const { W, H } = geom();
      const st = e.shiftKey ? 20 : 4; // px
      const h = chKey.value;
      state[h] = clampPt([state[h][0] + (v[0] * st) / W, state[h][1] + (v[1] * st) / H], h);
      draw();
    };
    cnv.addEventListener('keydown', onKey);
    d.add(() => cnv.removeEventListener('keydown', onKey));

    cv.onResize(() => { clampAll(); draw(); });
    d.add(L.onThemeChange(draw));
    clampAll();
    draw();
    return { destroy: d.run };
  },
};
