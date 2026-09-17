## Why

Popup уже управляет labels, но выглядит утилитарно и не поддерживает предпочтения пользователя по светлой/темной теме. Небольшое визуальное улучшение сделает настройки приятнее, не расширяя scope за пределы Chrome popup.

## What Changes

- Добавить в popup переключатель темы с двумя состояниями: светлая и темная тема.
- Сохранять выбранную тему между открытиями popup.
- Добавить Nerd Fonts glyph-иконки в popup controls и bundled локальный font asset, чтобы иконки работали без установленного у пользователя Nerd Font.
- Заменить текстовую кнопку `Delete` у label на красную иконку корзины.
- Сохранить доступность удаления через `aria-label`/title, чтобы icon-only control был понятен без видимого текста.
- Сохранить существующее поведение labels: редактирование, добавление, удаление и использование списка в GitHub Pull Request comments.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `github-review-comments`: popup настроек должен поддерживать светлую/темную тему и icon-only удаление labels с красной иконкой корзины.

## Impact

- `src/popup.html`: добавить theme toggle и структуру для icon controls.
- `src/popup.css`: добавить light/dark theme tokens, стили toggle, локальный `@font-face` для Nerd Font glyphs и красную icon-only кнопку удаления.
- `src/popup.js`: сохранять тему в `chrome.storage.sync`, применять тему при загрузке и переключении, заменить видимый текст удаления на icon-only control.
- Новый локальный font asset в репозитории/extension bundle для Nerd Fonts glyphs.
- `test/popup-behavior.test.js`: покрыть загрузку/сохранение темы и icon-only delete button.
- `test/static.test.js`: проверить отсутствие внешних font URLs, наличие локального font asset и popup wiring.
- `README.md`: кратко описать переключатель темы и icon-only удаление.
