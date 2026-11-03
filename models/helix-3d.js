// Заряженная частица в однородном поле B, скорость под углом α к B: винтовая линия.
// Система координат рисунка: x — вправо, y — вверх, z — на зрителя; поле направлено по −z (⊗ в виде как в задании).
//
// Масштаб ФИКСИРОВАН и зависит только от сорта частицы, а не от v, B и α:
//   протон и α-частица: 1 ед. рисунка = 5 см, 1 с на экране = 10⁻⁷ с;
//   электрон:           1 ед. рисунка = 50 мкм, 1 с на экране = 10⁻¹⁰ с.
// Поэтому при удвоении v радиус на экране удваивается, а время оборота на экране не меняется.
import * as L from './_lib.js';
import * as D from './_3d.js';

const E_CHARGE = 1.6e-19;
export const PARTICLES = {
  e: { name: 'электрон', q: -E_CHARGE, m: 9.1e-31, U: 5e-5, Ts: 1e-10, r: 0.11, ruler: '100 мкм', tscale: '10⁻¹⁰ с' },
  p: { name: 'протон', q: E_CHARGE, m: 1.673e-27, U: 0.05, Ts: 1e-7, r: 0.14, ruler: '10 см', tscale: '10⁻⁷ с' },
  alpha: { name: 'α-частица', q: 2 * E_CHARGE, m: 4 * 1.66e-27, U: 0.05, Ts: 1e-7, r: 0.18, ruler: '10 см', tscale: '10⁻⁷ с' },
};

/** v — м/с, B — Тл, angle — градусы. Формулы: R = mv⊥/(|q|B), T = 2πm/(|q|B), h = v∥T, F = |q|vB sinα. */
export function helixParams(particle, v, B, angle) {
  const P = PARTICLES[particle];
  const a = L.deg(angle);
  const q = Math.abs(P.q);
  // при 90° и 0° точные значения, чтобы cos 90° не давал остаток порядка 10⁻¹⁷
  const sin = angle === 0 ? 0 : angle === 90 ? 1 : Math.sin(a);
  const cos = angle === 90 ? 0 : angle === 0 ? 1 : Math.cos(a);
  const vPerp = v * sin;
  const vPar = v * cos;
  const R = (P.m * vPerp) / (q * B);
  const T = (2 * Math.PI * P.m) / (q * B);
  return { vPerp, vPar, R, T, h: vPar * T, F: q * v * B * sin, sign: Math.sign(P.q) };
}

const fmtLen = (m) => {
  if (m === 0) return '0';
  if (m >= 1) return `${L.fmt(m, 2)} м`;
  if (m >= 0.01) return `${L.fmt(m * 100, 1)} см`;
  if (m >= 1e-3) return `${L.fmt(m * 1000, 2)} мм`;
  return `${L.fmt(m * 1e6, 1)} мкм`;
};

const DEF = { v: 1, B: 0.2, angle: 60, particle: 'p', ghost: false };
const Z0 = 4.6;          // старт по z
const Z_LEN = 9.4;       // длина пути вдоль поля на рисунке
const Y_START = 1.6;     // старт смещён от оси рисунка, чтобы окружность была в кадре
const R_FIT = 3.2;       // наибольший радиус, который помещается в кадр
const MAX_TURNS = 8;
const F_UNIT = 3e-14;    // Н на единицу рисунка (условно)

