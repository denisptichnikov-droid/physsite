// Модель «График t(Q)»: нагрев льда → плавление → нагрев воды → кипение → нагрев пара.
// Формулы — CLAUDE.md, часть B: 2.2.4 (Q = cmΔt), 2.2.5 (Q = λm, Q = Lm), 2.1.15–2.1.17 (t = const при переходе).
// Табличные c, λ, L — CHECK в docs/phase-graph.md.
import * as L from './_lib.js';

const C_ICE = 2100, LAMBDA = 3.3e5, C_W = 4200, L_V = 2.3e6, C_ST = 2000;
const T_END = 150; // °C — конечная температура пара
const DEF = { m: 1, t0: -20, q: 0 };
const NUM = ['①', '②', '③', '④', '⑤'];

const SUPM = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
function sci(x, d = 3) {
  if (!Number.isFinite(x)) return L.fmt(x);
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(Math.abs(x)));
  let m = +(x / 10 ** e).toFixed(d - 1);
  if (Math.abs(m) >= 10) { m /= 10; e += 1; }
  const ms = L.fmt(m, d - 1);
  return e === 0 ? ms : `${ms}·10${String(e).split('').map((ch) => SUPM[ch]).join('')}`;
}

/** Участки процесса от начальной температуры t0 до T_END. */
function build(m, t0) {
  const seg = [];
  const add = (o) => { if (o.Q > 0) seg.push(o); };
  if (t0 < 0) add({ kind: 'heat', name: 'нагрев льда', phase: 'лёд', c: C_ICE, t1: t0, t2: 0, Q: C_ICE * m * (0 - t0), f: 'Q = c_л·m·Δt' });
  if (t0 <= 0) add({ kind: 'phase', name: 'плавление', phase: 'лёд + вода', what: 'расплавилось', t1: 0, t2: 0, Q: LAMBDA * m, f: 'Q = λm' });
  if (t0 < 100) { const a = Math.max(t0, 0); add({ kind: 'heat', name: 'нагрев воды', phase: 'вода', c: C_W, t1: a, t2: 100, Q: C_W * m * (100 - a), f: 'Q = c_в·m·Δt' }); }
  if (t0 <= 100) add({ kind: 'phase', name: 'кипение', phase: 'вода + пар', what: 'испарилось', t1: 100, t2: 100, Q: L_V * m, f: 'Q = Lm' });
  { const a = Math.max(t0, 100); add({ kind: 'heat', name: 'нагрев пара', phase: 'пар', c: C_ST, t1: a, t2: T_END, Q: C_ST * m * (T_END - a), f: 'Q = c_п·m·Δt' }); }
  let acc = 0;
  seg.forEach((s) => { s.q0 = acc; acc += s.Q; s.q1 = acc; });
  return { seg, total: acc };
}

/** Состояние после подвода теплоты Q. */
function at(B, m, Q) {
  for (const s of B.seg) {
    if (Q <= s.q1 + 1e-9) {
      const q = Math.max(0, Q - s.q0);
      if (s.kind === 'heat') return { t: s.t1 + q / (s.c * m), s };
      return { t: s.t1, s, frac: Math.min(1, q / s.Q) };
    }
  }
  const s = B.seg[B.seg.length - 1];
  return { t: s.t2, s };
}

