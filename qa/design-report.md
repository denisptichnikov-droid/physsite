# Design QA — статический аудит (A9.2)

Дата: 2026-10-27. Метод: чтение CSS/JS + расчёт контраста (WCAG 2.x, python). Playwright недоступен: скриншотов нет; 61 маршрут без ошибок консоли и горизонтальный скролл на 320px проверял руководитель.

## Сводка контраста (tokens.css)

| Пара | Светлая | Тёмная |
|---|---|---|
| text / bg, surface, surface-2 | 15.6 / 16.6 / 14.6 | 15.0 / 13.8 / 12.1 |
| muted / bg, surface, surface-2, accent-soft | 6.2 / 6.6 / 5.8 / 5.7 | 7.4 / 6.8 / 6.0 / 5.7 |
| accent (ссылки) / bg, surface-2 | 6.2 / 5.9 | 7.9 / 6.3 |
| on-accent / accent (кнопка primary) | 6.6 | 7.9 |
| text / mark-bg | 14.5 | 7.1 |
| заголовок callout / фон callout (min из 6) | 4.91 (tip) | 6.73 (warning) |
| бейджи БУ / УУ | 4.91 / 5.37 | 7.62 / 8.48 |
| muted / фоны callout (min) | 5.8 | 6.3 |
| векторы force/vel/accel/E/B к bg, surface, surface-2 | min 4.05 (E/s2) — все ≥ 3:1 | min 5.29 — все ≥ 3:1 |
| **border-strong / surface (рамки полей, трек слайдера)** | **1.92** | **2.20** |
| border / bg | 1.32 | 1.59 |

Текстовые пары AA проходят. Не проходит граница UI‑контролов (WCAG 1.4.11, 3:1), а также --field-e как цвет мелкого текста (4.32 к bg).

## Находки

