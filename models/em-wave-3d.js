// Бегущая электромагнитная волна: E и B синфазны, E ⊥ B ⊥ c.
// Система координат рисунка: x — по направлению распространения, y — вдоль E, z — вдоль B (на зрителя).
// E × B направлено по +x: y × z = +x.
//
// Масштаб: 1 единица рисунка = 1 м, поэтому λ на экране равна значению на слайдере.
// Время условное: волна на экране всегда идёт со скоростью C_SCREEN, это и есть «одна и та же c при любой λ».
// Длины стрелок E и B условные (одна и та же амплитуда на рисунке), сравнивать их нельзя.
import * as L from './_lib.js';
import * as D from './_3d.js';

export const C = 3e8;
const C_SCREEN = 2;        // м/с на экране
const X_HALF = 5;
const AMP = 1.7;
const N = 41;              // стрелок вдоль оси
const DEF = { lambda: 4, showE: true, showB: true };

/** λ — м. ν = c/λ, T = 1/ν = λ/c. */
export function waveParams(lambda) {
  const nu = C / lambda;
  return { nu, T: 1 / nu };
}

/** Мгновенное значение (в долях амплитуды) в точке x в момент экранного времени t. E и B синфазны. */
export const phaseValue = (x, t, lambda) => Math.sin((2 * Math.PI * (x - C_SCREEN * t)) / lambda);

export default {
  id: 'em-wave-3d',
  title: 'Электромагнитная волна',
  codes: ['3.5.5'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'В вакууме векторы E, B и c взаимно перпендикулярны: E ⊥ B ⊥ c. E и B одновременно достигают максимума и одновременно обращаются в ноль. Длины стрелок условные. Движение замедлено: на экране волна проходит 2 м за секунду при любой длине волны.',
    });
    let S = null;
    const sL = L.slider(ui.controls, { key: 'lambda', label: 'Длина волны λ', min: 2, max: 10, step: 0.5, value: DEF.lambda, unit: 'м', onInput: sync });
    const cE = L.checkbox(ui.controls, { key: 'showE', label: 'Показать E', checked: DEF.showE, onChange: sync });
    const cB = L.checkbox(ui.controls, { key: 'showB', label: 'Показать B', checked: DEF.showB, onChange: sync });
    const bPlay = L.button(ui.controls, L.prefersReducedMotion() ? 'Пуск' : 'Пауза', () => S?.toggle());
    bPlay.classList.add('model-btn--play');
    L.button(ui.controls, 'Сброс', () => {
      sL.set(DEF.lambda); cE.set(DEF.showE); cB.set(DEF.showB);
      S?.resetView();
      S?.restart();
      sync();
    }, { reset: true });
    const ro = L.readout(ui.readout);

    function sync() {
      const lambda = sL.value;
      const w = waveParams(lambda);
      ro.set([
        ['Длина волны λ', `${L.fmt(lambda)} м`],
        ['Частота ν = c/λ', `${L.fmt(w.nu)} Гц`],
        ['Период T = λ/c', `${L.fmt(w.T)} с`],
        ['Скорость c', '3·10⁸ м/с'],
      ]);
      S?.update({ lambda, showE: cE.value, showB: cB.value });
    }
    sync();

    D.stage(ui.stage, {
      camera: [5.4, 4, 10.4],
      examView: { position: [0, 0, 12.5], up: [0, 1, 0] },
      controls: ui.controls,
    }).then((s) => {
      if (!s) return;
      if (dead) { s.destroy(); return; }
      d.add(s.destroy);
      S = buildScene(s, d, bPlay);
      sync();
    });

    return { destroy: d.run };
  },
};

