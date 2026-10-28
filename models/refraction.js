// Модель «Преломление и полное внутреннее отражение» (коды 3.6.2, 3.6.4, 3.6.5).
// Формулы (CLAUDE.md, B4): n₁ sin α = n₂ sin β; n = c/v; n_отн = n₂/n₁; sin α_пр = n₂/n₁ (n₁ > n₂).
import * as L from './_lib.js';

const MEDIA = [
  { value: 'air', label: 'воздух (1,0)', n: 1.0, name: 'воздух' },
  { value: 'water', label: 'вода (1,33)', n: 1.33, name: 'вода' },
  { value: 'glass', label: 'стекло (1,5)', n: 1.5, name: 'стекло' },
  { value: 'diamond', label: 'алмаз (2,42)', n: 2.42, name: 'алмаз' },
];
const C_LIGHT = 3e8; // м/с (B0)
const RAD2DEG = 180 / Math.PI;
const DEFAULTS = { m1: 'air', m2: 'glass', alpha: 40 };

/** Физика границы: углы в градусах. */
function physics(n1, n2, aDeg) {
  const a = aDeg / RAD2DEG;
  const s = (n1 * Math.sin(a)) / n2; // sin β
  const crit = n1 > n2 ? Math.asin(n2 / n1) * RAD2DEG : null;
  const tir = n1 > n2 && s >= 1; // α ≥ α_пр
  const beta = tir ? null : Math.asin(Math.min(1, s)) * RAD2DEG;
  return { beta, crit, tir };
}

/** Доля отражённой энергии (Френель, неполяризованный свет) — только для яркости луча. */
function reflectance(n1, n2, aDeg, bDeg, tir) {
  if (tir || bDeg === null) return 1;
  const ci = Math.cos(aDeg / RAD2DEG), ct = Math.cos(bDeg / RAD2DEG);
  const ds = n1 * ci + n2 * ct, dp = n2 * ci + n1 * ct;
  if (ds < 1e-9 || dp < 1e-9) return 1;
  const rs = (n1 * ci - n2 * ct) / ds, rp = (n2 * ci - n1 * ct) / dp;
  return (rs * rs + rp * rp) / 2;
}

/** Дуга угла между направлениями a и b (радианы, углы canvas) с подписью. */
function arcBetween(ctx, x, y, r, a, b, color, label, font) {
  let diff = b - a;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff <= -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) < 0.004) return;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.3; ctx.setLineDash([]);
  ctx.beginPath(); ctx.arc(x, y, r, a, a + diff, diff < 0); ctx.stroke();
  ctx.restore();
  if (label) {
    const m = a + diff / 2;
    L.text(ctx, label, x + Math.cos(m) * (r + 11), y + Math.sin(m) * (r + 11), color, { font, align: 'center' });
  }
}

/** Отрезок-луч со стрелкой направления посередине. */
function ray(ctx, x1, y1, x2, y2, color, width = 2.2) {
  const mx = x1 + (x2 - x1) * 0.55, my = y1 + (y2 - y1) * 0.55;
  L.arrow(ctx, x1, y1, mx, my, color, { width, head: 10 });
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.restore();
}

