.DEFAULT_GOAL := help

# The archive version matches the installed extension version.
VERSION = $(shell node -p "require('./manifest.json').version")
ARCHIVE = dist/conventional-comments-$(VERSION).zip

.PHONY: help test spec-check check changes specs change-check change-instructions package
.PHONY: build-firefox lint-firefox run-firefox package-firefox
export FIREFOX_BIN

help: ## Show common commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  make %-28s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf '\nFor change-* commands, specify CHANGE=<change-name>.\n'
	@printf 'Firefox tools: npm ci (Node.js 22+ recommended). Optional: FIREFOX_BIN=<executable path>.\n'

test: ## Run application tests through npm
	npm test

spec-check: ## Validate main OpenSpec specifications in strict mode
	openspec validate --specs --strict

check: test spec-check ## Run tests and specification validation

changes: ## List active OpenSpec changes
	openspec list --json

specs: ## List main OpenSpec specifications
	openspec list --specs --json

change-check: ## Validate a change: make change-check CHANGE=<name>
	@test -n "$(CHANGE)" || { echo 'Specify CHANGE=<change-name>'; exit 1; }
	openspec validate --changes "$(CHANGE)" --strict

change-instructions: ## Show change tasks: make change-instructions CHANGE=<name>
	@test -n "$(CHANGE)" || { echo 'Specify CHANGE=<change-name>'; exit 1; }
	openspec instructions apply --change "$(CHANGE)" --json

# -FS removes files no longer present in the source from an existing ZIP archive.
# Hidden files, including .DS_Store, are excluded from the archive.
package: ## Create the Chrome extension ZIP in dist/ for transfer
	@command -v node >/dev/null || { echo 'Node.js is required to determine the version'; exit 1; }
	@command -v zip >/dev/null || { echo 'The zip utility is required for packaging'; exit 1; }
	mkdir -p dist
	zip -q -r -FS "$(ARCHIVE)" manifest.json src README.md docs -x '*/.*'
	@printf 'Archive created: %s\n' "$(ARCHIVE)"

build-firefox: ## Prepare the unpacked Firefox extension in dist/firefox
	npm run package:firefox

lint-firefox: ## Prepare and validate the Firefox extension with web-ext
	npm run lint:firefox

run-firefox: ## Prepare, validate and launch Firefox with a temporary profile
	npm run run:firefox

package-firefox: ## Prepare, validate and create the unsigned Firefox ZIP in dist/
	npm run zip:firefox
