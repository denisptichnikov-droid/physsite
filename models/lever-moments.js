// Модель «Рычаг: правило моментов, центр масс».
// Формулы (CLAUDE.md, B1): 1.3.1 |M| = Fl; 1.3.3 ΣM = 0 (M_по = M_против); 1.3.2 x_цм = Σmᵢxᵢ / Σmᵢ.
// Балка длиной 2 м, опора в точке x_O; груз i действует на балку силой Fᵢ = mᵢg, плечо lᵢ = |xᵢ − x_O|.
// Груз правее опоры вращает балку по часовой стрелке, левее — против. Масса балки (по желанию) — в её середине (x = 1 м).
import * as L from './_lib.js';

const G = 10;
const BEAM = 2;
const DEF = { xo: 1, m1: 2, x1: 0.6, m2: 1, x2: 1.8, use3: false, m3: 1, x3: 1.5, useBeam: false, M: 1 };
const LABEL_FONT = '600 13px system-ui, sans-serif';
const snap = (x) => (Math.abs(x) < 1e-9 ? 0 : x);

function hatchLine(ctx, x1, y1, x2, y2, color, side = 1) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len, uy = dy / len, nx = -uy * side, ny = ux * side;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath();
  for (let s = 4; s < len; s += 8) {
    const px = x1 + ux * s, py = y1 + uy * s;
    ctx.moveTo(px, py); ctx.lineTo(px + nx * 7 - ux * 5, py + ny * 7 - uy * 5);
  }
  ctx.stroke();
  ctx.restore();
}

