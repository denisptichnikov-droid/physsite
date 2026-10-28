// Модель «Шкала электромагнитных волн» (3.5.5, 3.5.6; энергия фотона — 4.1.2).
import * as L from './_lib.js';

const C_LIGHT = 3e8; // м/с
const H_PLANCK = 6.6e-34; // Дж·с
const EV = 1.6e-19; // Дж
const LOG_MIN = -13, LOG_MAX = 4; // шкала: 10⁻¹³ … 10⁴ м
const VIS_MIN = 380e-9, VIS_MAX = 760e-9;

// Границы диапазонов условные (диапазоны частично перекрываются; см. docs).
const BANDS = [
  {
    short: 'γ', name: 'гамма-излучение', from: 0, to: 1e-11,
    src: 'радиоактивные ядра, ядерные реакции, космические источники',
    use: 'радиотерапия (лучевая терапия опухолей), гамма-дефектоскопия, стерилизация',
  },
  {
    short: 'рентген', name: 'рентгеновское излучение', from: 1e-11, to: 1e-8,
    src: 'рентгеновская трубка (торможение быстрых электронов в аноде)',
    use: 'рентгенография, компьютерная томография, досмотр багажа, рентгеноструктурный анализ',
  },
  {
    short: 'УФ', name: 'ультрафиолетовое излучение', from: 1e-8, to: VIS_MIN,
    src: 'Солнце, кварцевые (ртутные) лампы, электрическая дуга',
    use: 'загар и выработка витамина D, стерилизация и обеззараживание, проверка купюр (люминесценция)',
  },
  {
    short: '', name: 'видимый свет', from: VIS_MIN, to: VIS_MAX,
    src: 'Солнце, лампы, светодиоды, лазеры',
    use: 'зрение, освещение, фотосинтез, фотография, оптическая связь',
  },
  {
    short: 'ИК', name: 'инфракрасное излучение', from: VIS_MAX, to: 1e-3,
    src: 'нагретые тела (тепловое излучение), Солнце, ИК-светодиоды пультов',
    use: 'тепловизор, приборы ночного видения, пульт ДУ, обогрев и сушка',
  },
  {
    short: 'СВЧ', name: 'СВЧ (микроволны)', from: 1e-3, to: 1,
    src: 'магнетрон, клистрон, антенны радаров и базовых станций',
    use: 'микроволновая печь, радиолокация, мобильная связь, Wi-Fi, спутниковая связь',
  },
  {
    short: 'радио', name: 'радиоволны', from: 1, to: Infinity,
    src: 'антенны передатчиков (колебательный контур), молнии',
    use: 'радиосвязь, радиовещание, телевидение, навигация',
  },
];

// Цвета видимого спектра (условно; границы цветов — приблизительные).
const COLOR_NAMES = [
  [380, 'фиолетовый'], [440, 'синий'], [485, 'голубой'], [500, 'зелёный'],
  [565, 'жёлтый'], [590, 'оранжевый'], [625, 'красный'],
];

/** Три значащие цифры. */
function f3(x) {
  if (x === 0 || !Number.isFinite(x)) return L.fmt(x);
  const ax = Math.abs(x);
  if (ax >= 1e5 || ax < 1e-3) return L.fmt(x, 2);
  return L.fmt(x, Math.max(0, 2 - Math.floor(Math.log10(ax))));
}

/** Приближённый цвет спектральной линии λ (нм) — физический цвет, не зависит от темы. */
function specRGB(nm) {
  nm = L.clamp(nm, 380, 780);
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else { r = 1; }
  let f = 1;
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const t = (x) => Math.round(255 * Math.pow(Math.max(0, x * f), 0.8));
  return `rgb(${t(r)},${t(g)},${t(b)})`;
}

const bandOf = (lam) => BANDS.find((b) => lam >= b.from && lam < b.to) || BANDS[BANDS.length - 1];
const colorName = (nm) => { let n = COLOR_NAMES[0][1]; for (const [a, s] of COLOR_NAMES) if (nm >= a) n = s; return n; };

