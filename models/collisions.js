// Модель «Абсолютно упругий и абсолютно неупругий удар» (1.4.1–1.4.3, 1.4.6).
import * as L from './_lib.js';

const DEF = { type: 'elastic', m1: 2, m2: 1, v1: 4, v2: -2 };
const TC = 1.2;      // время (анимации) до удара, с
const PAUSE = 1.0;   // пауза перед повтором, с
const FONT = 'italic 13px system-ui, sans-serif';
const SMALL = '12px system-ui, sans-serif';

const clean = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

function hatchH(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x1 + 7; x <= x2; x += 8) { ctx.moveTo(x, y); ctx.lineTo(x - 7, y + 7); }
  ctx.stroke();
  ctx.restore();
}

export default {
  id: 'collisions',
  title: 'Упругий и неупругий удар: импульс и энергия',
  codes: ['1.4.1', '1.4.2', '1.4.3', '1.4.6'],
  mount(el) {
    const d = L.disposer();
    d.add(() => { el.innerHTML = ''; el.classList.remove('model'); });
    const ui = L.layout(el, {
      caption: 'Центральный удар двух шаров на гладкой прямой. Проекции скоростей — на ось x (вправо). Суммарный импульс сохраняется при любом ударе; кинетическая энергия — только при абсолютно упругом.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.9, maxHeight: 560, label: 'Два шара до и после удара, векторы скоростей и импульсов' });
    d.add(cv.destroy);

    let tau = 0; // время анимации, с

    const type = L.choice(ui.controls, {
      label: 'Тип удара',
      options: [{ value: 'elastic', label: 'абсолютно упругий' }, { value: 'inelastic', label: 'абсолютно неупругий' }],
      value: DEF.type,
      onChange: () => restart(),
    });
    const sM1 = L.slider(ui.controls, { label: 'Масса m<sub>1</sub>', min: 0.5, max: 5, step: 0.5, value: DEF.m1, unit: 'кг', onInput: () => restart() });
    const sM2 = L.slider(ui.controls, { label: 'Масса m<sub>2</sub>', min: 0.5, max: 5, step: 0.5, value: DEF.m2, unit: 'кг', onInput: () => restart() });
    const sV1 = L.slider(ui.controls, { label: 'Скорость v<sub>1x</sub>', min: -10, max: 10, step: 0.5, value: DEF.v1, unit: 'м/с', onInput: () => restart() });
    const sV2 = L.slider(ui.controls, { label: 'Скорость v<sub>2x</sub>', min: -10, max: 10, step: 0.5, value: DEF.v2, unit: 'м/с', onInput: () => restart() });

    const anim = L.animator((dt) => {
      tau += dt;
      if (tau > 2 * TC + PAUSE) tau = 0;
      draw();
    }, { autoplay: true });
    d.add(anim.destroy);
    const play = L.playButton(ui.controls, anim);
    L.button(ui.controls, 'Сброс', () => {
      type.set(DEF.type); sM1.set(DEF.m1); sM2.set(DEF.m2); sV1.set(DEF.v1); sV2.set(DEF.v2);
      restart(); play.sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function calc() {
      const m1 = sM1.value, m2 = sM2.value, v1 = sV1.value, v2 = sV2.value;
      const elastic = type.value === 'elastic';
      const hit = v1 > v2; // шар 1 слева: удар только если он догоняет/встречает шар 2
      let u1 = v1, u2 = v2;
      if (hit) {
        if (elastic) {
          // следствие ЗСИ и ЗСЭ (1.4.3, 1.4.6) для центрального удара
          u1 = ((m1 - m2) * v1 + 2 * m2 * v2) / (m1 + m2);
          u2 = ((m2 - m1) * v2 + 2 * m1 * v1) / (m1 + m2);
        } else {
          u1 = u2 = (m1 * v1 + m2 * v2) / (m1 + m2); // ЗСИ
        }
      }
      u1 = clean(u1); u2 = clean(u2);
      const p0 = clean(m1 * v1 + m2 * v2);
      const p1 = clean(m1 * u1 + m2 * u2);
      const E0 = (m1 * v1 * v1) / 2 + (m2 * v2 * v2) / 2;
      const E1 = (m1 * u1 * u1) / 2 + (m2 * u2 * u2) / 2;
      const Q = clean(E0 - E1);
      return { m1, m2, v1, v2, u1, u2, p0, p1, E0, E1, Q, elastic, hit };
    }

    function pArrows(ctx, ox, y, items, kp, c) {
      // items: [{p, label, color, bold}]
      items.forEach((it, i) => {
        const yy = y + (i - 1) * 15;
        const x2 = ox + it.p * kp;
        if (Math.abs(x2 - ox) < 1) {
          L.dot(ctx, ox, yy, it.color, 3);
          L.text(ctx, it.label + ' = 0', ox + 6, yy, it.color, { font: SMALL });
          return;
        }
        L.arrow(ctx, ox, yy, x2, yy, it.color, { width: it.bold ? 2.6 : 2, head: 8 });
        const right = it.p > 0;
        L.text(ctx, it.label, x2 + (right ? 5 : -5), yy, it.color, { font: SMALL, align: right ? 'left' : 'right' });
      });
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      const r = calc();
      ctx.clearRect(0, 0, W, H);

      // ---- дорожка
      const left = 12, right = W - 12;
      const half = (right - left) / 2, xc = (left + right) / 2;
      const trackY = H * 0.36;
      const rmax = Math.max(9, Math.min(H * 0.08, W * 0.06, 26));
      const rad = (m) => Math.max(7, rmax * Math.cbrt(m / 5));
      const r1 = rad(r.m1), r2 = rad(r.m2);
      const vmaxAll = Math.max(Math.abs(r.v1), Math.abs(r.v2), Math.abs(r.u1), Math.abs(r.u2), 0.5);
      const k = Math.max(0, half - 2 * rmax - 12) / (vmaxAll * TC); // пикселей на (м/с · с)
      const t = Math.min(tau, 2 * TC);
      const after = r.hit && t > TC;
      let x1, x2;
      if (r.hit) {
        const va = after ? r.u1 : r.v1, vb = after ? r.u2 : r.v2;
        x1 = xc - r1 + va * k * (t - TC);
        x2 = xc + r2 + vb * k * (t - TC);
      } else {
        const kk = k / 2;
        x1 = xc - r1 - 10 + r.v1 * kk * t;
        x2 = xc + r2 + 10 + r.v2 * kk * t;
      }
      hatchH(ctx, left, right, trackY, c.text);
      L.arrow(ctx, right - 46, trackY + 18, right - 6, trackY + 18, c.text, { width: 1.2, head: 6 });
      L.text(ctx, 'x', right - 8, trackY + 30, c.text, { font: FONT, align: 'right' });

      const ball = (x, rr, fill, lab) => {
        ctx.save();
        ctx.globalAlpha = 0.35; ctx.fillStyle = fill;
        ctx.beginPath(); ctx.arc(x, trackY - rr, rr, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
        L.text(ctx, lab, x, trackY - rr, c.text, { font: rr > 11 ? FONT : '10px system-ui, sans-serif', align: 'center' });
      };
      ball(x1, r1, c.accent, 'm_1');
      ball(x2, r2, c.muted, 'm_2');

      // скорости над шарами
      const vs = Math.min(42, W * 0.12) / vmaxAll;
      const ya = trackY - 2 * rmax - 18;
      const vArrow = (x, v, lab) => {
        if (Math.abs(v) < 1e-9) { L.text(ctx, lab + ' = 0', x, ya, c.velocity, { font: SMALL, align: 'center' }); return; }
        const x2e = x + v * vs;
        L.arrow(ctx, x, ya, x2e, ya, c.velocity);
        L.text(ctx, lab, x2e + (v > 0 ? 4 : -4), ya - 10, c.velocity, { font: SMALL, align: v > 0 ? 'left' : 'right' });
      };
      if (after && !r.elastic) {
        vArrow((x1 + x2) / 2, r.u1, '→u');
      } else {
        vArrow(x1, after ? r.u1 : r.v1, after ? "→v'_1" : '→v_1');
        vArrow(x2, after ? r.u2 : r.v2, after ? "→v'_2" : '→v_2');
      }
      L.text(ctx, r.hit ? (after ? 'после удара' : 'до удара') : 'удара нет', left, 12, c.muted, { font: SMALL });

      // ---- импульсы
      const ox = W / 2;
      const pmax = Math.max(Math.abs(r.m1 * r.v1), Math.abs(r.m2 * r.v2), Math.abs(r.m1 * r.u1), Math.abs(r.m2 * r.u2), Math.abs(r.p0), 1e-9);
      const kp = (W / 2 - 46) / pmax;
      const yA = H * 0.58, yB = H * 0.84;
      ctx.save();
      ctx.strokeStyle = c.grid; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ox, yA - 30); ctx.lineTo(ox, yB + 26); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'Импульсы до удара', 6, yA - 30, c.muted, { font: SMALL });
      L.text(ctx, 'после удара', 6, yB - 30, c.muted, { font: SMALL });
      pArrows(ctx, ox, yA, [
        { p: r.m1 * r.v1, label: '→p_1', color: c.accent },
        { p: r.m2 * r.v2, label: '→p_2', color: c.muted },
        { p: r.p0, label: '→p', color: c.text, bold: true },
      ], kp, c);
      pArrows(ctx, ox, yB, [
        { p: r.m1 * r.u1, label: "→p'_1", color: c.accent },
        { p: r.m2 * r.u2, label: "→p'_2", color: c.muted },
        { p: r.p1, label: "→p'", color: c.text, bold: true },
      ], kp, c);
    }

    function updateReadout() {
      const r = calc();
      const rows = [
        ['p до = m<sub>1</sub>v<sub>1x</sub> + m<sub>2</sub>v<sub>2x</sub>', L.fmt(r.p0) + ' кг·м/с'],
        ['p после', L.fmt(r.p1) + ' кг·м/с'],
      ];
      if (!r.hit) {
        rows.push(['Удар', 'не произойдёт: v₁ₓ ≤ v₂ₓ, шары не сближаются']);
      } else if (r.elastic) {
        rows.push(['v′<sub>1x</sub>', L.fmt(r.u1) + ' м/с'], ['v′<sub>2x</sub>', L.fmt(r.u2) + ' м/с']);
      } else {
        rows.push(['u = (m<sub>1</sub>v<sub>1x</sub> + m<sub>2</sub>v<sub>2x</sub>)/(m<sub>1</sub> + m<sub>2</sub>)', L.fmt(r.u1) + ' м/с']);
      }
      rows.push(
        ['E<sub>к</sub> до', L.fmt(r.E0) + ' Дж'],
        ['E<sub>к</sub> после', L.fmt(r.E1) + ' Дж'],
        ['Q = E<sub>к до</sub> − E<sub>к после</sub>', L.fmt(r.Q) + ' Дж'],
      );
      ro.set(rows);
    }

    function restart() { tau = 0; draw(); updateReadout(); }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    restart();
    return { destroy: d.run };
  },
};