export default {
  id: 'phase-graph',
  title: 'График t(Q): плавление и кипение',
  codes: ['2.1.16', '2.1.17', '2.2.4', '2.2.5'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Вода (лёд) массой m нагревается до 150 °C при нормальном давлении. На горизонтальных участках '
        + 'температура не меняется: теплота идёт на плавление (Q = λm) и кипение (Q = Lm).',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.6, minHeight: 260, maxHeight: 440, label: 'График зависимости температуры от подведённой теплоты' });
    d.add(cv.destroy);

    let qPct = DEF.q;
    let B = build(DEF.m, DEF.t0);
    const sM = L.slider(ui.controls, { label: 'Масса m', min: 0.1, max: 2, step: 0.1, value: DEF.m, unit: 'кг', onInput: () => rebuild() });
    const sT0 = L.slider(ui.controls, { label: 'Начальная температура t<sub>0</sub>', min: -50, max: 140, step: 5, value: DEF.t0, unit: '°C', onInput: () => rebuild() });
    const sQ = L.slider(ui.controls, {
      label: 'Подведённая теплота Q', min: 0, max: 100, step: 0.1, value: 0,
      format: (v) => `${L.fmt((v / 100) * B.total / 1000, 0)} кДж`,
      onInput: (v) => { qPct = v; draw(); },
    });
    const ro = L.readout(ui.readout);

    const anim = L.animator((dt) => {
      qPct += (dt * 100) / 8;
      if (qPct >= 100) { qPct = 100; anim.stop(); play.sync(); }
      sQ.set(qPct);
      draw();
    });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    play.el.addEventListener('click', () => { if (anim.running && qPct >= 100) { qPct = 0; sQ.set(0); } });
    L.button(ui.controls, 'Сброс', () => {
      anim.stop(); play.sync();
      sM.set(DEF.m); sT0.set(DEF.t0); qPct = DEF.q; rebuild();
    }, { reset: true });

    function rebuild() { B = build(sM.value, sT0.value); sQ.set(qPct); draw(); }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const m = sM.value;
      const Q = (qPct / 100) * B.total;
      const st = at(B, m, Q);
      const narrow = W < 420;
      const rect = { x: narrow ? 36 : 44, y: 24, w: W - (narrow ? 36 : 44) - 30, h: H - 24 - 22 };
      const xMax = (B.total / 1000) * 1.04;
      const g = L.graph(ctx, rect, {
        xMin: 0, xMax, yMin: -60, yMax: 170, xLabel: 'Q, кДж', yLabel: 't, °C',
        xTicks: L.niceStep(xMax, narrow ? 3 : 5), yTicks: narrow ? 40 : 20,
      });
      // уровень 100 °C
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(g.X(0), g.Y(100)); ctx.lineTo(g.X(xMax), g.Y(100)); ctx.stroke();
      ctx.restore();
      const line = (q0, q1, col, w) => {
        ctx.save();
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath();
        let first = true;
        for (const s of B.seg) {
          const a = Math.max(q0, s.q0), b = Math.min(q1, s.q1);
          if (b < a) continue;
          const ta = s.kind === 'heat' ? s.t1 + (a - s.q0) / (s.c * m) : s.t1;
          const tb = s.kind === 'heat' ? s.t1 + (b - s.q0) / (s.c * m) : s.t1;
          if (first) { ctx.moveTo(g.X(a / 1000), g.Y(ta)); first = false; } else ctx.lineTo(g.X(a / 1000), g.Y(ta));
          ctx.lineTo(g.X(b / 1000), g.Y(tb));
        }
        ctx.stroke();
        ctx.restore();
      };
      line(0, B.total, c.muted, 1.5);
      if (Q > 0) line(0, Q, c.force, 3);
      // номера участков и формулы
      B.seg.forEach((s, i) => {
        const xa = g.X(s.q0 / 1000), xb = g.X(s.q1 / 1000);
        const mx = (xa + xb) / 2, my = (g.Y(s.t1) + g.Y(s.t2)) / 2;
        if (s.kind === 'phase') {
          const lab = xb - xa > 70 ? `${NUM[i]} ${s.f}` : NUM[i];
          L.text(ctx, lab, mx, my - 12, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
        } else {
          L.text(ctx, NUM[i], mx + 12, my + 6, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
        }
      });
      // текущая точка
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(g.X(Q / 1000), g.Y(0)); ctx.lineTo(g.X(Q / 1000), g.Y(st.t)); ctx.stroke();
      ctx.restore();
      L.dot(ctx, g.X(Q / 1000), g.Y(st.t), c.force, 5);

      let state = st.s.phase;
      if (st.s.kind === 'phase') {
        const before = st.s.t1 === 0 ? 'лёд' : 'вода', after = st.s.t1 === 0 ? 'вода' : 'пар';
        if (st.frac <= 0) state = `${before} при ${st.s.t1} °C (начало: ${st.s.name})`;
        else if (st.frac >= 1) state = `${after} при ${st.s.t1} °C (${st.s.name} закончилось)`;
        else state = `${st.s.phase}: ${st.s.what} ${L.fmt(st.frac * m, 3)} кг`;
      }
      const rows = [
        ['Подведено Q', `${sci(Q)} Дж`],
        ['Температура t', `${L.fmt(st.t, 1)} °C (T = ${L.fmt(st.t + 273, 1)} К)`],
        ['Состояние', state],
      ];
      B.seg.forEach((s, i) => {
        const how = s.kind === 'heat'
          ? `${s.c}·${L.fmt(m, 1)}·${L.fmt(s.t2 - s.t1, 0)}`
          : `${sci(s.t1 === 0 ? LAMBDA : L_V, 2)}·${L.fmt(m, 1)}`;
        rows.push([`${NUM[i]} ${s.name}: ${s.f.replace(/_(.)/g, '<sub>$1</sub>')}`, `${how} = ${sci(s.Q)} Дж`]);
      });
      rows.push(['Q полное', `${sci(B.total)} Дж`]);
      ro.set(rows);
    }

    cv.onResize(() => draw());
    d.add(L.onThemeChange(() => draw()));
    draw();
    return { destroy: d.run };
  },
};
