.DEFAULT_GOAL := help

# Версия архива совпадает с версией устанавливаемого расширения.
VERSION = $(shell node -p "require('./manifest.json').version")
ARCHIVE = dist/conventional-comments-$(VERSION).zip

.PHONY: help test spec-check check changes specs change-check change-instructions package

help: ## Показать основные команды
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  make %-28s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf '\nДля команд change-* укажите CHANGE=<имя-change>.\n'

test: ## Запустить тесты приложения через npm
	npm test

spec-check: ## Проверить основные спецификации OpenSpec в строгом режиме
	openspec validate --specs --strict

check: test spec-check ## Запустить тесты и проверку спецификаций

changes: ## Показать активные OpenSpec changes
	openspec list --json

specs: ## Показать основные спецификации OpenSpec
	openspec list --specs --json

change-check: ## Проверить change: make change-check CHANGE=<имя>
	@test -n "$(CHANGE)" || { echo 'Укажите CHANGE=<имя-change>'; exit 1; }
	openspec validate --changes "$(CHANGE)" --strict

change-instructions: ## Показать задачи change: make change-instructions CHANGE=<имя>
	@test -n "$(CHANGE)" || { echo 'Укажите CHANGE=<имя-change>'; exit 1; }
	openspec instructions apply --change "$(CHANGE)" --json

# -FS удаляет из повторно создаваемого ZIP файлы, которых больше нет в исходниках.
# Скрытые файлы, включая .DS_Store, в архив не входят.
package: ## Создать ZIP расширения в dist/ для переноса на другой компьютер
	@command -v node >/dev/null || { echo 'Для определения версии нужен Node.js'; exit 1; }
	@command -v zip >/dev/null || { echo 'Для упаковки нужна утилита zip'; exit 1; }
	mkdir -p dist
	zip -q -r -FS "$(ARCHIVE)" manifest.json src README.md README-DEVELOPER.md docs -x '*/.*'
	@printf 'Архив создан: %s\n' "$(ARCHIVE)"