export default {
  id: 'helix-3d',
  title: 'Частица в магнитном поле: винтовая линия',
  codes: ['3.3.4'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'Масштаб рисунка постоянный: у протона и α-частицы чёрный отрезок всегда 10 см. Включите второй след: при вдвое большей скорости радиус и шаг вдвое больше, а обороты обе частицы заканчивают одновременно.',
    });
    const hint = document.createElement('p');
    hint.className = 'model-caption';
    hint.setAttribute('aria-live', 'polite');
    ui.controls.before(hint);

    let S = null;
    const sV = L.slider(ui.controls, { key: 'v', label: 'Скорость v', min: 0.5, max: 2, step: 0.1, value: DEF.v, unit: '·10⁶ м/с', onInput: sync });
    const sB = L.slider(ui.controls, { key: 'B', label: 'Индукция B', min: 0.1, max: 0.4, step: 0.01, value: DEF.B, unit: 'Тл', onInput: sync });
    const sA = L.slider(ui.controls, { key: 'angle', label: 'Угол α между v и B', min: 0, max: 90, step: 5, value: DEF.angle, unit: '°', onInput: sync });
    const cP = L.choice(ui.controls, {
      key: 'particle', label: 'Частица', value: DEF.particle,
      options: [{ value: 'e', label: 'электрон' }, { value: 'p', label: 'протон' }, { value: 'alpha', label: 'α-частица' }],
      onChange: sync,
    });
    const cG = L.checkbox(ui.controls, { key: 'ghost', label: 'Второй след: скорость 2v', checked: DEF.ghost, onChange: sync });
    const bPlay = L.button(ui.controls, 'Пауза', () => S?.toggle());
    bPlay.classList.add('model-btn--play');
    L.button(ui.controls, 'Сброс', () => {
      sV.set(DEF.v); sB.set(DEF.B); sA.set(DEF.angle); cP.set(DEF.particle); cG.set(DEF.ghost);
      S?.resetView();
      sync();
      S?.restart();
    }, { reset: true });
    const ro = L.readout(ui.readout);
    if (L.prefersReducedMotion()) bPlay.textContent = 'Пуск';

    const state = () => ({ v: sV.value * 1e6, B: sB.value, angle: sA.value, particle: cP.value, ghost: cG.value });

    function sync() {
      const st = state();
      const P = PARTICLES[st.particle];
      const a = helixParams(st.particle, st.v, st.B, st.angle);
      const g = helixParams(st.particle, 2 * st.v, st.B, st.angle);
      const rows = [
        ['R', fmtLen(a.R)],
        ['T', `${L.fmt(a.T)} с`],
        ['h = v<sub>∥</sub>T', fmtLen(a.h)],
        ['F<sub>Л</sub>', `${L.fmt(a.F)} Н`],
      ];
      if (st.ghost) rows.push(['При 2v', `R = ${fmtLen(g.R)}, h = ${fmtLen(g.h)}, T то же`]);
      rows.push(['Масштаб', `отрезок = ${P.ruler}; 1 с на экране = ${P.tscale}`]);
      ro.set(rows);

      const notes = [];
      if (st.angle === 90) notes.push('α = 90°: v<sub>∥</sub> = 0, шаг равен нулю, след — окружность.');
      else if (st.angle === 0) notes.push('α = 0°: скорость вдоль поля, F<sub>Л</sub> = 0, частица летит по прямой.');
      else notes.push('Вдоль B частица движется равномерно (v<sub>∥</sub> не меняется), поперёк B — по окружности (F<sub>Л</sub> перпендикулярна v).');
      if (st.particle === 'e') notes.push('<b>Электрон показан в другом масштабе:</b> рисунок увеличен в 1000 раз, время замедлено ещё в 1000 раз. На одном масштабе с протоном его окружность не была бы видна: при тех же v и B она меньше примерно в 1840 раз. Заряд отрицательный, поэтому вращение в другую сторону.');
      const maxR = (st.ghost ? g.R : a.R) / P.U;
      if (maxR > R_FIT) notes.push('<b>След выходит за рисунок:</b> масштаб не подстраивается специально. Уменьшите v или увеличьте B.');
      hint.innerHTML = notes.join(' ');
      S?.rebuild(st);
    }
    sync();

    D.stage(ui.stage, {
      camera: [10, 5, 15],
      examView: { position: [0, 0, 19.5], up: [0, 1, 0] },
      controls: ui.controls,
      fov: 28,                // малая перспектива: размеры в глубине почти не искажаются
    }).then((s) => {
      if (!s) return;
      if (dead) { s.destroy(); return; }
      d.add(s.destroy);
      S = buildScene(s, d, bPlay);
      sync();
      S.restart();
    });

    return { destroy: d.run };
  },
};