export default {
  id: 'em-spectrum',
  title: 'Шкала электромагнитных волн',
  codes: ['3.5.5', '3.5.6', '4.1.2'],
  mount(el) {
    const d = L.disposer();
    const ui = L.layout(el, {
      caption: 'Шкала в логарифмическом масштабе: каждое деление — в 10 раз. Слева — длинные волны (малые частоты), справа — короткие (большие частоты и энергии фотонов). ' +
        'Все электромагнитные волны в вакууме распространяются со скоростью c = 3·10⁸ м/с. Границы диапазонов условные, соседние диапазоны перекрываются.',
    });
    const cv = L.canvas(ui.stage, { aspect: 0.55, minHeight: 250, maxHeight: 320, label: 'Шкала электромагнитных волн с маркером выбранной длины волны' });
    d.add(cv.destroy);

    // Слайдер хранит u = −lg λ (λ в метрах): движение вправо — к коротким волнам, как на шкале.
    const DEF_U = 6.26; // λ ≈ 550 нм
    const sU = L.slider(ui.controls, {
      label: 'Длина волны λ', min: -LOG_MAX, max: -LOG_MIN, step: 0.01, value: DEF_U, unit: 'м',
      format: (u) => f3(10 ** -u), onInput: () => { updRO(); draw(); },
    });
    L.button(ui.controls, 'Сброс', () => { sU.set(DEF_U); updRO(); draw(); }, { reset: true });
    const ro = L.readout(ui.readout);

    function phys() {
      const lam = 10 ** -sU.value;
      const nu = C_LIGHT / lam;
      const E = H_PLANCK * nu;
      return { lam, nu, E, eV: E / EV, band: bandOf(lam) };
    }

    function updRO() {
      const p = phys();
      const rows = [
        ['Длина волны λ', f3(p.lam) + ' м'],
        ['ν = <i>c</i>/λ', f3(p.nu) + ' Гц'],
        ['<i>E</i> = <i>h</i>ν', f3(p.E) + ' Дж'],
        ['<i>E</i> (в эВ)', f3(p.eV) + ' эВ'],
        ['Диапазон', p.band.name],
      ];
      if (p.band.name === 'видимый свет') rows.push(['Цвет (примерно)', colorName(p.lam * 1e9)]);
      rows.push(['Источники', p.band.src], ['Применение', p.band.use]);
      ro.set(rows);
    }

    function draw() {
      const { ctx, width: W, height: H } = cv;
      if (!W || !H) return;
      const c = L.colors();
      ctx.clearRect(0, 0, W, H);
      const p = phys();
      const lg = Math.log10(p.lam);
      const x0 = 14, w = W - 28;
      const X = (lgl) => x0 + ((LOG_MAX - lgl) / (LOG_MAX - LOG_MIN)) * w; // длинные волны слева
      const visible = p.lam >= VIS_MIN && p.lam < VIS_MAX;
      const waveCol = visible ? specRGB(p.lam * 1e9) : c.accent;
      const small = '11px system-ui, sans-serif';

      // ---------- схема волны ----------
      L.text(ctx, 'вид волны (схематично)', x0, 9, c.muted, { font: small });
      const wy = 38, amp = 13;
      const P = 7 + ((lg - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (w * 0.8); // период на экране, px
      ctx.save();
      ctx.strokeStyle = waveCol; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= w; i++) {
        const y = wy - amp * Math.sin((2 * Math.PI * i) / P);
        if (i === 0) ctx.moveTo(x0 + i, y); else ctx.lineTo(x0 + i, y);
      }
      ctx.stroke();
      ctx.restore();

      // ---------- основная шкала ----------
      const barY = 80, barH = 30;
      BANDS.forEach((b, i) => {
        const lgFrom = b.from > 0 ? Math.max(LOG_MIN, Math.log10(b.from)) : LOG_MIN;
        const lgTo = Number.isFinite(b.to) ? Math.min(LOG_MAX, Math.log10(b.to)) : LOG_MAX;
        const xa = X(lgTo), xb = X(lgFrom); // xa < xb
        ctx.save();
        if (b.name === 'видимый свет') {
          const gr = ctx.createLinearGradient(xa, 0, xb, 0);
          for (let nm = 760; nm >= 380; nm -= 20) gr.addColorStop((760 - nm) / 380, specRGB(nm));
          ctx.fillStyle = gr;
        } else {
          ctx.fillStyle = i % 2 ? c.surface : c.grid;
        }
        ctx.fillRect(xa, barY, xb - xa, barH);
        ctx.restore();
        if (b.short) {
          ctx.save(); ctx.font = small;
          const tw = ctx.measureText(b.short).width;
          ctx.restore();
          if (tw + 4 < xb - xa) L.text(ctx, b.short, (xa + xb) / 2, barY + barH / 2, c.text, { font: small, align: 'center' });
        }
      });
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.strokeRect(x0, barY, w, barH);
      ctx.restore();

      // подпись «видимый» над узкой полосой
      const xv1 = X(Math.log10(VIS_MAX)), xv2 = X(Math.log10(VIS_MIN));
      const xvc = (xv1 + xv2) / 2;
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xvc, barY - 2); ctx.lineTo(xvc, barY - 10); ctx.stroke();
      ctx.restore();
      L.text(ctx, 'видимый', xvc, barY - 16, c.text, { font: small, align: 'center' });

      // деления: каждая декада, подписи через 3 порядка
      const lbl = { 3: '1 км', 0: '1 м', '-3': '1 мм', '-6': '1 мкм', '-9': '1 нм', '-12': '1 пм' };
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let e = LOG_MIN; e <= LOG_MAX; e++) {
        const xt = Math.round(X(e)) + 0.5;
        const big = lbl[e] !== undefined;
        ctx.moveTo(xt, barY + barH); ctx.lineTo(xt, barY + barH + (big ? 7 : 4));
      }
      ctx.stroke();
      ctx.restore();
      for (const e of Object.keys(lbl)) L.text(ctx, lbl[e], X(+e), barY + barH + 15, c.text, { font: small, align: 'center' });
      L.text(ctx, '← длиннее λ, меньше ν', x0, barY + barH + 31, c.muted, { font: small });
      L.text(ctx, 'короче λ, больше ν, E →', x0 + w, barY + barH + 31, c.muted, { font: small, align: 'right' });

      // маркер
      const xm = X(L.clamp(lg, LOG_MIN, LOG_MAX));
      ctx.save();
      ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xm, barY - 3); ctx.lineTo(xm, barY + barH + 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xm, barY - 2); ctx.lineTo(xm - 6, barY - 11); ctx.lineTo(xm + 6, barY - 11); ctx.closePath(); ctx.fill();
      ctx.restore();

      // ---------- видимый диапазон крупно ----------
      const zy = barY + barH + 62, zh = 18;
      const ZX = (nm) => x0 + ((760 - nm) / 380) * w; // красный слева, фиолетовый справа
      L.text(ctx, 'видимый диапазон крупно (380–760 нм)', x0, zy - 12, c.muted, { font: small });
      ctx.save();
      ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xv1, barY + barH); ctx.lineTo(ZX(760), zy);
      ctx.moveTo(xv2, barY + barH); ctx.lineTo(ZX(380), zy);
      ctx.stroke();
      ctx.restore();
      const gr = ctx.createLinearGradient(ZX(760), 0, ZX(380), 0);
      for (let nm = 760; nm >= 380; nm -= 10) gr.addColorStop((760 - nm) / 380, specRGB(nm));
      ctx.save(); ctx.fillStyle = gr; ctx.fillRect(x0, zy, w, zh);
      // обводка цветом текста: спектральные цвета контрастны и в светлой, и в тёмной теме
      ctx.globalAlpha = 0.7; ctx.strokeStyle = c.text; ctx.lineWidth = 1.5;
      ctx.strokeRect(x0, zy, w, zh); ctx.strokeRect(xv1, barY, xv2 - xv1, barH);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = c.text; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const nm of [400, 500, 600, 700]) { const xt = Math.round(ZX(nm)) + 0.5; ctx.moveTo(xt, zy + zh); ctx.lineTo(xt, zy + zh + 5); }
      ctx.stroke();
      ctx.restore();
      for (const nm of [400, 500, 600, 700]) L.text(ctx, `${nm} нм`, ZX(nm), zy + zh + 13, c.text, { font: small, align: 'center' });
      if (visible) {
        const xz = ZX(p.lam * 1e9);
        ctx.save();
        ctx.strokeStyle = c.text; ctx.fillStyle = c.text; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(xz, zy - 3); ctx.lineTo(xz, zy + zh + 3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xz, zy - 2); ctx.lineTo(xz - 5, zy - 9); ctx.lineTo(xz + 5, zy - 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        const longer = p.lam >= VIS_MAX;
        L.text(ctx, longer ? '← λ длиннее красного (вне видимого)' : 'λ короче фиолетового (вне видимого) →',
          longer ? x0 : x0 + w, zy + zh + 30, c.muted, { font: small, align: longer ? 'left' : 'right' });
      }
    }

    cv.onResize(draw);
    d.add(L.onThemeChange(draw));
    updRO();
    draw();
    return { destroy: d.run };
  },
};
