## Why

Ревьюеры в GitHub Pull Requests часто пишут комментарии свободным текстом, из-за чего намерение комментария может быть неочевидным для автора изменений. Расширение помогает быстро начинать комментарий с Conventional Comments label, не заменяя стандартный интерфейс GitHub.

## What Changes

- Добавляется Chrome-расширение для страниц GitHub Pull Requests.
- На открытом поле комментария к строке кода расширение показывает панель с labels из Conventional Comments.
- При клике по label расширение вставляет выбранный префикс в начало поля комментария.
- Документация проекта ведется на русском языке.
- GitLab Merge Requests и Bitbucket Pull Requests не входят в MVP и остаются на будущие изменения.

## Capabilities

### New Capabilities

- `github-review-comments`: помощь в написании GitHub PR review comments с использованием Conventional Comments labels.

### Modified Capabilities

- Нет.

## Impact

- Новый Chrome Extension Manifest V3.
- Новый content script для страниц `github.com` с Pull Request diff/review интерфейсом.
- Новые стили для панели labels внутри GitHub UI.
- Возможные тесты или ручная проверка поведения на реальной странице GitHub Pull Request.
