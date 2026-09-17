## 1. Manifest and Popup Shell

- [ ] 1.1 Add `storage` permission and `action.default_popup` to `manifest.json`, and verify static tests assert the new MV3 popup configuration.
- [ ] 1.2 Create popup HTML/CSS/JS files without external dependencies, and verify the files are referenced by manifest and load as static extension assets.

## 2. Settings Storage and Popup Behavior

- [ ] 2.1 Implement popup loading of `ccLabels` from `chrome.storage.sync` with the default labels fallback, and verify a first-open popup renders `praise`, `nitpick`, `suggestion`, `issue`, `todo`, `question`, `thought`, `chore`, `note`.
- [ ] 2.2 Implement editing existing labels with automatic persistence, and verify a changed label is written back to `ccLabels`.
- [ ] 2.3 Implement adding non-empty labels and rejecting whitespace-only additions, and verify storage contains the added label only for valid input.
- [ ] 2.4 Implement deleting labels, including deleting the last remaining label, and verify storage reflects the resulting list.

## 3. GitHub Panel Integration

- [ ] 3.1 Update `src/content-script.js` to load labels from `chrome.storage.sync` with the same default labels fallback, and verify existing GitHub Pull Request panel tests still pass after async loading is accounted for.
- [ ] 3.2 Render buttons from the saved label list and insert the selected saved label as `<label>: `, and verify custom labels such as `proposal` and `idea💡` are inserted correctly.
- [ ] 3.3 Handle an intentionally empty saved list by not rendering an empty panel, and verify MutationObserver does not repeatedly create UI for the same textarea.
- [ ] 3.4 Preserve the existing GitHub-only page guard, textarea detection, modern GitHub insertion target, and standard GitHub submit/cancel behavior, and verify the existing behavior tests remain covered.

## 4. Documentation and Validation

- [ ] 4.1 Update Russian README documentation to describe popup settings, editable labels, add/delete behavior, and the continued GitHub Pull Request scope, and verify README static tests match the new scope text.
- [ ] 4.2 Add or update tests for manifest, popup storage behavior, default label consistency between popup and content script, custom label insertion, and empty list behavior, then verify `npm test` passes.
- [ ] 4.3 Validate the OpenSpec change with `openspec validate --changes add-configurable-label-popup --strict` and project specs with `openspec validate --specs --strict`.
