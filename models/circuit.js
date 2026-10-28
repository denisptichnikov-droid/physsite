// Полная цепь: источник (ℰ, r), два резистора последовательно/параллельно, идеальные амперметр и вольтметр.
// I = ℰ/(R + r), U = ℰ − Ir, η = R/(R + r), I_кз = ℰ/r (3.2.6, 3.2.7, 3.2.9).
import * as L from './_lib.js';

const DEF = { E: 12, r: 2, R1: 4, R2: 6 };

export default {
  id: 'circuit',
  title: 'Цепь с ЭДС и внутренним сопротивлением',
  codes: ['3.2.3', '3.2.6', '3.2.7', '3.2.8', '3.2.9'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Приборы идеальные: амперметр (R_A = 0) включён в общую ветвь, вольтметр (R_V → ∞) — на зажимах источника или на R₁. «Короткое замыкание» — внешняя цепь замкнута перемычкой (R = 0).',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.75, minHeight: 220, maxHeight: 480, label: 'Электрическая цепь: источник, два резистора, амперметр, вольтметр' });
    d.add(cv.destroy);

    const sEmf = L.slider(ui.controls, { label: 'ЭДС ℰ', min: 1, max: 24, step: 1, value: DEF.E, unit: 'В', onInput: draw });
    const sr = L.slider(ui.controls, { label: 'Внутреннее сопротивление r', min: 0, max: 5, step: 0.5, value: DEF.r, unit: 'Ом', onInput: draw });
    const sR1 = L.slider(ui.controls, { label: 'R<sub>1</sub>', min: 1, max: 20, step: 1, value: DEF.R1, unit: 'Ом', onInput: draw });
    const sR2 = L.slider(ui.controls, { label: 'R<sub>2</sub>', min: 1, max: 20, step: 1, value: DEF.R2, unit: 'Ом', onInput: draw });
    const conn = L.choice(ui.controls, {
      label: 'Соединение R<sub>1</sub> и R<sub>2</sub>',
      options: [{ value: 'series', label: 'последовательно' }, { value: 'parallel', label: 'параллельно' }],
      value: 'series', onChange: draw,
    });
    const vm = L.choice(ui.controls, {
      label: 'Вольтметр подключён',
      options: [{ value: 'source', label: 'к зажимам источника' }, { value: 'R1', label: 'к резистору R<sub>1</sub>' }],
      value: 'source', onChange: draw,
    });
    const sc = L.checkbox(ui.controls, { label: 'Короткое замыкание (R = 0)', checked: false, onChange: draw });
    L.button(ui.controls, 'Сброс', () => {
      sEmf.set(DEF.E); sr.set(DEF.r); sR1.set(DEF.R1); sR2.set(DEF.R2);
      conn.set('series'); vm.set('source'); sc.set(false);
      draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function calc() {
      const E = sEmf.value, r = sr.value, R1 = sR1.value, R2 = sR2.value;
      const series = conn.value === 'series';
      const short = sc.value;
      const Rblock = series ? R1 + R2 : (R1 * R2) / (R1 + R2);
      const R = short ? 0 : Rblock;
      const I = R + r > 0 ? E / (R + r) : Infinity;    // r = 0 и КЗ — ток не ограничен
      const U = R > 0 ? I * R : 0;                      // = ℰ − Ir
      let I1, I2, U1, U2;
      if (short) { I1 = 0; I2 = 0; U1 = 0; U2 = 0; }
      else if (series) { I1 = I; I2 = I; U1 = I * R1; U2 = I * R2; }
      else { U1 = U; U2 = U; I1 = U / R1; I2 = U / R2; }
      const P1 = I1 * U1, P2 = I2 * U2;
      const Pext = R > 0 ? I * U : 0;
      const Psrc = E * I;
      const Pr = r > 0 ? I * I * r : (Number.isFinite(I) ? 0 : NaN);
      const eta = R + r > 0 ? R / (R + r) : NaN;
      const Isc = r > 0 ? E / r : Infinity;
      const Vread = vm.value === 'source' ? U : U1;
      return { E, r, R1, R2, series, short, R, I, U, I1, I2, U1, U2, P1, P2, Pext, Psrc, Pr, eta, Isc, Vread };
    }

    // --- примитивы схемы ---
    function wire(ctx, pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    function clearCircle(ctx, x, y, r) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function resistor(ctx, x, y, w, h, color) {
      ctx.clearRect(x - w / 2, y - h / 2, w, h);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.restore();
    }
    function meter(ctx, x, y, r, letter, color) {
      clearCircle(ctx, x, y, r);
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      L.text(ctx, letter, x, y + 1, color, { font: `700 ${Math.round(r * 1.1)}px system-ui, sans-serif`, align: 'center' });
    }
    function node(ctx, x, y, color) { L.dot(ctx, x, y, color, 3); }
    function tri(ctx, x, y, dx, dy, color, size = 8) {
      ctx.save(); ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + dx * size * 0.6, y + dy * size * 0.6);
      ctx.lineTo(x - dx * size * 0.6 - dy * size * 0.5, y - dy * size * 0.6 + dx * size * 0.5);
      ctx.lineTo(x - dx * size * 0.6 + dy * size * 0.5, y - dy * size * 0.6 - dx * size * 0.5);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const s = calc();

      const xL = 0.07 * W, xR = 0.93 * W;
      const xN1 = 0.25 * W, xN2 = 0.75 * W;
      const ySh = 0.08 * H, yTop = 0.33 * H, yUp = 0.2 * H, yLo = 0.46 * H, yBot = 0.74 * H, yVs = 0.92 * H;
      const rw = L.clamp(0.13 * W, 32, 80), rh = L.clamp(0.055 * H, 10, 18);
      const mr = L.clamp(0.035 * W, 10, 15);
      const xs = 0.32 * W, xA = 0.66 * W, sg = 8;
      const xR1s = 0.4 * W, xR2s = 0.6 * W, xMid = 0.5 * W;
      const curCol = c.accent, lineCol = c.text;
      const lbl = 'italic 14px system-ui, sans-serif';

      ctx.save();
      ctx.strokeStyle = lineCol; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // общий контур: левая и правая стороны, нижний провод с источником и амперметром
      wire(ctx, [[xs - sg / 2, yBot], [xL, yBot], [xL, yTop]]);
      wire(ctx, [[xs + sg / 2, yBot], [xR, yBot], [xR, yTop]]);
      // блок резисторов
      let r1x, r1y;
      if (s.series) {
        wire(ctx, [[xL, yTop], [xR, yTop]]);
        r1x = xR1s; r1y = yTop;
      } else {
        wire(ctx, [[xL, yTop], [xN1, yTop]]);
        wire(ctx, [[xN2, yTop], [xR, yTop]]);
        wire(ctx, [[xN1, yUp], [xN1, yLo]]);
        wire(ctx, [[xN2, yUp], [xN2, yLo]]);
        wire(ctx, [[xN1, yUp], [xN2, yUp]]);
        wire(ctx, [[xN1, yLo], [xN2, yLo]]);
        r1x = xMid; r1y = yLo;
      }
      // перемычка КЗ
      if (s.short) {
        const yJoin = s.series ? yTop : yUp;
        wire(ctx, [[xN1, yJoin], [xN1, ySh], [xN2, ySh], [xN2, yJoin]]);
      }
      // вольтметр
      const vOnSource = vm.value === 'source';
      let vx, vy, va, vb, vyFrom;
      if (vOnSource) {
        vx = xs; vy = yVs; va = xs - 0.08 * W; vb = xs + 0.08 * W; vyFrom = yBot;
      } else {
        vx = r1x; vy = r1y + 0.14 * H; va = r1x - rw / 2 - 7; vb = r1x + rw / 2 + 7; vyFrom = r1y;
      }
      wire(ctx, [[va, vyFrom], [va, vy], [vx - mr, vy]]);
      wire(ctx, [[vb, vyFrom], [vb, vy], [vx + mr, vy]]);
      ctx.restore();

      // источник: короткая толстая (−) слева, длинная тонкая (+) справа
      ctx.save();
      ctx.strokeStyle = lineCol; ctx.lineCap = 'butt';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(xs - sg / 2, yBot - 7); ctx.lineTo(xs - sg / 2, yBot + 7); ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(xs + sg / 2, yBot - 14); ctx.lineTo(xs + sg / 2, yBot + 14); ctx.stroke();
      ctx.restore();
      L.text(ctx, '−', xs - sg / 2 - 9, yBot - 12, lineCol, { font: '13px system-ui, sans-serif', align: 'center' });
      L.text(ctx, '+', xs + sg / 2 + 9, yBot - 12, lineCol, { font: '13px system-ui, sans-serif', align: 'center' });
      L.text(ctx, 'ℰ, r', xs, yBot - 26, lineCol, { font: lbl, align: 'center' });

      // резисторы
      if (s.series) {
        resistor(ctx, xR1s, yTop, rw, rh, lineCol);
        resistor(ctx, xR2s, yTop, rw, rh, lineCol);
        L.text(ctx, 'R_1', xR1s, yTop - rh / 2 - 10, lineCol, { font: lbl, align: 'center' });
        L.text(ctx, 'R_2', xR2s, yTop - rh / 2 - 10, lineCol, { font: lbl, align: 'center' });
      } else {
        resistor(ctx, xMid, yUp, rw, rh, lineCol);
        resistor(ctx, xMid, yLo, rw, rh, lineCol);
        L.text(ctx, 'R_2', xMid, yUp - rh / 2 - 10, lineCol, { font: lbl, align: 'center' });
        L.text(ctx, 'R_1', xMid, yLo - rh / 2 - 10, lineCol, { font: lbl, align: 'center' });
        node(ctx, xN1, yTop, lineCol); node(ctx, xN2, yTop, lineCol);
      }
      if (s.short) {
        const yJoin = s.series ? yTop : yUp;
        node(ctx, xN1, yJoin, lineCol); node(ctx, xN2, yJoin, lineCol);
        L.text(ctx, 'перемычка (КЗ)', xMid, ySh - 9 < 6 ? ySh + 10 : ySh - 9, c.force, { font: '12px system-ui, sans-serif', align: 'center' });
      }

      // приборы
      meter(ctx, xA, yBot, mr, 'A', lineCol);
      meter(ctx, vx, vy, mr, 'V', lineCol);
      node(ctx, va, vyFrom, lineCol); node(ctx, vb, vyFrom, lineCol);
      const fs = '600 12px system-ui, sans-serif';
      L.text(ctx, L.fmt(s.I, 3) + ' А', xA, yBot + mr + 10, curCol, { font: fs, align: 'center' });
      L.text(ctx, L.fmt(s.Vread, 3) + ' В', vx, vOnSource ? vy - mr - 9 : vy + mr + 10, curCol, { font: fs, align: 'center' });

      // направление тока (во внешней цепи от «+» к «−»)
      tri(ctx, (xs + xA) / 2 + 4, yBot, 1, 0, curCol);
      L.text(ctx, 'I', (xs + xA) / 2 + 4, yBot - 12, curCol, { font: lbl, align: 'center' });
      tri(ctx, xR, (yTop + yBot) / 2, 0, -1, curCol);
      tri(ctx, xL, (yTop + yBot) / 2, 0, 1, curCol);
      if (s.short) {
        tri(ctx, xMid, ySh, -1, 0, curCol);
      } else if (s.series) {
        tri(ctx, xMid, yTop, -1, 0, curCol);
        L.text(ctx, 'I', xMid, yTop - 12, curCol, { font: lbl, align: 'center' });
      } else {
        const xa = xN1 + (xMid - rw / 2 - xN1) / 2;
        tri(ctx, xa, yUp, -1, 0, curCol);
        tri(ctx, xa, yLo, -1, 0, curCol);
        L.text(ctx, 'I_2', xa, yUp - 12, curCol, { font: lbl, align: 'center' });
        L.text(ctx, 'I_1', xa, yLo - 12, curCol, { font: lbl, align: 'center' });
      }

      // --- вывод ---
      const A = (x) => L.fmt(x, 3) + ' А', V = (x) => L.fmt(x, 3) + ' В', Wt = (x) => L.fmt(x, 3) + ' Вт';
      const rows = [
        ['R<sub>внеш</sub> ' + (s.short ? '(КЗ)' : s.series ? '= R<sub>1</sub> + R<sub>2</sub>' : '= R<sub>1</sub>R<sub>2</sub>/(R<sub>1</sub> + R<sub>2</sub>)'), L.fmt(s.R, 3) + ' Ом'],
        ['I = ℰ/(R + r) — амперметр', Number.isFinite(s.I) ? A(s.I) : '∞ (r = 0: ток КЗ не ограничен)'],
        ['U = ℰ − Ir (на зажимах источника)', V(s.U)],
        ['I<sub>1</sub>; I<sub>2</sub>', A(s.I1) + '; ' + A(s.I2)],
        ['U<sub>1</sub>; U<sub>2</sub>', V(s.U1) + '; ' + V(s.U2)],
        ['P<sub>1</sub> = I<sub>1</sub>U<sub>1</sub>; P<sub>2</sub> = I<sub>2</sub>U<sub>2</sub>', Wt(s.P1) + '; ' + Wt(s.P2)],
        ['P<sub>внеш</sub> = IU', Wt(s.Pext)],
        ['P<sub>ист</sub> = ℰI', Number.isFinite(s.Psrc) ? Wt(s.Psrc) : '∞ (r = 0: ток КЗ не ограничен)'],
        ['P<sub>r</sub> = I²r (потери внутри)', Wt(s.Pr)],
        ['η = R/(R + r)', Number.isFinite(s.eta) ? L.fmt(s.eta * 100, 1) + ' %' : '—'],
        ['I<sub>кз</sub> = ℰ/r', Number.isFinite(s.Isc) ? A(s.Isc) : '∞ (идеальный источник)'],
        ['Вольтметр (' + (vOnSource ? 'источник' : 'R<sub>1</sub>') + ')', V(s.Vread)],
      ];
      ro.set(rows);
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
