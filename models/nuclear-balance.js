// Модель «Баланс A и Z в ядерных реакциях»: правила смещения (α, β⁻, β⁺, γ), реакции, режим «реши сам».
// Формулы — CLAUDE.md, часть B, 4.3.1, 4.3.2, 4.3.4. Модель на DOM (без canvas).
import * as L from './_lib.js';

// Символы и названия элементов, индекс = Z (1…96)
const SYM = [''].concat((
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn '
  + 'Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd '
  + 'Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th '
  + 'Pa U Np Pu Am Cm').split(' '));
const NAMES = [''].concat((
  'водород гелий литий бериллий бор углерод азот кислород фтор неон '
  + 'натрий магний алюминий кремний фосфор сера хлор аргон калий кальций '
  + 'скандий титан ванадий хром марганец железо кобальт никель медь цинк '
  + 'галлий германий мышьяк селен бром криптон рубидий стронций иттрий цирконий '
  + 'ниобий молибден технеций рутений родий палладий серебро кадмий индий олово '
  + 'сурьма теллур иод ксенон цезий барий лантан церий празеодим неодим '
  + 'прометий самарий европий гадолиний тербий диспрозий гольмий эрбий тулий иттербий '
  + 'лютеций гафний тантал вольфрам рений осмий иридий платина золото ртуть '
  + 'таллий свинец висмут полоний астат радон франций радий актиний торий '
  + 'протактиний уран нептуний плутоний америций кюрий').split(' '));
const ZMAX = SYM.length - 1; // 96

const MODES = [
  { value: 'alpha', label: 'α-распад' },
  { value: 'beta-', label: 'β⁻-распад' },
  { value: 'beta+', label: 'β⁺-распад' },
  { value: 'gamma', label: 'γ-излучение' },
  { value: 'reaction', label: 'ядерная реакция' },
];
const MODE_NAME = { alpha: 'α-распад', 'beta-': 'β⁻-распад', 'beta+': 'β⁺-распад', gamma: 'γ-излучение' };
const RULE = {
  alpha: 'α-распад: A уменьшается на 4, Z — на 2',
  'beta-': 'β⁻-распад: A не меняется, Z увеличивается на 1',
  'beta+': 'β⁺-распад: A не меняется, Z уменьшается на 1',
  gamma: 'γ-излучение: A и Z не меняются',
};

// Исходные ядра; real — характерный для ядра тип распада
const NUCLIDES = [
  { id: 'U238', A: 238, Z: 92, real: 'alpha' },
  { id: 'Ra226', A: 226, Z: 88, real: 'alpha' },
  { id: 'Po210', A: 210, Z: 84, real: 'alpha' },
  { id: 'C14', A: 14, Z: 6, real: 'beta-' },
  { id: 'I131', A: 131, Z: 53, real: 'beta-' },
  { id: 'Co60', A: 60, Z: 27, real: 'beta-' },
  { id: 'K40', A: 40, Z: 19, real: 'beta-' },
  { id: 'Na22', A: 22, Z: 11, real: 'beta+' },
];

// Частицы: A, Z, символ; signed — писать знак у Z (позитрон «+1»)
const PT = {
  He: { A: 4, Z: 2, X: 'He' },
  n: { A: 1, Z: 0, X: 'n' },
  p: { A: 1, Z: 1, X: 'p' },
  em: { A: 0, Z: -1, X: 'e' },
  ep: { A: 0, Z: 1, X: 'e', signed: true },
  gamma: { A: 0, Z: 0, X: 'γ' },
  anu: { A: 0, Z: 0, X: 'ν̃' },
  nu: { A: 0, Z: 0, X: 'ν' },
};
const el = (A, Z) => ({ A, Z, X: SYM[Z] });