| severity | страница/файл | ширина/тема | проблема | скриншот | как исправить |
|---|---|---|---|---|---|
| major | assets/css/tokens.css, models.css:121,127,209,278; base.css .search__input | все / обе | Рамка полей ввода, трека слайдера, сегментов radio, `.model-btn` = `--border-strong`: 1.92:1 (светлая) и 2.20:1 (тёмная) к surface. Это меньше 3:1 для границ UI‑компонентов (1.4.11), поэтому контрол плохо виден | — | Затемнить `--border-strong` (светлая ≈ `#8a94a3`, тёмная ≈ `#6b7686`), чтобы было ≥3:1 к surface и surface-2; либо ввести отдельный `--control-border` |
| major | models/double-slit.js:64, field-lines.js:354, magnetic-lines.js:378, lens-builder.js:50, plane-mirror.js:53 | все / обе | Перетаскивание на canvas работает только через pointerdown. Обработчиков клавиатуры и tabindex нет (grep keydown/tabindex пуст). Если у перетаскиваемого параметра нет дублирующего слайдера, с клавиатуры он недоступен | — | Проверить, что у каждого перетаскиваемого параметра есть L.slider; если нет — добавить слайдер или сделать canvas фокусируемым (tabindex=0, стрелки) |
| major | models/photoeffect.js:28-39, bohr-levels.js:35, em-spectrum.js:77, grating.js:20, prism.js:20, double-slit.js:22 | все / тёмная | Цвет спектральной линии λ→rgb не зависит от темы. Фиолетовые и тёмно-красные края (#8f5bff, #b0282e, rgb близко к 380/750 нм) на тёмном `--bg` #111418 дают <3:1, а жёлтые на светлом surface — ~1.1–1.5:1 | — | Для линий/лучей добавить обводку `c.text` с alpha 0.5, тонкий контур или ограничить яркость по теме (min контраст 3:1 к c.bg) |
| minor | models/*.js (семантика векторов) | все / обе | `c.force` применяется не только для сил: тексты-предупреждения («фотоэффекта нет», «ПВО», «полное внутреннее отражение», «КЗ», «α₀ > 15°»), точки на графиках (decay, phase-graph, resonance, wave), Q в energy-bars, «объект» в lens-builder/plane-mirror. `c.fieldB` используется для E_п/E_упр (energy-bars), Q_х/T_х (carnot), воды (humidity), поглощения (bohr). `c.accel` — для изображения (lens-builder, plane-mirror). `c.velocity` — для «равновесия» (lever-moments) и максимумов (double-slit). Прямых перепутанных ролей у векторов (F≠c.force, v≠c.velocity, a≠c.accel) не найдено | — | Ввести нейтральные токены `--warn`/`--danger` для предупреждений, `--series-1..4` для графиков и энергий, `--object`/`--image` для оптики; векторные цвета оставить только для векторов |
| minor | models/motion-graphs.js:109 | все / обе | Полосы графика окрашены в `[c.velocity, c.force]`: сила в модели кинематики — смысловая путаница | — | Использовать c.velocity / c.accel или нейтральный цвет |
| minor | assets/css/tokens.css (--field-e) | все / светлая | `--field-e` #c05600: 4.32:1 к bg, 4.05:1 к surface-2. Для вектора нормально (≥3:1), но если подписи «E» рисуются шрифтом 12–14px, это меньше AA для мелкого текста | — | Затемнить до ≈ `#a94b00` (≥4.5:1 к bg и surface-2) |
| minor | assets/css/tokens.css (--vec-force) | все / светлая | `--vec-force` к surface-2: 4.48:1. Подписи силы мелким текстом на плашках surface-2 чуть ниже AA | — | `#c62a25` или темнее |
| minor | assets/css/models.css:10-17 (.model-wrap overflow:hidden) | все / обе | Фокусное кольцо с `outline-offset: 2px` у элементов, прижатых к краю `.model-wrap` (canvas, первые контролы), может обрезаться из-за overflow:hidden | — | Внутренним контролам задать `outline-offset: -2px` или перенести overflow:hidden на .model-canvas |
| minor | assets/css/tokens.css (--border) | все / обе | `--border` 1.32–1.59:1 — декоративные рамки карточек. Это допустимо, но если `--border` — единственная граница интерактивных `.search-result`/`.section-card`/pager, то их края почти не видны | — | Оставить для декора; для интерактивных карточек использовать border-strong (после исправления) |
| minor | models/field-lines.js:322, magnetic-lines.js:354 | — / reduced-motion | requestAnimationFrame вне L.animator — однократная перерисовка (throttle) без анимации. Это не нарушение reduced-motion: фиксируем, что проблемы нет | — | Ничего не делать |
| minor | assets/css/components.css:586-621 (печать «Все формулы») | печать | `.af-grid` всегда печатается в 2 колонки, а длинная формула получает `overflow: visible` и font-size 0.92em. Самые длинные формулы могут вылезти за колонку (на половине A4 ≈ 85 мм) и наложиться на соседнюю карточку | — | Добавить `.formula-card--wide { grid-column: 1 / -1 }` для длинных формул или `max-width:100%` + `font-size` по факту; проверить печать в превью |
| minor | assets/css/components.css:609 (.quiz::details-content) | печать / Firefox, Safari | Раскрытие ответов при печати держится на `beforeprint` (app.js:310) и `::details-content` — в браузерах без beforeprint ответы могут остаться свёрнутыми. При закрытии печати `open` не снимается | — | Добавить afterprint, который восстанавливает состояние; приемлемо |

## Проверено, нарушений нет

- **Фокус:** глобальный `:focus-visible` (base.css:58) — 2px `--focus` (6.2–7.9:1), покрывает ссылки, кнопки, summary, toc, pager, select, number. Для range отдельные стили thumb (models.css:157-164), для radio — `input:focus-visible + span` (models.css:231). У search — свой стиль. Есть skip-link «К содержанию» → `#main`; Escape закрывает меню и возвращает фокус на кнопку (app.js:73); при открытии меню фокус переходит в сайдбар; после навигации фокус ставится на main.
- **Подписи:** L.slider — `label for=id` и `output for=id`; L.choice — fieldset/legend; L.checkbox — обёртка label. Ручные контролы: bohr-levels.js:50 и nuclear-balance.js:194 (select с label.htmlFor=id), nuclear-balance.js:149 (input number с label.htmlFor). Поиск — aria-label. Readout с `aria-live=polite`, canvas с aria-label. Контролов без подписи не найдено.
- **Цвета векторов:** все через `L.colors()` из CSS-переменных; захардкоженных hex для векторов нет. Подписи F/v/a/E/B соответствуют своим ролям. Цвета перечитываются при `themechange` (L.onThemeChange).
- **Темы:** в моделях нет `#fff`/`white`/`black`. Хардкоды в CSS только в @media print (намеренно). Фолбэки в `_lib.colors()` светлые, но срабатывают, только если переменная не определена.
- **Адаптив:** брейкпоинты 480/600/768/1280 (min-width:768 и 1280 — сайдбар и TOC). `body min-width:320px`, `.katex-display` и таблицы с `overflow-x:auto`, `max-width:100%`. Фиксированных ширин >320px нет: search `max-width:480px` — это ограничение сверху. Canvas масштабируется от `parent.clientWidth` через ResizeObserver и DPR (минимум 200px).
- **prefers-reduced-motion:** CSS гасит animation/transition, а smooth-scroll включён только при no-preference. `L.animator` не делает autoplay при reduce. Других обходных rAF‑циклов анимации нет.
- **Печать:** скрыты topbar, sidebar, toc, pager, breadcrumbs, footer, модели, print-btn, search. Есть break-inside: avoid для карточек, callout, katex и таблиц; h2/h3 — break-after: avoid; палитра печати — ч/б.
- **Типографика:** h1/h2/h3 = clamp(1.55–2.1rem) / clamp(1.3–1.5rem) / 1.1875rem, lh 1.25. Основной текст 17px / 1.65. KaTeX 1.1em, у display-формул свой скролл и отступы, в таблицах — nowrap. Признаков наложения формул на текст нет.

## Итого

blocker: 0, major: 3, minor: 9.
