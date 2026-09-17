## Context

Popup сейчас состоит из `src/popup.html`, `src/popup.css` и `src/popup.js`. Он уже использует `chrome.storage.sync` для массива `ccLabels`, рендерит inputs labels и текстовую кнопку `Delete`. CSS сейчас задает только светлую палитру с хардкоженными цветами. Тесты popup используют fake DOM в `test/popup-behavior.test.js`, поэтому новые controls нужно сделать проверяемыми без браузера.

## Goals / Non-Goals

**Goals:**

- Добавить понятный toggle светлая/темная тема внутри popup.
- Хранить выбранную тему в `chrome.storage.sync` рядом с labels.
- Улучшить controls иконками без сборщика, npm-зависимостей и runtime-загрузок из сети.
- Поставлять минимальный Nerd Font webfont asset вместе с расширением, чтобы иконки работали независимо от системных шрифтов.
- Заменить видимый текст `Delete` на красную icon-only кнопку корзины с `aria-label` и `title`.
- Сохранить существующие сценарии редактирования, добавления и удаления labels.

**Non-Goals:**

- Автоматическая тема по системному `prefers-color-scheme`.
- Больше двух тем, кастомные цвета или отдельная options page.
- CDN или runtime-загрузка шрифтов.
- Изменение GitHub content panel.

## Decisions

### Тема хранится отдельным ключом `ccTheme`

Использовать строковый ключ `ccTheme` со значениями `light` или `dark`. Значение по умолчанию - `light`. При загрузке popup код читает labels и тему из storage, применяет тему к корневому элементу popup, затем рендерит UI.

Альтернатива: хранить тему в одном объекте настроек вместе с labels. Это аккуратнее для будущих настроек, но потребовало бы миграции текущего ключа `ccLabels`; для маленького MVP отдельный ключ проще и безопаснее.

### Темизация через CSS custom properties

Заменить хардкоженные цвета popup на tokens: background, text, muted text, border, input background, button background, focus и danger. Переключение темы меняет `data-theme` на `body` или корневом `.popup`, а CSS меняет значения tokens.

Альтернатива: переключать классы на каждом элементе. Это быстро становится шумным и сложнее тестируется.

### Nerd Fonts через bundled локальный webfont

Скачать и сохранить в репозитории WOFF2-файл Nerd Font, достаточный для используемых glyphs popup, например Symbols Nerd Font или другой официальный Nerd Fonts webfont artifact. Подключить его через локальный `@font-face` в `src/popup.css`, например из `src/fonts/`, и использовать этот font-family для icon elements/buttons. Не использовать CDN, remote URL или runtime-загрузку шрифта. Если конкретный glyph изменится, asset должен оставаться частью extension bundle, чтобы иконки работали у пользователей без установленного Nerd Font.

Альтернатива: полагаться на установленный в системе Nerd Font. Это проще, но не дает гарантии отображения у всех пользователей. SVG или lucide icons надежны визуально, но пользователь явно попросил Nerd Fonts.

### Icon-only delete button

Кнопка удаления остается `button type="button"`, но получает классы для icon/danger styling, красный цвет и доступное имя `Удалить label`. Видимый текст `Delete` удаляется. Можно использовать glyph `󰆴` или другой Nerd Fonts trash icon как содержимое.

Альтернатива: оставить текст рядом с иконкой. Пользователь явно попросил убрать кнопку `Удалить` и заменить ее корзиной, поэтому visible text не должен оставаться.

## Risks / Trade-offs

- Локальный font asset увеличит размер расширения → выбрать WOFF2 webfont и, если удобно без усложнения сборки, минимальный Symbols Nerd Font asset.
- Нужно соблюдать лицензию шрифта → использовать официальный Nerd Fonts artifact с совместимой лицензией и сохранить license/attribution, если этого требует выбранный файл.
- Theme toggle добавляет еще один storage key → tests должны покрыть default `light`, сохранение `dark` и повторное чтение.
- Темная тема может ухудшить контраст при ручных цветах → выбрать restrained цвета и проверить focus/hover states в CSS.
- Fake DOM tests могут потребовать расширить тестовые элементы для `dataset`, `checked` или похожих свойств → держать JS простым и DOM-neutral.

## Migration Plan

1. Добавить `ccTheme` с default `light`; существующим пользователям миграция не нужна.
2. Добавить локальный Nerd Font WOFF2 asset и подключить его в popup CSS через `@font-face`.
3. Обновить popup HTML/CSS/JS и тесты.
4. README дополнить краткой проверкой темы и иконки корзины.
5. Rollback: удалить `ccTheme`, локальный font asset, вернуть светлую CSS-палитру и текстовую кнопку удаления.
