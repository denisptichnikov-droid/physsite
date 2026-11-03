// Модель «Цикл Карно»: две изотермы и две адиабаты на pV-диаграмме, η_max = 1 − T_х/T_н.
// Формулы — CLAUDE.md, часть B: 2.1.7 (T = t + 273), 2.2.7 (адиабата Q = 0), 2.2.10 (η Карно).
// Форма адиабаты pV^{5/3} = const (одноатомный газ) в части B отсутствует — используется только для рисунка
// (см. docs/carnot.md, CHECK). Масштаб pV-диаграммы условный (νR = 1, V₁ = 1,5 усл. ед.).
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

const DEF = { Th: 500, Tc: 300, Q: 1000 };
const Q_MAX = 2000; // верх шкалы столбиков и слайдера Q_н, Дж
const V1 = 1.5, V2 = 3;      // объёмы на горячей изотерме (усл. ед.)
const X_MAX = 14, Y_MAX = 720; // оси pV в условных единицах (p = T/V при νR = 1)
const GAMMA = 5 / 3;

/** Вершины цикла; при T_х = 0 объёмы 3 и 4 бесконечны (возвращаем Infinity, рисунок обрезается). */
function vertices(Th, Tc) {
  const k = Tc > 0 ? Math.pow(Th / Tc, 1.5) : Infinity; // T·V^{2/3} = const на адиабате
  return { V1, V2, V3: V2 * k, V4: V1 * k, p1: Th / V1, p2: Th / V2 };
}

