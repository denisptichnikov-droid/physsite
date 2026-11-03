# Дизайн-система «ЕГЭ по физике»

Файлы стилей подключаются в порядке: KaTeX CSS (CDN) → `tokens.css` → `base.css` → `components.css` → `models.css`.

| Файл | Содержимое |
|---|---|
| `assets/css/tokens.css` | все CSS-переменные: светлая тема (`:root`), тёмная (`[data-theme="dark"]` и `prefers-color-scheme: dark` без явной темы), печатная палитра |
| `assets/css/base.css` | сброс, фокус, skip-link, topbar, сетка `.layout` (sidebar / page / toc), подвал, типографика Markdown (`.content`), таблицы, KaTeX, `prefers-reduced-motion`, общая печать |
| `assets/css/components.css` | кнопки, навигация, оглавление, крошки, шапка страницы, карточка формулы и сетка раздела «Формулы», callout'ы и свёрнутые блоки, задания к модели, задачи, quiz, pager, главная, поиск, «Все формулы», состояния, печать |
| `assets/css/models.css` | контейнер и компоновка модели, холст, слайдеры, сегментированный переключатель, флажок, кнопки, readout, `.model-more`, подпись, загрузка/ошибка |

## 1. Темы

- Тема задаётся атрибутом `<html data-theme="light|dark">`. Без атрибута — по системной настройке `prefers-color-scheme`.
- Порядок приоритета: `data-theme="light"` > `data-theme="dark"` > системная тёмная > светлая по умолчанию.
- В каждой теме задан `color-scheme`, поэтому нативные элементы (скроллбары, чекбоксы) тоже переключаются.
- Модели читают цвета через `L.colors()` (из `models/_lib.js`) внутри `draw()` — смена темы подхватывается автоматически.

## 2. Цвета

### 2.1 Поверхности и текст

| Токен | Назначение | Светлая | Тёмная |
|---|---|---|---|
| `--bg` | фон страницы | `#f7f8fa` | `#111418` |
| `--surface` | карточки, модели, topbar | `#ffffff` | `#191d23` |
| `--surface-2` | вложенные плашки, inline-code, readout, трек слайдера | `#eef1f5` | `#222831` |
| `--border` | рамки | `#d5dae1` | `#323944` |
| `--border-strong` | рамки полей, кнопок | `#848e9c` (3.3:1 к surface) | `#6b7684` (3.7:1 к surface) |
| `--text` | основной текст | `#1b1f24` (15.6:1) | `#e5e8ec` (15.0:1) |
| `--muted` | вторичный текст | `#555e6b` (6.2:1) | `#9ba5b2` (7.4:1) |
| `--accent` | ссылки, активные элементы | `#1f56c2` (6.2:1) | `#7fa8ff` (7.9:1) |
| `--accent-hover` | hover ссылок/кнопок | `#17449c` | `#a3c0ff` |
| `--accent-soft` | фон активного пункта меню | `#e8effc` | `#1b2a47` |
| `--on-accent` | текст на `--accent` | `#ffffff` (6.6:1) | `#111418` (7.9:1) |
| `--focus` | кольцо фокуса | = `--accent` | = `--accent` |
| `--mark-bg` / `--mark-text` | подсветка `<mark>` в поиске | `#fff1a8` / `#1b1f24` | `#5a4a10` / `#e5e8ec` |
| `--selection` | выделение, ореол фокуса | `#cfdcf7` | `#2a3f6b` |
| `--danger` / `--danger-bg` | ошибки (`.model-error`, `.math-error`) | `#b42318` / `#fdf0ee` | `#ff7b72` / `#2b1716` |
| `--grid` | сетка графиков/клеток в моделях | `#dde1e7` | `#2c333d` |

Контраст указан к `--bg`; все пары «текст/фон», включая `--muted` на `--surface-2`, ≥ 4.5:1 (WCAG AA).

### 2.2 Цветовая семантика векторов (едина для всего сайта)

