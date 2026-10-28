// Модель «Закон радиоактивного распада»: N(t) = N₀·2^(−t/T), отметки T, 2T, 3T, стохастическое поле ядер.
// Формулы — CLAUDE.md, часть B, 4.3.3.
import * as L from './_lib.js';

const NFIELD = 200, COLS = 20, ROWS = 10;
const DEF = { mode: 'N', N0: 1000, m0: 100, T: 4, t: 0, field: true };
const T_RANGE = 5; // ось времени: от 0 до 5T

export default {
  id: 'decay',
  title: 'Закон радиоактивного распада',
  codes: ['4.3.2', '4.3.3'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Кривая — точный закон N(t) = N₀·2^(−t/T): за каждый период полураспада T остаётся половина ядер. '
        + 'Поле из 200 точек — наглядная модель: каждое ядро распадается в случайный момент, поэтому число оставшихся '
        + 'точек лишь примерно следует закону (закон статистический и точен для большого числа ядер).',
    });
    const cvG = L.canvas(ui.stage, { aspect: 0.6, minHeight: 230, maxHeight: 400, label: 'График N(t) с отметками T, 2T, 3T' });
    d.add(cvG.destroy);
    const fieldWrap = document.createElement('div');
    ui.stage.append(fieldWrap);
    const cvF = L.canvas(fieldWrap, { aspect: 0.32, minHeight: 120, maxHeight: 200, label: 'Поле из 200 ядер: случайный распад' });
    d.add(cvF.destroy);

    const mode = L.choice(ui.controls, {
      label: 'Величина',
      options: [{ value: 'N', label: 'число ядер N' }, { value: 'm', label: 'масса m' }],
      value: DEF.mode,
      onChange: () => { syncMode(); update(); },
    });
    const sN = L.slider(ui.controls, { label: 'Начальное число ядер N<sub>0</sub>', min: 100, max: 10000, step: 100, value: DEF.N0, format: (v) => L.fmt(v, 0), onInput: update });
    const sM = L.slider(ui.controls, { label: 'Начальная масса m<sub>0</sub>', min: 1, max: 200, step: 1, value: DEF.m0, unit: 'г', format: (v) => L.fmt(v, 0), onInput: update });
    const sT = L.slider(ui.controls, { label: 'Период полураспада T', min: 1, max: 20, step: 0.5, value: DEF.T, unit: 'с', format: (v) => L.fmt(v, 1), onInput: onT });
    const sTime = L.slider(ui.controls, { label: 'Время t', min: 0, max: T_RANGE * DEF.T, step: 0.05, value: DEF.t, unit: 'с', format: (v) => L.fmt(v, 2), onInput: (v) => { t = v; update(); } });
    sTime.input.step = 'any'; // время в анимации меняется непрерывно
    const chk = L.checkbox(ui.controls, { label: 'Показать поле из 200 ядер', checked: DEF.field, onChange: () => { syncField(); update(); } });

    let t = DEF.t;
    let u = sample();
    const anim = L.animator(step);
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Новая случайная выборка', () => { u = sample(); update(); });
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    // u_i ∈ (0; 1]; момент распада i-го ядра τ_i = T·log₂(1/u_i) — экспоненциальное распределение
    function sample() { return Array.from({ length: NFIELD }, () => 1 - Math.random()); }
    const tMax = () => T_RANGE * sT.value;

    function syncMode() {
      const isN = mode.value === 'N';
      sN.el.style.display = isN ? '' : 'none';
      sM.el.style.display = isN ? 'none' : '';
    }
    function syncField() { fieldWrap.style.display = chk.value ? '' : 'none'; }

    function onT() {
      sTime.input.max = String(tMax());
      if (t > tMax()) t = tMax();
      sTime.set(t);
      update();
    }

    function q() {
      const isN = mode.value === 'N';
      const Q0 = isN ? sN.value : sM.value;
      const T = sT.value;
      const tt = Math.min(Math.max(0, t), tMax());
      const ratio = Math.pow(2, -tt / T);       // 2^(−t/T)
      return { isN, Q0, T, t: tt, ratio, Q: Q0 * ratio, sym: isN ? 'N' : 'm', unit: isN ? '' : 'г' };
    }

    function step(dt) {
      const max = tMax();
      if (t >= max - 1e-9) {
        t = 0;
      } else {
        t = Math.min(max, t + (dt * sT.value) / 3); // весь интервал 0…5T за 15 с
      }
      sTime.set(t);
      update();
      if (t >= max - 1e-9) { anim.stop(); play.sync(); }
    }

    function drawGraph() {
      const { ctx, width: W, height: Hg } = cvG;
      if (!W) return;
      const c = L.colors();
      const s = q();
      ctx.clearRect(0, 0, W, Hg);
      const fs = W < 420 ? 11 : 12;
      const font = `${fs}px system-ui, sans-serif`;
      const rect = { x: 46, y: 24, w: W - 46 - 30, h: Hg - 24 - 40 };
      const g = L.graph(ctx, rect, {
        xMin: 0, xMax: T_RANGE * s.T, yMin: 0, yMax: s.Q0 * 1.08,
        xTicks: s.T, yTicks: s.Q0 / 4,
        xLabel: 't, с', yLabel: s.isN ? 'N' : 'm, г',
      });
      // отметки T, 2T, 3T
      const sub0 = s.isN ? 'N_0' : 'm_0';
      for (let k = 1; k <= 3; k++) {
        const xk = g.X(k * s.T), yk = g.Y(s.Q0 / 2 ** k);
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(xk, g.Y(0)); ctx.lineTo(xk, yk); ctx.lineTo(g.X(0), yk); ctx.stroke();
        ctx.restore();
        L.dot(ctx, xk, yk, c.muted, 3);
        L.text(ctx, `${sub0}/${2 ** k}`, xk + 5, yk - 9, c.muted, { font });
        L.text(ctx, k === 1 ? 'T' : `${k}T`, xk, g.Y(0) + 24, c.accent, { font: `600 ${fs}px system-ui, sans-serif`, align: 'center' });
      }
      L.plotFn(ctx, g, (x) => s.Q0 * Math.pow(2, -x / s.T), c.accent, { width: 2.5, n: 300 });
      // текущий момент
      const xt = g.X(s.t), yt = g.Y(s.Q);
      ctx.save();
      ctx.strokeStyle = c.force; ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(xt, g.Y(0)); ctx.lineTo(xt, yt); ctx.stroke();
      ctx.restore();
      L.dot(ctx, xt, yt, c.force, 5);
    }

    function drawField() {
      const { ctx, width: W, height: Hf } = cvF;
      if (!W || !chk.value) return;
      const c = L.colors();
      const s = q();
      ctx.clearRect(0, 0, W, Hf);
      const fs = W < 420 ? 11 : 12;
      const top = 22;
      const cell = Math.min((W - 16) / COLS, (Hf - top - 6) / ROWS);
      const ox = (W - cell * COLS) / 2, oy = top + (Hf - top - 6 - cell * ROWS) / 2;
      const r = Math.max(2, cell * 0.32);
      let left = 0;
      for (let i = 0; i < NFIELD; i++) {
        const tau = s.T * Math.log2(1 / u[i]);
        const alive = !(s.t > tau);
        if (alive) left++;
        const x = ox + (i % COLS + 0.5) * cell;
        const y = oy + (Math.floor(i / COLS) + 0.5) * cell;
        ctx.save();
        if (alive) {
          ctx.fillStyle = c.accent;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
      }
      L.text(ctx, `Случайный распад 200 ядер: осталось ${left} (по закону ≈ ${L.fmt(NFIELD * s.ratio, 1)})`, W / 2, 10, c.text, { font: `${fs}px system-ui, sans-serif`, align: 'center' });
      return left;
    }

    function countLeft(s) {
      let left = 0;
      for (let i = 0; i < NFIELD; i++) if (!(s.t > s.T * Math.log2(1 / u[i]))) left++;
      return left;
    }

    function updateReadout() {
      const s = q();
      const f = L.fmt;
      const val = (x) => (s.isN ? f(x, 1) : `${f(x, 2)} г = ${f(x / 1000)} кг`);
      const rows = [
        ['t', `${f(s.t, 2)} с`],
        ['T', `${f(s.T, 1)} с`],
        ['t/T', f(s.t / s.T, 3)],
        ['2<sup>−t/T</sup> (доля оставшихся)', f(s.ratio, 4)],
        [`${s.sym}(t) = ${s.sym}<sub>0</sub>·2<sup>−t/T</sup>`, val(s.Q)],
        ['Доля распавшихся 1 − 2<sup>−t/T</sup>', `${f(1 - s.ratio, 4)} (${f((1 - s.ratio) * 100, 1)} %)`],
        [`Распалось Δ${s.sym} = ${s.sym}<sub>0</sub> − ${s.sym}(t)`, val(s.Q0 - s.Q)],
      ];
      if (chk.value) {
        rows.push(['Поле 200 ядер: осталось (случайно)', `${countLeft(s)} (ожидается ${f(NFIELD * s.ratio, 1)})`]);
      }
      ro.set(rows);
    }

    function update() {
      t = Math.min(Math.max(0, t), tMax());
      drawGraph();
      drawField();
      updateReadout();
    }

    function reset() {
      anim.stop();
      mode.set(DEF.mode);
      sN.set(DEF.N0);
      sM.set(DEF.m0);
      sT.set(DEF.T);
      sTime.input.max = String(T_RANGE * DEF.T);
      t = DEF.t;
      sTime.set(t);
      chk.set(DEF.field);
      syncMode();
      syncField();
      play.sync();
      update();
    }

    syncMode();
    syncField();
    cvG.onResize(drawGraph);
    cvF.onResize(drawField);
    d.add(L.onThemeChange(update));
    update();
    return { destroy: d.run };
  },
};
