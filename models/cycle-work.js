// Модель «Работа газа за цикл»: цикл на pV-диаграмме, работа = площадь, знаки Q на участках, КПД.
// Формулы — CLAUDE.md, часть B: 2.1.10 (U = 3/2·pV), 2.2.6 (A = площадь под графиком, за цикл — площадь цикла),
// 2.2.7 (Q = ΔU + A), 2.2.9 (η = A/Q_нагр = 1 − |Q_хол|/Q_нагр).
// Единицы на графике: p в кПа, V в л, тогда p·V сразу в джоулях (1 кПа·л = 1 Дж).
import * as L from './_lib.js';

const DEF = { tpl: 'rect', ccw: false, p1: 100, p2: 300, V1: 2, V2: 6 };
const X_MAX = 11;   // л
const Y_MAX = 450;  // кПа
const N_NUM = 2000; // разбиение участка при расчёте теплоты по кусочкам
const N_DRAW = 160; // разбиение участка для рисования

const KIND_NAME = { V: 'изохора', p: 'изобара', line: 'прямая', T: 'изотерма' };

/** Точка на участке seg при параметре t ∈ [0, 1]: [V (л), p (кПа)]. */
function pointOn(seg, t) {
  const [Va, pa] = seg.a, [Vb, pb] = seg.b;
  const V = Va + (Vb - Va) * t;
  if (seg.kind === 'T') return [V, V > 0 ? (pa * Va) / V : pa];
  return [V, pa + (pb - pa) * t];
}

/**
 * Участок разбивается на N кусочков; на каждом A = (p₁+p₂)/2·ΔV (площадь трапеции под графиком),
 * ΔU = 3/2·Δ(pV), Q = ΔU + A. Полученная теплота — сумма положительных Q, отданная — отрицательных.
 */
function analyze(seg, n = N_NUM) {
  let A = 0, Qp = 0, Qm = 0;
  let prev = pointOn(seg, 0);
  for (let i = 1; i <= n; i++) {
    const q = pointOn(seg, i / n);
    const dA = ((prev[1] + q[1]) / 2) * (q[0] - prev[0]);
    const dU = 1.5 * (q[0] * q[1] - prev[0] * prev[1]);
    const dQ = dU + dA;
    A += dA;
    if (dQ > 0) Qp += dQ; else Qm += dQ;
    prev = q;
  }
  const dU = 1.5 * (seg.b[0] * seg.b[1] - seg.a[0] * seg.a[1]);
  return { A, dU, Q: dU + A, Qp, Qm };
}

/** Вершины и типы участков для шаблона. */
function build(tpl, ccw, p1, p2, V1, V2) {
  let pts, kinds, note = '';
  if (tpl === 'tri') {
    pts = [[V1, p1], [V1, p2], [V2, p1]];
    kinds = ['V', 'line', 'p'];
  } else if (tpl === 'iso') {
    const Vmax = (p2 * V1) / p1; // изотерма из (V₁, p₂) опускается до p₁ при этом объёме
    const V3 = Math.min(V2, Vmax);
    if (V2 > Vmax + 1e-9) note = `V₂ ограничен: изотерма опускается до p₁ уже при V = ${L.fmt(Vmax, 2)} л`;
    if (Vmax - V3 < 1e-6) {
      // изотерма сама приходит к p₁ — изохора 3→4 вырождается, её не показываем
      pts = [[V1, p1], [V1, p2], [V3, p1]];
      kinds = ['V', 'T', 'p'];
    } else {
      pts = [[V1, p1], [V1, p2], [V3, (p2 * V1) / V3], [V3, p1]];
      kinds = ['V', 'T', 'V', 'p'];
    }
  } else {
    pts = [[V1, p1], [V1, p2], [V2, p2], [V2, p1]];
    kinds = ['V', 'p', 'V', 'p'];
  }
  if (ccw) { pts = [pts[0], ...pts.slice(1).reverse()]; kinds = kinds.slice().reverse(); }
  const n = pts.length;
  const segs = pts.map((a, i) => ({ a, b: pts[(i + 1) % n], kind: kinds[i], i: i + 1, j: ((i + 1) % n) + 1 }));
  return { pts, segs, note };
}

const en = (x) => L.fmt(Math.abs(x) < 0.05 ? 0 : x, 1);
const sgn = (x) => (Math.abs(x) < 0.05 ? '0' : (x > 0 ? '+' : '') + L.fmt(x, 1));