| Величина | Переменная | `L.colors()` | Светлая | Тёмная | Контраст к `--bg` (свет / тёмн) |
|---|---|---|---|---|---|
| Сила $\vec F$ (любая: $m\vec g$, $\vec N$, $\vec F_{тр}$, $\vec T$, $\vec F_A$, $\vec F_Л$…) | `--vec-force` | `force` | `#c2271f` красный | `#ff6a62` | 5.4 / 6.6 |
| Скорость $\vec v$ (и проекции $v_x$, $v_y$) | `--vec-velocity` | `velocity` | `#1c7a39` зелёный | `#4ccb72` | 5.1 / 8.9 |
| Ускорение $\vec a$ (в т. ч. $\vec a_{цс}$, $\vec g$ как ускорение) | `--vec-accel` | `accel` | `#7b3dc2` фиолетовый | `#bb8dff` | 6.0 / 7.4 |
| Напряжённость $\vec E$, линии поля E | `--field-e` | `fieldE` | `#a84a00` оранжевый | `#ffa04a` | 5.4 / 9.1 |
| Индукция $\vec B$, линии поля B | `--field-b` | `fieldB` | `#1565b8` синий | `#5aaeff` | 5.5 / 7.9 |

Все пять цветов ≥ 3:1 также к `--surface` и `--surface-2` в обеих темах (в светлой теме все ≥ 4.5:1 и к `--surface-2`).
Правила для моделистов:
- Сила тяжести $m\vec g$ — это **сила** (красный). Вектор $\vec g$ как ускорение — фиолетовый.
- Проекции/составляющие вектора — тем же цветом, но пунктиром (`dash: [5, 4]`) или тоньше.
- Импульс $\vec p$ — цветом скорости (сонаправлен с $\vec v$); если нужно различить — пунктиром.
- Оси, подписи, тела — `--text` / `--muted`; сетка — `--grid`; выделение/курсор — `--accent`.
- Для HTML-легенд есть классы `.vec-force`, `.vec-velocity`, `.vec-accel`, `.field-e`, `.field-b` (задают `color`).
- В readout строку можно пометить цветом вектора: `row.dataset.vec = 'force' | 'velocity' | 'accel' | 'e' | 'b'` (цветная полоса слева).

### 2.3 Callout'ы

Каждый callout — полоса слева и заголовок цвета `--callout-X`, фон `--callout-X-bg`, значок-кружок с символом.

| Класс | Директива | Смысл | Значок | Цвет (свет / тёмн) |
|---|---|---|---|---|
| `.callout--tip` | `[!tip]` | Лайфхак | ★ | `#1c7a39` / `#4ccb72` |
| `.callout--warning` | `[!warning]` | Типичная ошибка | ! | `#b42318` / `#ff7b72` |
| `.callout--theory` | `[!theory]` | Теория, справка | i | `#1f56c2` / `#7fa8ff` |
| `.callout--task26` | `[!task26]` | Обоснование №26 | 26 | `#6b35b0` / `#c29bff` |
| `.callout--limits` | `[!limits]` | Границы применимости | ≤ | `#8a5a00` / `#f0b44c` |
| `.callout--measure` | `[!measure]` | Как это измеряют | ± | `#0e7178` / `#4cc8c8` |

Заголовок на своём фоне ≥ 4.9:1 во всех вариантах.

### 2.4 Задачи

Токены `--level-*`, `--trap*`, `--answer*` объявлены один раз в `:root` как псевдонимы цветов callout'ов, поэтому сами следуют за темой и печатной палитрой.

