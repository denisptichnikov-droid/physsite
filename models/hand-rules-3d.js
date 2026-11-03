// Три правила руки в 3D: сила Лоренца, сила Ампера (левая рука), буравчик (правая рука).
// Система координат рисунка: x — вправо, y — вверх, z — на зрителя. ⊙ = +z, ⊗ = −z.
// Направления считаются векторным произведением (computeTriad), рука строится по результату, а не наоборот.
import * as L from './_lib.js';
import * as D from './_3d.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mul = (a, k) => a.map((x) => (x === 0 ? 0 : x * k));

/**
 * rule: 'lorentz' | 'ampere' | 'screw'; sign: '+' | '-'; field: 'in' (⊗) | 'out' (⊙).
 * lorentz, ampere: F = q·v×B (F = I·l×B). Левая рука: f — четыре пальца, t — большой, n = f×t — наружу из ладони, n = −B.
 * screw: B в точке r̂ справа от провода задан (field), ток находится из B ∥ I×r̂, то есть I = r̂×B.
 */
export function computeTriad(rule, sign, field) {
  const B = field === 'in' ? [0, 0, -1] : [0, 0, 1];
  if (rule === 'screw') {
    const r = [1, 0, 0];
    const I = cross(r, B);
    return { rule, B, r, I, thumb: I, hand: 'right' };
  }
  const q = rule === 'lorentz' && sign === '-' ? -1 : 1;
  const flow = [1, 0, 0];                 // v или I
  const F = mul(cross(flow, B), q);
  const f = mul(flow, q);                 // пальцы: по v при q > 0, против v при q < 0; для тока — по I
  const t = F;                            // большой палец
  const n = cross(f, t);                  // наружная нормаль ладони у левой руки
  return { rule, B, flow, F, q, f, t, n, hand: 'left' };
}

const dirName = (v) => {
  if (v[0] > 0.5) return 'вправо';
  if (v[0] < -0.5) return 'влево';
  if (v[1] > 0.5) return 'вверх';
  if (v[1] < -0.5) return 'вниз';
  return v[2] > 0 ? 'на нас ⊙' : 'от нас ⊗';
};

