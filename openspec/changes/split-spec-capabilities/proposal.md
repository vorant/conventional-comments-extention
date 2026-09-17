## Why

Текущая основная спецификация `github-review-comments` смешивает поведение content script, popup/settings и packaging-детали расширения в одном файле. Разделение на capability-файлы сделает будущие changes точнее: изменения popup не будут выглядеть как изменения GitHub review UI, а packaging не будет жить рядом с поведением textarea.

## What Changes

- Разнести существующие requirements по нескольким main specs без изменения пользовательского поведения.
- Оставить `github-review-comments` для поведения панели labels внутри GitHub Pull Request review UI.
- Выделить `popup-label-management` для popup, темы, CRUD labels и drag-and-drop reorder.
- Выделить `extension-packaging` для manifest/Chrome UI packaging concerns, включая extension icons.
- Не менять runtime-код, README или тесты, кроме проверок OpenSpec при необходимости.

## Capabilities

### New Capabilities

- None; this is an OpenSpec organization refactor with no product behavior change.

### Modified Capabilities

- None; requirements are moved between main spec files without changing their normative content.

## Impact

- Affects only files under `openspec/specs/`.
- Future OpenSpec changes should target the narrower capability path that owns the behavior being changed.
- Runtime extension behavior, tests, dependencies, and user documentation remain unchanged.