function buildScene(s, d, bPlay) {
  const { THREE, scene, camera, orbit } = s;
  const c = () => L.colors();
  const colB = () => c().fieldB;
  const colV = () => c().velocity;
  const colF = () => c().force;
  const colT = () => c().text;
  const colM = () => c().muted;

  const basics = [];
  const basic = (fn, opts = {}) => {
    const m = new THREE.MeshBasicMaterial(opts);
    m.color.set(fn());
    basics.push([m, fn]);
    return m;
  };
  d.add(L.onThemeChange(() => { basics.forEach(([m, fn]) => m.color.set(fn())); s.requestRender(); }));

  // В виде как в задании всё сплющивается на плоскость рисунка: винтовая линия становится окружностью.
  const world = new THREE.Group();
  scene.add(world);

  /* ---------- поле: стрелки в свободном виде и значки ⊗ в виде как в задании ---------- */
  const fieldArrows = [[0, 3.75], [0, -3.75], [-4, -1.2]].map(([x, y]) => s.arrow([x, y, 5], [0, 0, -1], 10, colB));
  const R0 = 0.16;
  const gFill = new THREE.CircleGeometry(R0, 22);
  const gRing = new THREE.RingGeometry(R0 * 0.8, R0, 22);
  const gBar = new THREE.PlaneGeometry(R0 * 1.45, R0 * 0.2);
  const mFill = basic(() => c().surface);
  const mSym = basic(colB);
  const grid = new THREE.Group();
  for (let x = -6; x <= 6; x += 2) for (let y = -4; y <= 4; y += 2) {
    const g = new THREE.Group();
    g.position.set(x, y, -0.3);
    const f = new THREE.Mesh(gFill, mFill);
    const r = new THREE.Mesh(gRing, mSym); r.position.z = 0.002;
    const a = new THREE.Mesh(gBar, mSym); a.rotation.z = Math.PI / 4; a.position.z = 0.004;
    const b = new THREE.Mesh(gBar, mSym); b.rotation.z = -Math.PI / 4; b.position.z = 0.006;
    g.add(f, r, a, b);
    grid.add(g);
  }
  scene.add(grid);

  /* ---------- следы и частицы ---------- */
  const trail = s.tube([[0, 0, 0], [0, 0, 1]], colT, 0.035);
  const trail2 = s.tube([[0, 0, 0], [0, 0, 1]], colM, 0.03);
  world.add(trail.obj, trail2.obj);
  const axis = s.line([[0, 0, 5], [0, 0, -5]], colM, { dashed: true });
  world.add(axis.obj);

  const gSphere = new THREE.SphereGeometry(1, 20, 14);
  const dot1 = new THREE.Mesh(gSphere, basic(colT));
  const dot2 = new THREE.Mesh(gSphere, basic(colM));
  world.add(dot1, dot2);

  /* ---------- векторы у частицы ---------- */
  const aV = s.arrow([0, 0, 0], [1, 0, 0], 1, colV);
  const aPar = s.arrow([0, 0, 0], [0, 0, -1], 1, colV);
  const aPerp = s.arrow([0, 0, 0], [1, 0, 0], 1, colV);
  const aF = s.arrow([0, 0, 0], [0, 1, 0], 1, colF);
  const aV2 = s.arrow([0, 0, 0], [1, 0, 0], 1, colV);
  [aV, aPar, aPerp, aF, aV2].forEach((a) => world.add(a.group));

  // дуга угла α: строится в плоскости x–(−z) и поворачивается вокруг оси z вместе с v⊥
  const arc = s.line([[0, 0, 0], [0, 0, 0]], colT);
  world.add(arc.obj);

  /* ---------- линейка ---------- */
  const ruler = s.tube([[0, -3.6, 0], [0, -1.6, 0]], colT, 0.025);
  world.add(ruler.obj);
  const tickG = new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8);
  tickG.rotateZ(Math.PI / 2);
  const tickM = basic(colT);
  const tickA = new THREE.Mesh(tickG, tickM); tickA.position.set(0, -3.6, 0);
  const tickB = new THREE.Mesh(tickG, tickM); tickB.position.set(0, -1.6, 0);
  ruler.obj.add(tickA, tickB);

  /* ---------- подписи ---------- */
  const SIZE = 0.6;
  const lab = (t, col) => { const sp = s.label(t, [0, 0, 0], col, SIZE); sp.visible = false; return sp; };
  const L_B = lab('→B', colB);
  const L_V = lab('→v', colV);
  const L_PAR = lab('→v_∥', colV);
  const L_PERP = lab('→v_⊥', colV);
  const L_F = lab('→F_Л', colF);
  const L_A = lab('α', colT);
  const L_G = lab('2v', colM);
  const rulerLabels = { '10 см': lab('10 см', colT), '100 мкм': lab('100 мкм', colT) };

  const isExam = () => camera.position.clone().sub(orbit.target).normalize().z > 0.998;

  let st = null;
  let P = null;
  let main = null;      // { Ru, w, vz, y0, sgn, vU, vParU, vPerpU, Fu }
  let ghost = null;
  let t = 0;            // экранное время, с
  let dur = 1;
  let looped = false;
  let flat = false;

  const toScreen = (par, v, particle) => {
    const Pp = PARTICLES[particle];
    const sgn = par.sign;
    const y0 = -sgn * Y_START;
    return {
      Ru: par.R / Pp.U,
      w: (2 * Math.PI * Pp.Ts) / par.T,        // рад за экранную секунду
      vz: (par.vPar * Pp.Ts) / Pp.U,           // ед. за экранную секунду
      y0, sgn,
      vU: 0.7 * v / 1e6,                       // стрелки скорости: 0,7 ед. на 10⁶ м/с
      vParU: 0.7 * par.vPar / 1e6,
      vPerpU: 0.7 * par.vPerp / 1e6,
      Fu: Math.min(3, par.F / F_UNIT),
    };
  };

  const pos = (m, tau) => [
    m.Ru * Math.sin(m.w * tau),
    m.y0 + m.sgn * m.Ru * (1 - Math.cos(m.w * tau)),
    Z0 - m.vz * tau,
  ];

  function revealTube(tube, frac) {
    const g = tube.obj.geometry;
    if (!g.index) return;
    const n = Math.floor((g.index.count * L.clamp(frac, 0, 1)) / 48) * 48;
    g.setDrawRange(0, n);
  }

  function rebuild(next) {
    st = next;
    P = PARTICLES[st.particle];
    main = toScreen(helixParams(st.particle, st.v, st.B, st.angle), st.v, st.particle);
    ghost = st.ghost ? toScreen(helixParams(st.particle, 2 * st.v, st.B, st.angle), 2 * st.v, st.particle) : null;

    const Tscreen = (2 * Math.PI) / main.w;
    const vzMax = ghost ? ghost.vz : main.vz;
    looped = vzMax < 1e-9;
    dur = looped ? Tscreen : Math.min(Z_LEN / vzMax, MAX_TURNS * Tscreen);
    if (t > dur) t = 0;

    const turns = dur / Tscreen;
    const N = Math.max(32, Math.ceil(turns * 48));
    const sample = (m) => {
      const pts = [];
      for (let i = 0; i <= N; i++) pts.push(pos(m, (dur * i) / N));
      return pts;
    };
    trail.setPoints(sample(main));
    trail2.obj.visible = !!ghost;
    dot2.visible = !!ghost;
    aV2.setVisible(!!ghost);
    if (ghost) trail2.setPoints(sample(ghost));

    const axisY = main.y0 + main.sgn * main.Ru;
    axis.setPoints([[0, axisY, 5], [0, axisY, -5]]);

    dot1.scale.setScalar(P.r);
    dot2.scale.setScalar(P.r);

    // дуга α: от направления поля (−z) к v⊥ (x)
    const rad = 0.55;
    const al = L.deg(st.angle);
    const pts = [];
    for (let i = 0; i <= 16; i++) { const th = (al * i) / 16; pts.push([rad * Math.sin(th), 0, -rad * Math.cos(th)]); }
    arc.setPoints(pts);

    Object.values(rulerLabels).forEach((sp) => { sp.visible = false; });
    render();
  }

  function render() {
    if (!st) return;
    flat = isExam();
    world.scale.z = flat ? 0.001 : 1;
    grid.visible = flat;
    fieldArrows.forEach((a) => a.setVisible(!flat));
    // в свободном виде линейка на глубине оси, чтобы перспектива не искажала её длину
    ruler.obj.position.set(flat ? -5.2 : 0, flat ? 0 : 4.6, flat ? 0 : 4.6);
    const rl = rulerLabels[P.ruler];
    rl.visible = true;
    rl.position.set(flat ? -5.2 : 0, flat ? -4.05 : 3.42, flat ? 0 : 4.6);
    L_B.visible = true;
    if (flat) L_B.position.set(5, 3, 0); else L_B.position.set(0, 3.2, -5);

    const p = pos(main, t);
    const ph = main.w * t;
    const sgn = main.sgn;
    const perp = [Math.cos(ph), sgn * Math.sin(ph), 0];
    const par = [0, 0, -1];
    const vp = [main.vPerpU * perp[0], main.vPerpU * perp[1], -main.vParU];
    const fdir = [-Math.sin(ph), sgn * Math.cos(ph), 0];
    const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
    // Подписи — дочерние объекты сцены, а не world: в плоском виде z сводится к нулю вручную.
    const onScreen = (q) => (flat ? [q[0], q[1], 0] : q);

    dot1.position.set(...p);
    const frac = t / dur;
    const shown = looped && seenLoop ? 1 : frac;
    revealTube(trail, shown);
    if (ghost) revealTube(trail2, shown);

    aPerp.set(p, perp, main.vPerpU);
    aPar.set(p, par, main.vParU);
    aV.set(p, vp, main.vU);
    aF.set(p, fdir, main.Fu);
    // В плоском виде v и v∥ не показываем: v∥ смотрит от нас, а на плоскости остаётся только v⊥.
    if (flat) { aPar.setVisible(false); aV.setVisible(false); }

    const hasPerp = main.vPerpU > 1e-6;
    const hasPar = main.vParU > 1e-6;
    L_PERP.visible = hasPerp && hasPar;
    if (L_PERP.visible) L_PERP.position.set(...onScreen(add(p, perp, main.vPerpU + 0.4)));
    L_PAR.visible = !flat && hasPerp && hasPar;
    if (L_PAR.visible) L_PAR.position.set(...add(p, par, main.vParU + 0.45));
    L_V.visible = !flat || !hasPar;
    if (L_V.visible) {
      const u = main.vU || 1;
      L_V.position.set(...onScreen(add(p, vp, (u + 0.42) / u)));
    }
    if (flat && !hasPerp) L_V.visible = false;
    L_F.visible = main.Fu > 1e-6;
    if (L_F.visible) L_F.position.set(...onScreen(add(p, fdir, main.Fu + 0.45)));

    arc.obj.visible = !flat && hasPerp && hasPar;
    L_A.visible = arc.obj.visible;
    if (arc.obj.visible) {
      arc.obj.position.set(...p);
      arc.obj.rotation.z = sgn * ph;
      const mid = L.deg(st.angle) / 2;
      L_A.position.set(...add(add(p, perp, 0.95 * Math.sin(mid)), par, 0.95 * Math.cos(mid)));
    }

    if (ghost) {
      const g = pos(ghost, t);
      dot2.position.set(...g);
      const gph = ghost.w * t;
      const gp = [ghost.vPerpU * Math.cos(gph), sgn * ghost.vPerpU * Math.sin(gph), -ghost.vParU];
      aV2.set(g, gp, ghost.vU);
      L_G.visible = true;
      L_G.position.set(...onScreen([g[0] + 0.1, g[1] - sgn * 0.5, g[2]]));
    } else {
      L_G.visible = false;
    }
    s.requestRender();
  }

  let seenLoop = false;
  s.onFrame((dt) => {
    if (!st) return;
    t += dt;
    if (t >= dur) {
      if (looped) { seenLoop = true; t %= dur; } else { t = 0; }
    }
    render();
  });

  orbit.addEventListener('change', () => { if (st && isExam() !== flat) render(); });

  const syncBtn = () => { bPlay.textContent = s.running ? 'Пауза' : 'Пуск'; bPlay.setAttribute('aria-pressed', String(s.running)); };
  syncBtn();

  return {
    rebuild(next) { seenLoop = false; rebuild(next); },
    resetView() { s.resetView(); },
    toggle() { if (s.running) s.pause(); else s.play(); syncBtn(); render(); },
    restart() {
      // Без анимации показываем уже прочерченный след: картинка понятна и без движения.
      t = s.running ? 0 : dur * 0.8;
      seenLoop = false;
      render();
    },
  };
}
