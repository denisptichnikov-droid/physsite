// 3D-модель «Перемычка на рельсах, поле B наклонено»: |ℰ| = Blv sin α, α — угол между B и плоскостью рельсов.
// Координаты: рельсы вдоль x, перемычка вдоль z, y вверх. B = B(cos α, sin α, 0), v = (v, 0, 0).
// Ток в перемычке вдоль +z при v·B_y > 0; сила на перемычку F = I_z·l·(−B_y, B_x, 0).
import * as L from './_lib.js';
import * as D from './_3d.js';

const SLOW = 0.1;                // анимация замедлена в 10 раз (как в плоской модели)
const RAIL_LEN = 2.15;           // длина рельсов, м
const X_MIN = 0.15, X_MAX = 2.0; // пределы положения перемычки, м
const K = 2.6;                   // единиц сцены на метр
const XC = (RAIL_LEN * K) / 2;   // середина рельсов на сцене
const TRIAD = [1.2, 0, -1.75];   // где нарисован вектор B с углом α
const FOV = 40, FOV_FLAT = 12;

function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
}

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
  id: 'rails-3d',
  title: 'Перемычка на рельсах в наклонном поле',
  codes: ['3.4.1', '3.4.3', '3.4.4', '3.4.5', '3.3.3'],
  mount(el) {
    const d = L.disposer();
    let dead = false;
    d.add(() => { dead = true; });
    const ui = L.layout(el, {
      caption: 'α — угол между вектором B и плоскостью рельсов (в ней лежат l и v). Поток создаёт только вертикальная составляющая B sin α, поэтому |ℰ| = Blv sin α. ' +
        'Скорость постоянна только потому, что внешняя сила Fвн тянет перемычку: она равна горизонтальной составляющей силы Ампера, иначе перемычка тормозила бы. ' +
        'Полная сила Ампера FA = IBl перпендикулярна B, её вертикальная часть IBl cos α прижимает перемычку к рельсам или приподнимает. Длины стрелок сил условные. Анимация замедлена в 10 раз.',
    });
    const host = document.createElement('div');
    const note = document.createElement('div');
    note.style.cssText = 'padding:.5em .75em;min-height:2.4em;font-weight:600;font-size:.95rem;line-height:1.3;color:var(--text);border-top:1px solid var(--border);';
    ui.stage.append(host, note);

    const DEF = { B: 0.5, l: 0.4, v: 2, alpha: 60, R: 2, x: 0.7 };
    let x = DEF.x;
    let playing = !L.prefersReducedMotion();
    let atEdge = false;
    let s = null, fb = null;
    let render3d = () => {};

    const onParam = () => { atEdge = false; renderAll(true); };
    const sB = L.slider(ui.controls, { key: 'B', label: 'Индукция <i>B</i>', min: 0.1, max: 2, step: 0.1, value: DEF.B, unit: 'Тл', onInput: onParam });
    const sL = L.slider(ui.controls, { key: 'l', label: 'Длина перемычки <i>l</i>', min: 0.2, max: 1, step: 0.05, value: DEF.l, unit: 'м', onInput: onParam });
    const sV = L.slider(ui.controls, { key: 'v', label: 'Скорость <i>v</i> (+ вправо)', min: -5, max: 5, step: 0.5, value: DEF.v, unit: 'м/с', onInput: onParam });
    const sA = L.slider(ui.controls, { key: 'alpha', label: 'Угол α (минус — <i>B</i> вниз)', min: -90, max: 90, step: 5, value: DEF.alpha, unit: '°', format: (v) => String(v).replace('-', '−'), onInput: onParam });
    const sR = L.slider(ui.controls, { key: 'R', label: 'Сопротивление <i>R</i>', min: 0.5, max: 10, step: 0.5, value: DEF.R, unit: 'Ом', onInput: onParam });
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
      if (playing) {
        // у края: новый проход начинается с начала рельсов
        const v = sV.value;
        if (v > 0 && x >= X_MAX) x = X_MIN;
        else if (v < 0 && x <= X_MIN) x = X_MAX;
        atEdge = false;
        frameStart();
      } else frameStop();
      syncPlay();
      renderAll(true);
    }
    function reset() {
      sB.set(DEF.B); sL.set(DEF.l); sV.set(DEF.v); sA.set(DEF.alpha); sR.set(DEF.R);
      x = DEF.x; atEdge = false;
      playing = !L.prefersReducedMotion();
      s?.resetView();
      if (playing) frameStart(); else frameStop();
      syncPlay();
      renderAll(true);
    }

    function phys() {
      const B = sB.value, l = sL.value, v = sV.value, R = sR.value, aDeg = sA.value;
      const a = L.deg(aDeg);
      const sa = aDeg === 0 ? 0 : Math.abs(aDeg) === 90 ? Math.sign(aDeg) : Math.sin(a);
      const ca = Math.abs(aDeg) === 90 ? 0 : Math.cos(a);
      const emf = B * l * Math.abs(v) * Math.abs(sa);   // |ℰ| = Blv sin α
      const I = emf / R;                                // I = ℰ/R
      const FA = I * B * l;                             // полная сила Ампера: перемычка ⟂ B
      const FAh = I * B * l * Math.abs(sa);             // горизонтальная часть = F_вн
      const Phi = B * Math.abs(sa) * l * x;             // Φ = B sin α · l x
      const flowing = emf > 0;
      // +1 — ток в перемычке вдоль +z: при виде сверху по часовой стрелке
      const iz = flowing ? Math.sign(v * sa) : 0;
      const grows = flowing && v > 0;                   // |Φ| растёт, когда контур расширяется
      return { B, l, v, R, aDeg, sa, ca, emf, I, FA, FAh, Phi, flowing, iz, grows };
    }

    function tick(dt) {
      const v = sV.value;
      if (v !== 0 && dt > 0) {
        x += v * SLOW * dt;
        if (x >= X_MAX || x <= X_MIN) {
          x = L.clamp(x, X_MIN, X_MAX);
          atEdge = true;
          playing = false;
          frameStop();
          syncPlay();
          renderAll(true);
          return;
        }
      }
      renderAll(false);
    }

    let roTime = 0;
    function renderAll(force) {
      render3d();
      const now = performance.now();
      if (!force && now - roTime < 180) return;
      roTime = now;
      const p = phys();
      let msg;
      if (p.v === 0) msg = '<i>v</i> = 0: площадь контура не меняется → ℰ = 0, тока и сил нет';
      else if (p.sa === 0) msg = 'α = 0: <i>B</i> лежит в плоскости рельсов, поток равен нулю и не меняется → тока нет';
      else msg = `Контур ${p.grows ? 'расширяется, поток растёт → <i>B</i><sub>инд</sub> против' : 'сужается, поток падает → <i>B</i><sub>инд</sub> по'} вертикальной части <i>B</i>. <i>F</i><sub>вн</sub> уравновешивает торможение`;
      if (atEdge) msg = 'Перемычка дошла до края рельсов: пауза. «Пуск» начнёт новый проход. Числа — для заданной скорости';
      note.innerHTML = msg;
      ro.set([
        ['|ℰ| = <i>Blv</i> sin α', f3(p.emf) + ' В'],
        ['<i>I</i> = ℰ/<i>R</i>', f3(p.I) + ' А'],
        ['<i>F</i><sub>вн</sub> = <i>IBl</i> sin α (гориз. часть <i>F</i><sub>A</sub>)', f3(p.FAh) + ' Н'],
        ['Полная <i>F</i><sub>A</sub> = <i>IBl</i>', f3(p.FA) + ' Н'],
        ['Φ = <i>B</i> sin α · <i>lx</i>', f3(p.Phi) + ' Вб' + (p.flowing ? (p.grows ? ', растёт' : ', падает') : ', постоянен')],
        ['Ток (вид сверху)', p.iz === 0 ? 'нет' : p.iz > 0 ? 'по часовой стрелке' : 'против часовой стрелки'],
      ]);
    }

    syncPlay();
    renderAll(true);

    D.stage(host, {
      aspect: 0.68,
      camera: [5.6, 3.2, 6.2],
      target: [XC, 0.3, 0],
      examView: { position: [XC, 25.3, 0], up: [0, 0, -1] },
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
        F: () => L.colors().force,
        V: () => L.colors().velocity,
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
        const sp = text ? lab(text, [0, 0, 0], colorFn) : null;
        if (sp) sp.visible = false;
        return {
          set(o, dv, len) {
            a.set(o, dv, len);
            if (!sp) return;
            const m = Math.hypot(...dv) || 1;
            const show = len > 1e-3;
            sp.visible = show;
            if (show) sp.position.set(o[0] + dv[0] / m * (len + 0.3) + off[0], o[1] + dv[1] / m * (len + 0.3) + off[1], o[2] + dv[2] / m * (len + 0.3) + off[2]);
          },
          hide() { a.setVisible(false); if (sp) sp.visible = false; },
        };
      };

      // плоскость рельсов
      const plane = s.mesh(new THREE.PlaneGeometry(RAIL_LEN * K + 1, 4.4), () => L.colors().grid, { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(XC, -0.03, 0);

      // рельсы, провод, резистор, перемычка
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const rail1 = s.mesh(boxGeo, cols.muted), rail2 = s.mesh(boxGeo, cols.muted), wire = s.mesh(boxGeo, cols.muted);
      const resistor = s.mesh(boxGeo, cols.text);
      const bar = s.mesh(boxGeo, cols.text);
      lab('R', [-0.42, 0.22, 0], cols.text);
      const lLab = lab('l', [0, 0, 0], cols.text);

      // контур S
      const loop = s.mesh(new THREE.PlaneGeometry(1, 1), cols.B, { transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
      loop.rotation.x = -Math.PI / 2;
      loop.position.y = 0.005;

      // наклонные линии поля
      const matOn = new THREE.MeshStandardMaterial({ roughness: 0.6 });
      const matOff = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.14, depthWrite: false });
      const paintLines = () => { const col = new THREE.Color(L.colors().fieldB); matOn.color.copy(col); matOff.color.copy(col); s.requestRender(); };
      paintLines();
      d.add(L.onThemeChange(paintLines));
      const LEN = 2.7;
      const lineGeo = new THREE.CylinderGeometry(0.014, 0.014, 2 * LEN, 5);
      const coneGeo = new THREE.ConeGeometry(0.075, 0.22, 10);
      const up = new THREE.Vector3(0, 1, 0);
      const fieldLines = [];
      for (let j = -4; j <= 4; j++) {
        for (const z of [-1.2, -0.4, 0.4, 1.2]) {
          const m = new THREE.Mesh(lineGeo, matOff);
          const c = new THREE.Mesh(coneGeo, matOff);
          scene.add(m, c);
          fieldLines.push({ p: j * 0.75, z, m, c });
        }
      }

      // треугольник векторов B: плоскость z = TRIAD[2]
      const O = TRIAD;
      const vB = vec(cols.B, '→B', [-0.28, 0, 0]);
      const vBp = vec(cols.B, 'B_⊥', [0.42, -0.1, 0]);
      s.line([O, [O[0] + 2.6, O[1], O[2]]], cols.muted, { dashed: true });
      const arc = s.tube([], cols.text, 0.026);
      const arcLab = lab('α', [0, 0, 0], cols.text, 0.6);

      // векторы на перемычке
      const vV = vec(cols.V, '→v');
      const vFA = vec(cols.F, '→F_A');
      const vFh = vec(cols.F, 'F_{A гор}', [0, -0.3, 0]);
      const vFe = vec(cols.F, '→F_{вн}', [0, 0.26, 0]);
      const vIbar = vec(cols.I, 'I');
      const vI1 = vec(cols.I), vI2 = vec(cols.I), vI3 = vec(cols.I);
      const vBind = vec(cols.B, '→B_{инд}');

      // значки: поле на виде сверху и ток в перемычке на виде сбоку
      const symB = symbolMaterials(THREE, cols.B);
      const symI = symbolMaterials(THREE, cols.I);
      d.add(L.onThemeChange(() => { symB.paint(); symI.paint(); s.requestRender(); }));
      const grid = [];
      for (let i = 0; i < 8; i++) for (let k = -2; k <= 2; k++) {
        const sp = new THREE.Sprite(symB.dot);
        sp.scale.set(0.24, 0.24, 1);
        sp.position.set(0.25 + i * 0.74, 0.02, k * 0.8);
        sp.visible = false;
        scene.add(sp);
        grid.push(sp);
      }
      const barSym = new THREE.Sprite(symI.dot);
      barSym.renderOrder = 11;
      barSym.scale.set(0.34, 0.34, 1);
      barSym.visible = false;
      scene.add(barSym);

      const bindSym = new THREE.Sprite(symB.dot);
      bindSym.renderOrder = 11;
      bindSym.scale.set(0.34, 0.34, 1);
      bindSym.visible = false;
      scene.add(bindSym);
      const bindLab = lab('→B_{инд}', [0, 0, 0], cols.B);
      bindLab.visible = false;

      let view = 'free';
      let lastDeg = null, lastHl = null, bpArgs = null, hasArc = false;
      const baseSet = s.setView;
      const bSide = L.button(ui.controls, 'Вид сбоку: угол α', () => {
        if (view === 'side') { s.setView('free'); return; }
        view = 'side';
        s.camera.fov = FOV_FLAT;
        s.camera.updateProjectionMatrix();
        s.camera.position.set(XC, 0.3, 25);
        s.camera.up.set(0, 1, 0);
        s.orbit.target.set(XC, 0.3, 0);
        s.orbit.update();
        bSide.textContent = 'Свободный вид';
        renderAll(true);
      });
      d.add(() => bSide.remove());
      s.setView = (name) => {
        view = name === 'exam' ? 'exam' : 'free';
        s.camera.fov = name === 'exam' ? FOV_FLAT : FOV;
        s.camera.updateProjectionMatrix();
        baseSet(name);
        bSide.textContent = 'Вид сбоку: угол α';
        renderAll(true);
      };

      render3d = () => {
        const p = phys();
        const hl = (p.l * K) / 2;            // половина перемычки на сцене
        const xr = x * K;
        const ca = p.ca, sa = p.sa;

        if (hl !== lastHl) {
          lastHl = hl;
          const len = RAIL_LEN * K;
          rail1.scale.set(len, 0.07, 0.07); rail1.position.set(len / 2, 0, hl);
          rail2.scale.set(len, 0.07, 0.07); rail2.position.set(len / 2, 0, -hl);
          wire.scale.set(0.07, 0.07, 2 * hl); wire.position.set(0, 0, 0);
          const rl = Math.min(0.62, hl * 1.2);
          resistor.scale.set(0.24, 0.24, rl); resistor.position.set(0, 0.04, 0);
          bar.scale.set(0.11, 0.11, 2 * hl + 0.34);
        }
        bar.position.set(xr, 0.06, 0);
        lLab.position.set(xr, 0.3, -hl - 0.36);
        loop.scale.set(xr, 2 * hl, 1);
        loop.position.x = xr / 2;

        // линии поля: перестраиваются при смене угла; подсвечены те, что проходят сквозь контур
        const bh = [ca, sa, 0];
        const eh = [-sa, ca];
        const showLines = view !== 'exam';
        if (p.aDeg !== lastDeg) {
          lastDeg = p.aDeg;
          const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(ca, sa, 0));
          for (const ln of fieldLines) {
            const cx = XC + ln.p * eh[0], cy = ln.p * eh[1];
            ln.m.position.set(cx, cy, ln.z);
            ln.m.quaternion.copy(q);
            ln.c.position.set(cx + ca * LEN * 0.82, cy + sa * LEN * 0.82, ln.z);
            ln.c.quaternion.copy(q);
          }
          // вектор B, составляющая и дуга
          const Lb = 2.1;
          vB.set(O, bh, Lb);
          const tip = [O[0] + ca * Lb, O[1] + sa * Lb, O[2]];
          if (Math.abs(sa) > 1e-6 && Math.abs(ca) > 1e-6) {
            bpArgs = [[tip[0], O[1], O[2]], [0, Math.sign(sa), 0], Lb * Math.abs(sa)];
          } else {
            bpArgs = null;   // при α = 0 и α = ±90° разложение не нужно
          }
          const ang = L.deg(p.aDeg);
          hasArc = Math.abs(ang) > 0.03;
          if (hasArc) {
            const pts = [];
            const n = Math.max(4, Math.ceil(Math.abs(ang) / 0.14));
            const r = 0.95;
            for (let i = 0; i <= n; i++) { const t = (ang * i) / n; pts.push([O[0] + r * Math.cos(t), O[1] + r * Math.sin(t), O[2]]); }
            arc.setPoints(pts);
            arcLab.position.set(O[0] + 1.32 * Math.cos(ang / 2), O[1] + 1.32 * Math.sin(ang / 2), O[2]);
          }
        }
        // сверху угол α не виден: дугу и разложение показываем только в 3D и сбоку
        arc.obj.visible = arcLab.visible = hasArc && view !== 'exam';
        if (bpArgs && view !== 'exam') vBp.set(...bpArgs); else vBp.hide();
        for (const ln of fieldLines) {
          // пересечение прямой с плоскостью y = 0: x₀ = XC − p/sin α
          const on = sa !== 0 && Math.abs(ln.z) <= hl && (() => { const x0 = XC - ln.p / sa; return x0 >= 0 && x0 <= xr; })();
          const mat = on ? matOn : matOff;
          ln.m.material = mat; ln.c.material = mat;
          ln.m.visible = showLines; ln.c.visible = showLines;
        }

        // скорость
        const sv = Math.sign(p.v);
        if (p.v !== 0) vV.set([xr, 0.5, hl + 0.3], [sv, 0, 0], 0.5 + 0.22 * Math.abs(p.v));
        else vV.hide();

        // силы — единый масштаб, чтобы разложение сходилось
        if (p.flowing) {
          const Lt = 0.75 + 1.1 * (p.FA / (p.FA + 0.25));
          const k = Lt / p.FA;
          const fx = -p.iz * p.l * p.B * sa * p.I;     // F_x = −I_z l B_y
          const fy = p.iz * p.l * p.B * ca * p.I;      // F_y = I_z l B_x
          const o = [xr, 0.1, 0];
          if (view !== 'exam') vFA.set(o, [fx, fy, 0], Lt);   // сверху видна только горизонтальная часть
          else vFA.hide();
          if (Math.abs(ca) > 0.03) vFh.set(o, [-sv, 0, 0], Math.abs(fx) * k);
          else vFh.hide();
          vFe.set(o, [sv, 0, 0], Math.abs(fx) * k);

          // ток по контуру: перемычка +z·iz, рельс z=+hl — к резистору, резистор −z·iz, рельс z=−hl — от резистора
          const a = Math.min(0.9, 2 * hl * 0.7);
          const xm = xr / 2;
          const ar = Math.min(0.95, xr * 0.5);
          vIbar.set([xr - 0.2, 0.14, -p.iz * a / 2], [0, 0, p.iz], a);
          vI1.set([xm + p.iz * ar / 2, 0.14, hl], [-p.iz, 0, 0], ar);
          vI2.set([0.2, 0.14, p.iz * a / 2], [0, 0, -p.iz], a);
          vI3.set([xm - p.iz * ar / 2, 0.14, -hl], [p.iz, 0, 0], ar);
          // поле индукционного тока внутри контура
          if (view === 'exam') vBind.hide();                  // на виде сверху — значок
          else vBind.set([xr * 0.4, 0.05, 0], [0, -p.iz, 0], 0.9);
          bindSym.visible = view === 'exam';
          bindSym.position.set(xr * 0.4, 0.04, 0);
          bindSym.material = p.iz > 0 ? symB.cross : symB.dot;   // по часовой сверху → поле вниз, от зрителя
          bindLab.visible = view === 'exam';
          bindLab.position.set(xr * 0.4, 0.04, Math.min(hl - 0.1, 0.42));
        } else {
          [vFA, vFh, vFe, vIbar, vI1, vI2, vI3, vBind].forEach((a) => a.hide());
          bindSym.visible = bindLab.visible = false;
        }

        // значки: вид сверху — вертикальная часть B; вид сбоку — ток в перемычке
        const showGrid = view === 'exam' && sa !== 0;
        const mat = sa > 0 ? symB.dot : symB.cross;
        grid.forEach((sp) => { sp.visible = showGrid; sp.material = mat; });
        const showBar = view === 'side' && p.iz !== 0;
        barSym.visible = showBar;
        if (showBar) {
          barSym.position.set(xr, 0.06, hl + 0.2);
          barSym.material = p.iz > 0 ? symI.dot : symI.cross;  // +z — на зрителя
        }
        s.requestRender();
      };
      fitLabels();
    }

    return { destroy: d.run };
  },
};
