// Линии магнитной индукции: прямой провод, виток, катушка, полосовой магнит (3.3.1, 3.3.2).
// Качественная картина: источники заменены набором прямых токов, перпендикулярных рисунку
// (виток — два сечения ⊙/⊗, катушка — ряды сечений витков, магнит — эквивалентные поверхностные токи).
// Линии B — изолинии функции ψ = Σ sᵢ·ln rᵢ (в плоской задаче они совпадают с линиями поля),
// при равном шаге уровней густота линий пропорциональна |B|.
import * as L from './_lib.js';

const DEF_PROBE = { u: 0.8, v: 0.22 };

const RULES = {
  wire: 'Правило буравчика: если буравчик ввинчивать по направлению тока, то направление вращения его рукоятки совпадает с направлением линий →B. Ток «на нас» (⊙) — линии против часовой стрелки, «от нас» (⊗) — по часовой. B ∝ I/r: с удалением от провода линии реже.',
  loop: 'Правило буравчика для витка: если вращать рукоятку буравчика по направлению тока в витке, то поступательное движение буравчика укажет направление →B в центре витка.',
  coil: 'Правило правой руки: обхватите катушку так, чтобы четыре пальца шли по току в витках, — отогнутый большой палец укажет направление →B внутри катушки (на её северный полюс N). Внутри поле почти однородно.',
  magnet: 'Снаружи магнита линии →B выходят из северного полюса N и входят в южный S, внутри магнита идут от S к N — линии замкнуты. Северный конец стрелки компаса указывает направление →B.',
};
const NAMES = { wire: 'прямой провод с током (вид сверху)', loop: 'круговой виток с током (сечение)', coil: 'катушка с током (сечение)', magnet: 'полосовой магнит' };

