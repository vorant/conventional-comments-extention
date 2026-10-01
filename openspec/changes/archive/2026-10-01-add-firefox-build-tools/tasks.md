## 1. Инструменты

- [x] 1.1 Выбрать совместимую версию web-ext по опубликованным engines, закрепить её в devDependencies, создать package-lock.json и исключить node_modules из Git; проверить npm ci и запуск локального web-ext --version на документированном Node.js.
- [x] 1.2 Добавить npm-команды проверки, запуска и ZIP-упаковки с общей подготовкой dist/firefox, явной диагностикой отсутствующего web-ext и сохранением смысла package:firefox; проверить последовательность и ненулевые коды при ошибках подготовки/проверки.

## 2. Makefile и ZIP

- [x] 2.1 Добавить build-firefox, lint-firefox, run-firefox и package-firefox в Makefile и .PHONY, обновить help и описание package для Chrome; проверить make help и выполнение targets, включая make -j package-firefox.
- [x] 2.2 Создавать через web-ext build dist/conventional-comments-firefox-<manifest.version>.zip после lint; проверить корневой Firefox manifest, LICENSE и ресурсы, отсутствие node_modules/tooling/вложенных ZIP и сохранность Chrome/Safari outputs.
- [x] 2.3 Добавить проверки повторной упаковки после изменения/удаления исходного ресурса и ошибки lint, блокирующей запуск/архив; проверить актуальное содержимое ZIP и отсутствие ложного сообщения об успехе.

## 3. Запуск и документация

- [ ] 3.1 Реализовать run-firefox с отдельным временным профилем и FIREFOX_BIN; проверить передачу пути с пробелами и ошибку неверного пути, затем реальный запуск Firefox с расширением и открытием UI, записать версию и результат.
- [x] 3.2 Обновить README и docs/firefox.md: npm ci, требования Node.js, четыре make-команды, временный профиль, повторный запуск после изменения src, неподписанный ZIP и прежняя ручная установка; сверить команды с фактическими результатами.

## 4. Итоговая проверка

- [x] 4.1 Выполнить npm test, make lint-firefox, make package-firefox и прежние команды Chrome/Safari packaging; записать диагностику lint и убедиться, что runtime-ресурсы и прежние команды не регрессировали.
- [x] 4.2 Выполнить openspec validate --specs --strict, openspec validate --changes add-firefox-build-tools --strict и openspec instructions apply --change add-firefox-build-tools --json; проверить согласованность задач и результатов перед синхронизацией спецификаций и архивированием завершённого change.
