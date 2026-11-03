// Линии магнитной индукции прямого провода, витка и катушки в 3D, срез с ⊙ ⊗ в виде как в задании.
// Система координат рисунка: x — вправо, y — вверх, z — на зрителя. Плоскость среза: z = 0.
// Провод идёт вдоль z. Виток и катушка соосны с x, при dir = '+' поле внутри направлено по +x.
//
// Провод: окружности с B ∝ I/r. Равный поток между соседними линиями даёт радиусы r_k = r₀·exp(k·Δ), Δ ∝ 1/I.
// Виток и катушка: форма линий считается численно, дискретным суммированием Био — Савара.
// Формулы для этого на сайте нет, абсолютное значение B не выводится, используется только направление поля.
import * as L from './_lib.js';
import * as D from './_3d.js';

const LOOP_A = 1.6;
const COIL_A = 1.15;
const COIL_HALF = 1.8;
const COIL_TURNS = 8;     // сколько витков нарисовано
const COIL_RINGS = 16;    // сколько колец в расчёте поля: так линии внутри катушки не «дрожат» между витками
const HALF_SEGS = 36;
const X_MAX = 5.1;
const RHO_MAX = 3.6;

/** Радиусы окружностей вокруг провода при токе I: равный поток между соседними линиями. */
export function wireRadii(I, r0 = 0.6, rMax = 3.6) {
  const delta = 1 / (0.7 * I);
  const out = [];
  for (let r = r0; r <= rMax + 1e-9; r *= Math.exp(delta)) out.push(r);
  return out;
}

/** Число линий на половину плоскости среза у витка и катушки. */
export const linesCount = (I) => 1 + Math.ceil(I / 2);

const ringsFor = (src) => {
  if (src === 'loop') return [{ x: 0, a: LOOP_A }];
  const out = [];
  for (let i = 0; i < COIL_RINGS; i++) out.push({ x: -COIL_HALF + (2 * COIL_HALF * i) / (COIL_RINGS - 1), a: COIL_A });
  return out;
};

/** Дискретный закон Био — Савара в плоскости z = 0. Коэффициент опущен: нужна только форма линий. */
export function fieldAt(rings, x, rho) {
  let bx = 0, by = 0;
  const dth = Math.PI / HALF_SEGS;
  for (const r of rings) {
    for (let k = 0; k < HALF_SEGS; k++) {
      const th = (k + 0.5) * dth;       // половина кольца, вторая половина даёт те же Bx, By (Bz сокращается)
      const cy = r.a * Math.cos(th), cz = r.a * Math.sin(th);
      const lx = 0, ly = -r.a * Math.sin(th) * dth, lz = r.a * Math.cos(th) * dth;   // ток: от y к z, поле внутри по +x
      const rx = x - r.x, ry = rho - cy, rz = -cz;
      const d2 = rx * rx + ry * ry + rz * rz;
      const inv = 1 / (d2 * Math.sqrt(d2));
      bx += 2 * (ly * rz - lz * ry) * inv;
      by += 2 * (lz * rx - lx * rz) * inv;
    }
  }
  return [bx, by];
}

/** Линия поля из точки (0, rho0) плоскости симметрии. Возвращает точки [x, rho] вдоль направления B. */
export function traceLine(rings, rho0) {
  const ds = 0.05;
  const pts = [[0, rho0]];
  let x = 0, y = rho0;
  const dir = (a, b) => { const [u, v] = fieldAt(rings, a, b); const n = Math.hypot(u, v) || 1; return [u / n, v / n]; };
  for (let i = 0; i < 900; i++) {
    const [u1, v1] = dir(x, y);
    const [u2, v2] = dir(x + (u1 * ds) / 2, y + (v1 * ds) / 2);
    x += u2 * ds; y += v2 * ds;
    if (x < 0) {                         // линия вернулась в плоскость симметрии: половина замкнутой линии готова
      pts.push([0, y]);
      break;
    }
    if (y < 0.001) y = 0.001;
    pts.push([x, y]);
    if (x > X_MAX || y > RHO_MAX) break;
  }
  const mirrored = pts.slice(1).reverse().map(([a, b]) => [-a, b]);
  return [...mirrored, ...pts];
}