| Токен | Где | Цвет на фоне (свет / тёмн) | Контраст (свет / тёмн) |
|---|---|---|---|
| `--level-base`, `--level-base-bg` | «База» | `#1c7a39` на `#ecf7ef` / `#4ccb72` на `#15261b` | 4.91 / 7.62 |
| `--level-mid`, `--level-mid-bg` | «Повышенная» | `#8a5a00` на `#fdf6e7` / `#f0b44c` на `#2a2213` | 5.51 / 8.48 |
| `--level-hard`, `--level-hard-bg` | «Сложная» | `#b42318` на `#fdf0ee` / `#ff7b72` на `#2b1716` | 5.91 / 6.73 |
| `--trap`, `--trap-bg` | заголовок блока «Здесь часто ошибаются» | как `--level-mid` | 5.51 / 8.48 |
| `--answer`, `--answer-bg` | заголовок блока «Ответ» | как `--level-base` | 4.91 / 7.62 |

Другие пары новых элементов (свет / тёмн):

| Пара | Контраст |
|---|---|
| `--text` на `--surface`, задание `.try-btn` | 16.56 / 13.76 |
| `--text` на `--accent-soft`, `.try-btn` при наведении | 14.34 / 11.63 |
| `--accent` на `--accent-soft`, `.task__next`, `.try-btn--open`, номер задания | 5.74 / 6.09 |
| `--muted` на `--surface`, `.task__all`, `.task__line` | 6.56 / 6.78 |
| `--muted` на `--surface-2`, `.task-banks`, подписи показаний | 5.79 / 5.95 |
| `--accent` на `--surface-2`, ссылки в `.task-banks` | 5.85 / 6.32 |
| `--text` на `--trap-bg` | 15.39 / 12.78 |
| `--text` на `--answer-bg` | 15.08 / 12.90 |

## 3. Типографика

Шрифты системные, без загрузки:
- `--font-sans`: `system-ui, -apple-system, "Segoe UI", Roboto, …, sans-serif`
- `--font-mono`: `ui-monospace, "Cascadia Mono", …, Consolas, monospace` (inline-code)

| Токен | Размер | Где |
|---|---|---|
| `--fs-xs` | 12px | подписи readout, уровень и линия задачи |
| `--fs-ui` | 13px | карточка формулы, контролы и подпись модели; задания в правой колонке модели |
| `--fs-sm` | 14px | навигация, мета, callout-заголовки, элементы модели |
| `--fs-base` | 17px | текст статьи |
| `--fs-md` | 18px | бренд, заголовки карточек |
| `--fs-h3` | 19px | h3 |
| `--fs-h2` | 21–24px (clamp) | h2, с линией снизу |
| `--fs-h1` | 25–34px (clamp) | h1 |
| `--katex-scale` | 1.1em | все формулы в `.content` |

Межстрочный: `--lh-base: 1.65` (текст), `--lh-tight: 1.25` (заголовки). Цифры в readout и таблицах — табличные (`tabular-nums`).

## 4. Отступы, радиусы, размеры

| Отступы | | Радиусы | |
|---|---|---|---|
| `--space-1` | 4px | `--radius-sm` | 4px |
| `--space-2` | 8px | `--radius` | 8px |
| `--space-3` | 12px | `--radius-lg` | 12px (модель, карточки разделов) |
| `--space-4` | 16px | `--radius-pill` | 999px |
| `--space-5` | 24px | | |
| `--space-6` | 32px | | |
| `--space-7` | 48px | | |
| `--space-8` | 64px | | |

Размеры: `--topbar-h: 56px`, `--sidebar-w: 280px` (≥1280), `--sidebar-w-md: 256px` (768–1279), `--toc-w: 220px`, `--content-max: 760px`, `--layout-max: 1440px`, `--gutter: 16px`, `--tap: 40px` (иконочные кнопки), `--tap-min: 32px` (пункты меню, сегменты, кнопки модели), `--tap-touch: 44px` (`.try-btn`, `.task__next`, `.task__all`; на сенсорных экранах также `.callout--fold` и `.model-more`), `--slider-h: 26px` (зона слайдера, при `pointer: coarse` 38px), `--model-side: clamp(264px, 40%, 340px)` (правая колонка модели).

Слои: `--z-topbar: 30`, `--z-backdrop: 40`, `--z-sidebar: 50`, `--z-skip: 100`. Движение: `--dur: 160ms`, `--dur-slow: 240ms`, `--ease`.

