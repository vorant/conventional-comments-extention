## Why

Пользователь уже может настраивать список labels, но порядок пока зависит только от добавления/удаления. Возможность перетаскивать labels сделает popup удобнее для личного workflow, а собственная иконка расширения поможет визуально находить его в панели Chrome.

## What Changes

- Добавить drag-and-drop сортировку labels в popup.
- После перетаскивания сохранять новый порядок labels в `chrome.storage.sync`, чтобы панель GitHub Pull Request comments использовала тот же порядок.
- Добавить визуальный drag handle к каждой строке label.
- Сохранить существующие возможности popup: редактирование, добавление, удаление, тема и локальные Nerd Font icons.
- Добавить новую иконку расширения для Chrome toolbar/action и manifest icons.
- Выбранный визуальный стиль иконки: компактный badge с `CC` и hint на review comment, в палитре проекта, пригодный для размеров Chrome extension icons.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `github-review-comments`: popup настроек должен позволять менять порядок labels через drag-and-drop, а расширение должно иметь собственную иконку в Chrome UI.

## Impact

- `src/popup.html`: добавить семантику/контейнеры, если нужно для drag handles.
- `src/popup.css`: добавить стили drag handle, dragging/drop states и icon controls.
- `src/popup.js`: реализовать reorder labels через native drag-and-drop, сохранять обновленный `ccLabels`.
- `manifest.json`: добавить `action.default_icon` и top-level `icons`.
- Новые icon assets для Chrome extension, минимум sizes `16`, `32`, `48`, `128`.
- `test/popup-behavior.test.js`: покрыть reorder и сохранение порядка.
- `test/static.test.js`: проверить manifest icon wiring и наличие icon assets.
- `README.md`: описать drag-and-drop reorder и иконку расширения в ручной проверке.