const SRC_NAME = { wire: 'прямой провод', loop: 'виток', coil: 'катушка' };
const DEF = { source: 'wire', dir: '+', I: 5 };

export default {
  id: 'magnetic-field-3d',
  title: 'Магнитное поле провода, витка и катушки',
  codes: ['3.3.2'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'Форма линий поля показана качественно. Светлая плоскость на рисунке — срез: кнопка «Вид как в задании» показывает картину именно в этой плоскости. Там ток виден как ⊙ (на нас) и ⊗ (от нас).',
    });
    const hint = document.createElement('p');
    hint.className = 'model-caption';
    hint.setAttribute('aria-live', 'polite');
    ui.controls.before(hint);

    let S = null;
    const cSrc = L.choice(ui.controls, {
      key: 'source', label: 'Источник поля', value: DEF.source,
      options: [{ value: 'wire', label: 'прямой провод' }, { value: 'loop', label: 'виток' }, { value: 'coil', label: 'катушка' }],
      onChange: sync,
    });
    const cDir = L.choice(ui.controls, {
      key: 'dir', label: 'Направление тока', value: DEF.dir,
      options: [{ value: '+', label: 'прямое' }, { value: '-', label: 'обратное' }],
      onChange: sync,
    });
    const sI = L.slider(ui.controls, { key: 'I', label: 'Сила тока I', min: 1, max: 10, step: 1, value: DEF.I, unit: 'А', onInput: sync });
    L.button(ui.controls, 'Сброс', () => {
      cSrc.set(DEF.source); cDir.set(DEF.dir); sI.set(DEF.I);
      S?.resetView();
      sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function sync() {
      const src = cSrc.value;
      const plus = cDir.value === '+';
      const I = sI.value;
      const rows = [['Источник', SRC_NAME[src]], ['Сила тока', `${L.fmt(I)} А`]];
      if (src === 'wire') {
        hint.innerHTML = `<b>Правило буравчика.</b> Буравчик ввинчиваем по току (ток ${plus ? 'на нас ⊙' : 'от нас ⊗'}). Рукоятка вращается так, как идут линии B: <b>${plus ? 'против часовой стрелки' : 'по часовой стрелке'}</b>. Чем дальше от провода, тем реже линии: B ∝ I/r.`;
        rows.push(['Линии B', plus ? 'против часовой' : 'по часовой']);
        rows.push(['B на расстоянии 2r', 'вдвое меньше, чем на r']);
        rows.push(['B в сравнении с током 1 А', I === 1 ? 'столько же' : `в ${L.fmt(I)} раз больше`]);
        rows.push(['Линий на срезе', String(wireRadii(I).length)]);
      } else if (src === 'loop') {
        hint.innerHTML = `<b>Правило буравчика.</b> Рукоятку вращаем по току в витке. Поступательное движение буравчика показывает B в центре витка: <b>${plus ? 'вправо' : 'влево'}</b>. На срезе виток виден как два значка: сверху ${plus ? '⊙' : '⊗'}, снизу ${plus ? '⊗' : '⊙'}.`;
        rows.push(['B в центре', plus ? 'вправо' : 'влево']);
        rows.push(['На срезе', `сверху ${plus ? '⊙' : '⊗'}, снизу ${plus ? '⊗' : '⊙'}`]);
        rows.push(['Линий на срезе', String(2 * linesCount(I) + 1)]);
      } else {
        hint.innerHTML = `<b>Правая рука.</b> Четыре пальца обхватывают катушку по току в витках. Отогнутый большой палец показывает B внутри катушки: <b>${plus ? 'вправо' : 'влево'}</b>. На срезе каждый виток даёт пару значков: верхний ряд ${plus ? '⊙' : '⊗'}, нижний ${plus ? '⊗' : '⊙'}.`;
        rows.push(['B внутри', plus ? 'вправо' : 'влево']);
        rows.push(['На срезе', `верхний ряд ${plus ? '⊙' : '⊗'}, нижний ${plus ? '⊗' : '⊙'}`]);
        rows.push(['Линий на срезе', String(2 * linesCount(I) + 1)]);
      }
      ro.set(rows);
      S?.update({ src, plus, I });
    }
    sync();

    D.stage(ui.stage, {
      camera: [7.2, 4.6, 8.6],
      examView: { position: [0, 0, 13], up: [0, 1, 0] },
      controls: ui.controls,
      autoplay: false,
    }).then((s) => {
      if (!s) return;
      if (dead) { s.destroy(); return; }
      d.add(s.destroy);
      S = buildScene(s, d);
      sync();
    });

    return { destroy: d.run };
  },
};

