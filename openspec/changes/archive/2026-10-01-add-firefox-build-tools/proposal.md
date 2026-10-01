## Why

Firefox-пакет уже создаётся в dist/firefox, но Makefile предлагает только ZIP с Chrome manifest. Нужны единые команды подготовки, проверки, запуска и упаковки Firefox, чтобы разработчик мог проверить пакет и передать его без ручного набора команд.

## What Changes

- Закрепить Mozilla web-ext в devDependencies с package-lock.json и документировать совместимую версию Node.js.
- Добавить make build-firefox, lint-firefox, run-firefox и package-firefox.
- Собирать отдельный dist/conventional-comments-firefox-<version>.zip из актуального Firefox-пакета.
- Обновить make help и документацию; уточнить, что существующий make package предназначен для Chrome.
- Сохранить npm run package:firefox как команду подготовки папки, без изменения её смысла.
- Подпись, AMO и постоянная установка остаются вне объёма.

## Capabilities

### New Capabilities

Нет.

### Modified Capabilities

- `extension-packaging`: команды проверки и запуска Firefox, отдельный версионный ZIP и актуальная справка Makefile.

## Impact

Makefile, package.json, новый package-lock.json, .gitignore, scripts при необходимости, тесты упаковки, README и docs/firefox.md. web-ext используется только при разработке и не включается в ресурсы расширения. Поведение UI и хранилища не меняется; существующие Chrome и Safari способы упаковки сохраняются.