export default {
  id: 'hand-rules-3d',
  title: 'Три правила руки',
  codes: ['3.3.2', '3.3.3', '3.3.4'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'Поверните рисунок мышью или пальцем, чтобы заглянуть в ладонь. «Вид как в задании» показывает тот же случай на плоскости, со значками ⊙ и ⊗ вместо руки.',
    });
    const hint = document.createElement('p');
    hint.className = 'model-caption';
    hint.setAttribute('aria-live', 'polite');
    ui.controls.before(hint);

    let S = null;
    const cRule = L.choice(ui.controls, {
      key: 'rule', label: 'Что определяем', value: 'lorentz',
      options: [
        { value: 'lorentz', label: 'сила Лоренца' },
        { value: 'ampere', label: 'сила Ампера' },
        { value: 'screw', label: 'поле тока (буравчик)' },
      ],
      onChange: sync,
    });
    const cSign = L.choice(ui.controls, {
      key: 'sign', label: 'Заряд частицы', value: '+',
      options: [{ value: '+', label: 'q &gt; 0' }, { value: '-', label: 'q &lt; 0' }],
      onChange: sync,
    });
    const cField = L.choice(ui.controls, {
      key: 'field', label: 'Поле B', value: 'in',
      options: [{ value: 'in', label: 'от нас ⊗' }, { value: 'out', label: 'на нас ⊙' }],
      onChange: sync,
    });
    const cHand = L.checkbox(ui.controls, { key: 'hand', label: 'Показать руку', checked: true, onChange: sync });
    L.button(ui.controls, 'Сброс', () => {
      cRule.set('lorentz'); cSign.set('+'); cField.set('in'); cHand.set(true);
      S?.resetView();
      sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function sync() {
      const rule = cRule.value;
      const t = computeTriad(rule, cSign.value, cField.value);
      cSign.el.style.display = rule === 'lorentz' ? '' : 'none';
      cField.el.querySelector('legend').textContent = rule === 'screw' ? 'Поле B справа от провода' : 'Поле B';
      if (rule === 'lorentz') {
        hint.innerHTML = `<b>Левая рука.</b> Поле ${dirName(t.B)}, поэтому ладонь развёрнута ${t.B[2] < 0 ? 'к нам' : 'от нас'}: вектор B входит в неё. `
          + (t.q > 0
            ? 'Заряд положительный: четыре пальца идут по скорости v. '
            : 'Заряд отрицательный: четыре пальца идут <b>против</b> скорости v. ')
          + `Отогнутый большой палец показывает силу F<sub>Л</sub>: ${dirName(t.F)}.`;
        ro.set([
          ['Скорость v', dirName(t.flow)],
          ['Поле B', dirName(t.B)],
          ['Четыре пальца', `${dirName(t.f)} (${t.q > 0 ? 'по v' : 'против v'})`],
          ['Сила F<sub>Л</sub>', dirName(t.F)],
        ]);
      } else if (rule === 'ampere') {
        hint.innerHTML = `<b>Левая рука.</b> Поле ${dirName(t.B)}, поэтому ладонь развёрнута ${t.B[2] < 0 ? 'к нам' : 'от нас'}: вектор B входит в неё. `
          + `Четыре пальца идут по току I. Отогнутый большой палец показывает силу F<sub>A</sub>: ${dirName(t.F)}.`;
        ro.set([
          ['Ток I', dirName(t.flow)],
          ['Поле B', dirName(t.B)],
          ['Четыре пальца', `${dirName(t.f)} (по току)`],
          ['Сила F<sub>A</sub>', dirName(t.F)],
        ]);
      } else {
        hint.innerHTML = `<b>Правая рука, буравчик.</b> Большой палец идёт по току: ${dirName(t.I)}. Четыре согнутых пальца обхватывают провод и показывают, куда идут линии B: `
          + `справа от провода ${dirName(t.B)}, слева ${dirName(mul(t.B, -1))}.`;
        ro.set([
          ['Ток I', dirName(t.I)],
          ['B справа от провода', dirName(t.B)],
          ['B слева от провода', dirName(mul(t.B, -1))],
        ]);
      }
      S?.update(t);
    }
    sync();

    D.stage(ui.stage, {
      camera: [4, 2.8, 8.2],
      examView: { position: [0, 0, 9.6], up: [0, 1, 0] },
      controls: ui.controls,
      autoplay: false,
    }).then((s) => {
      if (!s) return;
      if (dead) { s.destroy(); return; }
      d.add(s.destroy);
      S = buildScene(s, d, () => cHand.value);
      sync();
    });

    return { destroy: d.run };
  },
};

