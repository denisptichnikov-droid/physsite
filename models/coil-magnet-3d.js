// 3D-модель «Магнит и катушка»: почему в неподвижной катушке возникает ток.
// Поток считается точно, а не «на глаз»: магнит — два разнесённых полюса (±A от центра), поток через круг радиуса R
// на расстоянии d от центра магнита: φ(d) = [c(d+A) − c(d−A)] / (2c(A)), c(u) = u/√(u²+R²); φ(0) = 1.
// Линии B — изолинии этой же функции, поэтому число линий через виток строго пропорционально потоку.
import * as L from './_lib.js';
import * as D from './_3d.js';

const R = 1.25;        // радиус витка
const A = 0.9;         // полюса — на ±A от центра магнита
const PITCH = 0.14;    // шаг витков
const POS_MIN = 0, POS_MAX = 5;
const HOLD = 0.7;      // сколько магнит стоит в крайних точках, с
const MANUAL = 2;      // скорость, с которой магнит догоняет слайдер, ед./с
const WIN = 8;         // окно графиков, с
const LEVELS = 8;      // уровней линий, идущих через виток (на каждом из 4 сечений)
const EPS = 0.004;     // меньше этой скорости изменения потока считаем, что он не меняется
const FOV = 40, FOV_EXAM = 12;

const hyp = (u) => Math.hypot(u, R);
const cu = (u) => u / hyp(u);
const PSI0 = 2 * cu(A);
/** Поток через один виток, усл. ед. (1 — магнит в центре катушки). */
const phi = (d) => (cu(d + A) - cu(d - A)) / PSI0;
/** Производная φ по расстоянию d. */
const dphi = (d) => (R * R / hyp(d + A) ** 3 - R * R / hyp(d - A) ** 3) / PSI0;

/** Половина линии поля (от полюса N к плоскости симметрии) для уровня psi в плоскости (x, r). */
function traceLine(psi, clip = 7) {
  const field = (x, r) => {
    const a1 = x + A, a2 = x - A;
    const d1 = Math.hypot(a1, r) ** 3, d2 = Math.hypot(a2, r) ** 3;
    const fx = a1 / d1 - a2 / d2, fr = r / d1 - r / d2;
    const m = Math.hypot(fx, fr) || 1;
    return [fx / m, fr / m];
  };
  const beta = Math.acos(L.clamp(1 - psi, -1, 1));
  const eps = 0.03;
  let x = -A - eps * Math.cos(beta), r = eps * Math.sin(beta);
  const pts = [[-A, 0], [x, r]];
  const ds = 0.04;
  let closed = false;
  for (let i = 0; i < 1600; i++) {
    const [f1, g1] = field(x, r);
    const [f2, g2] = field(x + f1 * ds / 2, r + g1 * ds / 2);
    x += f2 * ds; r += g2 * ds;
    if (i % 5 === 0) pts.push([x, r]);
    if (x >= 0) { pts.push([0, r]); closed = true; break; }
    if (Math.hypot(x, r) > clip) break;
  }
  return { pts, closed };
}