// Типовые реакции; unknown: 'AZ' — найти A и Z частицы (с коэффициентом k), 'k' — найти число частиц
const REACTIONS = [
  { title: 'Резерфорд (1919): первая ядерная реакция, открытие протона', left: [el(14, 7), PT.He], right: [el(17, 8), { unknown: 'AZ', k: 1 }], ans: { A: 1, Z: 1 } },
  { title: 'Чедвик (1932): открытие нейтрона', left: [el(9, 4), PT.He], right: [el(12, 6), { unknown: 'AZ', k: 1 }], ans: { A: 1, Z: 0 } },
  { title: 'Ирен и Фредерик Жолио-Кюри (1934): искусственная радиоактивность', left: [el(27, 13), PT.He], right: [{ unknown: 'AZ', k: 1 }, PT.n], ans: { A: 30, Z: 15 } },
  { title: 'Термоядерный синтез дейтерия и трития', left: [el(2, 1), el(3, 1)], right: [el(4, 2), { unknown: 'AZ', k: 1 }], ans: { A: 1, Z: 0 } },
  { title: 'Получение трития из лития', left: [el(6, 3), PT.n], right: [{ unknown: 'AZ', k: 1 }, PT.He], ans: { A: 3, Z: 1 } },
  { title: 'Кокрофт и Уолтон (1932): расщепление лития протонами', left: [el(7, 3), PT.p], right: [{ unknown: 'AZ', k: 2 }], ans: { A: 4, Z: 2 } },
  { title: 'β⁻-распад углерода-14 (радиоуглеродный метод)', left: [el(14, 6)], right: [el(14, 7), { unknown: 'AZ', k: 1 }, PT.anu], ans: { A: 0, Z: -1 } },
  { title: 'Деление урана-235 нейтроном: сколько нейтронов вылетает?', left: [el(235, 92), PT.n], right: [el(141, 56), el(92, 36), { unknown: 'k', A: 1, Z: 0, X: 'n' }], ans: { k: 3 } },
];

const SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const supStr = (n) => String(n).split('').map((ch) => SUPD[ch] || ch).join('');
const zStr = (Z, signed) => (Z < 0 ? `−${-Z}` : signed && Z > 0 ? `+${Z}` : String(Z));
const symOf = (Z) => (Z >= 1 && Z <= ZMAX ? SYM[Z] : '?');
const nameOf = (A, Z) => (Z >= 1 && Z <= ZMAX ? `${NAMES[Z]}-${A}` : '—');

/** Запись ядра/частицы: A сверху слева, Z снизу слева. */
function nucHTML(A, Z, X, signed = false) {
  return `<span class="nb-nuc"><span class="nb-az"><sup>${A}</sup><sub>${zStr(Z, signed)}</sub></span><span class="nb-x">${X}</span></span>`;
}

/** Что за частица/ядро с данными A и Z. */
function identify(A, Z) {
  if (A === 0 && Z === -1) return { html: nucHTML(0, -1, 'e'), name: 'электрон (β⁻-частица)' };
  if (A === 0 && Z === 1) return { html: nucHTML(0, 1, 'e', true), name: 'позитрон (β⁺-частица)' };
  if (A === 0 && Z === 0) return { html: nucHTML(0, 0, 'γ'), name: 'γ-квант (A = 0, Z = 0)' };
  if (A === 1 && Z === 0) return { html: nucHTML(1, 0, 'n'), name: 'нейтрон' };
  if (A === 1 && Z === 1) return { html: nucHTML(1, 1, 'p'), name: 'протон (ядро водорода ¹H)' };
  if (A === 4 && Z === 2) return { html: nucHTML(4, 2, 'He'), name: 'α-частица (ядро гелия-4)' };
  if (Z >= 1 && Z <= ZMAX && A >= Z) return { html: nucHTML(A, Z, SYM[Z]), name: `ядро ${nameOf(A, Z)}` };
  return null;
}

