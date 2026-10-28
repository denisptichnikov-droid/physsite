// Модель «Поперечные и продольные волны» (1.5.4).
import * as L from './_lib.js';

const XW = 8;      // ширина окна, м
const N = 97;      // число частиц (шаг 1/12 м)
const HL = 24;     // номер выделенной частицы (x = 2 м)
const DEF = { type: 'transverse', A: 3, T: 2, v: 2 }; // A — в см
const FONT = 'italic 13px system-ui, sans-serif';
const SMALL = '11px system-ui, sans-serif';

function dbl(ctx, x1, y1, x2, y2, color) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  L.arrow(ctx, mx, my, x1, y1, color, { width: 1.2, head: 6 });
  L.arrow(ctx, mx, my, x2, y2, color, { width: 1.2, head: 6 });
}

export default {
  id: 'wave',
  title: 'Поперечная и продольная волна',
  codes: ['1.5.4'],
  mount(el) {
    const d = L.disposer();
    d.add(() => { el.innerHTML = ''; el.classList.remove('model'); });
    const ui = L.layout(el, {
      caption: 'Волна бежит вправо со скоростью v. Частицы среды не переносятся волной — они колеблются около положений равновесия: поперёк направления распространения (поперечная) или вдоль него (продольная). λ — расстояние между соседними гребнями (сгущениями). Амплитуда на рисунке условная.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.6, label: 'Цепочка частиц, по которой бежит волна; отмечены длина волны и направления' });
    d.add(cv.destroy);

    let t = 0;
    const type = L.choice(ui.controls, {
      label: 'Волна',
      options: [{ value: 'transverse', label: 'поперечная' }, { value: 'longitudinal', label: 'продольная' }],
      value: DEF.type, onChange: () => update(),
    });
    const sA = L.slider(ui.controls, { label: 'Амплитуда A', min: 1, max: 5, step: 0.5, value: DEF.A, unit: 'см', onInput: () => update() });
    const sT = L.slider(ui.controls, { label: 'Период T', min: 1, max: 4, step: 0.1, value: DEF.T, unit: 'с', onInput: () => update() });
    const sV = L.slider(ui.controls, { label: 'Скорость волны v', min: 0.5, max: 4, step: 0.1, value: DEF.v, unit: 'м/с', onInput: () => update() });

    const anim = L.animator((dt) => { t += dt; draw(); }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      type.set(DEF.type); sA.set(DEF.A); sT.set(DEF.T); sV.set(DEF.v); t = 0;
      update(); play.sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function calc() {
      const T = sT.value, v = sV.value, A = sA.value / 100;
      const lam = v * T;            // λ = vT
      const nu = 1 / T;             // ν = 1/T
      const w = (2 * Math.PI) / T;  // ω = 2π/T
      const kw = (2 * Math.PI) / lam;
      return { T, v, A, lam, nu, w, kw, trans: type.value === 'transverse' };
    }

    /** Две соседние точки с фазой φ = φ* + 2πn внутри окна, ближе к центру. */
    function pair(r, phiStar) {
      const xs = [];
      const base = r.w * t - phiStar;
      const nMin = Math.ceil((base - r.kw * XW) / (2 * Math.PI));
      const nMax = Math.floor(base / (2 * Math.PI));
      for (let n = nMin; n <= nMax; n++) { const x = (base - 2 * Math.PI * n) / r.kw; if (x >= 0 && x <= XW) xs.push(x); }
      xs.sort((a, b) => a - b);
      if (xs.length < 2) return null;
      let best = null, bd = Infinity;
      for (let i = 0; i + 1 < xs.length; i++) {
        const dd = Math.abs((xs[i] + xs[i + 1]) / 2 - XW / 2);
        if (dd < bd) { bd = dd; best = [xs[i], xs[i + 1]]; }
      }
      return best;
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const r = calc();
      ctx.clearRect(0, 0, W, H);
      const x0 = 26, x1 = W - 18;
      const X = (x) => x0 + ((x1 - x0) * x) / XW;
      const midY = H * 0.52;
      const lamPx = X(r.lam) - X(0);
      const phase = (x) => r.w * t - r.kw * x;

      // ось x (линейка)
      const ay = H - 22;
      L.arrow(ctx, x0, ay, x1 + 10, ay, c.text, { width: 1.2, head: 7 });
      ctx.save(); ctx.strokeStyle = c.text; ctx.fillStyle = c.muted; ctx.font = SMALL; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let i = 0; i <= XW; i++) {
        ctx.beginPath(); ctx.moveTo(X(i), ay - 3); ctx.lineTo(X(i), ay + 3); ctx.stroke();
        ctx.fillText(String(i), X(i), ay + 5);
      }
      ctx.restore();
      L.text(ctx, 'x, м', x1 + 8, ay - 12, c.text, { font: FONT, align: 'right' });

      // направление распространения
      L.arrow(ctx, W - 70, 14, W - 20, 14, c.velocity, { width: 2.2 });
      L.text(ctx, '→v', W - 76, 14, c.velocity, { font: FONT, align: 'right' });

      let lamY, marks = null;
      if (r.trans) {
        const ay2 = Math.min(H * 0.24, (r.A / 0.05) * H * 0.24);
        // равновесие и ось y
        ctx.save(); ctx.strokeStyle = c.grid; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, midY); ctx.lineTo(x1, midY); ctx.stroke(); ctx.restore();
        L.arrow(ctx, x0, midY + H * 0.26, x0, midY - H * 0.3, c.text, { width: 1.2, head: 6 });
        L.text(ctx, 'y', x0 + 6, midY - H * 0.3 + 4, c.text, { font: FONT });
        const pts = [];
        for (let i = 0; i < N; i++) { const x = (XW * i) / (N - 1); pts.push([X(x), midY - ay2 * Math.sin(phase(x))]); }
        ctx.save(); ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
        ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke(); ctx.restore();
        pts.forEach(([px, py], i) => L.dot(ctx, px, py, i === HL ? c.force : c.text, i === HL ? 4.5 : 2.3));
        // колебания выделенной частицы
        const hx = pts[HL][0];
        ctx.save(); ctx.strokeStyle = c.force; ctx.globalAlpha = 0.5; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(hx, midY - ay2); ctx.lineTo(hx, midY + ay2); ctx.stroke(); ctx.restore();
        dbl(ctx, hx - 10, midY - ay2, hx - 10, midY + ay2, c.force);
        L.text(ctx, 'колебания', hx - 14, midY + ay2 + 4, c.force, { font: SMALL, align: 'right' });
        // гребни: φ = π/2 + 2πn
        marks = pair(r, Math.PI / 2);
        lamY = midY - ay2 - 14;
        if (marks) {
          ctx.save(); ctx.strokeStyle = c.accent; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.beginPath();
          marks.forEach((x) => { ctx.moveTo(X(x), midY - ay2); ctx.lineTo(X(x), lamY - 4); });
          ctx.stroke(); ctx.restore();
        }
      } else {
        const aPx = Math.min((r.A / 0.05) * 0.9 * lamPx / (2 * Math.PI), W * 0.12);
        const rows = [-16, 0, 16];
        for (let i = 0; i < N; i++) {
          const x = (XW * i) / (N - 1);
          const px = X(x) + aPx * Math.sin(phase(x));
          rows.forEach((dy) => L.dot(ctx, px, midY + dy, i === HL ? c.force : c.text, i === HL ? 4 : 2.3));
        }
        const hx0 = X((XW * HL) / (N - 1));
        dbl(ctx, hx0 - Math.max(aPx, 8), midY + 32, hx0 + Math.max(aPx, 8), midY + 32, c.force);
        L.text(ctx, 'колебания', hx0, midY + 46, c.force, { font: SMALL, align: 'center' });
        // сгущения: φ = 2πn
        marks = pair(r, 0);
        lamY = midY - 34;
        if (marks) {
          ctx.save(); ctx.strokeStyle = c.accent; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.beginPath();
          marks.forEach((x) => { ctx.moveTo(X(x), midY + 20); ctx.lineTo(X(x), lamY - 4); });
          ctx.stroke(); ctx.restore();
          L.text(ctx, 'сгущение', X(marks[0]), midY - 24, c.muted, { font: SMALL, align: 'center' });
        }
      }
      if (marks) {
        dbl(ctx, X(marks[0]), lamY, X(marks[1]), lamY, c.accent);
        L.text(ctx, 'λ', (X(marks[0]) + X(marks[1])) / 2, lamY - 10, c.accent, { font: FONT, align: 'center' });
      } else {
        L.text(ctx, 'λ = ' + L.fmt(r.lam) + ' м — больше окна', x0 + 6, 14, c.accent, { font: SMALL });
      }
    }

    function updateReadout() {
      const r = calc();
      ro.set([
        ['Тип', r.trans ? 'поперечная: частицы колеблются ⟂ направлению v' : 'продольная: частицы колеблются вдоль v'],
        ['A', L.fmt(r.A) + ' м'],
        ['T', L.fmt(r.T) + ' с'],
        ['ν = 1/T', L.fmt(r.nu, 3) + ' Гц'],
        ['v', L.fmt(r.v) + ' м/с'],
        ['λ = vT = v/ν', L.fmt(r.lam, 3) + ' м'],
      ]);
    }

    function update() { draw(); updateReadout(); }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    update();
    return { destroy: d.run };
  },
};