/** Спрайт-значки ⊙ и ⊗ (рисуются вручную: символа может не быть в шрифте). */
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
      ctx.beginPath(); ctx.arc(48, 48, 38, 0, Math.PI * 2); ctx.stroke();
      if (out) { ctx.beginPath(); ctx.arc(48, 48, 12, 0, Math.PI * 2); ctx.fill(); }
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
  id: 'coil-magnet-3d',
  title: 'Магнит и катушка: откуда берётся ток',
  codes: ['3.4.1', '3.4.2', '3.4.3', '3.4.5'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'Катушка неподвижна, а заряды в ней поехали. Толкает их не магнит: меняющееся магнитное поле создаёт вокруг себя вихревое электрическое поле E, ' +
        'и оно разгоняет заряды по витку. Точки на проводе — электроны, они идут против стрелки тока I. Яркие линии B проходят сквозь виток: их число пропорционально потоку Φ (Φ = 1 усл. ед., когда магнит в центре катушки). ' +
        'Магнит остановился — поток постоянен, вихревого поля и тока нет.',
    });
    const host = document.createElement('div');
    const note = document.createElement('div');
    note.style.cssText = 'padding:.5em .75em;min-height:2.4em;font-weight:600;font-size:.95rem;line-height:1.3;color:var(--text);border-top:1px solid var(--border);';
    const chartHost = document.createElement('div');
    chartHost.style.borderTop = '1px solid var(--border)';
    ui.stage.append(host, note, chartHost);
    const cv = L.canvas(chartHost, { aspect: 0.3, minHeight: 170, maxHeight: 200, label: 'Графики потока через виток и индукционного тока от времени' });
    d.add(cv.destroy);

    const DEF = { pos: 5, turns: 5, pole: 'N', speed: 1.2 };
    let x = DEF.pos, dir = -1, hold = 0, vel = 0, time = 0;
    let auto = !L.prefersReducedMotion();
    let target = null, settle = 0;
    let eShift = 0;   // сдвиг электронов вдоль провода, витки
    let buf = [];
    let s = null, fb = null;
    let render3d = () => {};

    const sPos = L.slider(ui.controls, { key: 'pos', label: 'Положение магнита <i>d</i>', min: POS_MIN, max: POS_MAX, step: 0.1, value: DEF.pos, unit: 'ед.', format: (v) => L.fmt(v, 1), onInput: onPos });
    const sTurns = L.slider(ui.controls, { key: 'turns', label: 'Число витков <i>N</i>', min: 1, max: 8, step: 1, value: DEF.turns, onInput: onTurns });
    const sSpeed = L.slider(ui.controls, { key: 'speed', label: 'Скорость магнита', min: 0, max: 2, step: 0.1, value: DEF.speed, unit: 'ед./с', format: (v) => L.fmt(v, 1), onInput: () => renderAll(true) });
    const cPole = L.choice(ui.controls, { key: 'pole', label: 'К катушке обращён полюс', value: DEF.pole, onChange: () => renderAll(true),
      options: [{ value: 'N', label: 'N (северный)' }, { value: 'S', label: 'S (южный)' }] });
    const bPlay = L.button(ui.controls, 'Пауза', togglePlay);
    bPlay.classList.add('model-btn--play');
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    function syncPlay() {
      bPlay.textContent = auto ? 'Пауза' : 'Пуск';
      bPlay.setAttribute('aria-pressed', String(auto));
    }
    const frameStart = () => { if (s) s.play(); else if (fb) fb.start(); };
    const frameStop = () => { if (s) s.pause(); else if (fb) fb.stop(); };

    function togglePlay() {
      auto = !auto;
      target = null;
      if (auto) frameStart();
      else { vel = 0; frameStop(); }
      syncPlay();
      renderAll(true);
    }
    function onPos(v) {
      auto = false;
      syncPlay();
      if (s || fb) { target = v; settle = 0.6; frameStart(); }
      else { x = v; vel = 0; }
      renderAll(true);
    }
    function onTurns() {
      rebuildCoil();
      renderAll(true);
    }
    function reset() {
      sPos.set(DEF.pos); sTurns.set(DEF.turns); sSpeed.set(DEF.speed); cPole.set(DEF.pole);
      x = DEF.pos; dir = -1; hold = 0; vel = 0; time = 0; buf = []; target = null;
      auto = !L.prefersReducedMotion();
      s?.resetView();
      rebuildCoil();
      if (auto) frameStart(); else frameStop();
      syncPlay();
      renderAll(true);
    }

    function phys() {
      const N = sTurns.value;
      const f = phi(x);
      const rate = dphi(x) * vel;          // d|Φ|/dt через один виток, усл. ед./с
      const mag = Math.abs(rate);
      const changing = mag >= EPS;
      // B магнита через катушку: N к катушке → вдоль −x, S → вдоль +x (магнит на стороне +x).
      const sm = cPole.value === 'N' ? -1 : 1;
      // Ленц: B_инд противодействует изменению потока. sigma = +1 — B_инд вдоль +x,
      // ток по правому винту вокруг +x (со стороны магнита — против часовой).
      const sigma = changing ? -Math.sign(sm * rate) : 0;
      const emf = changing ? N * mag : 0;  // |ℰ| ~ N·|ΔΦ/Δt|
      return { N, f, rate, mag, changing, sm, sigma, emf, I: sigma * emf };
    }

    function tick(dt) {
      const prev = x;
      if (auto) {
        const v = sSpeed.value;
        if (v > 0) {
          if (hold > 0) hold -= dt;
          else {
            x += dir * v * dt;
            if (x >= POS_MAX) { x = POS_MAX; dir = -1; hold = HOLD; }
            else if (x <= POS_MIN) { x = POS_MIN; dir = 1; hold = HOLD; }
          }
        }
      } else if (target !== null) {
        const st = MANUAL * dt;
        if (Math.abs(target - x) <= st) { x = target; target = null; }
        else x += Math.sign(target - x) * st;
      }
      if (dt > 0) {
        vel = (x - prev) / dt;
        time += dt;
        const p = phys();
        eShift -= p.sigma * L.clamp(0.1 * Math.abs(p.I), 0, 0.7) * dt;  // электроны идут против тока
        buf.push({ t: time, f: p.f, I: p.I });
        while (buf.length && buf[0].t < time - WIN) buf.shift();
      }
      if (!auto && target === null && dt > 0) {
        settle -= dt;
        if (settle <= 0) { vel = 0; frameStop(); renderAll(true); return; }
      }
      renderAll(false);
    }

    let roTime = 0;
    function renderAll(force) {
      render3d();
      drawChart();
      const now = performance.now();
      if (!force && now - roTime < 180) return;
      roTime = now;
      if (auto || target !== null) sPos.set(Math.round(x * 10) / 10);
      const p = phys();
      const cnt = countLevels(p.f) * 4;
      let msg;
      if (p.changing) {
        msg = p.rate > 0 ? 'Поток растёт → <i>B</i><sub>инд</sub> против <i>B</i> магнита' : 'Поток падает → <i>B</i><sub>инд</sub> по <i>B</i> магнита';
      } else if (Math.abs(vel) < 1e-6) {
        msg = 'Магнит стоит → поток не меняется → тока нет';
      } else {
        msg = 'Магнит движется, но поток почти не меняется → тока почти нет';
      }
      note.innerHTML = msg;
      const sign = !p.changing ? '0' : p.rate > 0 ? '+ (растёт)' : '− (падает)';
      ro.set([
        ['Φ через виток, усл. ед.', L.fmt(p.f, 2) + ` (линий: ${cnt} из ${LEVELS * 4})`],
        ['Знак ΔΦ/Δ<i>t</i>', sign],
        ['|ΔΦ/Δ<i>t</i>|', L.fmt(p.changing ? p.mag : 0, 2) + ' усл. ед./с'],
        ['Ток со стороны магнита', p.sigma === 0 ? 'нет' : p.sigma > 0 ? 'против часовой стрелки' : 'по часовой стрелке'],
        ['|ℰ| ~ <i>N</i>·|ΔΦ/Δ<i>t</i>|', L.fmt(p.emf, 2) + ' усл. ед.'],
      ]);
    }

    const countLevels = (f) => {
      let k = 0;
      for (let i = 0; i < LEVELS; i++) if ((i + 0.5) / LEVELS < f) k++;
      return k;
    };

    function drawChart() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const px = 34, pr = 16, top = 16;
      const h1 = Math.round((H - top - 46) * 0.42);
      const r1 = { x: px, y: top, w: W - px - pr, h: h1 };
      const r2 = { x: px, y: top + h1 + 28, w: W - px - pr, h: H - top - h1 - 28 - 8 };
      const t1 = Math.max(WIN, time), t0 = t1 - WIN;
      const g1 = L.graph(ctx, r1, { xMin: t0, xMax: t1, yMin: 0, yMax: 1.05, yTicks: 0.5, xTicks: 2, yLabel: 'Φ' });
      const g2 = L.graph(ctx, r2, { xMin: t0, xMax: t1, yMin: -10, yMax: 10, yTicks: 5, xTicks: 2, xLabel: 't, с', yLabel: 'I' });
      const poly = (g, key, col) => {
        if (buf.length < 2) return;
        ctx.save();
        ctx.beginPath(); ctx.rect(g.rect.x, g.rect.y - 2, g.rect.w, g.rect.h + 4); ctx.clip();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        buf.forEach((b, i) => { const a = g.X(b.t), y = g.Y(b[key]); if (i) ctx.lineTo(a, y); else ctx.moveTo(a, y); });
        ctx.stroke();
        ctx.restore();
      };
      poly(g1, 'f', c.fieldB);
      poly(g2, 'I', c.accent);
    }

    function rebuildCoil() { coilBuild?.(); }
    let coilBuild = null;

    cv.onResize(drawChart);
    d.add(L.onThemeChange(drawChart));
    syncPlay();
    renderAll(true);

    D.stage(host, {
      aspect: 0.62,
      camera: [6.2, 2.4, 8.4],
      target: [1.8, -0.5, 0],
      examView: { position: [1.8, -0.5, 32], up: [0, 1, 0] },
      controls: ui.controls,
      fov: FOV,
    }).then((st) => {
      if (dead) { st?.destroy(); return; }
      if (!st) {
        // Нет 3D: слайдеры, графики и числа всё равно работают.
        fb = L.animator(tick);
        d.add(fb.destroy);
        if (auto) fb.start();
        return;
      }
      s = st;
      d.add(s.destroy);
      build(s);
      s.onFrame(tick);
      if (!auto) s.pause();
      renderAll(true);
    }).catch((e) => console.error(e));

    function build(s) {
      const { THREE, scene } = s;
      const cols = {
        B: () => L.colors().fieldB,
        E: () => L.colors().fieldE,
        I: () => L.colors().accent,
        text: () => L.colors().text,
        muted: () => L.colors().muted,
      };

      // подписи: размер 0,55; на узком экране крупнее, чтобы читались
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

      // ось
      s.line([[-2.8, 0, 0], [6.6, 0, 0]], cols.muted, { dashed: true });

      // --- магнит: локально N на −x, S на +x; поворот на 180° меняет полярность ---
      const mag = new THREE.Group();
      scene.add(mag);
      const half = (color, cx) => {
        const m = s.mesh(new THREE.BoxGeometry(1, 0.7, 0.7), color);
        m.position.set(cx, 0, 0);
        mag.add(m);
      };
      half('#d9302a', -0.5);
      half('#2467c9', 0.5);
      const addPole = (t, px) => { const sp = lab(t, [px, 0, 0], '#ffffff', 0.6); mag.add(sp); };
      addPole('N', -0.5);
      addPole('S', 0.5);

      // материалы линий: яркая (через виток) и бледная
      const matOn = new THREE.MeshStandardMaterial({ roughness: 0.6 });
      const matOff = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.2, depthWrite: false });
      const paintLines = () => { const col = new THREE.Color(L.colors().fieldB); matOn.color.copy(col); matOff.color.copy(col); s.requestRender(); };
      paintLines();
      d.add(L.onThemeChange(paintLines));

      const cone = new THREE.ConeGeometry(0.075, 0.22, 10);
      const up = new THREE.Vector3(0, 1, 0);
      const lines = [];  // { level, side, meshes: [...] }
      const psiLevels = [];
      for (let i = 0; i < LEVELS; i++) psiLevels.push({ psi: ((i + 0.5) / LEVELS) * PSI0, level: i });
      psiLevels.push({ psi: PSI0 * 1.18, level: -1 }, { psi: PSI0 * 1.42, level: -1 });

      const tubeOf = (pts3) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3.map((p) => new THREE.Vector3(...p))), Math.max(12, pts3.length * 2), 0.016, 5, false);
      for (const { psi, level } of psiLevels) {
        const { pts, closed } = traceLine(psi);
        for (let j = 0; j < 4; j++) {
          const th = (j * Math.PI) / 2;
          const to3 = (px, pr) => [px, pr * Math.cos(th), pr * Math.sin(th)];
          const meshes = [];
          const addTube = (arr) => { const m = new THREE.Mesh(tubeOf(arr), matOff); mag.add(m); meshes.push(m); };
          const left = pts.map(([a, b]) => to3(a, b));
          const right = pts.map(([a, b]) => to3(-a, b)).reverse();
          if (closed) addTube(left.concat(right.slice(1)));
          else { addTube(left); addTube(right); }
          // стрелка направления на линии: N → S снаружи магнита
          const k = Math.min(pts.length - 2, Math.round(pts.length * 0.6));
          const a = to3(...pts[k]), b = to3(...pts[k + 1]);
          const dirV = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
          const cm = new THREE.Mesh(cone, matOff);
          cm.position.set(...a);
          cm.quaternion.setFromUnitVectors(up, dirV);
          mag.add(cm);
          meshes.push(cm);
          lines.push({ level, offAxis: j % 2 === 1, meshes });
        }
      }

      // --- катушка: сплошная спираль ---
      const coil = s.tube([[0, 0, 0], [0, 1, 0]], () => '#b87333', 0.04);
      // провода к гальванометру
      const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
      const rodL = s.mesh(rodGeo, () => '#b87333');
      const rodR = s.mesh(rodGeo, () => '#b87333');
      const GY = -2.62;
      const box = s.mesh(new THREE.BoxGeometry(1.5, 0.84, 0.2), () => L.colors().grid);
      box.position.set(0, GY, 0);
      const needle = s.arrow([0, GY - 0.3, 0.14], [0, 1, 0], 0.55, cols.text);
      lab('G', [-0.5, GY, 0.2], cols.text, 0.5);

      // кольцо вихревого поля E
      const ring = s.mesh(new THREE.TorusGeometry(R + 0.22, 0.016, 6, 64), cols.E);
      ring.rotation.y = Math.PI / 2;

      // электроны на проводе
      const eGeo = new THREE.SphereGeometry(0.07, 10, 8);
      const electrons = [];
      for (let i = 0; i < 8 * 4; i++) electrons.push(s.mesh(eGeo, cols.text));

      // векторы
      const vBm = vec(cols.B, '→B_м');
      const vBi = vec(cols.B, '→B_{инд}');
      const vI = vec(cols.I, 'I');
      const vE = vec(cols.E, '→E_{вихр}');

      // значки ⊙ ⊗ на верхнем и нижнем крае витков — для вида как в задании
      const sym = symbolMaterials(THREE, cols.I);
      d.add(L.onThemeChange(() => { sym.paint(); s.requestRender(); }));
      const syms = [];
      for (const side of [1, -1]) for (const col of [-1, 0, 1]) {
        const sp = new THREE.Sprite(sym.dot);
        sp.renderOrder = 11;
        sp.scale.set(0.34, 0.34, 1);
        sp.visible = false;
        scene.add(sp);
        syms.push({ sp, side, col });
      }

      let Lc = 0, nBuilt = 0;
      const setRod = (m, x0, y0, y1) => { m.position.set(x0, (y0 + y1) / 2, 0); m.scale.set(1, Math.abs(y1 - y0), 1); };
      coilBuild = () => {
        const N = sTurns.value;
        if (N === nBuilt) return;
        nBuilt = N;
        Lc = N * PITCH;
        const pts = [];
        const per = 20;
        for (let i = 0; i <= N * per; i++) {
          const u = i / per;
          const th = Math.PI + 2 * Math.PI * u;
          pts.push([-Lc / 2 + PITCH * u, R * Math.cos(th), R * Math.sin(th)]);
        }
        coil.setPoints(pts);
        setRod(rodL, -Lc / 2, -R, GY + 0.42);
        setRod(rodR, Lc / 2, -R, GY + 0.42);
        ring.position.set(-Lc / 2 - 0.34, 0, 0);
      };
      coilBuild();

      let exam = false;
      const baseSet = s.setView;
      s.setView = (name) => {
        exam = name === 'exam';
        s.camera.fov = exam ? FOV_EXAM : FOV;
        s.camera.updateProjectionMatrix();
        baseSet(name);
        renderAll(true);
      };

      let lastK = -1, lastExam = null;
      render3d = () => {
        const p = phys();
        mag.position.x = x;
        mag.rotation.y = cPole.value === 'N' ? 0 : Math.PI;

        // какие линии идут сквозь виток
        const k = countLevels(p.f);
        if (k !== lastK || exam !== lastExam) {
          lastK = k; lastExam = exam;
          for (const ln of lines) {
            const on = ln.level >= 0 && ln.level < k && ((ln.level + 0.5) / LEVELS) < p.f;
            ln.meshes.forEach((m) => { m.material = on ? matOn : matOff; m.visible = !(exam && ln.offAxis); });
          }
        }

        // векторы поля
        const lenB = 0.3 + 1.2 * p.f;
        vBm.set([-p.sm * lenB / 2, 0.74, 0], [p.sm, 0, 0], lenB);
        if (p.sigma !== 0) {
          const lenI = L.clamp(0.35 + 0.22 * p.emf, 0.35, 1.5);
          vBi.set([-p.sigma * lenI / 2, -0.74, 0], [p.sigma, 0, 0], lenI);
          // sigma = +1: спереди (z = +R) ток идёт вниз
          const a = 0.95;
          vI.set([Lc / 2 + 0.16, p.sigma * a / 2, R + 0.12], [0, -p.sigma, 0], a);
          vE.set([-Lc / 2 - 0.34, p.sigma * a / 2, R + 0.22], [0, -p.sigma, 0], a);
          ring.visible = true;
        } else {
          vBi.hide(); vI.hide(); vE.hide();
          ring.visible = false;
        }

        // электроны на витках
        const N = p.N;
        const total = N * 4;
        electrons.forEach((m, i) => {
          if (i >= total) { m.visible = false; return; }
          m.visible = true;
          let u = (i / 4 + eShift) % N;
          if (u < 0) u += N;
          const th = Math.PI + 2 * Math.PI * u;
          m.position.set(-Lc / 2 + PITCH * u, R * Math.cos(th), R * Math.sin(th));
        });

        // гальванометр
        const ang = L.clamp(p.I * 0.4, -1.2, 1.2);
        needle.set([0, GY - 0.3, 0.14], [Math.sin(ang), Math.cos(ang), 0], 0.55);

        // значки тока на срезе витка (только вид как в задании)
        const xs = { '-1': -Lc / 2, 0: 0, 1: Lc / 2 };
        for (const it of syms) {
          const show = exam && p.sigma !== 0 && (it.col === 0 || Lc > 0.5);
          it.sp.visible = show;
          if (!show) continue;
          it.sp.position.set(xs[it.col], it.side * (R + 0.24), 0);
          // sigma = +1: вверху ток на зрителя (⊙), внизу от зрителя (⊗)
          it.sp.material = it.side * p.sigma > 0 ? sym.dot : sym.cross;
        }
        s.requestRender();
      };
      fitLabels();
    }

    return { destroy: d.run };
  },
};
