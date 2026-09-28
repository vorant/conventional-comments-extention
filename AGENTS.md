# AGENTS.md

## Project overview

This is a Manifest V3 Chrome extension for GitHub Pull Requests. The MVP helps users write review comments in the Conventional Comments format: when a user opens the standard comment field for a line of code, the extension displays a label panel and inserts the selected `label: ` at the beginning of the textarea.

The project is intentionally small. The MVP supports only GitHub Pull Requests; GitLab, Bitbucket, a popup, settings, AI suggestions, and decorations such as `(non-blocking)` are outside the current scope.

## OpenSpec

The project follows the OpenSpec workflow.

- No active changes should remain after the MVP if the work is complete.
- Main specification: `openspec/specs/github-review-comments/spec.md`.
- MVP archive: `openspec/changes/archive/2026-09-16-github-conventional-comments-mvp/`.
- Start significant behavior changes with a new OpenSpec change, then sync the specs and archive the change after implementation.

Useful commands:

```bash
openspec list --json
openspec list --specs --json
openspec validate --specs --strict
```

## Project structure

- `manifest.json` - Manifest V3, with a content script limited to `https://github.com/*/*/pull/*`.
- `src/content-script.js` - finds GitHub comment textareas, adds the label panel, and inserts prefixes.
- `src/content-style.css` - styles for the panel and buttons.
- `test/` - tests using `node --test` with no external dependencies.
- `docs/github-dom-notes.md` - notes on the actual DOM of the GitHub Pull Request review UI.
- `README.md` - user documentation in Russian.

## Important implementation details

- The content script uses `MutationObserver` because GitHub dynamically adds the comment editor after a user clicks a diff line.
- The new GitHub UI may open a textarea without a `name`, but with `aria-label="Markdown value"` and `placeholder="Leave a comment"`.
- The panel must be inserted above the textarea. For the new GitHub UI, use the `[class*="MarkdownInput-module__inputWrapper"]` wrapper; otherwise, `inline-flex` may position the panel to the left of the field.
- An already processed textarea is marked with `data-cc-label-panel` to prevent duplicate panels.

## Checks

Before completing changes, run:

```bash
npm test
openspec validate --specs --strict
```

If there is an active OpenSpec change, also run:

```bash
openspec validate --changes <change-name> --strict
openspec instructions apply --change <change-name> --json
```

## Working conventions

- Do not expand the scope without a new OpenSpec change.
- Do not add a build tool or dependencies without a clear reason: the current MVP works as a simple unpacked extension.