export default {
  id: 'cycle-work',
  title: 'Работа газа за цикл и КПД',
  codes: ['2.2.6', '2.2.7', '2.2.9'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Одноатомный идеальный газ. Закрашенная площадь цикла — работа газа за цикл. '
        + 'Красным отмечены части участков, где газ получает теплоту (Q > 0), синим — где отдаёт (Q < 0). '
        + 'p в кПа, V в литрах: 1 кПа·л = 1 Дж.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.72, minHeight: 280, maxHeight: 520, label: 'Цикл на pV-диаграмме' });
    d.add(cv.destroy);

    let tpl = DEF.tpl;
    const ch = L.choice(ui.controls, {
      label: 'Цикл',
      options: [
        { value: 'rect', label: 'прямоугольный (2 изобары + 2 изохоры)' },
        { value: 'tri', label: 'треугольный' },
        { value: 'iso', label: 'с изотермой' },
      ],
      value: DEF.tpl,
      onChange: (v) => {
        tpl = v;
        // для цикла с изотермой выбираем невырожденные значения: p₂V₁/p₁ > V₂
        if (v === 'iso' && sV2.value >= (sP2.value * sV1.value) / sP1.value - 1e-9) {
          sP1.set(DEF.p1); sP2.set(DEF.p2); sV1.set(DEF.V1); sV2.set(4);
        }
        draw();
      },
    });
    const cb = L.checkbox(ui.controls, { label: 'Обход против часовой стрелки', checked: DEF.ccw, onChange: () => draw() });
    const sP1 = L.slider(ui.controls, { label: 'p<sub>1</sub>', min: 50, max: 390, step: 10, value: DEF.p1, unit: 'кПа', onInput: () => fix('p1') });
    const sP2 = L.slider(ui.controls, { label: 'p<sub>2</sub>', min: 60, max: 400, step: 10, value: DEF.p2, unit: 'кПа', onInput: () => fix('p2') });
    const sV1 = L.slider(ui.controls, { label: 'V<sub>1</sub>', min: 1, max: 9.5, step: 0.5, value: DEF.V1, unit: 'л', onInput: () => fix('V1') });
    const sV2 = L.slider(ui.controls, { label: 'V<sub>2</sub>', min: 1.5, max: 10, step: 0.5, value: DEF.V2, unit: 'л', onInput: () => fix('V2') });
    L.button(ui.controls, 'Сброс', () => {
      tpl = DEF.tpl; ch.set(DEF.tpl); cb.set(DEF.ccw);
      sP1.set(DEF.p1); sP2.set(DEF.p2); sV1.set(DEF.V1); sV2.set(DEF.V2);
      draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    // p₁ < p₂, V₁ < V₂ — двигаем «другой» слайдер, если пользователь их перепутал
    function fix(which) {
      if (sP1.value >= sP2.value) { if (which === 'p1') sP1.set(sP2.value - 10); else sP2.set(sP1.value + 10); }
      if (sV1.value >= sV2.value) { if (which === 'V1') sV1.set(sV2.value - 0.5); else sV2.set(sV1.value + 0.5); }
      draw();
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const narrow = W < 420;
      const rect = { x: narrow ? 40 : 48, y: 26, w: W - (narrow ? 40 : 48) - 26, h: H - 26 - 26 };
      const g = L.graph(ctx, rect, {
        xMin: 0, xMax: X_MAX, yMin: 0, yMax: Y_MAX, xLabel: 'V, л', yLabel: 'p, кПа',
        xTicks: narrow ? 2 : 1, yTicks: narrow ? 100 : 50,
      });
      const { pts, segs, note } = build(tpl, cb.value, sP1.value, sP2.value, sV1.value, sV2.value);
      const res = segs.map((s) => analyze(s));
      const A = res.reduce((t, r) => t + r.A, 0);
      const Qn = res.reduce((t, r) => t + r.Qp, 0);
      const Qx = res.reduce((t, r) => t + r.Qm, 0);

      // проекции вершин на оси
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (const [V, p] of pts) {
        ctx.moveTo(g.X(V), g.Y(p)); ctx.lineTo(g.X(V), g.Y(0));
        ctx.moveTo(g.X(V), g.Y(p)); ctx.lineTo(g.X(0), g.Y(p));
      }
      ctx.stroke();
      ctx.restore();

      // площадь цикла
      ctx.save();
      ctx.globalAlpha = 0.18; ctx.fillStyle = c.accent;
      ctx.beginPath();
      segs.forEach((s, k) => {
        for (let i = 0; i <= N_DRAW; i++) {
          const q = pointOn(s, i / N_DRAW);
          if (k === 0 && i === 0) ctx.moveTo(g.X(q[0]), g.Y(q[1])); else ctx.lineTo(g.X(q[0]), g.Y(q[1]));
        }
      });
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // центр фигуры — для подписи работы и выноса подписей участков наружу
      const cx = pts.reduce((t, q) => t + g.X(q[0]), 0) / pts.length;
      const cy = pts.reduce((t, q) => t + g.Y(q[1]), 0) / pts.length;
      const cyc = segs.length === 3 ? (2 * cy + g.Y(Math.min(...pts.map((q) => q[1])))) / 3 : cy;
      if (Math.abs(A) >= 0.05) {
        L.text(ctx, `A_{ц} ${A > 0 ? '>' : '<'} 0`, cx, cyc, c.text, { font: '600 13px system-ui, sans-serif', align: 'center' });
      }

      // участки: цвет по знаку теплоты на каждом кусочке
      segs.forEach((s) => {
        let prev = pointOn(s, 0);
        for (let i = 1; i <= N_DRAW; i++) {
          const q = pointOn(s, i / N_DRAW);
          const dQ = 1.5 * (q[0] * q[1] - prev[0] * prev[1]) + ((prev[1] + q[1]) / 2) * (q[0] - prev[0]);
          ctx.save();
          ctx.strokeStyle = dQ > 1e-9 ? c.force : dQ < -1e-9 ? c.fieldB : c.muted;
          ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(g.X(prev[0]), g.Y(prev[1])); ctx.lineTo(g.X(q[0]), g.Y(q[1])); ctx.stroke();
          ctx.restore();
          prev = q;
        }
      });

      // стрелки направления обхода и подписи знаков Q и A
      const font = narrow ? '11px system-ui, sans-serif' : '12px system-ui, sans-serif';
      segs.forEach((s, k) => {
        const r = res[k];
        const q1 = pointOn(s, 0.44), q2 = pointOn(s, 0.56);
        const x1 = g.X(q1[0]), y1 = g.Y(q1[1]), x2 = g.X(q2[0]), y2 = g.Y(q2[1]);
        const len = Math.hypot(x2 - x1, y2 - y1);
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        if (len > 1) {
          const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
          L.arrow(ctx, mx - ux * 8, my - uy * 8, mx + ux * 8, my + uy * 8, c.text, { width: 2.5, head: 10 });
        }
        if (Math.hypot(g.X(s.b[0]) - g.X(s.a[0]), g.Y(s.b[1]) - g.Y(s.a[1])) < 6) return; // вырожденный участок
        let ox = mx - cx, oy = my - cyc;
        const ol = Math.hypot(ox, oy) || 1;
        ox /= ol; oy /= ol;
        const qs = r.Qp > 0.05 && r.Qm < -0.05 ? 'Q: + и −' : r.Q > 0.05 ? 'Q > 0' : r.Q < -0.05 ? 'Q < 0' : 'Q = 0';
        const as = r.A > 0.05 ? 'A > 0' : r.A < -0.05 ? 'A < 0' : 'A = 0';
        const lx = mx + ox * (narrow ? 26 : 34), ly = my + oy * 22;
        const align = ox > 0.4 ? 'left' : ox < -0.4 ? 'right' : 'center';
        const qc = qs === 'Q > 0' ? c.force : qs === 'Q < 0' ? c.fieldB : c.text;
        L.text(ctx, qs, lx, ly - 7, qc, { font: '600 ' + font, align });
        L.text(ctx, as, lx, ly + 8, c.muted, { font, align });
      });

      // вершины
      pts.forEach(([V, p], i) => {
        L.dot(ctx, g.X(V), g.Y(p), c.text, 4);
        const ox = g.X(V) - cx, oy = g.Y(p) - cy;
        const ol = Math.hypot(ox, oy) || 1;
        L.text(ctx, String(i + 1), g.X(V) + (ox / ol) * 13, g.Y(p) + (oy / ol) * 13, c.text, { font: '600 13px system-ui, sans-serif', align: 'center' });
      });

      // readout
      const rows = [
        ['Направление обхода', A > 0.05 ? 'по часовой стрелке → A за цикл > 0' : A < -0.05 ? 'против часовой стрелки → A за цикл < 0' : 'площадь цикла равна нулю'],
        ['A за цикл (площадь фигуры)', `${en(A)} Дж`],
      ];
      segs.forEach((s, k) => {
        const r = res[k];
        const mixed = r.Qp > 0.05 && r.Qm < -0.05;
        const qtxt = mixed
          ? `Q = ${sgn(r.Q)} Дж (получает ${en(r.Qp)}, отдаёт ${en(-r.Qm)})`
          : `Q = ${sgn(r.Q)} Дж${r.Q > 0.05 ? ' (получает)' : r.Q < -0.05 ? ' (отдаёт)' : ''}`;
        rows.push([`${s.i}→${s.j}: ${KIND_NAME[s.kind]}`, `${qtxt}; A = ${en(r.A)} Дж; ΔU = ${en(r.dU)} Дж`]);
      });
      rows.push(['Q<sub>нагр</sub> (сумма Q > 0)', `${en(Qn)} Дж`]);
      rows.push(['|Q<sub>хол</sub>| (сумма |Q < 0|)', `${en(-Qx)} Дж`]);
      rows.push(['η = A/Q<sub>нагр</sub>', A > 0.05 && Qn > 0 ? `${L.fmt((A / Qn) * 100, 1)} %` : '— (A ≤ 0: это не тепловой двигатель)']);
      if (note) rows.push(['Примечание', note]);
      ro.set(rows);
    }

    cv.onResize(() => draw());
    d.add(L.onThemeChange(() => draw()));
    draw();
    return { destroy: d.run };
  },
};