## 5. Брейкпоинты и сетка

| Ширина | Колонки | Поведение |
|---|---|---|
| < 480px | 1 | как < 768, плюс скрыт `.brand__text` (остаётся знак Φ), поиск растягивается, сегменты переключателя переносятся по одному |
| < 768px | 1 | `.sidebar` — выезжающая панель слева (под topbar, `width: min(86vw, 320px)`), открывается классом `body.nav-open`; `.sidebar-backdrop` затемняет контент; `.nav-toggle` видна; `.toc` скрыт |
| 768–1279px | 2 | sidebar 256px (sticky, свой скролл) + контент; `.toc` скрыт; `.nav-toggle` скрыта |
| ≥ 1280px | 3 | sidebar 280px + контент (max 760px, по центру колонки) + toc 220px (sticky) |

Сетка — `grid-template-areas`, поэтому `.sidebar-backdrop` внутри `.layout` не занимает ячейку. Без горизонтального скролла на 320px, в том числе при классической полосе прокрутки (рабочая ширина 305px): у `body` нет `min-width`. Длинные формулы (`.katex-display`) и таблицы скроллятся внутри себя. У `.katex` стоит `position: relative`, иначе абсолютно позиционированный `.katex-mathml` выходит из скролл-контейнера и даёт скролл всей странице. У `.katex svg` стоит `max-width: none`: общее правило `svg { max-width: 100% }` обнуляло стрелки `\vec`.

`.page` является контейнером запросов (`container: page / inline-size`). От его ширины зависят сетка формул (от 600px) и компоновка модели (от 700px). В печати контейнер отключён, чтобы не мешать разрывам страниц.

## 6. Компоненты (классы)

**Оболочка:** `.skip-link`, `.topbar`, `.nav-toggle` (`aria-expanded="true"` подсвечивается), `.brand` > `.brand__mark` + `.brand__text`, `.search` > `.search__input` (лупа нарисована CSS), `.theme-toggle`, `.layout`, `.sidebar`, `.sidebar-backdrop`, `.page`, `.toc`, `.footer`.

**Навигация:** `.nav` > `li.nav__extra` (служебные ссылки, после них разделитель) и `li.nav__section[.is-open]` > `button.nav__section-btn[aria-expanded]` (шеврон поворачивается) > `.nav__num`; `ul.nav__list` виден только у `.is-open`. `.nav__link.is-active` / `[aria-current="page"]` — фон `--accent-soft` и полоса слева.

**Оглавление:** `.toc__title`, `.toc__list`, `.toc__link[.is-active]`, `.toc__link--sub` (h3, с отступом), `.toc__link--model` (пункт «Модель»: цвет `--accent`, точка-маркер, без отступа, поэтому заметен в списке).

**Страница:** `.breadcrumbs` (ссылка без `href` — без подчёркивания, `span` — текущая), `.content`, `.page-header` > h1.

**Markdown в `.content`:** h1–h4 (`scroll-margin-top` под topbar), p, ul/ol, blockquote, code/pre, hr, img, table (сам скроллится: `display:block; width:max-content; max-width:100%; overflow-x:auto`), `.katex-display` (скролл по X внутри, `overflow-y:hidden`), `.math-error`.

**Формулы:** `.formula-card` > `.formula-card__name` + `.formula-card__body` + `.formula-card__note`; `:target` и `.is-highlight` подсвечиваются. Паддинг 8/12px, без тени. `.formula-card--compact` — для сетки «Все формулы».

Сетка раздела «Формулы»: обёртки в разметке нет, карточки — прямые потомки `.content`. Если `.page` от 600px, страница с такими карточками (`.content:has(> .formula-card)`) становится flex-контейнером с переносом. Минимальная ширина карточки равна ширине её формулы, поэтому короткие идут по две в строке, а длинная занимает строку целиком; если не помещается и там, скроллится внутри себя. Остальные блоки занимают всю строку. Margin во flex не схлопываются, поэтому в этом режиме вертикальные отступы заданы только сверху, ритм совпадает с обычным.

