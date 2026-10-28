// Линии напряжённости и эквипотенциали системы 1–3 точечных зарядов.
// Масштаб: ширина рисунка = 1 м. Заряды — в нКл. Формулы: E = k|q|/r², φ = kq/r, суперпозиция (3.1.4–3.1.6).
import * as L from './_lib.js';

const K = 9e9;        // Н·м²/Кл²
const NC = 1e-9;      // 1 нКл в Кл
const R_NEAR = 0.005; // м: ближе — считаем, что точка совпадает с зарядом

const DEF_CHARGES = [
  { u: 0.3, v: 0.5, q: 2 },
  { u: 0.7, v: 0.5, q: -2 },
  { u: 0.5, v: 0.2, q: 1 },
];
const DEF_PROBE = { u: 0.5, v: 0.5 };
const DEF_COUNT = 2;
const EQ_LEVELS = [15, 30, 60, 120, 240, 480]; // В (и такие же отрицательные)

export default {
  id: 'field-lines',
  title: 'Линии напряжённости точечных зарядов',
  codes: ['3.1.4', '3.1.5', '3.1.6'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Перетаскивайте заряды и пробную точку A (или коснитесь поля, чтобы перенести A). Ширина рисунка — 1 м. Длина стрелки →E в точке A условная (нелинейная шкала).',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, label: 'Линии напряжённости электрического поля точечных зарядов' });
    d.add(cv.destroy);
    const C = cv.canvas;
    C.style.touchAction = 'none';
    C.style.cursor = 'pointer';

    const charges = DEF_CHARGES.map((c) => ({ ...c }));
    const probe = { ...DEF_PROBE };
    let count = DEF_COUNT;

    const nChoice = L.choice(ui.controls, {
      label: 'Число зарядов',
      options: [{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }],
      value: String(DEF_COUNT),
      onChange: (v) => { count = +v; syncSliders(); schedule(); },
    });
    const qs = charges.map((ch, i) => L.slider(ui.controls, {
      label: `Заряд q<sub>${i + 1}</sub>`, min: -3, max: 3, step: 0.5, value: ch.q, unit: 'нКл',
      onInput: (v) => { ch.q = v; schedule(); },
    }));
    const eqCb = L.checkbox(ui.controls, { label: 'Эквипотенциальные линии (φ = const)', checked: false, onChange: () => schedule() });
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    function syncSliders() { qs.forEach((s, i) => { s.el.style.display = i < count ? '' : 'none'; }); }

    // ---------- физика (координаты в px холста, S — px на метр) ----------
    function activeCharges(W, H) {
      const a = [];
      for (let i = 0; i < count; i++) {
        const c = charges[i];
        if (c.q !== 0) a.push({ x: c.u * W, y: c.v * H, q: c.q * NC, i });
      }
      return a;
    }
    // Вектор E (В/м) в осях холста (y вниз)
    function efield(act, x, y, S) {
      let ex = 0, ey = 0;
      for (const c of act) {
        const dx = (x - c.x) / S, dy = (y - c.y) / S;
        const r2 = Math.max(dx * dx + dy * dy, 1e-12);
        const f = (K * c.q) / (r2 * Math.sqrt(r2));
        ex += f * dx; ey += f * dy;
      }
      return [ex, ey];
    }
    function unitDir(act, x, y, S, sign) {
      const [ex, ey] = efield(act, x, y, S);
      const m = Math.hypot(ex, ey);
      if (!(m > 0) || !Number.isFinite(m)) return null;
      return [(sign * ex) / m, (sign * ey) / m];
    }

    // Линии поля: от положительных зарядов по E; от отрицательных — против E
    // (линии отрицательного заряда, пришедшие от положительного, отбрасываются — они уже есть).
    function traceLines(act, W, H) {
      const S = W, lines = [];
      const R0 = 8, ds = 2.5, maxSteps = 3000, margin = 60;
      for (const src of act) {
        const sign = src.q > 0 ? 1 : -1;
        const n = Math.max(4, Math.round(6 * Math.abs(src.q / NC)));
        const off = 0.3 + src.i * 0.41;
        for (let k = 0; k < n; k++) {
          const ang = off + (2 * Math.PI * k) / n;
          let x = src.x + R0 * Math.cos(ang), y = src.y + R0 * Math.sin(ang);
          const pts = [[src.x, src.y], [x, y]];
          let end = null;
          for (let s = 0; s < maxSteps; s++) {
            const d1 = unitDir(act, x, y, S, sign);
            if (!d1) break;
            const d2 = unitDir(act, x + (d1[0] * ds) / 2, y + (d1[1] * ds) / 2, S, sign);
            if (!d2) break;
            if (d1[0] * d2[0] + d1[1] * d2[1] < -0.5) break; // точка равновесия (E ≈ 0)
            x += d2[0] * ds; y += d2[1] * ds;
            pts.push([x, y]);
            if (x < -margin || x > W + margin || y < -margin || y > H + margin) break;
            let hit = null;
            for (const c of act) {
              if (c !== src && Math.hypot(x - c.x, y - c.y) < R0) { hit = c; break; }
            }
            if (hit) { pts.push([hit.x, hit.y]); end = hit; break; }
          }
          if (sign < 0 && end && end.q > 0) continue;
          if (sign < 0) pts.reverse(); // порядок точек — по направлению E
          lines.push(pts);
        }
      }
      return lines;
    }

    // Сетка потенциала для эквипотенциалей
    function potentialGrid(act, W, H) {
      const S = W;
      const g = Math.max(5, Math.round(W / 110));
      const nx = Math.ceil(W / g) + 1, ny = Math.ceil(H / g) + 1;
      const v = new Float64Array(nx * ny);
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const x = i * g, y = j * g;
          let phi = 0;
          for (const c of act) {
            const r = Math.max(Math.hypot(x - c.x, y - c.y) / S, 0.004);
            phi += (K * c.q) / r;
          }
          v[j * nx + i] = phi;
        }
      }
      return { v, nx, ny, g };
    }

    // Marching squares: отрезки изолинии level
    function isoSegments(grid, level) {
      const { v, nx, ny, g } = grid;
      const segs = [];
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const v0 = v[j * nx + i], v1 = v[j * nx + i + 1], v2 = v[(j + 1) * nx + i + 1], v3 = v[(j + 1) * nx + i];
          const b0 = v0 > level, b1 = v1 > level, b2 = v2 > level, b3 = v3 > level;
          const idx = (b0 ? 1 : 0) | (b1 ? 2 : 0) | (b2 ? 4 : 0) | (b3 ? 8 : 0);
          if (idx === 0 || idx === 15) continue;
          const x0 = i * g, y0 = j * g;
          const ep = (e) => {
            if (e === 0) return [x0 + (g * (level - v0)) / (v1 - v0), y0];
            if (e === 1) return [x0 + g, y0 + (g * (level - v1)) / (v2 - v1)];
            if (e === 2) return [x0 + (g * (level - v3)) / (v2 - v3), y0 + g];
            return [x0, y0 + (g * (level - v0)) / (v3 - v0)];
          };
          const crossed = [];
          if (b0 !== b1) crossed.push(0);
          if (b1 !== b2) crossed.push(1);
          if (b2 !== b3) crossed.push(2);
          if (b3 !== b0) crossed.push(3);
          if (crossed.length === 2) {
            segs.push([...ep(crossed[0]), ...ep(crossed[1])]);
          } else if (crossed.length === 4) {
            const cHigh = (v0 + v1 + v2 + v3) / 4 > level;
            if (cHigh === b0) { segs.push([...ep(0), ...ep(1)], [...ep(2), ...ep(3)]); }
            else { segs.push([...ep(3), ...ep(0)], [...ep(1), ...ep(2)]); }
          }
        }
      }
      return segs;
    }

    // ---------- кэш тяжёлых вычислений ----------
    let cacheKey = '', cache = null;
    function getCache(W, H) {
      const key = [W, H, count, eqCb.value, ...charges.slice(0, count).map((c) => `${c.u.toFixed(4)},${c.v.toFixed(4)},${c.q}`)].join('|');
      if (key === cacheKey && cache) return cache;
      const act = activeCharges(W, H);
      const lines = traceLines(act, W, H);
      let eq = null;
      if (eqCb.value && act.length) {
        const grid = potentialGrid(act, W, H);
        const hasPos = act.some((c) => c.q > 0), hasNeg = act.some((c) => c.q < 0);
        const levels = [];
        EQ_LEVELS.forEach((l) => { if (hasPos) levels.push(l); if (hasNeg) levels.push(-l); });
        if (hasPos && hasNeg) levels.push(0);
        eq = levels.map((l) => ({ level: l, segs: isoSegments(grid, l) }));
      }
      cache = { act, lines, eq };
      cacheKey = key;
      return cache;
    }

    // ---------- рисование ----------
    function head(ctx, x, y, dx, dy, color, size = 7) {
      const m = Math.hypot(dx, dy);
      if (!(m > 0)) return;
      const ux = dx / m, uy = dy / m;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + ux * size * 0.6, y + uy * size * 0.6);
      ctx.lineTo(x - ux * size * 0.6 - uy * size * 0.45, y - uy * size * 0.6 + ux * size * 0.45);
      ctx.lineTo(x - ux * size * 0.6 + uy * size * 0.45, y - uy * size * 0.6 - ux * size * 0.45);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function drawLine(ctx, pts, color, W, H) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
      // стрелки по направлению E
      const lens = [0];
      for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const total = lens[lens.length - 1];
      const marks = [];
      if (total < 150) marks.push(total / 2);
      else for (let s = 60; s < total - 30; s += 150) marks.push(s);
      let j = 1;
      for (const m of marks) {
        while (j < pts.length - 1 && lens[j] < m) j++;
        const p = pts[j];
        if (p[0] < 4 || p[0] > W - 4 || p[1] < 4 || p[1] > H - 4) continue;
        const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
        head(ctx, p[0], p[1], b[0] - a[0], b[1] - a[1], color);
      }
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const S = W; // px на метр
      const { act, lines, eq } = getCache(W, H);

      // эквипотенциали
      if (eq) {
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        for (const { segs } of eq) {
          ctx.beginPath();
          for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
          ctx.stroke();
        }
        ctx.restore();
      }

      // линии напряжённости
      ctx.save();
      ctx.strokeStyle = c.fieldE; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
      for (const pts of lines) drawLine(ctx, pts, c.fieldE, W, H);
      ctx.restore();

      // масштабная линейка 10 см
      const bx = 12, by = H - 12, bl = 0.1 * S;
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx + bl, by);
      ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
      ctx.moveTo(bx + bl, by - 4); ctx.lineTo(bx + bl, by + 4);
      ctx.stroke();
      ctx.restore();
      L.text(ctx, '10 см', bx + bl + 6, by, c.muted, { font: '12px system-ui, sans-serif' });

      // заряды
      for (let i = 0; i < count; i++) {
        const ch = charges[i];
        const x = ch.u * W, y = ch.v * H;
        const col = ch.q > 0 ? c.force : ch.q < 0 ? c.fieldB : c.muted;
        ctx.save();
        ctx.fillStyle = c.surface; ctx.strokeStyle = col; ctx.lineWidth = 2;
        if (ch.q === 0) ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        L.text(ctx, ch.q > 0 ? '+' : ch.q < 0 ? '−' : '0', x, y + 1, col, { font: '700 16px system-ui, sans-serif', align: 'center' });
        L.text(ctx, `q_${i + 1}`, x + 13, y - 14, c.text, { font: 'italic 14px system-ui, sans-serif' });
      }

      // пробная точка A
      const px = probe.u * W, py = probe.v * H;
      const rows = [];
      let rmin = Infinity;
      act.forEach((ch) => {
        const r = Math.hypot(px - ch.x, py - ch.y) / S;
        rmin = Math.min(rmin, r);
      });
      for (let i = 0; i < count; i++) {
        const ch = charges[i];
        const r = Math.hypot(px - ch.u * W, py - ch.v * H) / S;
        const Ei = r > R_NEAR ? (K * Math.abs(ch.q * NC)) / (r * r) : NaN;
        rows.push([`r<sub>${i + 1}</sub> (до q<sub>${i + 1}</sub>)`, L.fmt(r, 3) + ' м']);
        rows.push([`E<sub>${i + 1}</sub> = k|q<sub>${i + 1}</sub>|/r<sub>${i + 1}</sub>²`, ch.q === 0 ? '0' : (r > R_NEAR ? L.fmt(Ei, 3) + ' В/м' : '— (A на заряде)')]);
      }
      if (rmin > R_NEAR) {
        const [ex, ey] = efield(act, px, py, S);
        const Em = Math.hypot(ex, ey);
        let phi = 0;
        act.forEach((ch) => { phi += (K * ch.q) / (Math.hypot(px - ch.x, py - ch.y) / S); });
        if (Em > 0) {
          const maxLen = L.clamp(0.13 * W, 40, 95);
          const len = (maxLen * Em) / (Em + 1000);
          L.arrow(ctx, px, py, px + (ex / Em) * len, py + (ey / Em) * len, c.fieldE, { width: 3, head: 11, label: '→E', labelOffset: [6, -10] });
        }
        rows.push(['|E| в точке A (суперпозиция)', L.fmt(Em, 3) + ' В/м']);
        rows.push(['φ в точке A', L.fmt(phi, 3) + ' В']);
      } else {
        rows.push(['|E| в точке A', '— (точка A совпадает с зарядом)']);
        rows.push(['φ в точке A', '—']);
      }
      ctx.save();
      ctx.fillStyle = c.accent; ctx.strokeStyle = c.bg; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'A', px - 16, py + 12, c.accent, { font: '700 14px system-ui, sans-serif' });

      ro.set(rows);
    }

    // ---------- перерисовка (не чаще кадра) ----------
    let raf = 0;
    function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
    d.add(() => cancelAnimationFrame(raf));

    // ---------- перетаскивание ----------
    let drag = null;
    function localPos(e) {
      const r = C.getBoundingClientRect();
      const kx = r.width > 0 ? cv.width / r.width : 1, ky = r.height > 0 ? cv.height / r.height : 1;
      return [(e.clientX - r.left) * kx, (e.clientY - r.top) * ky];
    }
    function pick(x, y) {
      for (let i = count - 1; i >= 0; i--) {
        const ch = charges[i];
        if (Math.hypot(x - ch.u * cv.width, y - ch.v * cv.height) < 20) return { type: 'charge', i };
      }
      return { type: 'probe' };
    }
    function moveTo(x, y) {
      const u = L.clamp(x / cv.width, 0.02, 0.98), v = L.clamp(y / cv.height, 0.03, 0.97);
      const t = drag.type === 'charge' ? charges[drag.i] : probe;
      t.u = u; t.v = v;
      schedule();
    }
    const onDown = (e) => {
      const [x, y] = localPos(e);
      drag = pick(x, y);
      try { C.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
      moveTo(x, y);
    };
    const onMove = (e) => { if (!drag) return; const [x, y] = localPos(e); moveTo(x, y); };
    const onUp = (e) => { if (!drag) return; drag = null; try { C.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } };
    C.addEventListener('pointerdown', onDown);
    C.addEventListener('pointermove', onMove);
    C.addEventListener('pointerup', onUp);
    C.addEventListener('pointercancel', onUp);
    d.add(() => {
      C.removeEventListener('pointerdown', onDown);
      C.removeEventListener('pointermove', onMove);
      C.removeEventListener('pointerup', onUp);
      C.removeEventListener('pointercancel', onUp);
    });

    // ---------- клавиатура: 1/2/3 — выбрать заряд, A или 0 — точку A, стрелки — двигать (Shift — крупный шаг) ----------
    C.tabIndex = 0;
    C.setAttribute('aria-label', 'Поле зарядов. Клавиши 1, 2, 3 — выбрать заряд, A или 0 — пробную точку A; стрелки — перемещение, Shift — крупный шаг.');
    let kbSel = { type: 'probe' };
    const onKey = (e) => {
      const k = e.key;
      if (k === '1' || k === '2' || k === '3') { const i = +k - 1; if (i < count) kbSel = { type: 'charge', i }; e.preventDefault(); return; }
      if (k === '0' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф') { kbSel = { type: 'probe' }; e.preventDefault(); return; }
      const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      if (kbSel.type === 'charge' && kbSel.i >= count) kbSel = { type: 'probe' };
      const t = kbSel.type === 'charge' ? charges[kbSel.i] : probe;
      const st = e.shiftKey ? 0.05 : 0.01;
      t.u = L.clamp(t.u + dx * st, 0.02, 0.98);
      t.v = L.clamp(t.v + (dy * st * cv.width) / Math.max(1, cv.height), 0.03, 0.97);
      schedule();
    };
    C.addEventListener('keydown', onKey);
    d.add(() => C.removeEventListener('keydown', onKey));

    function reset() {
      DEF_CHARGES.forEach((c, i) => { Object.assign(charges[i], c); qs[i].set(c.q); });
      Object.assign(probe, DEF_PROBE);
      count = DEF_COUNT;
      nChoice.set(String(DEF_COUNT));
      eqCb.set(false);
      syncSliders();
      draw();
    }

    syncSliders();
    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
