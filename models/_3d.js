// Общая библиотека 3D-моделей (three.js грузится только на страницах с такими моделями).
//
//   import * as L from './_lib.js';
//   import * as D from './_3d.js';
//   export default {
//     id: 'demo-3d', title: 'Демо', codes: ['3.4.1'],
//     mount(el) {
//       const d = L.disposer();
//       const ui = L.layout(el, { caption: '…' });
//       const handle = { destroy: d.run };
//       D.stage(ui.stage, {
//         camera: [4, 3, 6],                                   // свободный вид
//         examView: { position: [0, 0, 9], up: [0, 1, 0] },    // кнопка «Вид как в задании» (плоский рисунок)
//         controls: ui.controls,                               // куда поставить кнопку вида
//       }).then((s) => {
//         if (!s) return;                                      // нет WebGL/CDN: сообщение уже показано
//         d.add(s.destroy);
//         const { THREE, scene } = s;
//         const v = s.arrow([0, 0, 0], [1, 0, 0], 2, () => L.colors().velocity, '→v');
//         s.onFrame((dt) => { /* анимация */ v.set([0, 0, 0], [0, 1, 0], 2); });
//       });
//       return handle;
//     },
//   };
//
// Важно: mount синхронный, stage — асинхронный. Обязателен запасной вид: при отказе WebGL ученик видит подсказку.
// Цвета — функции (тема может смениться). Анимация сама выключается вне экрана и при prefers-reduced-motion
// (тогда onFrame вызывается по requestRender, dt = 0; покажите Пуск через s.play()/s.pause()).
import * as L from './_lib.js';

/** Выцвеченная под тему подпись-спрайт. text понимает _ ^ и → как L.text. */
function makeLabel(THREE, text, color) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const px = 48;
  const font = `600 ${px}px system-ui, sans-serif`;
  ctx.font = font;
  c.width = Math.max(64, Math.ceil(ctx.measureText(text).width) + 48);
  c.height = Math.round(px * 1.4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sp = new THREE.Sprite(mat);
  sp.renderOrder = 10;
  const paint = (col) => {
    ctx.clearRect(0, 0, c.width, c.height);
    L.text(ctx, text, c.width / 2, c.height / 2, col, { font, align: 'center' });
    tex.needsUpdate = true;
  };
  paint(color);
  sp.userData.paint = paint;
  sp.userData.aspect = c.width / c.height;
  return sp;
}

/**
 * Создаёт сцену. Возвращает Promise объекта s (или null при отказе):
 * { THREE, scene, camera, renderer, orbit, onFrame(cb), requestRender(), play(), pause(), running,
 *   arrow(origin, dir, length, colorFn, label?) -> { group, set(origin, dir, length), setVisible(b) },
 *   label(text, pos, colorFn, size?) -> sprite, line(points, colorFn, opts?) -> { obj, setPoints(points) },
 *   tube(points, colorFn, radius?) -> { obj, setPoints(points) }, mesh(geometry, colorFn, matOpts?) -> Mesh,
 *   setView('free'|'exam'), destroy() }
 */
