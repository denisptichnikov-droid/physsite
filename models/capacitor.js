// Плоский конденсатор: C = εε₀S/d, q = CU, E = U/d, W = CU²/2 = q²/(2C) (3.1.9, 3.1.11).
// Режимы: подключён к источнику (U = const) / отключён (q = const, фиксируется в момент отключения).
import * as L from './_lib.js';

const EPS0 = 8.85e-12; // Ф/м
const DEF = { d: 2, S: 200, eps: 1, U: 100 };

export default {
  id: 'capacitor',
  title: 'Плоский конденсатор',
  codes: ['3.1.9', '3.1.11', '3.1.10', '3.1.8'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Меняйте d, S, ε. Подключён к источнику — U = const; отключён — q = const (заряд фиксируется в момент отключения). Стрелки ↑/↓ — изменение величины относительно момента последнего переключения режима.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, label: 'Плоский конденсатор с источником напряжения' });
    d.add(cv.destroy);

    let mode = 'U';   // 'U' — подключён, 'q' — отключён
    let qFixed = 0;   // Кл, заряд в режиме q = const
    let ref = null;   // состояние в момент переключения

    const sD = L.slider(ui.controls, { label: 'Расстояние между пластинами d', min: 1, max: 10, step: 0.5, value: DEF.d, unit: 'мм', onInput: draw });
    const sS = L.slider(ui.controls, { label: 'Площадь пластины S', min: 50, max: 500, step: 10, value: DEF.S, unit: 'см²', onInput: draw });
    const sE = L.slider(ui.controls, { label: 'Диэлектрическая проницаемость ε', min: 1, max: 10, step: 0.5, value: DEF.eps, onInput: draw });
    const sU = L.slider(ui.controls, { label: 'Напряжение источника U<sub>ист</sub>', min: 10, max: 300, step: 10, value: DEF.U, unit: 'В', onInput: draw });
    const mChoice = L.choice(ui.controls, {
      label: 'Режим',
      options: [
        { value: 'U', label: 'подключён к источнику (U = const)' },
        { value: 'q', label: 'отключён от источника (q = const)' },
      ],
      value: 'U',
      onChange: setMode,
    });
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    function calc() {
      const dm = sD.value * 1e-3;  // м
      const Sm = sS.value * 1e-4;  // м²
      const eps = sE.value;
      const C = (eps * EPS0 * Sm) / dm;
      let q, U;
      if (mode === 'U') { U = sU.value; q = C * U; } else { q = qFixed; U = q / C; }
      const E = U / dm;
      const W = (C * U * U) / 2;
      return { dm, Sm, eps, C, q, U, E, W };
    }

    function setMode(m) {
      const before = calc();
      mode = m;
      if (m === 'q') qFixed = before.q;
      sU.input.disabled = m === 'q';
      ref = calc();
      draw();
    }

    function reset() {
      sD.set(DEF.d); sS.set(DEF.S); sE.set(DEF.eps); sU.set(DEF.U);
      mode = 'U'; qFixed = 0; sU.input.disabled = false;
      mChoice.set('U');
      ref = calc();
      draw();
    }

    function trend(v, r) {
      if (!r || !Number.isFinite(v) || !Number.isFinite(r)) return '';
      const rel = (v - r) / (Math.abs(r) || 1);
      if (Math.abs(rel) < 1e-9) return '  (не изменилось)';
      return rel > 0 ? '  ↑' : '  ↓';
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const s = calc();
      if (!ref) ref = s;

      // --- геометрия рисунка ---
      const cx = W / 2, cy = 0.42 * H;
      const gap = Math.max(12, 0.42 * W * (sD.value / 10));
      const plateH = Math.max(30, 0.62 * H * Math.sqrt(sS.value / 500));
      const pt = 6; // толщина пластины
      const xIn1 = cx - gap / 2, xIn2 = cx + gap / 2;   // внутренние грани
      const yT = cy - plateH / 2, yB = cy + plateH / 2;

      // диэлектрик
      if (s.eps > 1) {
        ctx.save();
        ctx.fillStyle = c.accent; ctx.globalAlpha = 0.16;
        ctx.fillRect(xIn1, yT, gap, plateH);
        ctx.restore();
      }

      // линии поля: густота ∝ E
      const Edef = DEF.U / (DEF.d * 1e-3);
      const hDef = Math.max(30, 0.62 * H * Math.sqrt(DEF.S / 500));
      const nLines = Math.round(L.clamp(8 * (plateH / hDef) * (s.E / Edef), 1, 30));
      for (let k = 0; k < nLines; k++) {
        const y = yT + (plateH * (k + 0.5)) / nLines;
        L.arrow(ctx, xIn1 + 2, y, xIn2 - 2, y, c.fieldE, { width: 1.5, head: Math.min(8, gap * 0.45) });
      }
      L.text(ctx, '→E', cx, yT - 14, c.fieldE, { font: '600 15px system-ui, sans-serif', align: 'center' });

      // пластины
      ctx.save();
      ctx.fillStyle = c.text;
      ctx.fillRect(xIn1 - pt, yT, pt, plateH);
      ctx.fillRect(xIn2, yT, pt, plateH);
      ctx.restore();

      // знаки зарядов
      const nSigns = Math.round(L.clamp(plateH / 18, 2, 12));
      for (let k = 0; k < nSigns; k++) {
        const y = yT + (plateH * (k + 0.5)) / nSigns;
        L.text(ctx, '+', xIn1 - pt - 9, y, c.force, { font: '700 13px system-ui, sans-serif', align: 'center' });
        L.text(ctx, '−', xIn2 + pt + 9, y, c.fieldB, { font: '700 13px system-ui, sans-serif', align: 'center' });
      }
      L.text(ctx, '+q', xIn1 - pt - 4, yT - 14, c.text, { font: 'italic 14px system-ui, sans-serif', align: 'right' });
      L.text(ctx, '−q', xIn2 + pt + 4, yT - 14, c.text, { font: 'italic 14px system-ui, sans-serif' });

      // размер d
      const yd = yB + 14;
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xIn1, yB + 3); ctx.lineTo(xIn1, yd + 4); ctx.moveTo(xIn2, yB + 3); ctx.lineTo(xIn2, yd + 4); ctx.stroke();
      ctx.restore();
      if (gap > 20) {
        L.arrow(ctx, cx, yd, xIn1, yd, c.muted, { width: 1, head: 5 });
        L.arrow(ctx, cx, yd, xIn2, yd, c.muted, { width: 1, head: 5 });
      } else {
        ctx.save(); ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xIn1, yd); ctx.lineTo(xIn2, yd); ctx.stroke(); ctx.restore();
      }
      L.text(ctx, 'd', cx, yd + 12, c.text, { font: 'italic 14px system-ui, sans-serif', align: 'center' });
      if (s.eps > 1) L.text(ctx, `ε = ${L.fmt(s.eps)}`, xIn2 + pt + 22, yB - 8, c.accent, { font: '13px system-ui, sans-serif' });

      // провода и источник
      const xWl = Math.min(0.1 * W, xIn1 - pt - 22), xWr = Math.max(0.9 * W, xIn2 + pt + 22);
      const yW = 0.88 * H;
      const xs = cx, sg = 8;          // источник: зазор между обкладками символа
      const xk = 0.5 * W + 0.22 * W;  // ключ
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xIn1 - pt, cy); ctx.lineTo(xWl, cy); ctx.lineTo(xWl, yW); ctx.lineTo(xs - sg / 2, yW);
      ctx.moveTo(xIn2 + pt, cy); ctx.lineTo(xWr, cy); ctx.lineTo(xWr, yW); ctx.lineTo(xk + 14, yW);
      ctx.moveTo(xk - 14, yW); ctx.lineTo(xs + sg / 2, yW);
      ctx.stroke();
      // ключ
      ctx.beginPath();
      ctx.moveTo(xk - 14, yW);
      if (mode === 'U') ctx.lineTo(xk + 14, yW);
      else ctx.lineTo(xk + 10, yW - 13);
      ctx.stroke();
      ctx.fillStyle = c.text;
      ctx.beginPath(); ctx.arc(xk - 14, yW, 2.5, 0, Math.PI * 2); ctx.arc(xk + 14, yW, 2.5, 0, Math.PI * 2); ctx.fill();
      // источник: длинная тонкая (+) слева, короткая толстая (−) справа (левая пластина заряжена +)
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(xs - sg / 2, yW - 13); ctx.lineTo(xs - sg / 2, yW + 13); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(xs + sg / 2, yW - 7); ctx.lineTo(xs + sg / 2, yW + 7); ctx.stroke();
      ctx.restore();
      L.text(ctx, '+', xs - sg / 2 - 8, yW - 12, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
      L.text(ctx, '−', xs + sg / 2 + 8, yW - 12, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
      L.text(ctx, 'U_{ист}', xs, yW - 24, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'center' });
      L.text(ctx, mode === 'U' ? 'ключ замкнут' : 'ключ разомкнут', xk, yW + 14 < H - 4 ? yW + 14 : yW - 22, c.muted, { font: '11px system-ui, sans-serif', align: 'center' });

      // --- вывод ---
      const r = ref;
      ro.set([
        ['Режим', mode === 'U' ? 'подключён: U = const' : 'отключён: q = const'],
        ['Ёмкость C = εε₀S/d', L.fmt(s.C, 3) + ' Ф' + trend(s.C, r.C)],
        ['Заряд q = CU', L.fmt(s.q, 3) + ' Кл' + trend(s.q, r.q)],
        ['Напряжение U', L.fmt(s.U, 3) + ' В' + trend(s.U, r.U)],
        ['Напряжённость E = U/d', L.fmt(s.E, 3) + ' В/м' + trend(s.E, r.E)],
        ['Энергия W = CU²/2 = q²/(2C)', L.fmt(s.W, 3) + ' Дж' + trend(s.W, r.W)],
      ]);
    }

    ref = calc();
    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