const STYLE = `
.nb-eq{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.2rem .45rem;padding:.9rem .5rem .4rem;font-size:1.4rem;line-height:2.1;color:var(--text);}
.nb-nuc{display:inline-flex;align-items:center;white-space:nowrap;}
.nb-az{display:inline-flex;flex-direction:column;align-items:flex-end;font-size:.6em;line-height:1.1;margin-right:.08em;}
.nb-az sup,.nb-az sub{vertical-align:baseline;position:static;font-size:1em;line-height:1.1;}
.nb-op{color:var(--muted);}
.nb-q{display:inline-block;min-width:1.7em;padding:0 .3em;border:2px dashed var(--accent);border-radius:6px;color:var(--accent);font-weight:700;text-align:center;line-height:1.5;}
.nb-ans{display:inline-flex;align-items:center;color:var(--vec-velocity);font-weight:600;}
.nb-title{margin:.2rem .5rem 0;text-align:center;color:var(--muted);font-size:.9rem;}
.nb-solve{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:flex-end;justify-content:center;padding:.4rem .5rem;}
.nb-field{display:flex;flex-direction:column;gap:.2rem;font-size:.9rem;color:var(--text);}
.nb-field input{width:7em;font:inherit;padding:.3rem .45rem;border:1px solid var(--grid);border-radius:6px;background:var(--bg);color:var(--text);}
.nb-status{min-height:1.5em;padding:.2rem .5rem .6rem;text-align:center;font-size:.95rem;color:var(--text);}
.nb-status .nb-nuc{font-size:1.15em;}
.nb-ok{color:var(--vec-velocity);font-weight:600;}
.nb-bad{color:var(--vec-force);font-weight:600;}
.nb-note{margin:0 .5rem .6rem;text-align:center;color:var(--muted);font-size:.85rem;}
.nb-hidden{display:none !important;}
`;

let uid = 0;