**Callout:** `aside.callout.callout--{tip|warning|theory|task26|limits|measure}` > `.callout__title` + `.callout__body`.

**Свёрнутый блок:** `details.callout.callout--{limits|measure|task26}.callout--fold` > `summary.callout__title` + `.callout__body`. Закрытый блок занимает одну строку высотой 38px (на сенсорном экране 44px), справа шеврон. Соседние блоки идут через 8px.

**Задания к модели:** `.model-tasks` > `.model-tasks__title` + `ol` > `li` > `button.try-btn`. Кнопка читается как текст задания: на всю ширину, текст слева, с переносами, тонкая рамка, номер в кружке (счётчик на `li`), заливка только при наведении, высота от 44px. `li` без кнопки выглядит так же, но без рамки.

**Кнопка в разборе:** `button.try-btn.try-btn--open` — компактная, по ширине текста, фон `--accent-soft`, маркер ▸.

**Задача:**
```
section.task.task--{base|mid|hard}
  header.task__head > span.task__level + span.task__line + h3.task__title
  div.task__cond
  div.task__part.task__part--{step|trap|answer}[hidden] > div.task__part-title + содержимое
  div.task__actions > button.task__next + button.task__all
```
- Уровень различается не только цветом: подпись («База», «Повышенная», «Сложная»), точки ●○○ / ●●○ / ●●● и толщина левой полосы 2 / 4 / 6px. Точки декоративны и скрыты от скринридеров (`content: … / ""`).
- `--step`: номер шага (CSS-счётчик), тонкая линия слева.
- `--trap`: янтарный фон, полоса и значок «!»; красный занят уровнем «Сложная» и блоком ошибок.
- `--answer`: сплошная рамка 2px, полужирный текст.
- `.task__next` — обводка и `--accent-soft`, `.task__all` — подчёркнутый текст. Обе кнопки от 44px; уже 480px занимают всю строку.

**Настоящие задания:** `aside.task-banks` — спокойный блок на `--surface-2` с уменьшенным `h2`.

**Проверь себя:** `details.quiz` > `summary` (свой шеврон) + `.quiz__answer`.

**Пагинация:** `.pager` > `a.pager__prev` / `a.pager__next` (текст в `span`). Одна колонка < 600px; `.pager__next` всегда в правой колонке, даже без `.pager__prev`.

**Кнопки:** `.btn`, `.btn--primary`, `.print-btn` (значок ⎙ добавляется CSS).

**Главная:** `.home-hero` (h1, p, `.home-actions` > `a.btn`, `a.btn.btn--primary`), `.section-grid` > `.section-card` > `a.section-card__head` (`.section-card__num` + название) + `ul.section-card__list` (ссылки).

**Поиск:** `.search-results` (лучше `<ul>`/`<ol>`, списочные маркеры сброшены) > `.search-result` > `a.search-result__title`, `.search-result__meta`, `.search-result__ctx` (с `<mark>`); `.search-empty`.

**Все формулы:** `.all-formulas` > `.af-section` (h2) > `.af-sub` (h3 > a) > `.af-grid` > `.formula-card.formula-card--compact`.

**Состояния:** `.loading` (пульсация), `.not-found`.

**Модель** (`models.css`):
```
figure.model-wrap > figcaption.model-title + .model-tasks?
  div.model[data-model]
    .model-canvas > canvas         фон = --surface
    .model-controls                flex-wrap; пустой — скрыт
      div.model-control > label > span.model-control__label + output.model-control__value ; input[type=range]
      fieldset.model-control.model-choice > legend.model-control__label + label.model-choice__opt > input[type=radio] + span
      label.model-control.model-check > input[type=checkbox] + span
      button.model-btn[.model-btn--reset | .model-btn--play[aria-pressed]]
    .model-readout > dl.model-readout__list > .model-readout__row > dt + dd
                   + details.model-more > summary + dl.model-readout__list   лишние показания
    p.model-caption
  .model-loading | .model-error
```

