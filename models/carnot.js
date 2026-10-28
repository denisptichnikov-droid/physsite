// Модель «Цикл Карно»: две изотермы и две адиабаты на pV-диаграмме, η_max = 1 − T_х/T_н.
// Формулы — CLAUDE.md, часть B: 2.1.7 (T = t + 273), 2.2.7 (адиабата Q = 0), 2.2.10 (η Карно).
// Форма адиабаты pV^{5/3} = const (одноатомный газ) в части B отсутствует — используется только для рисунка
// (см. docs/carnot.md, CHECK). Масштаб pV-диаграммы условный (νR = 1, V₁ = 1,5 усл. ед.).
import * as L from './_lib.js';

const DEF = { Th: 500, Tc: 300 };
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
      caption: 'Цикл Карно: 1→2 — изотермическое расширение при T_н (газ получает Q_н), 2→3 — адиабатное расширение (Q = 0), '
        + '3→4 — изотермическое сжатие при T_х (газ отдаёт Q_х), 4→1 — адиабатное сжатие. '
        + 'КПД зависит только от температур нагревателя и холодильника (в кельвинах!). Масштаб диаграммы условный.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.66, minHeight: 300, maxHeight: 500, label: 'Цикл Карно на pV-диаграмме и шкала КПД' });
    d.add(cv.destroy);

    const tFmt = (v) => `${L.fmt(v, 0)} К (${L.fmt(v - 273, 0)} °C)`;
    const sTh = L.slider(ui.controls, { label: 'Температура нагревателя T<sub>н</sub>', min: 200, max: 1000, step: 10, value: DEF.Th, format: tFmt, onInput: () => fix('h') });
    const sTc = L.slider(ui.controls, { label: 'Температура холодильника T<sub>х</sub>', min: 0, max: 1000, step: 10, value: DEF.Tc, format: tFmt, onInput: () => fix('c') });
    L.button(ui.controls, 'Сброс', () => { sTh.set(DEF.Th); sTc.set(DEF.Tc); draw(); }, { reset: true });
    const ro = L.readout(ui.readout);

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

    function drawBar(ctx, r, eta, c, vertical) {
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillStyle = c.surface;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = c.accent;
      if (vertical) { const h = r.h * eta; ctx.fillRect(r.x, r.y + r.h - h, r.w, h); }
      else ctx.fillRect(r.x, r.y, r.w * eta, r.h);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = c.muted; ctx.font = '11px system-ui, sans-serif';
      for (let k = 0; k <= 4; k++) {
        const f = k / 4;
        if (vertical) {
          const y = r.y + r.h - r.h * f;
          ctx.beginPath(); ctx.moveTo(r.x + r.w, y); ctx.lineTo(r.x + r.w + 5, y); ctx.stroke();
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(`${k * 25} %`, r.x + r.w + 8, y);
        } else {
          const x = r.x + r.w * f;
          ctx.beginPath(); ctx.moveTo(x, r.y + r.h); ctx.lineTo(x, r.y + r.h + 5); ctx.stroke();
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(`${k * 25} %`, x, r.y + r.h + 7);
        }
      }
      ctx.restore();
      const lab = `η_{max} = ${L.fmt(eta * 100, 1)} %`;
      if (vertical) L.text(ctx, lab, r.x + r.w / 2, r.y - 12, c.text, { font: '600 13px system-ui, sans-serif', align: 'center' });
      else L.text(ctx, lab, r.x, r.y - 12, c.text, { font: '600 13px system-ui, sans-serif' });
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const Th = sTh.value, Tc = Math.min(sTc.value, Th);
      const eta = Th > 0 ? 1 - Tc / Th : 0; // B2.2.10
      const wide = W >= 480;
      if (wide) {
        const bw = 110;
        drawCycle(ctx, { x: 30, y: 26, w: W - 30 - bw - 40, h: H - 26 - 28 }, Th, Tc, c);
        drawBar(ctx, { x: W - bw + 6, y: 40, w: 30, h: H - 40 - 30 }, eta, c, true);
      } else {
        const bh = 74;
        drawCycle(ctx, { x: 26, y: 26, w: W - 26 - 24, h: H - 26 - 22 - bh }, Th, Tc, c);
        drawBar(ctx, { x: 18, y: H - bh + 24, w: W - 44, h: 18 }, eta, c, false);
      }

      let limit = 'T_х → 0 К: η → 100 %; T_х = T_н: η = 0';
      if (Tc === 0) limit = 'T_х = 0 К: η = 100 % — недостижимо (абсолютный нуль недостижим), адиабаты уходят в бесконечность';
      else if (Tc === Th) limit = 'T_х = T_н: η = 0 — цикл вырождается, работа за цикл равна нулю';
      ro.set([
        ['T<sub>н</sub>', tFmt(Th)],
        ['T<sub>х</sub>', tFmt(Tc)],
        ['T<sub>х</sub>/T<sub>н</sub>', L.fmt(Tc / Th, 3)],
        ['η<sub>max</sub> = 1 − T<sub>х</sub>/T<sub>н</sub>', `${L.fmt(eta * 100, 1)} % (${L.fmt(eta, 3)})`],
        ['Предельные случаи', limit],
      ]);
    }

    cv.onResize(() => draw());
    d.add(L.onThemeChange(() => draw()));
    draw();
    return { destroy: d.run };
  },
};
