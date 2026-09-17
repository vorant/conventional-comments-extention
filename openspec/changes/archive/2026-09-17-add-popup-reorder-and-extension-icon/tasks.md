## 1. Popup Reorder

- [x] 1.1 Add a visible drag handle to each popup label row and verify popup behavior/static tests can identify draggable rows and handle styling.
- [x] 1.2 Implement native drag-and-drop reorder logic in `src/popup.js`, and verify a drag/drop test can move `question` before `suggestion`.
- [x] 1.3 Persist reordered labels to `ccLabels`, and verify popup tests assert storage is updated in the new order.
- [x] 1.4 Preserve no-op drops without changing order or adding duplicate saves, and verify a test covers dropping a row onto its original position.
- [x] 1.5 Preserve existing label edit/add/delete/theme behavior after reorder changes, and verify existing popup behavior tests still pass.
- [x] 1.6 Add theme-specific drag handle icons for light and dark themes, and verify popup tests/static tests can identify both icons.
- [x] 1.7 Add dragover preview reordering with animated row movement, and verify tests show labels moving before drop and restoring on cancelled drag.
- [x] 1.8 Limit dragover preview animation to only the changed row range, and verify moving the second label to the fourth only marks rows two through four.
- [x] 1.9 Limit subsequent dragover preview animation to the latest changed range, and verify moving the second label to fourth then seventh only marks rows four through seven.

## 2. Extension Icon

- [x] 2.1 Generate local PNG extension icons in sizes `16`, `32`, `48`, and `128` using the chosen `CC` review-comment badge style, and verify the files exist under `src/icons/`.
- [x] 2.2 Wire `manifest.json` `icons` and `action.default_icon` to those local assets, and verify static tests assert each standard size is present.
- [x] 2.3 Verify the icon assets are local files with no remote URLs or build-time dependency required to load the extension.

## 3. Documentation and Validation

- [x] 3.1 Update Russian README documentation to mention drag-and-drop reorder and the custom Chrome extension icon, and verify README static tests match the new text.
- [x] 3.2 Run `npm test` and verify all tests pass.
- [x] 3.3 Validate the OpenSpec change with `openspec validate --changes add-popup-reorder-and-extension-icon --strict` and project specs with `openspec validate --specs --strict`.