Компоновка:

| Ширина `.page` | Схема |
|---|---|
| < 700px | столбик: заголовок, задания, рисунок, контролы, показания, подпись |
| от 700px | слева рисунок, показания, подпись; справа задания и контролы (`--model-side`) |

```
title   title
canvas  tasks
canvas  controls
readout controls
more    controls
caption controls
```
- В широкой схеме сеткой является `.model-wrap`, а `.model` получает `display: contents`, потому что задания лежат вне `.model`. Модели не должны измерять сам `el`: у него нет бокса. `L.canvas` измеряет `.model-canvas`, это работает.
- Если правая колонка выше левой, лишняя высота уходит в строку холста, рисунок центрируется по вертикали, показания остаются под ним.
- Выступ за текстовую колонку задаёт `--model-bleed`: 8px на узких, от 24 до 72px при `.page` от 700px и экране от 768px. Он всегда меньше свободного поля в `.page`, поэтому скролла не создаёт.
- Высоту холста задаёт `L.canvas`: `aspect` и `maxHeight` (по умолчанию 60vh). CSS её не меняет, иначе рисунок исказится.

Элементы:
- Слайдер: зона `--slider-h`, трек 6px, бегунок 18px цвета `--accent`; фокус — контур и ореол.
- Показания: плитки от 112px, паддинг 2/8px, значение 14px.
- Переключатель сегментированный: выбранный сегмент залит `--accent`, подписи переносятся; уже 480px сегменты становятся отдельными «таблетками».
- `select.model-select` (или любой `select` внутри `.model`) — поле 32px, своя стрелка, рамка `--border-strong`.
- `.model-wrap` без `overflow:hidden` — фокусное кольцо не обрезается.
- `.model-btn--play` получает значок ▶ / ❚❚ по `aria-pressed`; `.model-btn--reset` — значок ↺.
- Уже 480px каждый контрол занимает всю ширину, кнопки растягиваются.

## 7. Доступность

- Фокус: `:focus-visible` — контур 2px `--focus` с отступом 2px; у поиска — рамка + ореол; у сегментов — контур вокруг видимого сегмента.
- `.try-btn`, `.task__next`, `.task__all`, `summary` свёрнутых блоков получают тот же контур и сохраняют скругление; у `summary` контур внутри блока (`outline-offset: -2px`).
- `.skip-link` появляется при фокусе. `.page:focus` без контура (программный фокус после навигации).
- Закрытый мобильный сайдбар — `visibility: hidden` (ссылки не попадают в Tab-порядок).
- Утилита `.visually-hidden` / `.sr-only`.
- `prefers-reduced-motion: reduce` — все переходы и анимации практически обнулены, плавная прокрутка отключена.

## 8. Печать

- Скрыты: topbar, sidebar, toc, pager, breadcrumbs, footer, модели, кнопка печати, поиск, `.model-tasks`, `.try-btn`, абзац с `.try-btn--open`, `.task__actions`, `.task-banks`.
- Задачи печатаются полностью: условие, все шаги, ловушка и ответ (`.task__part[hidden]` показан принудительно). Шапка задачи не отрывается от условия.
- Палитра принудительно чёрно-белая (`tokens.css`, `@media print`), фоны callout'ов прозрачные, рамки серые/чёрные.
- `.formula-card`, callout'ы, quiz, таблицы и `.katex-display` — `break-inside: avoid`; внутренние скроллы отключены (`overflow: visible`), формулы не обрезаются.
- «Все формулы»: `.af-grid` — 1 колонка (длинные формулы не вылезают за край), компактные карточки, заголовки разделов не отрываются от содержимого (`break-after: avoid`).
- Ответы `details.quiz` и `details.callout--fold` раскрываются при печати там, где поддерживается `::details-content` (Chromium 131+). В других браузерах свёрнутые блоки останутся закрытыми: `beforeprint` в `app.js` открывает только `details.quiz`.