export async function stage(parent, { camera = [5, 4, 7], target = [0, 0, 0], examView, controls, aspect = 0.62, fov = 40, autoplay = true } = {}) {
  const fail = (msg) => {
    const p = document.createElement('p');
    p.className = 'model-error';
    p.textContent = msg;
    parent.append(p);
    return null;
  };
  let THREE, OrbitControls;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  } catch (e) {
    console.warn('three.js не загрузился', e);
    return fail('Не удалось загрузить 3D-библиотеку: проверьте интернет и обновите страницу.');
  }
  if (!parent.isConnected) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (e) {
    console.warn('WebGL недоступен', e);
    return fail('Ваш браузер не поддерживает 3D (WebGL). Описание явления есть в тексте страницы.');
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  const cv = renderer.domElement;
  cv.style.display = 'block';
  cv.style.width = '100%';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'Трёхмерный рисунок модели: перетащите, чтобы повернуть');
  parent.append(cv);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(fov, 1.6, 0.1, 200);
  cam.position.set(...camera);
  const orbit = new OrbitControls(cam, cv);
  orbit.target.set(...target);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.update();
  // вертикальный жест пальцем прокручивает страницу, а не крутит сцену
  cv.style.touchAction = 'pan-y';

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(4, 8, 6);
  scene.add(dir);

  const themed = [];
  const addThemed = (fn) => { themed.push(fn); fn(); return fn; };
  const toColor = (fn) => new THREE.Color(typeof fn === 'function' ? fn() : fn);

  let dirty = true;
  const requestRender = () => { dirty = true; };
  const frames = [];
  let running = autoplay && !L.prefersReducedMotion();
  let visible = true;
  let raf = 0;
  let last = 0;
  let w = 0, h = 0;

  function resize() {
    const nw = Math.max(200, parent.clientWidth || 320);
    const nh = Math.round(Math.min(Math.max(260, (window.innerHeight || 800) * 0.6), Math.max(220, nw * aspect)));
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    renderer.setSize(w, h, false);
    cv.style.height = `${h}px`;
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    requestRender();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(parent);
  resize();

  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop(); });
  io.observe(cv);
  orbit.addEventListener('change', requestRender);

  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function tick(t) {
    if (!visible || document.hidden) { last = 0; return; }
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    orbit.update();
    if (running) { frames.forEach((f) => f(dt)); dirty = true; }
    if (dirty) { dirty = false; renderer.render(scene, cam); }
    raf = requestAnimationFrame(tick);
  }
  const onVis = () => { if (!document.hidden) loop(); };
  document.addEventListener('visibilitychange', onVis);
  const offTheme = L.onThemeChange(() => { themed.forEach((f) => f()); requestRender(); });

  const s = {
    THREE, scene, camera: cam, renderer, orbit, requestRender,
    /** cb(dt): каждый кадр при запущенной анимации. */
    onFrame(cb) { frames.push(cb); return cb; },
    play() { running = true; },
    pause() { running = false; },
    get running() { return running; },
    /** Один шаг вручную (после смены параметров при паузе). */
    step() { frames.forEach((f) => f(0)); dirty = true; },

    arrow(origin, direction, length, colorFn, label) {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
      addThemed(() => mat.color.copy(toColor(colorFn)));
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12), mat);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 16), mat);
      group.add(shaft, head);
      scene.add(group);
      let sp = null;
      if (label) {
        sp = makeLabel(THREE, label, toColor(colorFn).getStyle());
        const size = 0.42;
        sp.scale.set(size * sp.userData.aspect, size, 1);
        scene.add(sp);
        addThemed(() => sp.userData.paint(toColor(colorFn).getStyle()));
      }
      const up = new THREE.Vector3(0, 1, 0);
      const api = {
        group,
        set(o, d, len) {
          const v = new THREE.Vector3(...d);
          const show = len > 1e-3 && v.lengthSq() > 1e-9;
          group.visible = show;
          if (sp) sp.visible = show;
          if (!show) { requestRender(); return; }
          v.normalize();
          const hl = Math.min(0.28, len * 0.5);
          group.position.set(...o);
          group.quaternion.setFromUnitVectors(up, v);
          shaft.scale.y = Math.max(1e-3, len - hl);
          shaft.position.y = (len - hl) / 2;
          head.scale.y = hl / 0.28;
          head.position.y = len - hl / 2;
          if (sp) sp.position.set(o[0] + v.x * (len + 0.25), o[1] + v.y * (len + 0.25), o[2] + v.z * (len + 0.25));
          requestRender();
        },
        setVisible(b) { group.visible = b; if (sp) sp.visible = b; requestRender(); },
      };
      api.set(origin, direction, length);
      return api;
    },

    label(text, pos, colorFn, size = 0.42) {
      const sp = makeLabel(THREE, text, toColor(colorFn).getStyle());
      sp.scale.set(size * sp.userData.aspect, size, 1);
      sp.position.set(...pos);
      scene.add(sp);
      addThemed(() => sp.userData.paint(toColor(colorFn).getStyle()));
      return sp;
    },

    line(points, colorFn, { dashed = false, opacity = 1 } = {}) {
      const geo = new THREE.BufferGeometry();
      const mat = dashed
        ? new THREE.LineDashedMaterial({ dashSize: 0.15, gapSize: 0.1, transparent: opacity < 1, opacity })
        : new THREE.LineBasicMaterial({ transparent: opacity < 1, opacity });
      addThemed(() => mat.color.copy(toColor(colorFn)));
      const obj = new THREE.Line(geo, mat);
      scene.add(obj);
      const setPoints = (pts) => {
        geo.setFromPoints(pts.map((p) => new THREE.Vector3(...p)));
        if (dashed) obj.computeLineDistances();
        requestRender();
      };
      setPoints(points);
      return { obj, setPoints };
    },

    tube(points, colorFn, radius = 0.04) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.55 });
      addThemed(() => mat.color.copy(toColor(colorFn)));
      const obj = new THREE.Mesh(new THREE.BufferGeometry(), mat);
      scene.add(obj);
      const setPoints = (pts) => {
        obj.geometry.dispose();
        if (pts.length < 2) { obj.geometry = new THREE.BufferGeometry(); requestRender(); return; }
        const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
        obj.geometry = new THREE.TubeGeometry(curve, Math.max(16, pts.length * 3), radius, 8, false);
        requestRender();
      };
      setPoints(points);
      return { obj, setPoints };
    },

    mesh(geometry, colorFn, matOpts = {}) {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, ...matOpts });
      addThemed(() => mat.color.copy(toColor(colorFn)));
      const m = new THREE.Mesh(geometry, mat);
      scene.add(m);
      return m;
    },

    setView(name) {
      if (name === 'exam' && examView) {
        cam.position.set(...examView.position);
        cam.up.set(...(examView.up || [0, 1, 0]));
      } else {
        cam.position.set(...camera);
        cam.up.set(0, 1, 0);
      }
      orbit.target.set(...target);
      orbit.update();
      requestRender();
    },

    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      offTheme();
      document.removeEventListener('visibilitychange', onVis);
      orbit.dispose();
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m) => { m.map?.dispose?.(); m.dispose?.(); });
      });
      renderer.dispose();
      cv.remove();
    },
  };

  if (examView && controls) {
    let exam = false;
    const b = L.button(controls, 'Вид как в задании', () => {
      exam = !exam;
      s.setView(exam ? 'exam' : 'free');
      b.textContent = exam ? 'Свободный вид' : 'Вид как в задании';
    });
    s.resetView = () => { exam = false; s.setView('free'); b.textContent = 'Вид как в задании'; };
  } else {
    s.resetView = () => s.setView('free');
  }
  loop();
  return s;
}