function buildScene(s, d, bPlay) {
  const { THREE, scene, camera, orbit } = s;
  const c = () => L.colors();
  const colE = () => c().fieldE;
  const colB = () => c().fieldB;
  const colV = () => c().velocity;
  const colT = () => c().text;

  const basics = [];
  const basic = (fn, opts = {}) => {
    const m = new THREE.MeshBasicMaterial(opts);
    m.color.set(fn());
    basics.push([m, fn]);
    return m;
  };
  d.add(L.onThemeChange(() => { basics.forEach(([m, fn]) => m.color.set(fn())); s.requestRender(); }));

  const xs = [];
  for (let i = 0; i < N; i++) xs.push(-X_HALF + (2 * X_HALF * i) / (N - 1));

  const arrowsE = xs.map((x) => s.arrow([x, 0, 0], [0, 1, 0], 1, colE));
  const arrowsB = xs.map((x) => s.arrow([x, 0, 0], [0, 0, 1], 1, colB));

  /* ---------- огибающие: координаты меняются прямо в буфере (setPoints каждый кадр копил бы буферы в видеопамяти) ---------- */
  const CURVE_N = 121;
  const zeros = Array.from({ length: CURVE_N }, (_, i) => [-X_HALF + (2 * X_HALF * i) / (CURVE_N - 1), 0, 0]);
  const curveE = s.line(zeros, colE);
  const curveB = s.line(zeros, colB);
  curveE.obj.frustumCulled = false;
  curveB.obj.frustumCulled = false;

  /* ---------- ось и c ---------- */
  s.line([[-X_HALF - 0.6, 0, 0], [X_HALF, 0, 0]], colT);
  s.arrow([X_HALF, 0, 0], [1, 0, 0], 1.0, colV);

  /* ---------- размерная линия λ ---------- */
  const dimY = -2.5;
  const dimLine = s.line([[0, dimY, 0], [1, dimY, 0]], colT);
  const tickL = s.line([[0, dimY - 0.18, 0], [0, dimY + 0.18, 0]], colT);
  const tickR = s.line([[0, dimY - 0.18, 0], [0, dimY + 0.18, 0]], colT);

  /* ---------- значки ⊙ ⊗ для B в виде как в задании ---------- */
  const R0 = 0.2;
  const gFill = new THREE.CircleGeometry(R0, 22);
  const gRing = new THREE.RingGeometry(R0 * 0.8, R0, 22);
  const gDot = new THREE.CircleGeometry(R0 * 0.28, 16);
  const gBar = new THREE.PlaneGeometry(R0 * 1.45, R0 * 0.2);
  const mFill = basic(() => c().surface);
  const mSym = basic(colB);
  const symbols = [];
  for (let i = 0; i < N; i += 2) {
    const g = new THREE.Group();
    g.position.set(xs[i], 0, 0.1);
    const f = new THREE.Mesh(gFill, mFill);
    const r = new THREE.Mesh(gRing, mSym); r.position.z = 0.002;
    const dot = new THREE.Mesh(gDot, mSym); dot.position.z = 0.004;
    const a = new THREE.Mesh(gBar, mSym); a.rotation.z = Math.PI / 4; a.position.z = 0.004;
    const b = new THREE.Mesh(gBar, mSym); b.rotation.z = -Math.PI / 4; b.position.z = 0.006;
    g.add(f, r, dot, a, b);
    scene.add(g);
    symbols.push({ g, dot, a, b, x: xs[i] });
  }

  /* ---------- подписи ---------- */
  const SIZE = 0.6;
  const labE = s.label('→E', [-X_HALF - 0.1, AMP + 0.5, 0], colE, SIZE);
  const labB = s.label('→B', [-X_HALF - 0.1, 0.25, AMP + 0.5], colB, SIZE);
  s.label('→c', [X_HALF + 1.25, 0.05, 0], colV, SIZE);
  const labLam = s.label('λ', [0, dimY - 0.48, 0], colT, SIZE);

  const isExam = () => camera.position.clone().sub(orbit.target).normalize().z > 0.998;

  let st = null;
  let t = 0;
  let lastEx = false;
  const O = [0, 0, 0];

  function render() {
    if (!st) return;
    const ex = isExam();
    lastEx = ex;
    const { lambda, showE, showB } = st;

    xs.forEach((x, i) => {
      const v = phaseValue(x, t, lambda);
      O[0] = x;
      const len = AMP * Math.abs(v);
      const aE = arrowsE[i];
      const aB = arrowsB[i];
      if (showE) aE.set(O, [0, v >= 0 ? 1 : -1, 0], len); else aE.setVisible(false);
      if (showB && !ex) aB.set(O, [0, 0, v >= 0 ? 1 : -1], len); else aB.setVisible(false);
    });

    const pe = curveE.obj.geometry.attributes.position;
    const pb = curveB.obj.geometry.attributes.position;
    for (let i = 0; i < CURVE_N; i++) {
      const x = -X_HALF + (2 * X_HALF * i) / (CURVE_N - 1);
      const v = AMP * phaseValue(x, t, lambda);
      pe.setXYZ(i, x, v, 0);
      pb.setXYZ(i, x, 0, v);
    }
    pe.needsUpdate = true;
    pb.needsUpdate = true;
    curveE.obj.visible = showE;
    curveB.obj.visible = showB && !ex;

    symbols.forEach((o) => {
      const v = phaseValue(o.x, t, lambda);
      const show = ex && showB && Math.abs(v) > 0.2;
      o.g.visible = show;
      if (!show) return;
      const k = 0.45 + 0.55 * Math.abs(v);    // размер значка отражает мгновенное значение
      o.g.scale.setScalar(k);
      const out = v > 0;                      // B по +z — на зрителя
      o.dot.visible = out; o.a.visible = !out; o.b.visible = !out;
    });

    labE.visible = showE;
    labB.visible = showB;
    if (ex) labB.position.set(-X_HALF - 0.1, 0.55, 0);
    else labB.position.set(-X_HALF - 0.1, 0.25, AMP + 0.5);
    s.requestRender();
  }

  function setDimension(lambda) {
    const a = -lambda / 2, b = lambda / 2;
    const set = (ln, pts) => {
      const p = ln.obj.geometry.attributes.position;
      pts.forEach((q, i) => p.setXYZ(i, ...q));
      p.needsUpdate = true;
      ln.obj.geometry.computeBoundingSphere();
    };
    set(dimLine, [[a, dimY, 0], [b, dimY, 0]]);
    set(tickL, [[a, dimY - 0.18, 0], [a, dimY + 0.18, 0]]);
    set(tickR, [[b, dimY - 0.18, 0], [b, dimY + 0.18, 0]]);
    labLam.position.set(0, dimY - 0.48, 0);
  }

  s.onFrame((dt) => {
    if (!st) return;
    t += dt;
    render();
  });
  orbit.addEventListener('change', () => { if (st && isExam() !== lastEx) render(); });

  const syncBtn = () => { bPlay.textContent = s.running ? 'Пауза' : 'Пуск'; bPlay.setAttribute('aria-pressed', String(s.running)); };
  syncBtn();

  return {
    update(next) { st = next; setDimension(st.lambda); render(); },
    resetView() { s.resetView(); },
    restart() { t = 0; render(); },
    toggle() { if (s.running) s.pause(); else s.play(); syncBtn(); },
  };
}
