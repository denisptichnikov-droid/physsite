// Модель «Идеальный колебательный контур» (3.5.1, 3.5.2).
import * as L from './_lib.js';

const C_LIGHT = 3e8; // м/с
const VIS_PERIOD = 4; // на экране один период длится 4 с (условно)

/** Три значащие цифры. */
function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
}

export default {
  id: 'lc-circuit',
  title: 'Колебательный LC-контур',
  codes: ['3.5.1', '3.5.2', '3.1.11', '3.4.7'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Идеальный контур (R = 0). В момент t = 0 конденсатор заряжен до q_max: q = q_max·cos ωt, I = q′ = −ωq_max·sin ωt. ' +
        'q — заряд верхней обкладки; I > 0, когда ток течёт к верхней обкладке. Энергия перекачивается между конденсатором и катушкой, W_C + W_L = const. ' +
        'Анимация замедлена: один период на экране — 4 с.',
    });
    const cv = L.canvas(ui.stage, { aspect: 1.15, minHeight: 360, maxHeight: 640, label: 'Схема LC-контура, столбики энергии и графики q(t), I(t)' });
    d.add(cv.destroy);

    const DEF = { L: 10, C: 10, q: 100 };
    let tau = 0; // время в периодах, 0 ≤ tau < 2

    const onParam = () => { updRO(true); draw(); };
    const sL = L.slider(ui.controls, { label: 'Индуктивность <i>L</i>', min: 1, max: 200, step: 1, value: DEF.L, unit: 'мГн', onInput: onParam });
    const sC = L.slider(ui.controls, { label: 'Ёмкость <i>C</i>', min: 1, max: 100, step: 1, value: DEF.C, unit: 'мкФ', onInput: onParam });
    const sQ = L.slider(ui.controls, { label: 'Заряд <i>q</i><sub>max</sub>', min: 10, max: 500, step: 10, value: DEF.q, unit: 'мкКл', onInput: onParam });

    const anim = L.animator(step, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      sL.set(DEF.L); sC.set(DEF.C); sQ.set(DEF.q);
      tau = 0;
      play.sync(); updRO(true); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function phys() {
      const Lh = sL.value * 1e-3; // Гн
      const C = sC.value * 1e-6; // Ф
      const qm = sQ.value * 1e-6; // Кл
      const sq = Math.sqrt(Lh * C);
      const T = 2 * Math.PI * sq; // формула Томсона
      const w = 1 / sq;
      const nu = 1 / T;
      const Imax = w * qm;
      const Umax = qm / C;
      const Wtot = (qm * qm) / (2 * C);
      const lam = C_LIGHT * T;
      const ph = 2 * Math.PI * tau; // ωt
      let q = qm * Math.cos(ph);
      let I = -w * qm * Math.sin(ph);
      if (Math.abs(q) < qm * 1e-9) q = 0;
      if (Math.abs(I) < Imax * 1e-9) I = 0;
      const WC = (q * q) / (2 * C);
      const WL = (Lh * I * I) / 2;
      return { Lh, C, qm, T, w, nu, Imax, Umax, Wtot, lam, q, I, WC, WL, t: tau * T };
    }

    function step(dt) {
      tau += dt / VIS_PERIOD;
      if (tau >= 2) tau -= 2;
      updRO(false);
      draw();
    }

    let roTime = 0;
    function updRO(force) {
      const now = performance.now();
      if (!force && now - roTime < 200) return;
      roTime = now;
      const p = phys();
      ro.set([
        ['<i>T</i> = 2π√(<i>LC</i>)', f3(p.T) + ' с'],
        ['ω = 1/√(<i>LC</i>)', f3(p.w) + ' рад/с'],
        ['ν = 1/<i>T</i>', f3(p.nu) + ' Гц'],
        ['<i>I</i><sub>max</sub> = ω<i>q</i><sub>max</sub>', f3(p.Imax) + ' А'],
        ['<i>U</i><sub>max</sub> = <i>q</i><sub>max</sub>/<i>C</i>', f3(p.Umax) + ' В'],
        ['<i>W</i> = <i>q</i><sup>2</sup><sub>max</sub>/(2<i>C</i>)', f3(p.Wtot) + ' Дж'],
        ['λ = <i>cT</i>', f3(p.lam) + ' м'],
        ['<i>t</i>', f3(p.t) + ' с'],
        ['<i>q</i> = <i>q</i><sub>max</sub> cos ω<i>t</i>', f3(p.q) + ' Кл'],
        ['<i>I</i> = −ω<i>q</i><sub>max</sub> sin ω<i>t</i>', f3(p.I) + ' А'],
        ['<i>W<sub>C</sub></i> = <i>q</i><sup>2</sup>/(2<i>C</i>)', f3(p.WC) + ' Дж'],
        ['<i>W<sub>L</sub></i> = <i>LI</i><sup>2</sup>/2', f3(p.WL) + ' Дж'],
        ['<i>W<sub>C</sub></i> + <i>W<sub>L</sub></i>', f3(p.WC + p.WL) + ' Дж'],
      ]);
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const p = phys();
      const topH = Math.max(140, H * 0.36);
      const qr = p.qm > 0 ? p.q / p.qm : 0; // −1..1
      const ir = p.Imax > 0 ? p.I / p.Imax : 0; // −1..1

      // ---------- схема ----------
      const x1 = 34, x2 = W * 0.6 - 26, y1 = 22, y2 = topH - 22;
      const yc = (y1 + y2) / 2;
      const pg = 7; // половина зазора между обкладками
      const pw = Math.max(10, Math.min(22, (x2 - x1) / 5));
      const ch = Math.min(64, (y2 - y1) * 0.7), cr = ch / 8, yT = yc - ch / 2;
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, yc - pg); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, yT);
      for (let i = 0; i < 4; i++) ctx.arc(x2, yT + cr + 2 * cr * i, cr, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(x2, y2); ctx.lineTo(x1, y2); ctx.lineTo(x1, yc + pg);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x1 - pw, yc - pg); ctx.lineTo(x1 + pw, yc - pg);
      ctx.moveTo(x1 - pw, yc + pg); ctx.lineTo(x1 + pw, yc + pg);
      ctx.stroke();
      ctx.restore();
      L.text(ctx, 'C', x1 + pw + 6, yc, c.text, { font: 'italic 14px system-ui, sans-serif' });
      L.text(ctx, 'L', x2 + cr + 7, yc, c.text, { font: 'italic 14px system-ui, sans-serif' });

      // заряды на обкладках
      const n = Math.round(4 * Math.abs(qr));
      if (n > 0) {
        const offs = [-0.45, 0.45, -0.9, 0.9].slice(0, n);
        const top = qr > 0 ? '+' : '−', bot = qr > 0 ? '−' : '+';
        const f = '700 13px system-ui, sans-serif';
        for (const o of offs) {
          L.text(ctx, top, x1 + o * pw, yc - pg - 8, c.text, { font: f, align: 'center' });
          L.text(ctx, bot, x1 + o * pw, yc + pg + 9, c.text, { font: f, align: 'center' });
        }
        // поле E между обкладками (от + к −)
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.abs(qr));
        const dir = qr > 0 ? 1 : -1;
        for (const o of [-0.55, 0, 0.55]) {
          L.arrow(ctx, x1 + o * pw, yc - dir * (pg - 1.5), x1 + o * pw, yc + dir * (pg - 1.5), c.fieldE, { width: 1.4, head: 5 });
        }
        ctx.restore();
      }

      // ток в проводах: I > 0 — к верхней обкладке (по верхнему проводу влево)
      const alen = 30 * Math.abs(ir);
      if (alen > 3) {
        const xm = (x1 + x2) / 2;
        const dirTop = ir > 0 ? -1 : 1;
        L.arrow(ctx, xm - dirTop * alen / 2, y1, xm + dirTop * alen / 2, y1, c.accent, { width: 3, head: 9 });
        L.arrow(ctx, xm + dirTop * alen / 2, y2, xm - dirTop * alen / 2, y2, c.accent, { width: 3, head: 9 });
        L.text(ctx, 'I', xm, y1 - 11, c.accent, { font: 'italic 600 13px system-ui, sans-serif', align: 'center' });
      }

      // ---------- столбики энергии ----------
      const bx0 = W * 0.6 + 4, bx1 = W - 8;
      const slot = (bx1 - bx0) / 3;
      const bw = Math.min(30, slot * 0.6);
      const yb = y2, ytop = y1 + 6;
      const maxH = yb - ytop;
      const bars = [
        { lab: 'W_C', val: p.Wtot > 0 ? p.WC / p.Wtot : 0, col: c.fieldE },
        { lab: 'W_L', val: p.Wtot > 0 ? p.WL / p.Wtot : 0, col: c.fieldB },
        { lab: 'W', val: 1, col: c.muted },
      ];
      bars.forEach((b, i) => {
        const bx = bx0 + slot * i + (slot - bw) / 2;
        const h = L.clamp(b.val, 0, 1) * maxH;
        ctx.save();
        ctx.strokeStyle = c.grid; ctx.lineWidth = 1;
        ctx.strokeRect(bx, ytop, bw, maxH);
        ctx.fillStyle = b.col;
        ctx.fillRect(bx, yb - h, bw, h);
        ctx.restore();
        L.text(ctx, b.lab, bx + bw / 2, yb + 11, c.text, { font: 'italic 13px system-ui, sans-serif', align: 'center' });
      });
      L.text(ctx, 'энергия', (bx0 + bx1) / 2, 10, c.muted, { font: '12px system-ui, sans-serif', align: 'center' });

      // ---------- графики ----------
      const Tms = p.T * 1e3;
      const tms = p.t * 1e3;
      const qmu = p.qm * 1e6; // мкКл
      const ImA = p.Imax * 1e3; // мА
      const gh = (H - topH) / 2;
      const gx = 48, gw = Math.max(60, W - gx - 34);
      const k = (2 * Math.PI) / Tms;
      const gq = L.graph(ctx, { x: gx, y: topH + 22, w: gw, h: Math.max(30, gh - 36) }, {
        xMin: 0, xMax: 2 * Tms, yMin: -1.2 * qmu, yMax: 1.2 * qmu, xLabel: 't, мс', yLabel: 'q, мкКл',
      });
      L.plotFn(ctx, gq, (t) => qmu * Math.cos(k * t), c.fieldE, { width: 2.2 });
      const gi = L.graph(ctx, { x: gx, y: topH + gh + 22, w: gw, h: Math.max(30, gh - 36) }, {
        xMin: 0, xMax: 2 * Tms, yMin: -1.2 * ImA, yMax: 1.2 * ImA, xLabel: 't, мс', yLabel: 'I, мА',
      });
      L.plotFn(ctx, gi, (t) => -ImA * Math.sin(k * t), c.accent, { width: 2.2 });

      // бегущая отметка
      for (const [g, val, col] of [[gq, p.q * 1e6, c.fieldE], [gi, p.I * 1e3, c.accent]]) {
        const X = g.X(tms);
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(X, g.rect.y); ctx.lineTo(X, g.rect.y + g.rect.h); ctx.stroke();
        ctx.restore();
        L.dot(ctx, X, g.Y(val), col, 5);
      }
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    updRO(true);
    draw();
    return { destroy: d.run };
  },
};
