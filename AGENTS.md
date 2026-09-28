# AGENTS.md

## Кратко о проекте

Это Chrome Extension Manifest V3 для GitHub Pull Requests. MVP помогает писать review comments в формате Conventional Comments: когда пользователь открывает стандартное поле комментария к строке кода, расширение показывает панель labels и вставляет выбранный `label: ` в начало textarea.

Проект намеренно небольшой. В MVP поддерживается только GitHub Pull Requests; GitLab, Bitbucket, popup, настройки, AI-подсказки и decorations вроде `(non-blocking)` не входят в текущий scope.

## OpenSpec

В проекте используется OpenSpec-подход.

- Активных changes после MVP быть не должно, если работа завершена.
- Основная спецификация: `openspec/specs/github-review-comments/spec.md`.
- Архив MVP: `openspec/changes/archive/2026-09-16-github-conventional-comments-mvp/`.
- Существенные изменения поведения начинай с нового OpenSpec change, затем синхронизируй specs и архивируй change после реализации.

Полезные команды:

```bash
openspec list --json
openspec list --specs --json
openspec validate --specs --strict
```

## Структура

- `manifest.json` - Manifest V3, content script только для `https://github.com/*/*/pull/*`.
- `src/content-script.js` - поиск GitHub comment textarea, добавление панели labels, вставка префикса.
- `src/content-style.css` - стили панели и кнопок.
- `test/` - тесты на `node --test` без внешних зависимостей.
- `docs/github-dom-notes.md` - заметки по реальному DOM GitHub Pull Request review UI.
- `README.md` - русскоязычная документация пользователя.

## Важные детали реализации

- Content script использует `MutationObserver`, потому что GitHub динамически добавляет comment editor после клика по строке diff.
- Новый GitHub UI может открывать textarea без `name`, но с `aria-label="Markdown value"` и `placeholder="Leave a comment"`.
- Панель должна вставляться над textarea. Для нового GitHub UI используется wrapper `[class*="MarkdownInput-module__inputWrapper"]`, иначе панель может оказаться слева от поля из-за `inline-flex`.
- Уже обработанная textarea помечается `data-cc-label-panel`, чтобы не дублировать панель.

## Проверки

Перед завершением изменений запускай:

```bash
npm test
openspec validate --specs --strict
```

Если открыт активный OpenSpec change, дополнительно проверяй:

```bash
openspec validate --changes <change-name> --strict
openspec instructions apply --change <change-name> --json
```

## Стиль работы

- Документация проекта ведется на русском языке.
- Не расширяй scope без нового OpenSpec change.
- Не добавляй сборщик или зависимости без явной причины: текущий MVP работает как простое unpacked extension.