/** Перетаскивание указателем (мышь/палец). */
function pointerDrag(cnv, d, { hit, move }) {
  let active = null, pid = null;
  const pos = (e) => { const r = cnv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const onDown = (e) => {
    const [x, y] = pos(e);
    const h = hit(x, y);
    if (h == null) return;
    active = h; pid = e.pointerId;
    try { cnv.setPointerCapture(pid); } catch (err) { /* нет захвата — не страшно */ }
    e.preventDefault();
    move(active, x, y);
  };
  const onMove = (e) => {
    const [x, y] = pos(e);
    if (active == null) { cnv.style.cursor = hit(x, y) != null ? 'grab' : ''; return; }
    e.preventDefault();
    move(active, x, y);
  };
  const onUp = () => {
    if (active == null) return;
    active = null;
    try { cnv.releasePointerCapture(pid); } catch (err) { /* уже отпущен */ }
  };
  cnv.style.touchAction = 'none';
  cnv.addEventListener('pointerdown', onDown);
  cnv.addEventListener('pointermove', onMove);
  cnv.addEventListener('pointerup', onUp);
  cnv.addEventListener('pointercancel', onUp);
  d.add(() => {
    cnv.removeEventListener('pointerdown', onDown);
    cnv.removeEventListener('pointermove', onMove);
    cnv.removeEventListener('pointerup', onUp);
    cnv.removeEventListener('pointercancel', onUp);
  });
}

export default {
  id: 'refraction',
  title: 'Преломление света и полное внутреннее отражение',
  codes: ['3.6.2', '3.6.4', '3.6.5'],
  mount(el /* , { theme } */) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Перетащите источник S (или двигайте слайдер α). Углы отсчитываются от нормали (штрих). Яркость отражённого луча показана качественно.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.72, minHeight: 230, label: 'Луч света на границе двух сред' });
    d.add(cv.destroy);

    const opts = MEDIA.map((m) => ({ value: m.value, label: m.label }));
    const ch1 = L.choice(ui.controls, { label: 'Среда 1 (сверху), n₁', options: opts, value: DEFAULTS.m1, onChange: draw });
    const ch2 = L.choice(ui.controls, { label: 'Среда 2 (снизу), n₂', options: opts, value: DEFAULTS.m2, onChange: draw });
    const sA = L.slider(ui.controls, { label: 'Угол падения α', min: 0, max: 90, step: 1, value: DEFAULTS.alpha, unit: '°', onInput: draw });
    L.button(ui.controls, 'Сброс', () => {
      ch1.set(DEFAULTS.m1); ch2.set(DEFAULTS.m2); sA.set(DEFAULTS.alpha); draw();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    const medium = (v) => MEDIA.find((m) => m.value === v) || MEDIA[0];

    function geom() {
      const W = cv.width, H = cv.height;
      return { W, H, ox: W / 2, oy: H / 2, R: Math.min(W * 0.44, H * 0.44) };
    }

    function draw() {
      const { ctx } = cv;
      const { W, H, ox, oy, R } = geom();
      const c = L.colors();
      const fs = Math.round(L.clamp(W / 38, 11, 14));
      const font = `${fs}px system-ui, sans-serif`;
      const fontI = `italic ${fs + 1}px system-ui, sans-serif`;
      const m1 = medium(ch1.value), m2 = medium(ch2.value);
      const n1 = m1.n, n2 = m2.n;
      const aDeg = sA.value;
      const { beta, crit, tir } = physics(n1, n2, aDeg);
      const a = aDeg / RAD2DEG;

      ctx.clearRect(0, 0, W, H);
      // среды
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, oy);
      ctx.fillStyle = c.surface; ctx.fillRect(0, oy, W, H - oy);
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(W, oy); ctx.stroke();
      ctx.restore();
      L.text(ctx, `n_1 = ${L.fmt(n1)} (${m1.name})`, 8, 14, c.muted, { font });
      L.text(ctx, `n_2 = ${L.fmt(n2)} (${m2.name})`, 8, H - 14, c.muted, { font });

      // нормаль
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(ox, oy - R - 8); ctx.lineTo(ox, oy + R + 8); ctx.stroke();
      ctx.restore();

      // предельный угол
      if (crit !== null) {
        const cr = crit / RAD2DEG;
        const px = ox - R * 0.9 * Math.sin(cr), py = oy - R * 0.9 * Math.cos(cr);
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(px, py); ctx.stroke();
        ctx.restore();
        L.text(ctx, 'α_{пр}', px - 4, py - 8, c.muted, { font, align: 'right' });
      }

      // лучи
      const sx = ox - R * Math.sin(a), sy = oy - R * Math.cos(a);
      const rx = ox + R * Math.sin(a), ry = oy - R * Math.cos(a);
      ray(ctx, sx, sy, ox, oy, c.accent);
      const refl = reflectance(n1, n2, aDeg, beta, tir);
      ctx.save();
      ctx.globalAlpha = 0.25 + 0.75 * Math.sqrt(refl);
      ray(ctx, ox, oy, rx, ry, c.accent, tir ? 2.6 : 1.8);
      ctx.restore();
      if (!tir) {
        const b = beta / RAD2DEG;
        const tx = ox + R * Math.sin(b), ty = oy + R * Math.cos(b);
        ray(ctx, ox, oy, tx, ty, c.accent);
      }

      // дуги углов
      const ra = Math.max(26, R * 0.26);
      arcBetween(ctx, ox, oy, ra, -Math.PI / 2, -Math.PI / 2 - a, c.text, 'α', fontI);
      arcBetween(ctx, ox, oy, ra * 0.8, -Math.PI / 2, -Math.PI / 2 + a, c.muted, 'γ', fontI);
      if (!tir) arcBetween(ctx, ox, oy, ra, Math.PI / 2, Math.PI / 2 - beta / RAD2DEG, c.text, 'β', fontI);

      // источник
      L.dot(ctx, sx, sy, c.accent, 6);
      ctx.save(); ctx.strokeStyle = c.bg; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      L.text(ctx, 'S', sx - 10, sy - 10, c.text, { font: fontI, align: 'right' });
      L.dot(ctx, ox, oy, c.text, 2.5);

      if (tir) {
        L.text(ctx, 'полное внутреннее отражение', W / 2, oy + R * 0.5, c.force, { font: `600 ${fs}px system-ui, sans-serif`, align: 'center' });
      }

      ro.set([
        ['Угол падения α', L.fmt(aDeg, 1) + '°'],
        ['Угол преломления β', tir ? '— (ПВО, преломлённого луча нет)' : L.fmt(beta, 1) + '°'],
        ['Угол отражения γ = α', L.fmt(aDeg, 1) + '°'],
        ['n<sub>отн</sub> = n₂/n₁', L.fmt(n2 / n1, 3)],
        ['Предельный угол α<sub>пр</sub>', crit !== null ? L.fmt(crit, 1) + '°' : 'нет (n₂ ≥ n₁)'],
        ['v₁ = c/n₁', L.fmt(C_LIGHT / n1) + ' м/с'],
        ['v₂ = c/n₂', L.fmt(C_LIGHT / n2) + ' м/с'],
        ['Явление', tir ? 'полное внутреннее отражение' : 'отражение и преломление'],
      ]);
    }

    pointerDrag(cv.canvas, d, {
      hit: (x, y) => (y < geom().oy - 2 ? 'S' : null),
      move: (_h, x, y) => {
        const { ox, oy } = geom();
        const dx = Math.abs(x - ox), dy = oy - y;
        const aDeg = dy <= 0 ? 90 : Math.atan2(dx, dy) * RAD2DEG;
        sA.set(Math.round(L.clamp(aDeg, 0, 90)));
        draw();
      },
    });

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    draw();
    return { destroy: d.run };
  },
};