export default {
  id: 'lever-moments',
  title: 'Рычаг: правило моментов',
  codes: ['1.3.1', '1.3.2', '1.3.3'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Плечо силы — кратчайшее расстояние от оси (опоры) до линии действия силы; для вертикальных сил на горизонтальной балке это |xᵢ − x_O|. '
        + 'Равновесие: M_по = M_против (то же самое — центр масс системы над опорой). Если равновесия нет, штрихом показано, куда начнёт поворачиваться балка.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, minHeight: 290, maxHeight: 460, label: 'Балка на опоре с грузами, плечами сил и моментами' });
    d.add(cv.destroy);

    const sl = (label, min, max, step, value, unit) => L.slider(ui.controls, { label, min, max, step, value, unit, onInput: draw });
    const sXo = sl('Положение опоры x<sub>O</sub>', 0, BEAM, 0.1, DEF.xo, 'м');
    const sM1 = sl('Масса груза m<sub>1</sub>', 0, 5, 0.1, DEF.m1, 'кг');
    const sX1 = sl('Положение груза x<sub>1</sub>', 0, BEAM, 0.1, DEF.x1, 'м');
    const sM2 = sl('Масса груза m<sub>2</sub>', 0, 5, 0.1, DEF.m2, 'кг');
    const sX2 = sl('Положение груза x<sub>2</sub>', 0, BEAM, 0.1, DEF.x2, 'м');
    const cb3 = L.checkbox(ui.controls, { label: 'Третий груз', checked: DEF.use3, onChange: () => { sync(); draw(); } });
    const sM3 = sl('Масса груза m<sub>3</sub>', 0, 5, 0.1, DEF.m3, 'кг');
    const sX3 = sl('Положение груза x<sub>3</sub>', 0, BEAM, 0.1, DEF.x3, 'м');
    const cbB = L.checkbox(ui.controls, { label: 'Учитывать массу балки (центр масс — посередине)', checked: DEF.useBeam, onChange: () => { sync(); draw(); } });
    const sMb = sl('Масса балки M', 0, 5, 0.1, DEF.M, 'кг');
    function sync() {
      sM3.el.style.display = sX3.el.style.display = cb3.value ? '' : 'none';
      sMb.el.style.display = cbB.value ? '' : 'none';
    }
    L.button(ui.controls, 'Сброс', () => {
      sXo.set(DEF.xo); sM1.set(DEF.m1); sX1.set(DEF.x1); sM2.set(DEF.m2); sX2.set(DEF.x2);
      cb3.set(DEF.use3); sM3.set(DEF.m3); sX3.set(DEF.x3); cbB.set(DEF.useBeam); sMb.set(DEF.M);
      sync(); draw();
    }, { reset: true });

    const ro = L.readout(ui.readout);
    let lastRO = '';

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const xo = sXo.value;
      const loads = [
        { name: '1', m: sM1.value, x: sX1.value },
        { name: '2', m: sM2.value, x: sX2.value },
      ];
      if (cb3.value) loads.push({ name: '3', m: sM3.value, x: sX3.value });
      const beamM = cbB.value ? sMb.value : 0;
      const all = loads.map((q) => ({ ...q, beam: false }));
      if (beamM > 0) all.push({ name: 'б', m: beamM, x: BEAM / 2, beam: true });
      let Mcw = 0, Mccw = 0, mSum = 0, mx = 0;
      all.forEach((q) => {
        q.F = q.m * G;
        q.arm = snap(Math.abs(q.x - xo));
        q.M = q.F * q.arm;
        q.dir = q.arm === 0 || q.F === 0 ? 0 : q.x > xo ? 1 : -1; // 1 — по часовой
        if (q.dir > 0) Mcw += q.M; else if (q.dir < 0) Mccw += q.M;
        mSum += q.m; mx += q.m * q.x;
      });
      const net = Mcw - Mccw;
      const eq = Math.abs(net) < 1e-6;
      ctx.clearRect(0, 0, W, H);

      // ---- геометрия ----
      const ml = 24, mr = 24;
      const XP = (x) => ml + (x / BEAM) * (W - ml - mr);
      const yb = Math.max(78, H * 0.3);
      const th = 8;
      const Fmax = Math.max(1e-9, ...all.map((q) => q.F));
      const Fpx = L.clamp(H * 0.22, 36, 100);
      const k = Fpx / Fmax;

      // опора и пол
      const ox = XP(xo);
      ctx.save();
      ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ox, yb + th / 2); ctx.lineTo(ox - 13, yb + th / 2 + 24); ctx.lineTo(ox + 13, yb + th / 2 + 24); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
      hatchLine(ctx, ox - 26, yb + th / 2 + 24, ox + 26, yb + th / 2 + 24, c.muted, 1);
      L.text(ctx, 'O', ox + 16, yb + th / 2 + 14, c.text, { font: 'italic 13px system-ui, sans-serif' });

      // «призрак» наклона при отсутствии равновесия
      if (!eq) {
        const ang = (net > 0 ? 1 : -1) * L.deg(7);
        ctx.save();
        ctx.translate(ox, yb); ctx.rotate(ang);
        ctx.strokeStyle = c.muted; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
        ctx.strokeRect(XP(0) - ox, -th / 2, XP(BEAM) - XP(0), th);
        ctx.restore();
        // круговая стрелка у опоры
        ctx.save();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2;
        const R = 30;
        const a0 = -Math.PI / 2 - 0.7, a1 = -Math.PI / 2 + 0.7;
        ctx.beginPath(); ctx.arc(ox, yb, R, a0, a1); ctx.stroke();
        ctx.restore();
        const end = net > 0 ? a1 : a0;
        const ex = ox + R * Math.cos(end), ey = yb + R * Math.sin(end);
        const tdir = net > 0 ? 1 : -1;
        const tx = -Math.sin(end) * tdir, ty = Math.cos(end) * tdir;
        L.arrow(ctx, ex - tx * 3, ey - ty * 3, ex + tx * 5, ey + ty * 5, c.accent, { width: 2, head: 8 });
        L.text(ctx, net > 0 ? 'повернётся по часовой' : 'повернётся против часовой', W / 2, 12, c.accent, { font: '600 13px system-ui, sans-serif', align: 'center' });
      } else {
        L.text(ctx, 'равновесие: M_{по} = M_{против}', W / 2, 12, c.velocity, { font: '600 13px system-ui, sans-serif', align: 'center' });
      }

      // балка с делениями
      ctx.save();
      ctx.fillStyle = c.grid; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.fillRect(XP(0), yb - th / 2, XP(BEAM) - XP(0), th);
      ctx.strokeRect(XP(0), yb - th / 2, XP(BEAM) - XP(0), th);
      ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 1; i < 20; i++) { const x = XP(i * 0.1); ctx.moveTo(x, yb - th / 2); ctx.lineTo(x, yb - th / 2 + (i % 5 ? 3 : 6)); }
      ctx.stroke();
      ctx.restore();
      ['0', '0,5', '1', '1,5', '2 м'].forEach((s, i) => L.text(ctx, s, XP(i * 0.5), yb - th / 2 - 52, c.muted, { font: '10px system-ui, sans-serif', align: i === 0 ? 'left' : i === 4 ? 'right' : 'center' }));

      // грузы (на балке), силы (вниз от балки), плечи
      const bwMax = L.clamp(W * 0.07, 16, 34);
      let row = 0;
      const armY0 = yb + th / 2 + Fpx + 22;
      all.forEach((q) => {
        if (q.m <= 0) return;
        const x = XP(q.x);
        if (!q.beam) {
          const s = bwMax * (0.55 + 0.45 * Math.sqrt(q.m / 5));
          ctx.save();
          ctx.fillStyle = c.surface; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
          ctx.fillRect(x - s / 2, yb - th / 2 - s, s, s); ctx.strokeRect(x - s / 2, yb - th / 2 - s, s, s);
          ctx.restore();
          L.text(ctx, `m_${q.name}`, x, yb - th / 2 - s - 9, c.text, { font: 'italic 12px system-ui, sans-serif', align: 'center' });
        } else {
          L.dot(ctx, x, yb, c.text, 3);
        }
        const len = q.F * k;
        const label = q.beam ? 'M→g' : `→F_${q.name}`;
        L.arrow(ctx, x, yb + th / 2, x, yb + th / 2 + len, c.force, { width: 2.2 });
        if (q.beam) {
          const w = L.text(ctx, 'M', x + 5, yb + th / 2 + len - 4, c.force, { font: LABEL_FONT });
          L.text(ctx, '→g', x + 5 + w, yb + th / 2 + len - 4, c.force, { font: LABEL_FONT });
        } else {
          L.text(ctx, label, x + 5, yb + th / 2 + len - 4, c.force, { font: LABEL_FONT });
        }
        // плечо
        if (q.arm > 0) {
          const y = armY0 + row * 18;
          row++;
          ctx.save();
          ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(x, yb + th / 2 + len); ctx.lineTo(x, y + 4); ctx.moveTo(ox, yb + th / 2 + 24); ctx.lineTo(ox, y + 4); ctx.stroke();
          ctx.setLineDash([]); ctx.strokeStyle = c.text;
          ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(x, y);
          ctx.moveTo(ox, y - 4); ctx.lineTo(ox, y + 4); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
          ctx.restore();
          L.text(ctx, `l_${q.name} = ${L.fmt(q.arm)} м`, (ox + x) / 2, y - 7, c.text, { font: 'italic 11px system-ui, sans-serif', align: 'center' });
        }
      });

      // ---- числа ----
      const rows = [];
      all.forEach((q) => {
        const nm = q.beam ? 'балка' : `груз ${q.name}`;
        rows.push([`${nm}: F = mg; l; M = Fl`, `${L.fmt(q.F)} Н; ${L.fmt(q.arm)} м; ${L.fmt(snap(q.M))} Н·м${q.dir > 0 ? ' (по час.)' : q.dir < 0 ? ' (против час.)' : ''}`]);
      });
      rows.push(['M<sub>по</sub> (сумма по часовой)', L.fmt(snap(Mcw)) + ' Н·м']);
      rows.push(['M<sub>против</sub> (сумма против часовой)', L.fmt(snap(Mccw)) + ' Н·м']);
      rows.push(['Итог', eq ? 'равновесие (M_по = M_против)' : net > 0 ? 'поворот по часовой стрелке' : 'поворот против часовой стрелки']);
      rows.push(['Центр масс x<sub>цм</sub> = Σm<sub>i</sub>x<sub>i</sub> / Σm<sub>i</sub>', mSum > 0 ? L.fmt(snap(mx / mSum)) + ' м (опора: ' + L.fmt(xo) + ' м)' : '— (нет грузов)']);
      if (eq) rows.push(['N опоры = Σm<sub>i</sub>g (в равновесии)', L.fmt(mSum * G) + ' Н']);
      const key = JSON.stringify(rows);
      if (key !== lastRO) { lastRO = key; ro.set(rows); }
    }

    sync();
    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