function buildScene(s, d) {
  const { THREE, scene, camera, orbit } = s;
  const c = () => L.colors();
  const colI = () => c().accent;
  const colB = () => c().fieldB;

  const basics = [];
  const basic = (fn, opts = {}) => {
    const m = new THREE.MeshBasicMaterial(opts);
    m.color.set(fn());
    basics.push([m, fn]);
    return m;
  };

  // Цвет линий зависит от тока: при малом токе бледнее (смешан с фоном), при большом — полный цвет поля.
  let curI = DEF.I;
  const lineColor = () => {
    const k = 0.45 * (1 - curI / 10);
    return `#${new THREE.Color(c().fieldB).lerp(new THREE.Color(c().surface), k).getHexString()}`;
  };
  const mLine = basic(lineColor);
  d.add(L.onThemeChange(() => { basics.forEach(([m, fn]) => m.color.set(fn())); s.requestRender(); }));

  // Всё, что меняется при смене направления тока, лежит в root. Поворот на 180° вокруг y меняет ток на обратный
  // и разворачивает поле вместе с ним (поворот сохраняет правый винт).
  const root = new THREE.Group();
  scene.add(root);
  const mI = basic(colI);

  const up = new THREE.Vector3(0, 1, 0);
  const gConeLine = new THREE.ConeGeometry(0.1, 0.28, 12);
  const gConeI = new THREE.ConeGeometry(0.13, 0.34, 14);
  const addCone = (parent, geo, mat, p, tan) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p);
    m.quaternion.setFromUnitVectors(up, new THREE.Vector3(...tan).normalize());
    parent.add(m);
    return m;
  };

  /* ---------- плоскость среза ---------- */
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(10.6, 7.6),
    basic(() => c().muted, { transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  );
  scene.add(plane);

  /* ---------- источники ---------- */
  const groups = { wire: new THREE.Group(), loop: new THREE.Group(), coil: new THREE.Group() };
  const bodies = { wire: new THREE.Group(), loop: new THREE.Group(), coil: new THREE.Group() };
  Object.keys(groups).forEach((k) => { root.add(groups[k]); groups[k].add(bodies[k]); });

  // провод вдоль z, ток по +z
  {
    const g = new THREE.CylinderGeometry(0.06, 0.06, 7.2, 12);
    g.rotateX(Math.PI / 2);
    bodies.wire.add(new THREE.Mesh(g, mI));
    addCone(bodies.wire, gConeI, mI, [0, 0, 3.75], [0, 0, 1]);
    addCone(bodies.wire, gConeI, mI, [0, 0, 1.5], [0, 0, 1]);
  }
  // виток в плоскости x = 0
  {
    const g = new THREE.TorusGeometry(LOOP_A, 0.05, 10, 96);
    g.rotateY(Math.PI / 2);
    bodies.loop.add(new THREE.Mesh(g, mI));
    [0.5, 2.07, 3.64, 5.21].forEach((th) => {
      addCone(bodies.loop, gConeI, mI, [0, LOOP_A * Math.cos(th), LOOP_A * Math.sin(th)], [0, -Math.sin(th), Math.cos(th)]);
    });
  }
  // катушка: винтовая линия, ток идёт по возрастанию угла вокруг +x
  {
    const pts = [];
    const n = COIL_TURNS * 32;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const th = 2 * Math.PI * (COIL_TURNS - 1) * u;
      pts.push(new THREE.Vector3(-COIL_HALF + 2 * COIL_HALF * u, COIL_A * Math.cos(th), COIL_A * Math.sin(th)));
    }
    bodies.coil.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.04, 8, false), mI));
    const step = (2 * COIL_HALF) / (COIL_TURNS - 1);
    [1, 3, 5].forEach((i) => {
      addCone(bodies.coil, gConeI, mI, [-COIL_HALF + i * step, 0, COIL_A], [0, -1, 0]);
    });
  }

  /* ---------- линии витка и катушки: считаются один раз на (источник, число линий) ---------- */
  const AZ_FREE = [Math.PI / 3, (2 * Math.PI) / 3, (-2 * Math.PI) / 3, -Math.PI / 3];
  const cache = new Map();
  const buildLines = (src, n) => {
    const key = `${src}:${n}`;
    if (cache.has(key)) return cache.get(key);
    const rings = ringsFor(src);
    const a = src === 'loop' ? LOOP_A : COIL_A;
    const rhoMax = a * (src === 'loop' ? 0.86 : 0.82);
    const g = new THREE.Group();
    const free = [];
    for (let i = 1; i <= n; i++) {
      const rho0 = rhoMax * Math.sqrt((i - 0.5) / n);    // равные потоки через кольца на срезе x = 0
      const raw = traceLine(rings, rho0);
      const pts = raw.filter((_, k) => k % 3 === 0 || k === raw.length - 1);
      if (pts.length < 4) continue;
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)));
      const geo = new THREE.TubeGeometry(curve, pts.length * 2, 0.018, 5, false);
      const unit = new THREE.Group();
      unit.add(new THREE.Mesh(geo, mLine));
      // стрелки: снаружи и внутри, чтобы было видно направление всей замкнутой линии
      [0.2, 0.5, 0.8].forEach((f) => {
        const u = L.clamp(f, 0.02, 0.98);
        const p = curve.getPointAt(u);
        const tan = curve.getTangentAt(u);
        addCone(unit, gConeLine, mLine, [p.x, p.y, 0], [tan.x, tan.y, 0]);
      });
      // в плоскости среза — верх и низ; остальные азимуты — только в свободном виде
      [0, Math.PI, ...AZ_FREE].forEach((az, idx) => {
        const inst = idx === 0 ? unit : unit.clone();
        const wrap = new THREE.Group();
        wrap.rotation.x = az;
        wrap.add(inst);
        g.add(wrap);
        if (idx >= 2) free.push(wrap);
      });
    }
    // линия по оси
    const axG = new THREE.CylinderGeometry(0.018, 0.018, 2 * X_MAX, 6);
    axG.rotateZ(Math.PI / 2);
    g.add(new THREE.Mesh(axG, mLine));
    [-X_MAX + 0.8, 0, X_MAX - 0.5].forEach((x) => addCone(g, gConeLine, mLine, [x, 0, 0], [1, 0, 0]));
    g.visible = false;
    root.add(g);
    const entry = { g, free };
    cache.set(key, entry);
    return entry;
  };

  /* ---------- окружности провода: пул, радиусы меняются вместе с током ---------- */
  const WIRE_Z = [-2.4, 0, 2.4];
  const wirePool = [];
  const wireLines = new THREE.Group();
  groups.wire.add(wireLines);
  const POOL = wireRadii(10).length;
  WIRE_Z.forEach((z, iz) => {
    for (let i = 0; i < POOL; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 6, 72), mLine);
      ring.position.z = z;
      const th0 = 0.7 + i * 0.9 + iz * 0.4;
      const cones = [th0, th0 + Math.PI].map((th) => addCone(wireLines, gConeLine, mLine, [0, 0, z], [-Math.sin(th), Math.cos(th), 0]));
      wireLines.add(ring);
      wirePool.push({ ring, cones, angles: [th0, th0 + Math.PI], z, inCut: z === 0, idx: i, r: -1 });
    }
  });
  const setWireRings = (I, ex) => {
    const radii = wireRadii(I);
    wirePool.forEach((w) => {
      const r = radii[w.idx];
      const show = r !== undefined && (!ex || w.inCut);
      w.ring.visible = show;
      w.cones.forEach((m) => { m.visible = show; });
      if (!show) return;
      if (w.r !== r) {
        w.r = r;
        w.ring.geometry.dispose();
        w.ring.geometry = new THREE.TorusGeometry(r, 0.018, 6, 72);
        w.cones.forEach((m, k) => m.position.set(r * Math.cos(w.angles[k]), r * Math.sin(w.angles[k]), w.z));
      }
    });
  };

  /* ---------- значки на срезе: вне root, чтобы всегда смотреть на зрителя ---------- */
  const R0 = 0.17;
  const gFill = new THREE.CircleGeometry(R0, 24);
  const gRing = new THREE.RingGeometry(R0 * 0.8, R0, 24);
  const gDot = new THREE.CircleGeometry(R0 * 0.28, 16);
  const gBar = new THREE.PlaneGeometry(R0 * 1.45, R0 * 0.2);
  const mFill = basic(() => c().surface);
  const makeSymbol = (x, y, topSide) => {
    const g = new THREE.Group();
    g.position.set(x, y, 0.05);
    const f = new THREE.Mesh(gFill, mFill);
    const r = new THREE.Mesh(gRing, mI); r.position.z = 0.002;
    const dot = new THREE.Mesh(gDot, mI); dot.position.z = 0.004;
    const a = new THREE.Mesh(gBar, mI); a.rotation.z = Math.PI / 4; a.position.z = 0.004;
    const b = new THREE.Mesh(gBar, mI); b.rotation.z = -Math.PI / 4; b.position.z = 0.006;
    g.add(f, r, dot, a, b);
    g.userData.set = (out) => { dot.visible = out; a.visible = !out; b.visible = !out; };
    g.userData.top = topSide;
    scene.add(g);
    return g;
  };
  const sym = { wire: [makeSymbol(0, 0, true)], loop: [makeSymbol(0, LOOP_A, true), makeSymbol(0, -LOOP_A, false)], coil: [] };
  const stepC = (2 * COIL_HALF) / (COIL_TURNS - 1);
  for (let i = 0; i < COIL_TURNS; i++) {
    const x = -COIL_HALF + i * stepC;
    sym.coil.push(makeSymbol(x, COIL_A, true), makeSymbol(x, -COIL_A, false));
  }

  /* ---------- подписи ---------- */
  const SIZE = 0.6;
  const lab = (t, col) => { const sp = s.label(t, [0, 0, 0], col, SIZE); sp.visible = false; return sp; };
  const labB = lab('→B', colB);
  const labI = lab('→I', colI);

  const isExam = () => camera.position.clone().sub(orbit.target).normalize().z > 0.998;
  let st = null;
  let lastEx = false;

  function update(next) {
    st = next;
    curI = st.I;
    mLine.color.set(lineColor());
    const ex = isExam();
    lastEx = ex;
    root.rotation.y = st.plus ? 0 : Math.PI;
    plane.visible = !ex;

    Object.keys(groups).forEach((k) => { groups[k].visible = k === st.src; bodies[k].visible = !ex; });
    cache.forEach((e) => { e.g.visible = false; });
    Object.entries(sym).forEach(([k, arr]) => arr.forEach((g) => {
      g.visible = ex && k === st.src;
      g.userData.set(g.userData.top === st.plus);
    }));

    if (st.src === 'wire') {
      setWireRings(st.I, ex);
      labB.position.set(2.05, 2.75, 0);
      labI.position.set(0.5, 0.5, st.plus ? 4.4 : -4.4);
    } else {
      const e = buildLines(st.src, linesCount(st.I));
      e.g.visible = true;
      e.free.forEach((w) => { w.visible = !ex; });
      labB.position.set(st.plus ? 4.65 : -4.65, 0.45, 0);
      if (st.src === 'loop') labI.position.set(0, LOOP_A + 0.42, 0.6);
      else labI.position.set(0, COIL_A + 0.5, 0.6);
    }
    labB.visible = true;
    labI.visible = !ex;
    s.requestRender();
  }

  orbit.addEventListener('change', () => { if (st && isExam() !== lastEx) update(st); });

  return { update, resetView() { s.resetView(); } };
}