export default {
  id: 'magnetic-lines',
  title: 'Линии магнитной индукции',
  codes: ['3.3.1', '3.3.2'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Качественная картина линий →B. У стрелок компасов красный конец — северный, он показывает направление →B. Стрелку A можно перетаскивать (или коснуться поля).',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.62, label: 'Линии магнитной индукции' });
    d.add(cv.destroy);
    const C = cv.canvas;
    C.style.touchAction = 'none';
    C.style.cursor = 'pointer';

    let src = 'wire';
    let dir = 1;
    const probe = { ...DEF_PROBE };

    const sChoice = L.choice(ui.controls, {
      label: 'Источник поля',
      options: [
        { value: 'wire', label: 'прямой провод' },
        { value: 'loop', label: 'виток с током' },
        { value: 'coil', label: 'катушка' },
        { value: 'magnet', label: 'полосовой магнит' },
      ],
      value: 'wire',
      onChange: (v) => { src = v; schedule(); },
    });
    const dirBtn = L.button(ui.controls, 'Сменить направление тока', () => { dir = -dir; schedule(); });
    L.button(ui.controls, 'Сброс', () => {
      src = 'wire'; dir = 1; Object.assign(probe, DEF_PROBE); sChoice.set('wire'); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    // ---------- геометрия источника ----------
    // fil: прямые токи ⟂ рисунку; s = +1 — «на нас» (⊙), s = −1 — «от нас» (⊗)
    function geom(W, H) {
      const xc = W / 2, yc = H / 2;
      const g = { xc, yc, fil: [], a: 0, len: 0 };
      if (src === 'wire') {
        g.fil.push({ x: xc, y: yc, s: dir });
      } else if (src === 'loop') {
        g.a = 0.2 * H;
        g.fil.push({ x: xc, y: yc - g.a, s: dir }, { x: xc, y: yc + g.a, s: -dir });
      } else if (src === 'coil') {
        g.a = 0.17 * H; g.len = Math.min(0.5 * W, 1.4 * H);
        const n = 8;
        for (let i = 0; i < n; i++) {
          const x = xc - g.len / 2 + (g.len * (i + 0.5)) / n;
          g.fil.push({ x, y: yc - g.a, s: dir }, { x, y: yc + g.a, s: -dir });
        }
      } else {
        g.a = 0.1 * H; g.len = Math.min(0.46 * W, 1.3 * H);
        const n = 24;
        for (let i = 0; i < n; i++) {
          const x = xc - g.len / 2 + (g.len * (i + 0.5)) / n;
          g.fil.push({ x, y: yc - g.a, s: dir }, { x, y: yc + g.a, s: -dir });
        }
      }
      return g;
    }

    // B в осях холста (y вниз), условные единицы. Ток ⊙ даёт линии против часовой стрелки на экране.
    function bfield(fil, x, y) {
      let bx = 0, by = 0;
      for (const f of fil) {
        const dx = x - f.x, dy = y - f.y;
        const r2 = Math.max(dx * dx + dy * dy, 4);
        bx += (f.s * dy) / r2;
        by += (-f.s * dx) / r2;
      }
      return [bx, by];
    }
    function psi(fil, x, y) {
      let p = 0;
      for (const f of fil) p += f.s * Math.log(Math.max(Math.hypot(x - f.x, y - f.y), 2));
      return p;
    }
    function insideMagnet(g, x, y) {
      return src === 'magnet' && Math.abs(x - g.xc) <= g.len / 2 && Math.abs(y - g.yc) <= g.a;
    }

    function isoSegments(grid, level) {
      const { v, nx, ny, step } = grid;
      const segs = [];
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const v0 = v[j * nx + i], v1 = v[j * nx + i + 1], v2 = v[(j + 1) * nx + i + 1], v3 = v[(j + 1) * nx + i];
          const b0 = v0 > level, b1 = v1 > level, b2 = v2 > level, b3 = v3 > level;
          if (b0 === b1 && b1 === b2 && b2 === b3) continue;
          const x0 = i * step, y0 = j * step;
          const ep = (e) => {
            if (e === 0) return [x0 + (step * (level - v0)) / (v1 - v0), y0];
            if (e === 1) return [x0 + step, y0 + (step * (level - v1)) / (v2 - v1)];
            if (e === 2) return [x0 + (step * (level - v3)) / (v2 - v3), y0 + step];
            return [x0, y0 + (step * (level - v0)) / (v3 - v0)];
          };
          const cr = [];
          if (b0 !== b1) cr.push(0);
          if (b1 !== b2) cr.push(1);
          if (b2 !== b3) cr.push(2);
          if (b3 !== b0) cr.push(3);
          if (cr.length === 2) segs.push([...ep(cr[0]), ...ep(cr[1])]);
          else if (cr.length === 4) {
            const cHigh = (v0 + v1 + v2 + v3) / 4 > level;
            if (cHigh === b0) segs.push([...ep(0), ...ep(1)], [...ep(2), ...ep(3)]);
            else segs.push([...ep(3), ...ep(0)], [...ep(1), ...ep(2)]);
          }
        }
      }
      return segs;
    }

    // ---------- кэш линий ----------
    let cacheKey = '', cache = null;
    function getCache(W, H) {
      const key = `${W}|${H}|${src}|${dir}`;
      if (key === cacheKey && cache) return cache;
      const g = geom(W, H);
      const step = Math.max(4, Math.round(W / 140));
      const nx = Math.ceil(W / step) + 1, ny = Math.ceil(H / step) + 1;
      const v = new Float64Array(nx * ny);
      let vmin = Infinity, vmax = -Infinity;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const p = psi(g.fil, i * step, j * step);
          v[j * nx + i] = p;
          if (p < vmin) vmin = p;
          if (p > vmax) vmax = p;
        }
      }
      // шаг уровней
      let delta;
      if (src === 'wire') delta = 0.32;
      else {
        const off = src === 'loop' ? 10 : src === 'coil' ? 6 : 3;
        const nIn = src === 'loop' ? 9 : src === 'coil' ? 8 : 7;
        const range = Math.abs(psi(g.fil, g.xc, g.yc - g.a + off) - psi(g.fil, g.xc, g.yc + g.a - off));
        delta = range > 1e-6 ? range / nIn : 0.4;
      }
      let kmin = Math.ceil(vmin / delta), kmax = Math.floor(vmax / delta);
      if (kmax - kmin > 80) { const mid = Math.round((kmin + kmax) / 2); kmin = mid - 40; kmax = mid + 40; }
      const grid = { v, nx, ny, step };
      const segs = [];
      for (let k = kmin; k <= kmax; k++) {
        const lvl = k * delta + (src === 'wire' ? 0 : 1e-9); // ψ = 0 — ось симметрии (сдвиг убирает вырожденные клетки)
        for (const s of isoSegments(grid, lvl)) segs.push(s);
      }
      // стрелки: точки пересечения линий с вертикалями/горизонталью через центр
      const vx = src === 'wire' ? [g.xc] : [g.xc, g.xc - 0.36 * W, g.xc + 0.36 * W];
      const hy = [g.yc];
      const marks = [];
      const near = (x, y) => marks.some((m) => Math.hypot(m[0] - x, m[1] - y) < 16);
      const nearFil = (x, y) => g.fil.some((f) => Math.hypot(f.x - x, f.y - y) < 16);
      const tryMark = (x, y) => {
        if (x < 6 || x > W - 6 || y < 6 || y > H - 6) return;
        if (nearFil(x, y) || insideMagnet(g, x, y) || near(x, y)) return;
        marks.push([x, y]);
      };
      for (const s of segs) {
        for (const X of vx) {
          if ((s[0] - X) * (s[2] - X) <= 0 && s[0] !== s[2]) {
            const t = (X - s[0]) / (s[2] - s[0]);
            tryMark(X, s[1] + t * (s[3] - s[1]));
          }
        }
        if (src === 'wire') {
          for (const Y of hy) {
            if ((s[1] - Y) * (s[3] - Y) <= 0 && s[1] !== s[3]) {
              const t = (Y - s[1]) / (s[3] - s[1]);
              tryMark(s[0] + t * (s[2] - s[0]), Y);
            }
          }
        }
      }
      cache = { g, segs, marks };
      cacheKey = key;
      return cache;
    }

    // ---------- рисование ----------
    function tri(ctx, x, y, dx, dy, color, size = 8) {
      const m = Math.hypot(dx, dy);
      if (!(m > 0)) return;
      const ux = dx / m, uy = dy / m;
      ctx.save(); ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + ux * size * 0.6, y + uy * size * 0.6);
      ctx.lineTo(x - ux * size * 0.6 - uy * size * 0.45, y - uy * size * 0.6 + ux * size * 0.45);
      ctx.lineTo(x - ux * size * 0.6 + uy * size * 0.45, y - uy * size * 0.6 - ux * size * 0.45);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function clearCircle(ctx, x, y, r) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function section(ctx, x, y, s, r, color) {
      clearCircle(ctx, x, y, r + 1);
      ctx.save();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      if (s > 0) { ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, r * 0.25), 0, Math.PI * 2); ctx.fill(); }
      else {
        const k = r * 0.55;
        ctx.beginPath(); ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); ctx.stroke();
      }
      ctx.restore();
    }
    function compass(ctx, x, y, r, bx, by, c, ringColor) {
      clearCircle(ctx, x, y, r + 1);
      ctx.save();
      ctx.strokeStyle = ringColor; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      const m = Math.hypot(bx, by);
      if (m > 0) {
        const ux = bx / m, uy = by / m, w = r * 0.28, l = r * 0.85;
        ctx.fillStyle = c.force; // северный конец — по →B
        ctx.beginPath(); ctx.moveTo(x + ux * l, y + uy * l); ctx.lineTo(x - uy * w, y + ux * w); ctx.lineTo(x + uy * w, y - ux * w); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c.muted;
        ctx.beginPath(); ctx.moveTo(x - ux * l, y - uy * l); ctx.lineTo(x - uy * w, y + ux * w); ctx.lineTo(x + uy * w, y - ux * w); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = c.text;
      ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    function dirWords(bx, by) {
      const m = Math.hypot(bx, by);
      if (!(m > 0)) return '—';
      const ang = (Math.atan2(-by, bx) * 180) / Math.PI; // от оси x, против часовой
      const names = ['вправо →', 'вправо-вверх ↗', 'вверх ↑', 'влево-вверх ↖', 'влево ←', 'влево-вниз ↙', 'вниз ↓', 'вправо-вниз ↘'];
      const idx = ((Math.round(ang / 45) % 8) + 8) % 8;
      return `${names[idx]} (${Math.round(ang)}° от оси x)`;
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      dirBtn.textContent = src === 'magnet' ? 'Перевернуть магнит' : 'Сменить направление тока';
      const { g, segs, marks } = getCache(W, H);

      // виток: контур кольца в перспективе (под линиями)
      if (src === 'loop') {
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(g.xc, g.yc, L.clamp(0.05 * W, 10, 26), g.a, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (src === 'coil') {
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.strokeRect(g.xc - g.len / 2, g.yc - g.a, g.len, 2 * g.a);
        ctx.restore();
      }

      // линии
      ctx.save();
      ctx.strokeStyle = c.fieldB; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
      ctx.stroke();
      ctx.restore();
      for (const [x, y] of marks) { const [bx, by] = bfield(g.fil, x, y); tri(ctx, x, y, bx, by, c.fieldB, 9); }

      // источник
      const big = '700 16px system-ui, sans-serif';
      const N_RIGHT = dir > 0; // для катушки, витка и магнита: →B внутри направлено вправо
      if (src === 'wire') {
        section(ctx, g.xc, g.yc, dir, 10, c.text);
        L.text(ctx, 'I', g.xc + 14, g.yc + 14, c.text, { font: 'italic 15px system-ui, sans-serif' });
      } else if (src === 'loop') {
        section(ctx, g.xc, g.yc - g.a, dir, 9, c.text);
        section(ctx, g.xc, g.yc + g.a, -dir, 9, c.text);
        L.text(ctx, 'I', g.xc + 14, g.yc - g.a - 12, c.text, { font: 'italic 15px system-ui, sans-serif' });
      } else if (src === 'coil') {
        const rr = L.clamp(0.022 * W, 5, 8);
        for (const f of g.fil) section(ctx, f.x, f.y, f.s, rr, c.text);
        const xN = N_RIGHT ? g.xc + g.len / 2 : g.xc - g.len / 2, xS = N_RIGHT ? g.xc - g.len / 2 : g.xc + g.len / 2;
        L.text(ctx, 'N', xN, g.yc - g.a - 20, c.force, { font: big, align: 'center' });
        L.text(ctx, 'S', xS, g.yc - g.a - 20, c.fieldB, { font: big, align: 'center' });
      } else {
        const x0 = g.xc - g.len / 2, y0 = g.yc - g.a, hw = g.len / 2, hh = 2 * g.a;
        ctx.save();
        ctx.fillStyle = N_RIGHT ? c.fieldB : c.force; ctx.fillRect(x0, y0, hw, hh);
        ctx.fillStyle = N_RIGHT ? c.force : c.fieldB; ctx.fillRect(x0 + hw, y0, hw, hh);
        ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, g.len, hh);
        ctx.restore();
        L.text(ctx, N_RIGHT ? 'S' : 'N', x0 + hw / 2, g.yc + 1, c.bg, { font: big, align: 'center' });
        L.text(ctx, N_RIGHT ? 'N' : 'S', x0 + 1.5 * hw, g.yc + 1, c.bg, { font: big, align: 'center' });
      }

      // компасы
      const rc = L.clamp(0.035 * W, 10, 16);
      let spots;
      if (src === 'wire') {
        const R = 0.32 * H;
        spots = [45, 135, 225, 315].map((a) => [g.xc + R * Math.cos((a * Math.PI) / 180), g.yc + R * Math.sin((a * Math.PI) / 180)]);
      } else {
        const half = src === 'loop' ? L.clamp(0.05 * W, 10, 26) : g.len / 2;
        const ex = Math.min(half + 0.1 * W, 0.5 * W - rc - 4);
        spots = [[g.xc, g.yc - 0.4 * H], [g.xc, g.yc + 0.4 * H], [g.xc - ex, g.yc], [g.xc + ex, g.yc]];
      }
      for (const [x, y] of spots) {
        if (g.fil.some((f) => Math.hypot(f.x - x, f.y - y) < rc + 8) || insideMagnet(g, x, y)) continue;
        const [bx, by] = bfield(g.fil, x, y);
        compass(ctx, x, y, rc, bx, by, c, c.muted);
      }
      const px = probe.u * W, py = probe.v * H;
      const [pbx, pby] = bfield(g.fil, px, py);
      const onWire = g.fil.some((f) => Math.hypot(f.x - px, f.y - py) < 6);
      compass(ctx, px, py, rc + 2, onWire ? 0 : pbx, onWire ? 0 : pby, c, c.accent);
      L.text(ctx, 'A', px + rc + 6, py - rc, c.accent, { font: '700 14px system-ui, sans-serif' });

      // вывод
      let cur;
      if (src === 'wire') cur = dir > 0 ? 'ток «на нас» (⊙)' : 'ток «от нас» (⊗)';
      else if (src === 'loop') cur = dir > 0 ? 'вверху сечение ⊙ (на нас), внизу ⊗ (от нас)' : 'вверху сечение ⊗ (от нас), внизу ⊙ (на нас)';
      else if (src === 'coil') cur = (dir > 0 ? 'вверху сечения ⊙, внизу ⊗' : 'вверху сечения ⊗, внизу ⊙') + `; N — ${N_RIGHT ? 'справа' : 'слева'}`;
      else cur = `N — ${N_RIGHT ? 'справа' : 'слева'}, S — ${N_RIGHT ? 'слева' : 'справа'}`;
      let bA = onWire ? '— (точка A на проводнике)' : dirWords(pbx, pby);
      if (insideMagnet(g, px, py)) bA += ' — внутри магнита';
      const rows = [
        ['Источник', NAMES[src]],
        [src === 'magnet' ? 'Полюса' : 'Ток', cur],
        ['Направление →B в точке A', bA],
      ];
      if (src === 'loop' || src === 'coil') rows.push(['→B в центре', N_RIGHT ? 'вправо →' : 'влево ←']);
      rows.push(['Правило', RULES[src]]);
      ro.set(rows);
    }

    let raf = 0;
    function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }
    d.add(() => cancelAnimationFrame(raf));

    // перетаскивание стрелки A
    let dragging = false;
    function localPos(e) {
      const r = C.getBoundingClientRect();
      const kx = r.width > 0 ? cv.width / r.width : 1, ky = r.height > 0 ? cv.height / r.height : 1;
      return [(e.clientX - r.left) * kx, (e.clientY - r.top) * ky];
    }
    function moveTo(e) {
      const [x, y] = localPos(e);
      probe.u = L.clamp(x / cv.width, 0.03, 0.97);
      probe.v = L.clamp(y / cv.height, 0.04, 0.96);
      schedule();
    }
    const onDown = (e) => {
      dragging = true;
      try { C.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
      moveTo(e);
    };
    const onMove = (e) => { if (dragging) moveTo(e); };
    const onUp = (e) => { if (!dragging) return; dragging = false; try { C.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ } };
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

    // клавиатура: стрелки двигают стрелку A (Shift — крупный шаг)
    C.tabIndex = 0;
    C.setAttribute('aria-label', 'Линии магнитной индукции. Стрелки клавиатуры перемещают компас A, Shift — крупный шаг.');
    const onKey = (e) => {
      const k = e.key;
      const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
      if (!dx && !dy) return;
      e.preventDefault();
      const st = e.shiftKey ? 0.05 : 0.01;
      probe.u = L.clamp(probe.u + dx * st, 0.03, 0.97);
      probe.v = L.clamp(probe.v + (dy * st * cv.width) / Math.max(1, cv.height), 0.04, 0.96);
      schedule();
    };
    C.addEventListener('keydown', onKey);
    d.add(() => C.removeEventListener('keydown', onKey));

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
