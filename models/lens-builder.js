// Модель «Построение изображения в тонкой линзе» (коды 3.6.6, 3.6.7).
// Формулы (CLAUDE.md, B4): 1/d + 1/f = 1/F; D = 1/F; Γ = h/H = |f|/d.
// Знаки: f < 0 — мнимое изображение; рассеивающая линза — F < 0, D < 0.
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

const DEFAULTS = { type: 'conv', F: 10, d: 25, H: 4, oblique: false, ang: 15 };
const OBL_Y = 6; // высота, на которой луч под углом падает на линзу, см
const HALF_VIEW_CM = 42; // половина видимой ширины рисунка, см

/** Расчёт изображения. Все длины в см; Fs — фокусное расстояние со знаком. */
export function solveLens(Fs, d, H) {
  if (Math.abs(d - Fs) < 1e-9) return { none: true }; // предмет в фокусе собирающей линзы
  const f = (Fs * d) / (d - Fs); // из 1/d + 1/f = 1/F
  const G = Math.abs(f) / d;
  const h = (-f / d) * H; // высота изображения со знаком (минус — перевёрнутое)
  return { none: false, f, G, h, real: f > 0 };
}

function describe(s) {
  if (s.none) return 'изображения нет (лучи после линзы параллельны)';
  const kind = s.real ? 'действительное' : 'мнимое';
  const orient = s.real ? 'перевёрнутое' : 'прямое';
  const size = Math.abs(s.G - 1) < 1e-9 ? 'равное предмету' : s.G > 1 ? 'увеличенное' : 'уменьшенное';
  return `${kind}, ${orient}, ${size}`;
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
  id: 'lens-builder',
  title: 'Построение изображения в линзе',
  codes: ['3.6.6', '3.6.7', '3.6.8'],
  mount(el /* , { theme } */) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Тяни предмет AB мышью, за вершину — меняется и высота. Штрихом показаны мнимые продолжения лучей и мнимое изображение.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.55, minHeight: 210, label: 'Построение изображения в тонкой линзе' });
    d.add(cv.destroy);

    const chType = L.choice(ui.controls, { key: 'chType',
      label: 'Линза',
      options: [{ value: 'conv', label: 'собирающая' }, { value: 'div', label: 'рассеивающая' }],
      value: DEFAULTS.type, onChange: draw,
    });
    const sF = L.slider(ui.controls, { key: 'sF', label: 'Фокусное расстояние |F|', min: 2, max: 15, step: 0.5, value: DEFAULTS.F, unit: 'см', onInput: draw });
    const sD = L.slider(ui.controls, { key: 'sD', label: 'Расстояние до предмета d', min: 1, max: 40, step: 0.5, value: DEFAULTS.d, unit: 'см', onInput: draw });
    const sH = L.slider(ui.controls, { key: 'sH', label: 'Высота предмета H', min: 0.5, max: 6, step: 0.5, value: DEFAULTS.H, unit: 'см', onInput: draw });
    const cbObl = L.checkbox(ui.controls, { key: 'cbOblique', label: 'Луч под углом к оси, побочная ось и фокальная плоскость', checked: DEFAULTS.oblique, onChange: () => { syncObl(); draw(); } });
    const sAng = L.slider(ui.controls, { key: 'sAng', label: 'Угол луча с главной осью φ', min: -30, max: 30, step: 1, value: DEFAULTS.ang, unit: '°', onInput: draw });
    function syncObl() { sAng.el.style.display = cbObl.value ? '' : 'none'; }
    syncObl();
    L.button(ui.controls, 'Сброс', () => {
      chType.set(DEFAULTS.type); sF.set(DEFAULTS.F); sD.set(DEFAULTS.d); sH.set(DEFAULTS.H);
      cbObl.set(DEFAULTS.oblique); sAng.set(DEFAULTS.ang); syncObl(); draw();
    }, { reset: true });
    const ro = moreReadout(ui.readout);

    function geom() {
      const W = cv.width, H = cv.height;
      const k = Math.min((W / 2 - 8) / HALF_VIEW_CM, (H / 2 - 14) / 8); // px на см
      const x0 = W / 2, y0 = H / 2;
      return { W, H, k, x0, y0, X: (x) => x0 + x * k, Y: (y) => y0 - y * k };
    }

    function line(ctx, x1, y1, x2, y2, color, { width = 1.6, dash } = {}) {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
      ctx.setLineDash(dash || []);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const { ctx } = cv;
      const g = geom();
      const { W, H, X, Y, x0, y0, k } = g;
      const c = L.colors();
      const fs = Math.round(L.clamp(W / 40, 11, 14));
      const font = `${fs}px system-ui, sans-serif`;
      const fontI = `italic ${fs}px system-ui, sans-serif`;
      const conv = chType.value === 'conv';
      const Fa = sF.value; // |F|, см
      const Fs = conv ? Fa : -Fa; // F со знаком
      const dd = sD.value, Hh = sH.value;
      const s = solveLens(Fs, dd, Hh);
      const xR = (W - x0) / k + 2; // правый край рисунка, см
      const yLim = (H / 2) / k; // половина видимой высоты, см
      const DASH = [6, 5];

      ctx.clearRect(0, 0, W, H);

      // главная оптическая ось
      line(ctx, 0, y0, W, y0, c.muted, { width: 1.2 });
      L.text(ctx, 'O', x0 - 5, y0 + 11, c.text, { font: fontI, align: 'right' });

      // фокусы F и 2F
      for (const sg of [-1, 1]) {
        for (const [mul, lab] of [[1, 'F'], [2, '2F']]) {
          const px = X(sg * mul * Fa);
          if (px < 4 || px > W - 4) continue;
          line(ctx, px, y0 - 5, px, y0 + 5, c.text, { width: 1.5 });
          L.dot(ctx, px, y0, c.text, 2.5);
          L.text(ctx, lab, px, y0 + 14, c.text, { font: fontI, align: 'center' });
        }
      }

      // линза
      const lx = X(0), top = 6, bot = H - 6;
      ctx.save();
      ctx.strokeStyle = c.text; ctx.fillStyle = c.text; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      if (conv) {
        ctx.beginPath(); ctx.moveTo(lx, top + 3); ctx.lineTo(lx, bot - 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx, top); ctx.lineTo(lx - 7, top + 10); ctx.lineTo(lx + 7, top + 10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(lx, bot); ctx.lineTo(lx - 7, bot - 10); ctx.lineTo(lx + 7, bot - 10); ctx.closePath(); ctx.fill();
      } else {
        const t2 = top + 9, b2 = bot - 9;
        ctx.beginPath(); ctx.moveTo(lx, t2); ctx.lineTo(lx, b2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 7, t2 - 9); ctx.lineTo(lx, t2); ctx.lineTo(lx + 7, t2 - 9); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 7, b2 + 9); ctx.lineTo(lx, b2); ctx.lineTo(lx + 7, b2 + 9); ctx.stroke();
      }
      ctx.restore();

      // при включённом луче под углом обычные лучи приглушены
      const oblique = cbObl.value;
      ctx.save();
      if (oblique) ctx.globalAlpha = 0.3;
      // лучи: точка A (вершина предмета) = (−d, H)
      const ax = -dd, ay = Hh;
      const rayColor = c.accent;
      const toEdge = (px, py, dx, dy) => { const t = (xR - px) / dx; return [px + dx * t, py + dy * t]; };
      const lensPts = []; // точки на линзе (для мнимых продолжений)

      // 1) через оптический центр — без преломления
      {
        const [ex, ey] = toEdge(0, 0, dd, -Hh);
        line(ctx, X(ax), Y(ay), X(0), Y(0), rayColor, { width: 1.8 });
        line(ctx, X(0), Y(0), X(ex), Y(ey), rayColor, { width: 1.8 });
        lensPts.push([0, 0]);
      }
      // 2) параллельно оси → через фокус (у рассеивающей — продолжение через мнимый фокус)
      {
        line(ctx, X(ax), Y(ay), X(0), Y(Hh), rayColor, { width: 1.8 });
        let dx, dy;
        if (conv) { dx = Fa; dy = -Hh; } else {
          dx = Fa; dy = Hh;
          line(ctx, X(0), Y(Hh), X(-Fa), Y(0), rayColor, { width: 1.2, dash: DASH });
        }
        const [ex, ey] = toEdge(0, Hh, dx, dy);
        line(ctx, X(0), Y(Hh), X(ex), Y(ey), rayColor, { width: 1.8 });
        lensPts.push([0, Hh]);
      }
      // 3) через фокус → параллельно оси
      if (!s.none) {
        let y3;
        if (conv) y3 = (-Hh * Fa) / (dd - Fa); // луч (или его продолжение) через передний фокус (−F, 0)
        else y3 = (Hh * Fa) / (dd + Fa); // луч, направленный в задний фокус (+|F|, 0)
        if (Math.abs(y3) <= yLim) {
          if (conv && dd < Fa) line(ctx, X(-Fa), Y(0), X(ax), Y(ay), rayColor, { width: 1.2, dash: DASH });
          line(ctx, X(ax), Y(ay), X(0), Y(y3), rayColor, { width: 1.8 });
          if (!conv) line(ctx, X(0), Y(y3), X(Fa), Y(0), rayColor, { width: 1.2, dash: DASH });
          line(ctx, X(0), Y(y3), X(xR), Y(y3), rayColor, { width: 1.8 });
          lensPts.push([0, y3]);
        }
      }

      ctx.restore();

      // изображение
      let offScreen = false;
      if (!s.none) {
        const ix = s.f, ih = s.h;
        if (!s.real) {
          ctx.save();
          if (oblique) ctx.globalAlpha = 0.3;
          for (const [px, py] of lensPts) line(ctx, X(px), Y(py), X(ix), Y(ih), rayColor, { width: 1.1, dash: [4, 4] });
          ctx.restore();
        }
        const imgCol = c.accel;
        const pxI = X(ix);
        offScreen = pxI < 0 || pxI > W || Math.abs(ih) > yLim;
        L.arrow(ctx, pxI, y0, pxI, Y(ih), imgCol, { width: 2.4, head: 10, dash: s.real ? null : [6, 4] });
        L.text(ctx, 'B_1', pxI + 4, y0 + (ih >= 0 ? 12 : -12), imgCol, { font: fontI });
        L.text(ctx, 'A_1', pxI + 6, Y(ih) + (ih >= 0 ? -6 : 8), imgCol, { font: fontI });
      }

      // предмет AB
      const objCol = c.force;
      L.arrow(ctx, X(ax), y0, X(ax), Y(ay), objCol, { width: 2.6, head: 11 });
      L.text(ctx, 'B', X(ax) - 4, y0 + 12, objCol, { font: fontI, align: 'right' });
      L.text(ctx, 'A', X(ax) - 6, Y(ay) - 4, objCol, { font: fontI, align: 'right' });
      L.dot(ctx, X(ax), Y(ay), objCol, 4);

      // луч под углом: побочная ось через O параллельна лучу и пересекает фокальную плоскость в точке P,
      // преломлённый луч (или его продолжение у рассеивающей линзы) проходит через P
      let yP = 0;
      if (oblique) {
        const m0 = -Math.tan(L.deg(sAng.value)); // наклон луча на рисунке: φ > 0 — луч идёт вниз
        const xL = -x0 / k - 2;
        const col = c.text;
        yP = m0 * Fs;
        line(ctx, X(xL), Y(m0 * xL), X(xR), Y(m0 * xR), c.muted, { width: 1.3, dash: [10, 4, 2, 4] });
        L.text(ctx, 'побочная ось', X(xL * 0.72), Y(m0 * xL * 0.72) + 13, c.muted, { font: `${Math.max(11, fs - 1)}px system-ui, sans-serif`, align: 'center' });
        const fx = X(Fs);
        line(ctx, fx, 4, fx, H - 4, c.muted, { width: 1.2, dash: [3, 4] });
        const fpW = 112;
        L.text(ctx, 'фокальная плоскость', fx + 4 + fpW > W ? fx - 4 : fx + 4, H - 12, c.muted, { font: '11px system-ui, sans-serif', align: fx + 4 + fpW > W ? 'right' : 'left' });
        // падающий луч
        line(ctx, X(xL), Y(OBL_Y + m0 * xL), X(0), Y(OBL_Y), col, { width: 2.4 });
        const dirX = Fs, dirY = yP - OBL_Y; // направление на P от точки на линзе
        const mOut = dirY / dirX;
        line(ctx, X(0), Y(OBL_Y), X(xR), Y(OBL_Y + mOut * xR), col, { width: 2.4 });
        if (!conv) line(ctx, X(0), Y(OBL_Y), X(Fs), Y(yP), col, { width: 1.3, dash: DASH });
        L.dot(ctx, X(Fs), Y(yP), c.force, 5);
        L.text(ctx, 'P', X(Fs) + 8, Y(yP) - 8, c.force, { font: `600 ${fs}px system-ui, sans-serif` });
      }

      // понятные подписи, когда изображения не видно
      const noteW = Math.min(W - 16, 400);
      if (s.none) {
        noteBox(ctx, 'd = F: лучи после линзы параллельны, изображение на бесконечности (его нет).', 8, 8, noteW, c.force, c);
      } else if (offScreen) {
        const near = conv && Math.abs(dd - Fa) / Fa < 0.35;
        const where = `|f| = ${L.fmt(Math.abs(s.f) / 100, 2)} м, h = ${L.fmt(Math.abs(s.h) / 100, 2)} м`;
        noteBox(ctx, near
          ? `Предмет почти в фокусе: лучи после линзы почти параллельны. Изображение далеко за краем рисунка (${where}).`
          : `Изображение за краем рисунка (${where}).`, 8, 8, noteW, c.force, c);
        // куда уходит изображение
        const pxI = X(s.f);
        if (pxI > W) L.arrow(ctx, W - 40, y0 - 18, W - 8, y0 - 18, c.accel, { width: 2.5 });
        else if (pxI < 0) L.arrow(ctx, 40, y0 - 18, 8, y0 - 18, c.accel, { width: 2.5 });
        else if (s.h > 0) L.arrow(ctx, pxI, 40, pxI, 8, c.accel, { width: 2.5 });
        else L.arrow(ctx, pxI, H - 40, pxI, H - 8, c.accel, { width: 2.5 });
      }

      const m = (x) => x / 100; // см → м
      const rows = [
        ['Расстояние до изображения f', s.none ? '∞ (изображения нет)' : L.fmt(m(s.f), 3) + ' м' + (s.real ? '' : ' (мнимое)')],
        ['Увеличение Γ = |f|/d', s.none ? '—' : L.fmt(s.G, 2)],
        ['Высота изображения h = ΓH', s.none ? '—' : L.fmt(m(Math.abs(s.h)), 3) + ' м'],
        ['Оптическая сила D = 1/F', L.fmt(1 / m(Fs), 2) + ' дптр'],
        ['Изображение', describe(s)],
      ];
      if (oblique) rows.push(['Точка P от главной оси: |F|·tg φ', L.fmt(m(Math.abs(yP)), 3) + ' м']);
      ro.set(rows, [
        ['Расстояние до предмета d', L.fmt(m(dd), 3) + ' м'],
        ['Фокусное расстояние F', L.fmt(m(Fs), 3) + ' м'],
      ]);
    }

    pointerDrag(cv.canvas, d, {
      hit: (x, y) => {
        const { X, Y, y0 } = geom();
        const ox = X(-sD.value), oy = Y(sH.value);
        if (Math.hypot(x - ox, y - oy) < 16) return 'tip';
        if (Math.abs(x - ox) < 12 && y <= y0 + 8 && y >= oy - 8) return 'base';
        return null;
      },
      move: (h, x, y) => {
        const { k, x0, y0 } = geom();
        const dNew = Math.round(((x0 - x) / k) * 2) / 2;
        sD.set(L.clamp(dNew, 1, 40));
        if (h === 'tip') sH.set(L.clamp(Math.round(((y0 - y) / k) * 2) / 2, 0.5, 6));
        draw();
      },
    });

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
