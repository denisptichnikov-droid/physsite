// Модель «Превращения механической энергии: горка/желоб и пружина» (1.4.6–1.4.8, 1.2.7, 1.2.8, 1.5.1).
import * as L from './_lib.js';

const G = 10; // м/с²
// Профиль желоба (м): левый склон y = HP·((A−x)/A)², горизонтальный участок длиной LH, правый склон симметричен.
const HP = 2.5, AS = 2.5, LH = 2, XT = 2 * AS + LH;
const DEF = { scene: 'hill', m: 1, h: 2, mu: 0, k: 100, A: 0.1 };
const FONT = 'italic 13px system-ui, sans-serif';
const SMALL = '12px system-ui, sans-serif';

const yOf = (x) => (x < AS ? HP * ((AS - x) / AS) ** 2 : x <= AS + LH ? 0 : HP * ((x - AS - LH) / AS) ** 2);
const dyOf = (x) => (x < AS ? (-2 * HP * (AS - x)) / (AS * AS) : x <= AS + LH ? 0 : (2 * HP * (x - AS - LH)) / (AS * AS));
const d2yOf = (x) => (x < AS || x > AS + LH ? (2 * HP) / (AS * AS) : 0);
const onFlat = (x) => x >= AS && x <= AS + LH;

function hatchH(ctx, x1, x2, y, color, up = false) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  const s = up ? -1 : 1;
  for (let x = x1 + 7; x <= x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7 * s); }
  ctx.stroke();
  ctx.restore();
}
function hatchV(ctx, x, y1, y2, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = y1; y <= y2 - 7; y += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke();
  ctx.restore();
}
function spring(ctx, x1, y1, x2, y2, color, coils = 9, amp = 6) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const lead = Math.min(8, len * 0.15), body = len - 2 * lead, n = coils * 2;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
  for (let i = 1; i < n; i++) {
    const s = lead + (body * i) / n, o = (i % 2 ? 1 : -1) * amp;
    ctx.lineTo(x1 + ux * s + nx * o, y1 + uy * s + ny * o);
  }
  ctx.lineTo(x2 - ux * lead, y2 - uy * lead); ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export default {
  id: 'energy-bars',
  title: 'Превращения механической энергии',
  codes: ['1.4.6', '1.4.7', '1.4.8', '1.2.7', '1.2.8'],
  mount(el) {
    const d = L.disposer();
    d.add(() => { el.innerHTML = ''; el.classList.remove('model'); });
    const ui = L.layout(el, {
      caption: 'Столбики показывают энергию в текущий момент. Без трения E₁ = E₂ (механическая энергия сохраняется); с трением E₁ = E₂ + Q. Нулевой уровень E_п тяж — горизонтальный участок (горка) или нижняя точка (вертикальная пружина).',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.95, maxHeight: 580, label: 'Тело на горке или на пружине и столбчатая диаграмма энергий' });
    d.add(cv.destroy);

    const st = { x: 0, vx: 0, Q: 0, stopped: false, wait: 0, t: 0 };

    const scene = L.choice(ui.controls, {
      label: 'Сценарий',
      options: [
        { value: 'hill', label: 'горка (желоб)' },
        { value: 'hspring', label: 'горизонтальная пружина' },
        { value: 'vspring', label: 'вертикальная пружина' },
      ],
      value: DEF.scene,
      onChange: () => { syncVis(); restart(); },
    });
    const sM = L.slider(ui.controls, { label: 'Масса m', min: 0.5, max: 5, step: 0.5, value: DEF.m, unit: 'кг', onInput: () => restart() });
    const sH = L.slider(ui.controls, { label: 'Начальная высота h', min: 0.2, max: 2.4, step: 0.1, value: DEF.h, unit: 'м', onInput: () => restart() });
    const sMu = L.slider(ui.controls, { label: 'Трение на горизонтальном участке μ', min: 0, max: 0.5, step: 0.05, value: DEF.mu, onInput: () => restart() });
    const sK = L.slider(ui.controls, { label: 'Жёсткость k', min: 20, max: 400, step: 10, value: DEF.k, unit: 'Н/м', onInput: () => restart() });
    const sA = L.slider(ui.controls, { label: 'Амплитуда A', min: 0.05, max: 0.3, step: 0.01, value: DEF.A, unit: 'м', onInput: () => restart() });

    let roTimer = 0; // обновление таблицы не чаще ~8 раз в секунду
    const anim = L.animator((dt) => { step(dt); draw(); roTimer += dt; if (roTimer > 0.12) { roTimer = 0; updateReadout(); } }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      scene.set(DEF.scene); sM.set(DEF.m); sH.set(DEF.h); sMu.set(DEF.mu); sK.set(DEF.k); sA.set(DEF.A);
      syncVis(); restart(); play.sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function syncVis() {
      const hill = scene.value === 'hill';
      sH.el.style.display = hill ? '' : 'none';
      sMu.el.style.display = hill ? '' : 'none';
      sK.el.style.display = hill ? 'none' : '';
      sA.el.style.display = hill ? 'none' : '';
    }

    function restart() {
      st.x = AS * (1 - Math.sqrt(sH.value / HP)); // старт на высоте h
      st.vx = 0; st.Q = 0; st.stopped = false; st.wait = 0; st.t = 0;
      draw(); updateReadout();
    }

    // ---- шаг моделирования
    function step(dt) {
      if (scene.value !== 'hill') { st.t += dt; return; }
      const m = sM.value, mu = sMu.value, E0 = m * G * sH.value;
      if (st.stopped) {
        st.wait += dt;
        if (st.wait > 2) restart();
        return;
      }
      const n = 24, hh = dt / n;
      for (let i = 0; i < n && !st.stopped; i++) {
        // движение бусинки по кривой y(x) без трения: x'' = −(g + y''x'²)·y'/(1 + y'²)
        const yp = dyOf(st.x), ypp = d2yOf(st.x);
        const ax = (-(G + ypp * st.vx * st.vx) * yp) / (1 + yp * yp);
        const vx = st.vx + ax * hh;
        const xNew = L.clamp(st.x + vx * hh, 0, XT);
        if (mu > 0) {
          const lo = Math.max(Math.min(st.x, xNew), AS), hi = Math.min(Math.max(st.x, xNew), AS + LH);
          if (hi > lo) st.Q += mu * m * G * (hi - lo); // A_тр = μmg·s (1.2.8)
        }
        st.x = xNew;
        // согласование скорости с законом энергии: E₁ = E_к + E_п + Q
        const ek = E0 - st.Q - m * G * yOf(st.x);
        const yp2 = dyOf(st.x);
        if (ek <= 0) {
          if (onFlat(st.x)) { st.Q = E0; st.vx = 0; st.stopped = true; }
          else st.vx = vx; // точка поворота на склоне
        } else {
          const v = Math.sqrt((2 * ek) / m);
          st.vx = (Math.sign(vx) || 1) * (v / Math.sqrt(1 + yp2 * yp2));
        }
      }
    }

    // ---- текущие значения
    function calc() {
      const m = sM.value;
      const sc = scene.value;
      if (sc === 'hill') {
        const h0 = sH.value, mu = sMu.value;
        const E0 = m * G * h0;
        const y = yOf(st.x);
        const Q = Math.min(st.Q, E0);
        const Ep = Math.min(m * G * y, E0 - Q);
        const Ek = Math.max(0, E0 - Q - Ep);
        const v = Math.sqrt((2 * Ek) / m);
        return { sc, m, h0, mu, E0, y, Q, Ep, Ek, v };
      }
      const k = sK.value, A = sA.value;
      const w = Math.sqrt(k / m);
      const x = A * Math.cos(w * st.t);
      const vx = -A * w * Math.sin(w * st.t);
      const Ek = (m * vx * vx) / 2;
      if (sc === 'hspring') {
        const Ep = (k * x * x) / 2;
        return { sc, m, k, A, w, x, vx, Ek, Ep, E: (k * A * A) / 2 };
      }
      // вертикальная пружина: x — смещение вниз от положения равновесия
      const dl0 = (m * G) / k;          // статическое удлинение: kΔl₀ = mg
      const dl = dl0 + x;               // деформация пружины
      const hgt = A - x;                // высота над нижней точкой
      const Eel = (k * dl * dl) / 2;
      const Egr = m * G * hgt;
      const E = (k * (dl0 + A) ** 2) / 2; // в нижней точке v = 0, h = 0
      return { sc, m, k, A, w, x, vx, Ek, Eel, Egr, dl0, dl, hgt, E };
    }

    // ---- рисование
    function bars(ctx, items, total, top, bottom, W, c) {
      const n = items.length;
      const bw = Math.min(46, (W - 40) / (n * 1.7));
      const gap = (W - 40 - n * bw) / (n + 1);
      const base = bottom - 18, hmax = base - top - 18;
      L.arrow(ctx, 20, base, W - 10, base, c.text, { width: 1.2, head: 6 });
      L.arrow(ctx, 20, base, 20, top - 2, c.text, { width: 1.2, head: 6 });
      L.text(ctx, 'E, Дж', 26, top + 2, c.text, { font: FONT });
      const kE = total > 0 ? hmax / total : 0;
      items.forEach((it, i) => {
        const x = 20 + gap * (i + 1) + bw * i;
        let y = base;
        const segs = it.stack || [{ v: it.v, color: it.color }];
        let sum = 0;
        segs.forEach((sg) => {
          const h = Math.max(0, sg.v) * kE;
          ctx.save(); ctx.fillStyle = sg.color; ctx.globalAlpha = 0.85;
          ctx.fillRect(x, y - h, bw, h);
          ctx.restore();
          y -= h; sum += Math.max(0, sg.v);
        });
        ctx.save(); ctx.strokeStyle = c.text; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, base - y); ctx.restore();
        L.text(ctx, L.fmt(sum), x + bw / 2, y - 8, c.text, { font: '11px system-ui, sans-serif', align: 'center' });
        L.text(ctx, it.label, x + bw / 2, base + 10, c.text, { font: '12px system-ui, sans-serif', align: 'center' });
      });
    }

    function drawHill(ctx, W, top, bottom, c, r) {
      const padL = 34, padR = 12;
      const s = Math.min((W - padL - padR) / XT, (bottom - top) / HP);
      const ox = padL + (W - padL - padR - XT * s) / 2, oy = bottom;
      const X = (x) => ox + x * s, Y = (y) => oy - y * s;
      // профиль + штриховка
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 140; i++) { const x = (XT * i) / 140; const px = X(x), py = Y(yOf(x)); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let px = X(0) + 7; px <= X(XT); px += 8) { const py = Y(yOf((px - ox) / s)); ctx.moveTo(px, py); ctx.lineTo(px - 6, py + 6); }
      ctx.stroke();
      ctx.restore();
      // шероховатый участок
      if (r.mu > 0) {
        ctx.save(); ctx.strokeStyle = c.force; ctx.lineWidth = 4; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.moveTo(X(AS), Y(0)); ctx.lineTo(X(AS + LH), Y(0)); ctx.stroke(); ctx.restore();
        L.text(ctx, 'μ', X(AS + LH / 2), Y(0) - 10, c.force, { font: FONT, align: 'center' });
      }
      // высота старта h
      const x0 = AS * (1 - Math.sqrt(r.h0 / HP));
      const hx = Math.max(10, X(x0) - 16);
      ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx - 4, Y(r.h0)); ctx.lineTo(X(x0), Y(r.h0)); ctx.moveTo(hx - 4, Y(0)); ctx.lineTo(X(AS), Y(0)); ctx.stroke(); ctx.restore();
      const hm = (Y(0) + Y(r.h0)) / 2;
      L.arrow(ctx, hx, hm, hx, Y(r.h0), c.muted, { width: 1, head: 5 });
      L.arrow(ctx, hx, hm, hx, Y(0), c.muted, { width: 1, head: 5 });
      L.text(ctx, 'h', hx - 4, hm, c.muted, { font: FONT, align: 'right' });
      // тело
      const yp = dyOf(st.x), nrm = Math.sqrt(1 + yp * yp), br = 7;
      const bx = X(st.x) + (-yp / nrm) * br, by = Y(yOf(st.x)) - (1 / nrm) * br;
      ctx.save(); ctx.fillStyle = c.accent; ctx.strokeStyle = c.text; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      const vmax = Math.sqrt(2 * G * r.h0);
      if (r.v > 1e-3 && st.vx !== 0) {
        const sg = Math.sign(st.vx), lv = (r.v / vmax) * 42;
        const tx = (sg * 1) / nrm, ty = (sg * yp) / nrm;
        L.arrow(ctx, bx, by, bx + tx * lv, by - ty * lv, c.velocity, { label: '→v', labelOffset: [4, -10], font: FONT });
      }
    }

    function drawHSpring(ctx, W, top, bottom, c, r) {
      const wx = 22, fy = bottom - 16;
      const xEq = wx + (W - wx) * 0.5;
      const kx = ((W - wx) * 0.25) / 0.3;
      const bw = 34, bh = 26;
      const bxL = xEq - bw / 2 + r.x * kx;
      hatchV(ctx, wx, fy - 60, fy, c.text);
      hatchH(ctx, wx, W - 10, fy, c.text);
      spring(ctx, wx, fy - bh / 2, bxL, fy - bh / 2, c.text);
      ctx.save(); ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillRect(bxL, fy - bh, bw, bh); ctx.strokeRect(bxL, fy - bh, bw, bh); ctx.restore();
      L.text(ctx, 'm', bxL + bw / 2, fy - bh / 2, c.text, { font: FONT, align: 'center' });
      // положение равновесия и ось
      ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xEq, fy - bh - 30); ctx.lineTo(xEq, fy); ctx.stroke(); ctx.restore();
      L.text(ctx, '0', xEq, fy - bh - 38, c.muted, { font: SMALL, align: 'center' });
      L.arrow(ctx, xEq, fy - bh - 26, W - 14, fy - bh - 26, c.muted, { width: 1, head: 6 });
      L.text(ctx, 'x', W - 16, fy - bh - 38, c.muted, { font: FONT, align: 'right' });
      const vmax = r.w * r.A;
      if (Math.abs(r.vx) > 1e-3 * vmax) {
        const cxB = bxL + bw / 2;
        L.arrow(ctx, cxB, fy - bh - 10, cxB + (r.vx / vmax) * 40, fy - bh - 10, c.velocity, { label: '→v', labelOffset: [4, -8], font: FONT });
      }
    }

    function drawVSpring(ctx, W, top, bottom, c, r) {
      const cx = W * 0.42, ceil = top + 4;
      const yEq = top + (bottom - top) * 0.5;
      const ky = ((bottom - top) * 0.3) / 0.3;
      const bw = 34, bh = 24;
      const byC = yEq + r.x * ky;
      hatchH(ctx, cx - 50, cx + 50, ceil, c.text, true);
      spring(ctx, cx, ceil, cx, byC - bh / 2, c.text, 10, 7);
      ctx.save(); ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillRect(cx - bw / 2, byC - bh / 2, bw, bh); ctx.strokeRect(cx - bw / 2, byC - bh / 2, bw, bh); ctx.restore();
      L.text(ctx, 'm', cx, byC, c.text, { font: FONT, align: 'center' });
      // уровни
      const yLow = yEq + r.A * ky + bh / 2;
      ctx.save(); ctx.strokeStyle = c.muted; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 60, yEq); ctx.lineTo(cx + 60, yEq);
      ctx.moveTo(cx - 60, yLow); ctx.lineTo(cx + 60, yLow);
      ctx.stroke(); ctx.restore();
      L.text(ctx, 'x = 0 (равновесие)', cx + 64, yEq, c.muted, { font: SMALL });
      L.text(ctx, 'h = 0', cx + 64, yLow, c.muted, { font: SMALL });
      L.arrow(ctx, cx - 70, yEq - 30, cx - 70, yEq + 30, c.muted, { width: 1, head: 6 });
      L.text(ctx, 'x', cx - 76, yEq + 26, c.muted, { font: FONT, align: 'right' });
      const vmax = r.w * r.A;
      if (Math.abs(r.vx) > 1e-3 * vmax) {
        const xx = cx + bw / 2 + 12;
        L.arrow(ctx, xx, byC, xx, byC + (r.vx / vmax) * 36, c.velocity, { label: '→v', labelOffset: [4, 0], font: FONT });
      }
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const r = calc();
      ctx.clearRect(0, 0, W, H);
      const sceneTop = 14, sceneBot = H * 0.56;
      if (r.sc === 'hill') {
        drawHill(ctx, W, sceneTop, sceneBot, c, r);
        bars(ctx, [
          { label: 'E_к', v: r.Ek, color: c.velocity },
          { label: 'E_п', v: r.Ep, color: c.accent },
          { label: 'Q', v: r.Q, color: c.force },
          { label: 'E_к+E_п+Q', stack: [{ v: r.Ek, color: c.velocity }, { v: r.Ep, color: c.accent }, { v: r.Q, color: c.force }] },
        ], r.E0, H * 0.62, H, W, c);
      } else if (r.sc === 'hspring') {
        drawHSpring(ctx, W, sceneTop, sceneBot, c, r);
        bars(ctx, [
          { label: 'E_к', v: r.Ek, color: c.velocity },
          { label: 'E_п', v: r.Ep, color: c.fieldB },
          { label: 'E_к+E_п', stack: [{ v: r.Ek, color: c.velocity }, { v: r.Ep, color: c.fieldB }] },
        ], r.E, H * 0.62, H, W, c);
      } else {
        drawVSpring(ctx, W, sceneTop, sceneBot, c, r);
        bars(ctx, [
          { label: 'E_к', v: r.Ek, color: c.velocity },
          { label: 'E_{упр}', v: r.Eel, color: c.fieldB },
          { label: 'E_{тяж}', v: r.Egr, color: c.accent },
          { label: 'E_{полн}', stack: [{ v: r.Ek, color: c.velocity }, { v: r.Eel, color: c.fieldB }, { v: r.Egr, color: c.accent }] },
        ], r.E, H * 0.62, H, W, c);
      }
    }

    function updateReadout() {
      const r = calc();
      let rows;
      if (r.sc === 'hill') {
        rows = [
          ['E₁ = mgh (в начале)', L.fmt(r.E0) + ' Дж'],
          ['Высота сейчас', L.fmt(r.y) + ' м'],
          ['v сейчас', L.fmt(r.v) + ' м/с'],
          ['E<sub>к</sub> = mv²/2', L.fmt(r.Ek) + ' Дж'],
          ['E<sub>п</sub> = mgh', L.fmt(r.Ep) + ' Дж'],
          ['Q = μmg·s', L.fmt(r.Q) + ' Дж'],
          ['E<sub>к</sub> + E<sub>п</sub> + Q', L.fmt(r.Ek + r.Ep + r.Q) + ' Дж'],
          ['v внизу (первый раз) = √(2gh)', L.fmt(Math.sqrt(2 * G * r.h0)) + ' м/с'],
        ];
        if (r.mu > 0) {
          rows.push(['Путь по шероховатому участку до остановки s = h/μ', L.fmt(r.h0 / r.mu) + ' м']);
          rows.push(['Закон', 'E₁ = E₂ + Q (есть трение)']);
        } else {
          rows.push(['Закон', 'E₁ = E₂ (трения нет)']);
        }
      } else if (r.sc === 'hspring') {
        rows = [
          ['ω = √(k/m)', L.fmt(r.w) + ' рад/с'],
          ['x сейчас', L.fmt(r.x, 3) + ' м'],
          ['v<sub>x</sub> сейчас', L.fmt(r.vx) + ' м/с'],
          ['E<sub>к</sub> = mv²/2', L.fmt(r.Ek, 3) + ' Дж'],
          ['E<sub>п</sub> = kx²/2', L.fmt(r.Ep, 3) + ' Дж'],
          ['E = kA²/2', L.fmt(r.E, 3) + ' Дж'],
          ['v<sub>max</sub> = ωA', L.fmt(r.w * r.A) + ' м/с'],
          ['Закон', 'E₁ = E₂ (трения нет)'],
        ];
      } else {
        rows = [
          ['Δl₀ = mg/k (в равновесии)', L.fmt(r.dl0, 3) + ' м'],
          ['x сейчас (вниз от равновесия)', L.fmt(r.x, 3) + ' м'],
          ['Деформация Δl = Δl₀ + x', L.fmt(r.dl, 3) + ' м'],
          ['h над нижней точкой', L.fmt(r.hgt, 3) + ' м'],
          ['E<sub>к</sub> = mv²/2', L.fmt(r.Ek, 3) + ' Дж'],
          ['E<sub>упр</sub> = kΔl²/2', L.fmt(r.Eel, 3) + ' Дж'],
          ['E<sub>тяж</sub> = mgh', L.fmt(r.Egr, 3) + ' Дж'],
          ['E<sub>полн</sub>', L.fmt(r.Ek + r.Eel + r.Egr, 3) + ' Дж'],
          ['Закон', 'E₁ = E₂ (трения нет)'],
        ];
      }
      ro.set(rows);
    }

    syncVis();
    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    restart();
    return { destroy: d.run };
  },
};