export default {
  id: 'nuclear-balance',
  title: 'Баланс A и Z в ядерных реакциях',
  codes: ['4.3.1', '4.3.2', '4.3.4'],
  mount(root) {
    const d = L.disposer();
    const pre = `nb${++uid}-${Math.random().toString(36).slice(2, 6)}`;
    const on = (t, ev, fn) => { t.addEventListener(ev, fn); d.add(() => t.removeEventListener(ev, fn)); };
    const ui = L.layout(root, {
      caption: 'В любой ядерной реакции и любом распаде сохраняются сумма массовых чисел A и сумма зарядовых чисел Z. '
        + 'Запись ядра: A — сверху слева, Z — снизу слева; число нейтронов N = A − Z.',
    });
    const style = document.createElement('style');
    style.textContent = STYLE;
    ui.root.prepend(style);
    d.add(() => style.remove());

    // сцена: уравнение, подпись, поля ввода, статус
    const title = document.createElement('p'); title.className = 'nb-title';
    const eq = document.createElement('div'); eq.className = 'nb-eq'; eq.setAttribute('aria-live', 'polite');
    const note = document.createElement('p'); note.className = 'nb-note';
    const solveBox = document.createElement('div'); solveBox.className = 'nb-solve';
    const status = document.createElement('div'); status.className = 'nb-status'; status.setAttribute('aria-live', 'polite');
    ui.stage.append(title, eq, note, solveBox, status);

    function field(id, labelText) {
      const w = document.createElement('div'); w.className = 'nb-field';
      const lab = document.createElement('label'); lab.htmlFor = id; lab.innerHTML = labelText;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = id; inp.step = '1'; inp.inputMode = 'numeric';
      w.append(lab, inp);
      solveBox.append(w);
      return { w, inp };
    }
    const fA = field(`${pre}-A`, 'A — массовое число «?»');
    const fZ = field(`${pre}-Z`, 'Z — зарядовое число «?»');
    const fK = field(`${pre}-K`, 'x — число нейтронов');
    const bCheck = L.button(solveBox, 'Проверить', check);
    const bShow = L.button(solveBox, 'Показать ответ', () => { revealed = true; checked = null; render(); });
    for (const f of [fA, fZ, fK]) {
      on(f.inp, 'input', () => { checked = null; renderStatus(); });
      on(f.inp, 'keydown', (e) => { if (e.key === 'Enter') check(); });
    }

    // управление
    const mode = L.choice(ui.controls, { label: 'Процесс', options: MODES, value: 'alpha', onChange: changed });
    const selNuc = select(ui.controls, {
      label: 'Исходное ядро',
      options: NUCLIDES.map((n) => ({ value: n.id, label: `${supStr(n.A)}${SYM[n.Z]} — ${nameOf(n.A, n.Z)}` })),
      value: NUCLIDES[0].id,
    });
    const selReac = select(ui.controls, {
      label: 'Реакция',
      options: REACTIONS.map((r, i) => ({ value: String(i), label: `${i + 1}. ${reactionText(r)}` })),
      value: '0',
    });
    const solve = L.checkbox(ui.controls, { label: 'Режим «реши сам» (найти продукт распада)', checked: false, onChange: changed });
    L.button(ui.controls, 'Сброс', reset, { reset: true });
    const ro = L.readout(ui.readout);

    let revealed = false;
    let checked = null; // результат последней проверки

    function select(parent, { label, options, value }) {
      const wrap = document.createElement('div');
      wrap.className = 'model-control';
      const id = `${pre}-sel-${parent.childElementCount}`;
      const lab = document.createElement('label');
      lab.htmlFor = id;
      const sp = document.createElement('span');
      sp.className = 'model-control__label';
      sp.textContent = label;
      lab.append(sp);
      const sel = document.createElement('select');
      sel.id = id; sel.className = 'model-select';
      for (const o of options) {
        const op = document.createElement('option');
        op.value = o.value; op.textContent = o.label;
        sel.append(op);
      }
      sel.value = value;
      on(sel, 'change', changed);
      wrap.append(lab, sel);
      parent.append(wrap);
      return { el: wrap, get value() { return sel.value; }, set(v) { sel.value = String(v); } };
    }

    function termText(t) {
      if (t.unknown === 'AZ') return (t.k > 1 ? `${t.k}·` : '') + '?';
      if (t.unknown === 'k') return `x·${supStr(t.A)}${t.X}`;
      return supStr(t.A) + t.X;
    }
    function reactionText(r) {
      return `${r.left.map(termText).join(' + ')} → ${r.right.map(termText).join(' + ')}`;
    }

    /** Текущая задача: { left, right, solve, kind, ans, title, decay? } */
    function problem() {
      const m = mode.value;
      if (m === 'reaction') {
        const r = REACTIONS[+selReac.value] || REACTIONS[0];
        return { left: r.left, right: r.right, solve: true, kind: r.right.find((t) => t.unknown).unknown, ans: r.ans, title: r.title };
      }
      const nuc = NUCLIDES.find((n) => n.id === selNuc.value) || NUCLIDES[0];
      let A = nuc.A, Z = nuc.Z;
      let parts;
      if (m === 'alpha') { A -= 4; Z -= 2; parts = [PT.He]; }
      else if (m === 'beta-') { Z += 1; parts = [PT.em, PT.anu]; }
      else if (m === 'beta+') { Z -= 1; parts = [PT.ep, PT.nu]; }
      else { parts = [PT.gamma]; }
      const isSolve = solve.value;
      const prod = isSolve ? { unknown: 'AZ', k: 1 } : { A, Z, X: symOf(Z), hl: true };
      const parent = { A: nuc.A, Z: nuc.Z, X: SYM[nuc.Z] + (m === 'gamma' ? '*' : '') };
      return {
        left: [parent], right: [prod, ...parts], solve: isSolve, kind: 'AZ', ans: { A, Z },
        title: `${MODE_NAME[m]} ядра ${nameOf(nuc.A, nuc.Z)}`, decay: { nuc, m, A, Z },
      };
    }

    function termHTML(t, p) {
      if (t.unknown === 'AZ') {
        if (revealed) {
          const id = identify(p.ans.A, p.ans.Z);
          return `<span class="nb-ans">${t.k > 1 ? t.k + '&thinsp;' : ''}${id ? id.html : nucHTML(p.ans.A, p.ans.Z, symOf(p.ans.Z))}</span>`;
        }
        return `${t.k > 1 ? t.k + '&thinsp;' : ''}<span class="nb-q" aria-label="неизвестная частица">?</span>`;
      }
      if (t.unknown === 'k') {
        const k = revealed ? `<span class="nb-ans">${p.ans.k}</span>` : '<span class="nb-q" aria-label="неизвестное число">x</span>';
        return `${k}&thinsp;${nucHTML(t.A, t.Z, t.X)}`;
      }
      const h = nucHTML(t.A, t.Z, t.X, t.signed);
      return t.hl ? `<span class="nb-ans">${h}</span>` : h;
    }

    /** Значения, введённые пользователем (null — не введено / не целое). */
    function userVals(p) {
      const num = (inp) => {
        if (inp.value.trim() === '') return null;
        const v = Number(inp.value);
        return Number.isInteger(v) ? v : null;
      };
      return p.kind === 'k' ? { k: num(fK.inp) } : { A: num(fA.inp), Z: num(fZ.inp) };
    }

    /** Суммы A и Z: известная часть и вклад неизвестного (если задан). */
    function sums(p, vals) {
      const side = (terms) => {
        let A = 0, Z = 0, unk = null;
        for (const t of terms) {
          if (t.unknown === 'AZ') { unk = t; continue; }
          if (t.unknown === 'k') { unk = t; continue; }
          A += t.A; Z += t.Z;
        }
        let Af = A, Zf = Z;
        if (unk) {
          if (unk.unknown === 'AZ') {
            if (vals && vals.A !== null && vals.Z !== null) { Af += unk.k * vals.A; Zf += unk.k * vals.Z; } else { Af = null; Zf = null; }
          } else if (vals && vals.k !== null) { Af += vals.k * unk.A; Zf += vals.k * unk.Z; } else { Af = null; Zf = null; }
        }
        return { A, Z, unk, Af, Zf };
      };
      return { L: side(p.left), R: side(p.right) };
    }

    function unkExpr(base, unk, which) {
      if (!unk) return String(base);
      if (unk.unknown === 'AZ') return `${base} + ${unk.k > 1 ? unk.k + '·' : ''}${which}(?)`;
      return `${base} + x·${which === 'A' ? unk.A : unk.Z}`;
    }

    function render() {
      const p = problem();
      title.textContent = p.title;
      const op = (s) => `<span class="nb-op">${s}</span>`;
      eq.innerHTML = p.left.map((t) => termHTML(t, p)).join(op('+')) + op('→') + p.right.map((t) => termHTML(t, p)).join(op('+'));

      // поля ввода
      solveBox.classList.toggle('nb-hidden', !p.solve);
      fA.w.classList.toggle('nb-hidden', p.kind !== 'AZ');
      fZ.w.classList.toggle('nb-hidden', p.kind !== 'AZ');
      fK.w.classList.toggle('nb-hidden', p.kind !== 'k');
      bCheck.disabled = revealed; bShow.disabled = revealed;

      // видимость управления
      const isR = mode.value === 'reaction';
      selNuc.el.classList.toggle('nb-hidden', isR);
      solve.el.classList.toggle('nb-hidden', isR);
      selReac.el.classList.toggle('nb-hidden', !isR);

      // примечание
      let n = '';
      if (p.decay) {
        const { nuc, m } = p.decay;
        if (m === 'gamma') n = 'γ-излучение испускает возбуждённое ядро (X*), обычно после α- или β-распада; A и Z не меняются.';
        else if (m !== nuc.real) n = `Это ядро в природе испытывает ${MODE_NAME[nuc.real]}; здесь правило смещения применено формально.`;
        else n = 'Этот тип распада характерен для выбранного ядра.';
        if (m === 'beta-') n += ' При β⁻-распаде в ядре нейтрон превращается в протон, вылетают электрон и антинейтрино ν̃ (A = 0, Z = 0).';
        if (m === 'beta+') n += ' При β⁺-распаде протон превращается в нейтрон, вылетают позитрон и нейтрино ν (A = 0, Z = 0).';
      } else {
        n = 'Найдите неизвестное: суммы A и Z слева и справа должны совпасть.';
      }
      note.textContent = n;

      renderStatus();
      updateReadout(p);
    }

    function renderStatus() {
      const p = problem();
      if (!p.solve) { status.innerHTML = ''; return; }
      if (revealed) {
        if (p.kind === 'k') status.innerHTML = `<span class="nb-ok">Ответ: x = ${p.ans.k}</span>`;
        else {
          const id = identify(p.ans.A, p.ans.Z);
          status.innerHTML = `<span class="nb-ok">Ответ: ? = </span>${id ? id.html + ' — ' + id.name : `A = ${p.ans.A}, Z = ${p.ans.Z}`}`;
        }
        return;
      }
      if (!checked) { status.innerHTML = 'Введите ' + (p.kind === 'k' ? 'x' : 'A и Z') + ' и нажмите «Проверить».'; return; }
      if (checked.invalid) { status.innerHTML = '<span class="nb-bad">Введите целые числа.</span>'; return; }
      const mark = (ok) => (ok ? '<span class="nb-ok">✓</span>' : '<span class="nb-bad">✗</span>');
      const { s } = checked;
      let h = `Σ A: слева ${s.L.Af}, справа ${s.R.Af} ${mark(checked.okA)}; Σ Z: слева ${zStr(s.L.Zf)}, справа ${zStr(s.R.Zf)} ${mark(checked.okZ)}`;
      if (checked.okA && checked.okZ) {
        if (p.kind === 'k') h += `<br><span class="nb-ok">Верно: x = ${checked.vals.k}</span>`;
        else {
          const id = identify(checked.vals.A, checked.vals.Z);
          h += `<br><span class="nb-ok">Верно: ? = </span>${id ? id.html + ' — ' + id.name : ''}`;
        }
      } else {
        h += '<br><span class="nb-bad">Суммы не сходятся — попробуйте ещё.</span>';
      }
      status.innerHTML = h;
    }

    function check() {
      const p = problem();
      if (!p.solve || revealed) return;
      const vals = userVals(p);
      const bad = p.kind === 'k' ? vals.k === null || vals.k < 0 : vals.A === null || vals.Z === null || vals.A < 0;
      if (bad) { checked = { invalid: true }; renderStatus(); return; }
      const s = sums(p, vals);
      checked = { s, vals, okA: s.L.Af === s.R.Af, okZ: s.L.Zf === s.R.Zf };
      renderStatus();
      updateReadout(p);
    }

    function updateReadout(p) {
      const known = !p.solve || revealed;
      const s = sums(p, known ? (p.kind === 'k' ? { k: p.ans.k } : p.ans) : null);
      const rows = [];
      if (p.decay) {
        const { nuc, m, A, Z } = p.decay;
        rows.push(['Исходное ядро', `${nameOf(nuc.A, nuc.Z)}: A = ${nuc.A}, Z = ${nuc.Z}, N = A − Z = ${nuc.A - nuc.Z}`]);
        rows.push(['Правило', RULE[m]]);
        rows.push(['Продукт', known ? `${nameOf(A, Z)}: A = ${A}, Z = ${Z}, N = ${A - Z}` : 'найдите сами']);
      }
      rows.push(['Σ A слева', unkExpr(s.L.A, s.L.unk, 'A') + (s.L.unk && s.L.Af !== null ? ` = ${s.L.Af}` : '')]);
      rows.push(['Σ A справа', s.R.unk ? (known ? `${s.R.Af}` : unkExpr(s.R.A, s.R.unk, 'A')) : String(s.R.A)]);
      rows.push(['Σ Z слева', zStr(s.L.Z)]);
      rows.push(['Σ Z справа', s.R.unk ? (known ? zStr(s.R.Zf) : unkExpr(zStr(s.R.Z), s.R.unk, 'Z')) : zStr(s.R.Z)]);
      rows.push(['Законы сохранения', 'Σ A слева = Σ A справа; Σ Z слева = Σ Z справа']);
      ro.set(rows);
    }

    function clearInputs() { fA.inp.value = ''; fZ.inp.value = ''; fK.inp.value = ''; }

    function changed() {
      revealed = false;
      checked = null;
      clearInputs();
      render();
    }

    function reset() {
      mode.set('alpha');
      selNuc.set(NUCLIDES[0].id);
      selReac.set('0');
      solve.set(false);
      changed();
    }

    render();
    d.add(L.onThemeChange(render)); // цвета берутся из CSS-переменных; перерисовка — для единообразия контракта
    return { destroy: d.run };
  },
};
