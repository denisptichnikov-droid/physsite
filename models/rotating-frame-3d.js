// 3D-модель «Рамка вращается в однородном магнитном поле»: Φ = NBS cos ωt, ℰ = ωNBS sin ωt.
// B — вдоль +x, ось вращения — вдоль z, нормаль n = (cos α, sin α, 0), α = ωt — угол между B и n.
import * as L from './_lib.js';
import * as D from './_3d.js';

const TAU = Math.PI * 2;
const SCALE = 7.16;    // сторона рамки на рисунке = SCALE·√S (рамка квадратная)
const PROJ_X = -2.5;   // где показана проекция рамки на плоскость ⟂ B
const WIN_BASE = 6.4;  // окно графиков, с (если период длиннее — окно равно периоду)
const FOV = 40, FOV_EXAM = 12;

/** Три значащие цифры; ноль вычислений показывается как 0. */
function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
}
/** cos и sin с точным нулём и единицей на кратных 90° (а не 6·10⁻¹⁷). */
const snap = (v) => (Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v);
const nice125 = (x) => {
  if (!(x > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(x));
  const n = x / p;
  return (n <= 1.0001 ? 1 : n <= 2.0001 ? 2 : n <= 5.0001 ? 5 : 10) * p;
};

function symbolMaterials(THREE, colorFn) {
  const make = (out) => {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const paint = () => {
      const col = colorFn();
      ctx.clearRect(0, 0, 96, 96);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(48, 48, 38, 0, TAU); ctx.stroke();
      if (out) { ctx.beginPath(); ctx.arc(48, 48, 12, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(22, 22); ctx.lineTo(74, 74); ctx.moveTo(74, 22); ctx.lineTo(22, 74); ctx.stroke(); }
      tex.needsUpdate = true;
    };
    paint();
    return { mat, paint };
  };
  const dot = make(true), cross = make(false);
  return { dot: dot.mat, cross: cross.mat, paint() { dot.paint(); cross.paint(); } };
}

export default {
  id: 'rotating-frame-3d',
  title: 'Рамка вращается в магнитном поле',
  codes: ['3.4.1', '3.4.3'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'α — угол между вектором B и нормалью n к рамке (не с плоскостью рамки!). Яркие линии B проходят сквозь рамку, их число пропорционально потоку. ' +
        'Рамка перпендикулярна B — поток наибольший, но в этот момент он не меняется, поэтому ℰ = 0. ' +
        'Рамка параллельна B — потока нет, зато он меняется быстрее всего, поэтому |ℰ| наибольшая.',
    });
    const host = document.createElement('div');
    const note = document.createElement('div');
    note.style.cssText = 'padding:.5em .75em;min-height:2.4em;font-weight:600;font-size:.95rem;line-height:1.3;color:var(--text);border-top:1px solid var(--border);';
    const chartHost = document.createElement('div');
    chartHost.style.borderTop = '1px solid var(--border)';
    ui.stage.append(host, note, chartHost);
    const cv = L.canvas(chartHost, { aspect: 0.3, minHeight: 180, maxHeight: 210, label: 'Синхронные графики потока и ЭДС от времени с бегущей меткой' });
    d.add(cv.destroy);

    const DEF = { B: 0.5, S: 0.1, omega: 2, angle: 0, N: 1 };
    let alpha = 0;     // угол α, рад (0…2π)
    let tau = 0;       // положение метки на графике, с
    let playing = !L.prefersReducedMotion();
    let s = null, fb = null;
    let render3d = () => {};

    const onParam = () => { syncTau(); renderAll(true); };
    const sB = L.slider(ui.controls, { key: 'B', label: 'Индукция <i>B</i>', min: 0.1, max: 1, step: 0.05, value: DEF.B, unit: 'Тл', onInput: onParam });
    const sS = L.slider(ui.controls, { key: 'S', label: 'Площадь рамки <i>S</i>', min: 0.02, max: 0.2, step: 0.01, value: DEF.S, unit: 'м²', onInput: onParam });
    const sOmega = L.slider(ui.controls, { key: 'omega', label: 'Угловая скорость ω', min: 0, max: 10, step: 0.1, value: DEF.omega, unit: 'рад/с', format: (v) => L.fmt(v, 1), onInput: onParam });
    const sN = L.slider(ui.controls, { key: 'N', label: 'Число витков <i>N</i>', min: 1, max: 20, step: 1, value: DEF.N, onInput: onParam });
    const sAngle = L.slider(ui.controls, { key: 'angle', label: 'Угол α (ставит на паузу)', min: 0, max: 360, step: 5, value: DEF.angle, unit: '°', format: (v) => String(Math.round(v)), onInput: onAngle });
    const bPlay = L.button(ui.controls, 'Пауза', togglePlay);
    bPlay.classList.add('model-btn--play');
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    function syncPlay() {
      bPlay.textContent = playing ? 'Пауза' : 'Пуск';
      bPlay.setAttribute('aria-pressed', String(playing));
    }
    const frameStart = () => { if (s) s.play(); else if (fb) fb.start(); };
    const frameStop = () => { if (s) s.pause(); else if (fb) fb.stop(); };
    function togglePlay() {
      playing = !playing;
      if (playing) frameStart(); else frameStop();
      syncPlay();
      renderAll(true);
    }
    function onAngle(v) {
      playing = false;
      frameStop();
      syncPlay();
      alpha = L.deg(v);
      syncTau();
      renderAll(true);
    }
    function reset() {
      sB.set(DEF.B); sS.set(DEF.S); sOmega.set(DEF.omega); sN.set(DEF.N); sAngle.set(DEF.angle);
      alpha = 0; tau = 0;
      playing = !L.prefersReducedMotion();
      s?.resetView();
      if (playing) frameStart(); else frameStop();
      syncPlay();
      renderAll(true);
    }

    const winOf = (w) => (w > 0 ? Math.max(WIN_BASE, TAU / w) : WIN_BASE);
    /** Метка ставится так, чтобы ωτ совпадало с углом α по модулю 2π. */
    function syncTau() {
      const w = sOmega.value;
      if (w <= 0) { tau = 0; return; }
      tau = (((alpha % TAU) + TAU) % TAU) / w;
      if (tau >= winOf(w)) tau = 0;
    }

    function phys() {
      const B = sB.value, S = sS.value, w = sOmega.value, N = sN.value;
      const ca = snap(Math.cos(alpha)), sa = snap(Math.sin(alpha));
      const PhiMax = N * B * S;           // Φ_max = NBS
      const EMax = w * N * B * S;         // ℰ_max = ωNBS
      const Phi = PhiMax * ca;            // Φ = NBS cos α
      const E = EMax * sa;                // ℰ = ωNBS sin α
      const T = w > 0 ? TAU / w : Infinity;
      return { B, S, w, N, ca, sa, PhiMax, EMax, Phi, E, T };
    }

    function tick(dt) {
      const w = sOmega.value;
      alpha = (alpha + w * dt) % TAU;
      if (w > 0) {
        tau += dt;
        const W = winOf(w), T = TAU / w;
        if (tau >= W) tau = W >= T ? tau - Math.floor(W / T) * T : 0;
        if (tau >= W || tau < 0) syncTau();
      }
      renderAll(false);
    }

    let roTime = 0;
    function renderAll(force) {
      render3d();
      drawChart();
      const now = performance.now();
      if (!force && now - roTime < 150) return;
      roTime = now;
      const p = phys();
      const deg = Math.round((alpha * 180) / Math.PI) % 360;
      if (playing) sAngle.set(Math.round(deg / 5) * 5);
      let msg;
      if (Math.abs(p.ca) > 0.985) msg = 'Рамка ⟂ <i>B</i>: |Φ| наибольший, но не меняется → ℰ ≈ 0';
      else if (Math.abs(p.sa) > 0.985) msg = 'Рамка ∥ <i>B</i>: Φ ≈ 0, но меняется быстрее всего → |ℰ| наибольшая';
      else msg = 'Φ и ℰ сдвинуты на четверть периода: когда один максимален, другой равен нулю';
      if (p.w === 0) msg = 'ω = 0: рамка не вращается, поток постоянен → ℰ = 0';
      note.innerHTML = msg;
      ro.set([
        ['α = ω<i>t</i> (между <i>B</i> и <i>n</i>)', deg + '°'],
        ['Φ = <i>NBS</i> cos α', f3(p.Phi) + ' Вб'],
        ['ℰ = ω<i>NBS</i> sin α', f3(p.E) + ' В'],
        ['Φ<sub>max</sub> = <i>NBS</i>', f3(p.PhiMax) + ' Вб'],
        ['ℰ<sub>max</sub> = ω<i>NBS</i>', f3(p.EMax) + ' В'],
        ['<i>T</i> = 2π/ω', p.w > 0 ? f3(p.T) + ' с' : '∞ (нет вращения)'],
      ]);
    }

    function drawChart() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      const p = phys();
      ctx.clearRect(0, 0, W, H);
      const px = 42, pr = 16, top = 16, gap = 26;
      const h1 = Math.round((H - top - gap - 22) / 2);
      const r1 = { x: px, y: top, w: W - px - pr, h: h1 };
      const r2 = { x: px, y: top + h1 + gap, w: W - px - pr, h: h1 };
      const win = winOf(p.w);
      // единицы оси: милли-, если размах меньше 1
      const scaleOf = (a) => (a < 1 ? 1000 : 1);
      const yPhi = nice125(p.PhiMax), yE = nice125(p.EMax);
      const kP = scaleOf(yPhi), kE = scaleOf(yE);
      const yP = nice125(p.PhiMax * kP), yEm = p.EMax > 0 ? nice125(p.EMax * kE) : 1;
      const g1 = L.graph(ctx, r1, { xMin: 0, xMax: win, yMin: -yP, yMax: yP, yTicks: yP, yLabel: kP > 1 ? 'Φ, мВб' : 'Φ, Вб' });
      const g2 = L.graph(ctx, r2, { xMin: 0, xMax: win, yMin: -yEm, yMax: yEm, yTicks: yEm, xLabel: 't, с', yLabel: kE > 1 ? 'ℰ, мВ' : 'ℰ, В' });
      const fPhi = (t) => (p.w > 0 ? p.PhiMax * Math.cos(p.w * t) : p.PhiMax * p.ca) * kP;
      const fE = (t) => (p.w > 0 ? p.EMax * Math.sin(p.w * t) : 0) * kE;

      // вертикали в моменты |Φ|max: там ℰ = 0 (только если волн немного)
      if (p.w > 0 && p.T / 2 >= win / 8) {
        ctx.save();
        ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath();
        for (let t = 0; t <= win + 1e-6; t += p.T / 2) {
          const a = Math.round(g1.X(t)) + 0.5;
          ctx.moveTo(a, r1.y); ctx.lineTo(a, r2.y + r2.h);
        }
        ctx.stroke();
        ctx.restore();
      }
      const n = Math.min(900, Math.max(200, Math.round(win * p.w * 24)));
      L.plotFn(ctx, g1, fPhi, c.fieldB, { n });
      L.plotFn(ctx, g2, fE, c.fieldE, { n });
      // бегущая метка
      const mx = g1.X(tau);
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(mx, r1.y); ctx.lineTo(mx, r2.y + r2.h); ctx.stroke();
      ctx.restore();
      L.dot(ctx, mx, g1.Y(p.Phi * kP), c.fieldB, 5);
      L.dot(ctx, mx, g2.Y(p.E * kE), c.fieldE, 5);
    }

    cv.onResize(drawChart);
    d.add(L.onThemeChange(drawChart));
    syncPlay();
    renderAll(true);

    D.stage(host, {
      aspect: 0.62,
      camera: [4.2, 3, 7.8],
      target: [0, 0, 0],
      examView: { position: [0, 0, 27], up: [0, 1, 0] },
      controls: ui.controls,
      fov: FOV,
    }).then((st) => {
      if (dead) { st?.destroy(); return; }
      if (!st) {
        fb = L.animator(tick);
        d.add(fb.destroy);
        if (playing) fb.start();
        return;
      }
      s = st;
      d.add(s.destroy);
      build(s);
      s.onFrame(tick);
      if (!playing) s.pause();
      renderAll(true);
    }).catch((e) => console.error(e));

    function build(s) {
      const { THREE, scene } = s;
      const cols = {
        B: () => L.colors().fieldB,
        I: () => L.colors().accent,
        text: () => L.colors().text,
        muted: () => L.colors().muted,
      };
      const labels = [];
      const lab = (t, p, c, size = 0.55) => { const sp = s.label(t, p, c, size); labels.push([sp, size]); return sp; };
      const fitLabels = () => {
        const k = host.clientWidth < 620 ? 1.3 : 1;
        labels.forEach(([sp, size]) => sp.scale.set(size * k * sp.userData.aspect, size * k, 1));
        s.requestRender();
      };
      const lro = new ResizeObserver(fitLabels);
      lro.observe(host);
      d.add(() => lro.disconnect());
      const vec = (colorFn, text, off = [0, 0, 0]) => {
        const a = s.arrow([0, 0, 0], [1, 0, 0], 0, colorFn);
        a.group.scale.set(1.5, 1, 1.5);
        const sp = lab(text, [0, 0, 0], colorFn);
        sp.visible = false;
        return {
          set(o, dv, len) {
            a.set(o, dv, len);
            const m = Math.hypot(...dv) || 1;
            const show = len > 1e-3;
            sp.visible = show;
            if (show) sp.position.set(o[0] + dv[0] / m * (len + 0.3) + off[0], o[1] + dv[1] / m * (len + 0.3) + off[1], o[2] + dv[2] / m * (len + 0.3) + off[2]);
          },
          hide() { a.setVisible(false); sp.visible = false; },
        };
      };

      // полюсы: B от N к S
      const poleGeo = new THREE.BoxGeometry(0.5, 4.2, 3.6);
      const pN = s.mesh(poleGeo, '#d9302a'); pN.position.set(-3.45, 0, 0);
      const pS = s.mesh(poleGeo, '#2467c9'); pS.position.set(3.45, 0, 0);
      lab('N', [-3.45, 0, 0], '#ffffff', 0.6);
      lab('S', [3.45, 0, 0], '#ffffff', 0.6);

      // линии поля — параллельные цилиндры вдоль x
      const matOn = new THREE.MeshStandardMaterial({ roughness: 0.6 });
      const matOff = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false });
      const paintLines = () => { const col = new THREE.Color(L.colors().fieldB); matOn.color.copy(col); matOff.color.copy(col); s.requestRender(); };
      paintLines();
      d.add(L.onThemeChange(paintLines));
      const fieldGeo = new THREE.CylinderGeometry(0.016, 0.016, 6.4, 6);
      const coneGeo = new THREE.ConeGeometry(0.08, 0.24, 10);
      const fieldLines = [];
      for (let iy = -4; iy <= 4; iy++) {
        for (let iz = -2; iz <= 2; iz++) {
          const y = iy * 0.4, z = iz * 0.7;
          const m = new THREE.Mesh(fieldGeo, matOff);
          m.rotation.z = -Math.PI / 2;
          m.position.set(0, y, z);
          scene.add(m);
          const meshes = [m];
          if (iz === 0) {
            const cn = new THREE.Mesh(coneGeo, matOn);
            cn.rotation.z = -Math.PI / 2;
            cn.position.set(2.7, y, z);
            scene.add(cn);
          }
          fieldLines.push({ y, z, meshes });
        }
      }

      // ось вращения
      s.line([[0, 0, -3.1], [0, 0, 3.1]], cols.muted, { dashed: true });
      const axisLab = lab('ось', [0, -0.34, 3.2], cols.muted, 0.5);

      // рамка: группа вращается вокруг z, локальный x = n
      const frame = new THREE.Group();
      scene.add(frame);
      const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
      const edges = [0, 1, 2, 3].map(() => { const m = s.mesh(edgeGeo, cols.text); frame.add(m); return m; });
      const fillMat = { transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false };
      const fill = s.mesh(new THREE.PlaneGeometry(1, 1), cols.I, fillMat);
      fill.rotation.y = Math.PI / 2;
      frame.add(fill);

      // проекция рамки
      const proj = s.mesh(new THREE.PlaneGeometry(1, 1), cols.B, { transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
      proj.rotation.y = Math.PI / 2;
      proj.position.x = PROJ_X;
      const projLab = lab('S·cos α', [PROJ_X, 0, 0], cols.B, 0.5);
      const ray1 = s.line([[0, 0, 0], [1, 0, 0]], cols.muted, { dashed: true });
      const ray2 = s.line([[0, 0, 0], [1, 0, 0]], cols.muted, { dashed: true });

      // векторы
      const vB = vec(cols.B, '→B', [0, -0.3, 0]);
      vB.set([0, 0, 0], [1, 0, 0], 1.75);
      const vN = vec(cols.text, '→n', [0, 0.28, 0]);
      const vI = vec(cols.I, 'I');

      // дуга α
      const arc = s.tube([], cols.text, 0.028);
      const arcLab = lab('α', [1, 0, 0], cols.text, 0.6);

      // значки тока на торцах рамки — для вида как в задании
      const sym = symbolMaterials(THREE, cols.I);
      d.add(L.onThemeChange(() => { sym.paint(); s.requestRender(); }));
      const symTop = new THREE.Sprite(sym.dot);
      const symBot = new THREE.Sprite(sym.cross);
      [symTop, symBot].forEach((sp) => { sp.renderOrder = 11; sp.scale.set(0.42, 0.42, 1); sp.visible = false; scene.add(sp); });

      let exam = false;
      const baseSet = s.setView;
      s.setView = (name) => {
        exam = name === 'exam';
        s.camera.fov = exam ? FOV_EXAM : FOV;
        s.camera.updateProjectionMatrix();
        baseSet(name);
        renderAll(true);
      };

      let lastA = null, lastS = null, lastN = null;
      render3d = () => {
        const p = phys();
        const a = SCALE * Math.sqrt(p.S);     // сторона рамки на рисунке
        frame.rotation.z = alpha;
        const t = [-p.sa, p.ca];              // направление в плоскости рамки, ⟂ оси

        if (a !== lastS || p.N !== lastN) {
          lastS = a; lastN = p.N;
          const th = 0.05 + 0.012 * Math.min(p.N, 20) ** 0.8;  // чем больше витков, тем толще рамка
          edges[0].position.set(0, a / 2, 0); edges[0].scale.set(th, th, a + th);
          edges[1].position.set(0, -a / 2, 0); edges[1].scale.set(th, th, a + th);
          edges[2].position.set(0, 0, a / 2); edges[2].scale.set(th, a + th, th);
          edges[3].position.set(0, 0, -a / 2); edges[3].scale.set(th, a + th, th);
          fill.scale.set(a, a, 1);
        }

        // линии поля сквозь рамку: |y| ≤ (a/2)|cos α|, |z| ≤ a/2
        const yLim = (a / 2) * Math.abs(p.ca) + 1e-6;
        for (const ln of fieldLines) {
          const on = Math.abs(ln.y) <= yLim && Math.abs(ln.z) <= a / 2 + 1e-6;
          ln.meshes[0].material = on ? matOn : matOff;
          ln.meshes[0].visible = !exam || ln.z === 0;   // на плоском рисунке ряды сливаются
        }

        vN.set([0, 0, 0], [p.ca, p.sa, 0], 1.75);
        axisLab.visible = !exam;

        // проекция
        const hP = a * Math.abs(p.ca);
        proj.visible = hP > 1e-3;
        if (proj.visible) proj.scale.set(a, hP, 1);
        projLab.position.set(PROJ_X + 0.2, -hP / 2 - 0.38, 0);
        projLab.visible = hP > 1e-3;
        const top = [t[0] * a / 2, t[1] * a / 2, a / 2];
        const bot = [-t[0] * a / 2, -t[1] * a / 2, a / 2];
        ray1.setPoints([top, [PROJ_X, top[1], a / 2]]);
        ray2.setPoints([bot, [PROJ_X, bot[1], a / 2]]);

        // дуга короткой стороной от B к n
        if (alpha !== lastA) {
          lastA = alpha;
          let sgn = alpha % TAU;
          if (sgn > Math.PI) sgn -= TAU;
          const r = 1.05;
          if (Math.abs(sgn) > L.deg(1.5)) {
            const pts = [];
            const n = Math.max(4, Math.ceil(Math.abs(sgn) / 0.14));
            for (let i = 0; i <= n; i++) { const q = (sgn * i) / n; pts.push([r * Math.cos(q), r * Math.sin(q), 0]); }
            arc.setPoints(pts);
            arc.obj.visible = true;
            arcLab.visible = true;
            arcLab.position.set(1.42 * Math.cos(sgn / 2), 1.42 * Math.sin(sgn / 2), 0);
          } else {
            arc.obj.visible = false;
            arcLab.visible = false;
          }
        }

        // ток: при ℰ > 0 — по правому винту вокруг n; на ребре z = +a/2 он идёт вдоль −t
        const sgnE = p.E === 0 ? 0 : Math.sign(p.E);
        if (sgnE !== 0 && Math.abs(p.sa) > 0.02) {
          const len = Math.min(0.95, a * 0.6);
          const o = [sgnE * t[0] * len / 2, sgnE * t[1] * len / 2, a / 2 + 0.1];
          vI.set(o, [-sgnE * t[0], -sgnE * t[1], 0], len);
        } else vI.hide();
        const showSym = exam && sgnE !== 0 && Math.abs(p.sa) > 0.02;
        symTop.visible = symBot.visible = showSym;
        if (showSym) {
          const q = a / 2 + 0.3;
          symTop.position.set(t[0] * q, t[1] * q, 0);
          symBot.position.set(-t[0] * q, -t[1] * q, 0);
          // ℰ > 0: на ребре +t ток вдоль +z (на зрителя, ⊙), на ребре −t — от зрителя (⊗)
          symTop.material = sgnE > 0 ? sym.dot : sym.cross;
          symBot.material = sgnE > 0 ? sym.cross : sym.dot;
        }
        s.requestRender();
      };
      fitLabels();
    }

    return { destroy: d.run };
  },
};