export default {
  id: 'carnot',
  title: 'Цикл Карно',
  codes: ['2.2.8', '2.2.9', '2.2.10'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Газ получает Qн на изотерме 1→2 и отдаёт |Qх| на изотерме 3→4; 2→3 и 4→1 — адиабаты. Столбики: Qн = A + |Qх|. КПД зависит только от температур в кельвинах. Масштаб диаграммы условный.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.6, minHeight: 360, maxHeight: 430, label: 'Цикл Карно на pV-диаграмме и столбики энергий' });
    d.add(cv.destroy);

    const tFmt = (v) => `${L.fmt(v, 0)} К (${L.fmt(v - 273, 0)} °C)`;
    const sTh = L.slider(ui.controls, { key: 'sTh', label: 'Температура нагревателя T<sub>н</sub>', min: 200, max: 1000, step: 10, value: DEF.Th, format: tFmt, onInput: () => fix('h') });
    const sTc = L.slider(ui.controls, { key: 'sTc', label: 'Температура холодильника T<sub>х</sub>', min: 0, max: 1000, step: 10, value: DEF.Tc, format: tFmt, onInput: () => fix('c') });
    const sQ = L.slider(ui.controls, { key: 'sQ', label: 'Теплота от нагревателя Q<sub>н</sub>', min: 100, max: Q_MAX, step: 50, value: DEF.Q, unit: 'Дж', onInput: () => draw() });
    L.button(ui.controls, 'Сброс', () => { sTh.set(DEF.Th); sTc.set(DEF.Tc); sQ.set(DEF.Q); draw(); }, { reset: true });
    const ro = moreReadout(ui.readout);

    // T_х ≤ T_н
    function fix(which) {
      if (sTc.value > sTh.value) { if (which === 'c') sTc.set(sTh.value); else sTc.set(sTh.value); }
      draw();
    }

    function drawCycle(ctx, rect, Th, Tc, c) {
      const g = L.graph(ctx, rect, { xMin: 0, xMax: X_MAX, yMin: 0, yMax: Y_MAX, xLabel: 'V', yLabel: 'p', xTicks: 1e6, yTicks: 1e6, grid: false });
      const v = vertices(Th, Tc);
      const cap = X_MAX * 1.4; // дальше рисунок всё равно обрезан
      const V3 = Math.min(v.V3, cap), V4 = Math.min(v.V4, cap);
      const pHot = (V) => Th / V;
      const pCold = (V) => Tc / V;
      const pAd23 = (V) => v.p2 * Math.pow(v.V2 / V, GAMMA);
      const pAd41 = (V) => v.p1 * Math.pow(v.V1 / V, GAMMA);
      const segs = [
        { f: pHot, a: v.V1, b: v.V2 },
        { f: pAd23, a: v.V2, b: V3 },
        { f: Tc > 0 ? pCold : pAd41, a: V3, b: V4 }, // скачок при V = cap — вне области рисунка
        { f: pAd41, a: V4, b: v.V1 },
      ];
      const pt = (s, t) => { const V = s.a + (s.b - s.a) * t; return [g.X(V), g.Y(s.f(V))]; };

      ctx.save();
      ctx.beginPath(); ctx.rect(rect.x, rect.y - 4, rect.w + 4, rect.h + 4); ctx.clip();
      // полные изотермы пунктиром
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      [Th, Tc].forEach((T) => {
        if (T <= 0) return;
        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
          const V = 0.4 + ((X_MAX - 0.4) * i) / 120;
          const x = g.X(V), y = g.Y(Math.min(T / V, Y_MAX * 2));
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.setLineDash([]);
      // площадь цикла
      ctx.globalAlpha = 0.18; ctx.fillStyle = c.accent;
      ctx.beginPath();
      segs.forEach((s, k) => {
        for (let i = 0; i <= 100; i++) {
          const [x, y] = pt(s, i / 100);
          if (k === 0 && i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
      });
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      // участки
      const cols = [c.force, c.text, c.fieldB, c.text];
      segs.forEach((s, k) => {
        if (k === 2 && !(Tc > 0)) return;
        ctx.strokeStyle = cols[k]; ctx.lineWidth = 2.6;
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const [x, y] = pt(s, i / 100);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      });
      ctx.restore();

      const inside = (x, y) => x >= rect.x - 1 && x <= rect.x + rect.w + 1 && y >= rect.y - 1 && y <= rect.y + rect.h + 1;
      // стрелки обхода
      segs.forEach((s, k) => {
        if (Math.abs(s.b - s.a) < 1e-6) return;
        const [x1, y1] = pt(s, 0.45), [x2, y2] = pt(s, 0.55);
        const len = Math.hypot(x2 - x1, y2 - y1);
        if (len < 1 || !inside(x1, y1) || !inside(x2, y2)) return;
        const ux = (x2 - x1) / len, uy = (y2 - y1) / len, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        L.arrow(ctx, mx - ux * 8, my - uy * 8, mx + ux * 8, my + uy * 8, cols[k], { width: 2.5, head: 10 });
        if (k === 1 || k === 3) L.text(ctx, 'Q = 0', mx + 10, my + (k === 1 ? -10 : 12), c.muted, { font: '11px system-ui, sans-serif' });
      });
      // теплота: Q_н входит на 1→2, Q_х уходит на 3→4
      if (v.V2 - v.V1 > 0) {
        const [mx, my] = pt(segs[0], 0.5);
        L.arrow(ctx, mx + 22, my - 34, mx + 4, my - 6, c.force, { width: 2.2, label: 'Q_н', labelOffset: [16, -26], font: '600 13px system-ui, sans-serif' });
      }
      if (Tc > 0 && Th > Tc) {
        const [mx, my] = pt(segs[2], 0.5);
        if (inside(mx, my)) L.arrow(ctx, mx, my + 4, mx + 14, my + 28, c.fieldB, { width: 2.2, label: 'Q_х', labelOffset: [6, 4], font: '600 13px system-ui, sans-serif' });
      }
      // вершины и подписи изотерм
      const P = [[v.V1, v.p1], [v.V2, v.p2], [v.V3, Tc > 0 ? Tc / v.V3 : 0], [v.V4, Tc > 0 ? Tc / v.V4 : 0]];
      P.forEach(([V, p], i) => {
        if (!Number.isFinite(V) || V > X_MAX) return;
        const x = g.X(V), y = g.Y(p);
        L.dot(ctx, x, y, c.text, 3.5);
        L.text(ctx, String(i + 1), x + (i === 0 || i === 3 ? -10 : 6), y + (i < 2 ? -10 : 10), c.text, { font: '600 12px system-ui, sans-serif', align: 'center' });
      });
      L.text(ctx, 'T_н', g.X(X_MAX) - 2, g.Y(Th / X_MAX) - 10, c.force, { font: '600 12px system-ui, sans-serif', align: 'right' });
      if (Tc > 0) L.text(ctx, 'T_х', g.X(X_MAX) - 2, Math.min(g.Y(Tc / X_MAX) - 10, g.Y(0) - 22), c.fieldB, { font: '600 12px system-ui, sans-serif', align: 'right' });
    }

    /** Столбики Q_н, A, |Q_х|: столбик |Q_х| стоит на вершине A, поэтому видно Q_н = A + |Q_х|. */
    function drawBars(ctx, r, e, c, vertical) {
      const items = [
        { lab: 'Q_н', val: e.Q, from: 0, col: c.force },
        { lab: 'A', val: e.A, from: 0, col: c.accent },
        { lab: '|Q_х|', val: e.Qc, from: e.A, col: c.fieldB },
      ];
      const small = '600 12px system-ui, sans-serif';
      L.text(ctx, `η_{max} = ${L.fmt(e.eta * 100, 1)} %`, r.x, r.y - 12, c.text, { font: '600 13px system-ui, sans-serif' });
      if (vertical) {
        const gap = 8, bw = (r.w - 2 * gap) / 3, base = r.y + r.h - 34, hMax = base - r.y - 18;
        const kh = hMax / Q_MAX;
        items.forEach((it, i) => {
          const x = r.x + i * (bw + gap);
          const h = it.val * kh, y0 = base - it.from * kh;
          ctx.save(); ctx.fillStyle = it.col; ctx.globalAlpha = 0.85; ctx.fillRect(x, y0 - h, bw, h); ctx.restore();
          L.text(ctx, L.fmt(it.val, 0), x + bw / 2, y0 - h - 9, c.text, { font: small, align: 'center' });
          L.text(ctx, it.lab, x + bw / 2, base + 11, it.col, { font: small, align: 'center' });
        });
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(r.x - 3, base + 0.5); ctx.lineTo(r.x + r.w + 3, base + 0.5); ctx.stroke(); ctx.restore();
        L.text(ctx, 'Дж', r.x + r.w, base + 25, c.muted, { font: '11px system-ui, sans-serif', align: 'right' });
      } else {
        const lw = 38, rowH = 16, kw = (r.w - lw - 46) / Q_MAX;
        items.forEach((it, i) => {
          const y = r.y + i * (rowH + 4);
          const x0 = r.x + lw + it.from * kw, w = it.val * kw;
          L.text(ctx, it.lab, r.x, y + rowH / 2, it.col, { font: small });
          ctx.save(); ctx.fillStyle = it.col; ctx.globalAlpha = 0.85; ctx.fillRect(x0, y, w, rowH); ctx.restore();
          L.text(ctx, `${L.fmt(it.val, 0)} Дж`, x0 + w + 4, y + rowH / 2, c.text, { font: small });
        });
      }
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const Th = sTh.value, Tc = Math.min(sTc.value, Th);
      const eta = Th > 0 ? 1 - Tc / Th : 0; // η_max = 1 − T_х/T_н
      const Q = sQ.value;
      const A = eta * Q;       // η = A/Q_н
      const Qc = Q - A;        // |Q_х| = Q_н − A
      const e = { eta, Q, A, Qc };
      const wide = W >= 480;
      if (wide) {
        const bw = Math.min(210, W * 0.32);
        drawCycle(ctx, { x: 30, y: 26, w: W - 30 - bw - 40, h: H - 26 - 28 }, Th, Tc, c);
        drawBars(ctx, { x: W - bw - 8, y: 30, w: bw, h: H - 30 - 4 }, e, c, true);
      } else {
        const bh = 96;
        drawCycle(ctx, { x: 26, y: 26, w: W - 26 - 24, h: H - 26 - 22 - bh }, Th, Tc, c);
        drawBars(ctx, { x: 8, y: H - bh + 30, w: W - 16, h: bh - 30 }, e, c, false);
      }

      const rows = [
        ['η<sub>max</sub> = 1 − T<sub>х</sub>/T<sub>н</sub>', `${L.fmt(eta * 100, 1)} % (${L.fmt(eta, 3)})`],
        ['Q<sub>н</sub> (получено от нагревателя)', `${L.fmt(Q, 0)} Дж`],
        ['A = ηQ<sub>н</sub> (работа за цикл)', `${L.fmt(A, 1)} Дж`],
        ['|Q<sub>х</sub>| = Q<sub>н</sub> − A (отдано холодильнику)', `${L.fmt(Qc, 1)} Дж`],
      ];
      if (Tc === 0) rows.push(['T<sub>х</sub> = 0 К', 'η = 100 % недостижимо: абсолютный нуль недостижим']);
      else if (Tc === Th) rows.push(['T<sub>х</sub> = T<sub>н</sub>', 'η = 0: цикл вырождается, работа за цикл равна нулю']);
      ro.set(rows, [
        ['T<sub>н</sub>', tFmt(Th)],
        ['T<sub>х</sub>', tFmt(Tc)],
        ['T<sub>х</sub>/T<sub>н</sub>', L.fmt(Tc / Th, 3)],
        ['Проверка: 1 − |Q<sub>х</sub>|/Q<sub>н</sub>', L.fmt(1 - Qc / Q, 3)],
      ]);
    }

    cv.onResize(() => draw());
    d.add(L.onThemeChange(() => draw()));
    draw();
    return { destroy: d.run };
  },
};