function buildScene(s, d, wantHand) {
  const { THREE, scene, camera, orbit } = s;
  const c = () => L.colors();
  const colB = () => c().fieldB;
  const colV = () => c().velocity;
  const colF = () => c().force;
  const colI = () => c().accent;
  const colT = () => c().text;

  // Материалы без освещения для значков и линий, чтобы цвет совпадал с заданным в теме.
  const basics = [];
  const basic = (fn, opts = {}) => {
    const m = new THREE.MeshBasicMaterial(opts);
    m.color.set(fn());
    basics.push([m, fn]);
    return m;
  };
  d.add(L.onThemeChange(() => { basics.forEach(([m, fn]) => m.color.set(fn())); s.requestRender(); }));

  /* ---------- значки ⊙ ⊗ ---------- */
  const R = 0.17;
  const gFill = new THREE.CircleGeometry(R, 24);
  const gRing = new THREE.RingGeometry(R * 0.8, R, 24);
  const gDot = new THREE.CircleGeometry(R * 0.28, 16);
  const gBar = new THREE.PlaneGeometry(R * 1.45, R * 0.2);
  const mFill = basic(() => c().surface);
  const mSym = basic(colB);
  const makeSymbol = (x, y) => {
    const g = new THREE.Group();
    g.position.set(x, y, -0.05);
    const fill = new THREE.Mesh(gFill, mFill);
    const ring = new THREE.Mesh(gRing, mSym); ring.position.z = 0.002;
    const dot = new THREE.Mesh(gDot, mSym); dot.position.z = 0.004;
    const a = new THREE.Mesh(gBar, mSym); a.rotation.z = Math.PI / 4; a.position.z = 0.004;
    const b = new THREE.Mesh(gBar, mSym); b.rotation.z = -Math.PI / 4; b.position.z = 0.006;
    g.add(fill, ring, dot, a, b);
    g.userData.set = (outward) => { dot.visible = outward; a.visible = !outward; b.visible = !outward; };
    scene.add(g);
    return g;
  };
  const gridForce = [];
  for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) {
    if (y === 0 && x >= 0) continue;   // не под стрелкой v или I
    if (x === 0 && y > 0) continue;    // не под стрелкой силы (вверх)
    if (x === 0 && y < 0) continue;    // не под стрелкой силы (вниз)
    gridForce.push(makeSymbol(x, y));
  }
  const gridScrew = [];
  for (const x of [-2.4, -1.2, 1.2, 2.4]) for (let y = -2; y <= 2; y++) {
    const g = makeSymbol(x, y);
    g.userData.side = Math.sign(x);
    gridScrew.push(g);
  }

  /* ---------- левая рука: X — пальцы, Y — большой палец, Z — наружу из ладони ---------- */
  const handOpts = { transparent: true, opacity: 0.62, depthWrite: false, roughness: 0.8 };
  const colHand = () => c().muted;
  const capsuleX = (r, len) => { const g = new THREE.CapsuleGeometry(r, len, 6, 14); g.rotateZ(-Math.PI / 2); return g; };

  const roundRect = (w, h, r) => {
    const sh = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    sh.moveTo(x + r, y);
    sh.lineTo(x + w - r, y); sh.quadraticCurveTo(x + w, y, x + w, y + r);
    sh.lineTo(x + w, y + h - r); sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    sh.lineTo(x + r, y + h); sh.quadraticCurveTo(x, y + h, x, y + h - r);
    sh.lineTo(x, y + r); sh.quadraticCurveTo(x, y, x + r, y);
    return sh;
  };

  const leftHand = new THREE.Group();
  {
    const palmG = new THREE.ExtrudeGeometry(roundRect(1.25, 1.2, 0.2), { depth: 0.24, bevelEnabled: false, curveSegments: 6 });
    palmG.translate(0, 0, -0.12);
    leftHand.add(s.mesh(palmG, colHand, handOpts));
    // четыре пальца: указательный ближе к большому, средний самый длинный
    [[0.45, 0.95], [0.15, 1.1], [-0.15, 1.0], [-0.45, 0.75]].forEach(([y, len]) => {
      const m = s.mesh(capsuleX(0.125, len), colHand, handOpts);
      m.position.set(0.625 + len / 2 + 0.03, y, 0);
      leftHand.add(m);
    });
    const thumb = s.mesh(new THREE.CapsuleGeometry(0.15, 0.85, 6, 14), colHand, handOpts);
    thumb.position.set(-0.05, 0.6 + 0.55, 0);
    leftHand.add(thumb);
    const wrist = s.mesh(new THREE.BoxGeometry(1.15, 0.82, 0.22), colHand, handOpts);
    wrist.position.set(-1.2, -0.05, 0);
    leftHand.add(wrist);
    // ладонная сторона отмечена светлым пятном: так видно, куда входит вектор B
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), basic(() => c().surface, { transparent: true, opacity: 0.75, depthWrite: false }));
    pad.position.set(0, 0, 0.125);
    leftHand.add(pad);
    leftHand.scale.setScalar(1.15);
    scene.add(leftHand);
  }

  /* ---------- правая рука, обхватившая провод. Ось Y — по току, пальцы вращаются вокруг +Y по правилу буравчика ---------- */
  const screwGroup = new THREE.Group();
  scene.add(screwGroup);
  const rightHand = new THREE.Group();
  {
    const grip = 0.46;
    [-0.39, -0.13, 0.13, 0.39].forEach((h) => {
      const pts = [];
      for (let a = 95; a <= 345; a += 12) {
        const th = L.deg(a);
        pts.push(new THREE.Vector3(grip * Math.cos(th), h, -grip * Math.sin(th)));
      }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 36, 0.115, 8, false);
      rightHand.add(s.mesh(g, colHand, handOpts));
    });
    const palm = s.mesh(new THREE.BoxGeometry(1.2, 1.05, 0.24), colHand, handOpts);
    palm.position.set(0.5, 0, -0.56);
    rightHand.add(palm);
    const wrist = s.mesh(new THREE.BoxGeometry(1.25, 0.8, 0.22), colHand, handOpts);
    wrist.position.set(1.72, 0, -0.56);
    rightHand.add(wrist);
    const thumb = s.mesh(new THREE.CapsuleGeometry(0.14, 0.9, 6, 14), colHand, handOpts);
    thumb.position.set(0.16, 1.0, -0.42);
    rightHand.add(thumb);
    rightHand.scale.setScalar(1.05);
    screwGroup.add(rightHand);
  }
  // линии B вокруг провода: при токе +Y обход — от +x к −z (правый винт)
  const mB = basic(colB);
  const gCone = new THREE.ConeGeometry(0.1, 0.28, 14);
  const ringR = 1.45;
  [-1.9, 1.9, 0].forEach((y, i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.022, 6, 72), mB);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    screwGroup.add(t);
    [i * 0.9 + 2.4, i * 0.9 + 2.4 + Math.PI].forEach((th) => {
      const cone = new THREE.Mesh(gCone, mB);
      cone.position.set(ringR * Math.cos(th), y, -ringR * Math.sin(th));
      const tan = new THREE.Vector3(-Math.sin(th), 0, -Math.cos(th));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      screwGroup.add(cone);
    });
  });

  /* ---------- векторы ---------- */
  const ORIGIN = [0, 0, 0];
  const aFlowV = s.arrow(ORIGIN, [1, 0, 0], 3, colV);
  const aFlowI = s.arrow(ORIGIN, [1, 0, 0], 3, colI);
  const aF = s.arrow(ORIGIN, [0, 1, 0], 2.9, colF);
  const aB = s.arrow(ORIGIN, [0, 0, -1], 2.4, colB);
  const aBside = [[1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]].map(([x, y]) => ({ x, y, a: s.arrow([x, y, 0], [0, 0, -1], 1.9, colB) }));
  const aWire = s.arrow([0, -2.8, 0], [0, 1, 0], 5.6, colI);
  const aBpoint = s.arrow([ringR, 1.9, 0], [0, 0, -1], 1.15, colB);

  const rodGeom = new THREE.CylinderGeometry(0.03, 0.03, 6.8, 10);
  rodGeom.rotateZ(Math.PI / 2);
  const rod = new THREE.Mesh(rodGeom, basic(colI));
  scene.add(rod);

  const particle = s.mesh(new THREE.SphereGeometry(0.19, 22, 16), colT);

  /* ---------- подписи ---------- */
  const SIZE = 0.6;
  const lab = (text, col) => { const sp = s.label(text, [0, 0, 0], col, SIZE); sp.visible = false; return sp; };
  const labels = {
    v: lab('→v', colV), I: lab('→I', colI), FL: lab('→F_Л', colF), FA: lab('→F_A', colF), B: lab('→B', colB),
    plus: lab('q > 0', colT), minus: lab('q < 0', colT), left: lab('левая рука', colHand), right: lab('правая рука', colHand),
  };
  const place = (sp, p) => { sp.position.set(...p); sp.visible = true; };

  const isExam = () => camera.position.clone().sub(orbit.target).normalize().z > 0.998;
  const basis = new THREE.Matrix4();
  let cur = null;

  function update(t) {
    cur = t;
    const ex = isExam();
    const showHand = !ex && wantHand();
    Object.values(labels).forEach((sp) => { sp.visible = false; });
    gridForce.forEach((g) => { g.visible = ex && t.rule !== 'screw'; g.userData.set(t.B[2] > 0); });
    gridScrew.forEach((g) => { g.visible = ex && t.rule === 'screw'; g.userData.set((t.B[2] > 0) === (g.userData.side > 0)); });

    if (t.rule === 'screw') {
      [aFlowV, aFlowI, aF, aB].forEach((a) => a.setVisible(false));
      aBside.forEach((o) => o.a.setVisible(false));
      rod.visible = false; particle.visible = false; leftHand.visible = false;

      const up = t.I[1] > 0;
      screwGroup.visible = !ex;
      screwGroup.rotation.z = up ? 0 : Math.PI;   // поворот сохраняет винт: линии и пальцы разворачиваются вместе с током
      rightHand.visible = showHand;
      aWire.set(mul(t.I, -2.8), t.I, 5.6);
      place(labels.I, mul(t.I, 3.15));
      labels.I.position.x = 0.45;
      if (ex) {
        aBpoint.setVisible(false);
        place(labels.B, [2.4, 2.75, 0]);
      } else {
        aBpoint.set([ringR, 1.9, 0], t.B, 1.15);
        place(labels.B, [ringR + 0.35, 2.25, t.B[2] * 1.3]);
        if (showHand) place(labels.right, [1.7, -1.1, -0.6]);
      }
    } else {
      screwGroup.visible = false;
      aWire.setVisible(false); aBpoint.setVisible(false);
      const lorentz = t.rule === 'lorentz';

      aFlowV.setVisible(lorentz);
      aFlowI.setVisible(!lorentz);
      if (lorentz) aFlowV.set(ORIGIN, t.flow, 3); else aFlowI.set(ORIGIN, t.flow, 3);
      place(lorentz ? labels.v : labels.I, [3.35, 0.05, 0]);
      labels[lorentz ? 'v' : 'I'].position.y = 0.42;
      rod.visible = !lorentz;
      particle.visible = lorentz;
      if (lorentz) place(t.q > 0 ? labels.plus : labels.minus, ex ? [-0.95, 0.42, 0] : [-0.75, 0.55, -t.B[2] * 0.3]);

      aF.set(ORIGIN, t.F, 2.9);
      place(lorentz ? labels.FL : labels.FA, [0.72, t.F[1] * 3.0, 0]);

      if (ex) {
        aB.setVisible(false);
        aBside.forEach((o) => o.a.setVisible(false));
        place(labels.B, [3.2, 2.72, 0]);
      } else {
        // вектор B заканчивается в ладони: хвост с наружной стороны ладони
        const tail = mul(t.B, -2.6);
        aB.set(tail, t.B, 2.5);
        aBside.forEach((o) => o.a.set([o.x, o.y, -t.B[2] * 2.0], t.B, 1.8));
        place(labels.B, [0.42, -0.42, -t.B[2] * 3.05]);
      }

      leftHand.visible = showHand;
      if (showHand) {
        const v3 = (a) => new THREE.Vector3(...a);
        basis.makeBasis(v3(t.f), v3(t.t), v3(t.n));
        leftHand.quaternion.setFromRotationMatrix(basis);
        // рука чуть позади тройки векторов, чтобы стрелки не прятались в пальцах
        leftHand.position.set(...mul(t.n, -0.24));
        place(labels.left, [-2.6, -t.F[1] * 1.3, 0]);
      }
    }
    s.requestRender();
  }

  orbit.addEventListener('change', () => { if (cur) { const e = isExam(); if (e !== update.lastExam) { update.lastExam = e; update(cur); } } });

  return {
    update,
    resetView() { s.resetView(); },
  };
}
