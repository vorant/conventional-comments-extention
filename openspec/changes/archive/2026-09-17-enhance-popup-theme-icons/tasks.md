## 1. Theme Toggle

- [x] 1.1 Add a light/dark theme toggle to `src/popup.html` and verify popup static tests can find the theme control.
- [x] 1.2 Implement `ccTheme` loading with default `light`, apply the selected theme to the popup root, and verify popup behavior tests cover first-open light theme and saved dark theme.
- [x] 1.3 Implement theme switching between only `light` and `dark`, persist changes to `chrome.storage.sync`, and verify tests cover dark-to-light and light-to-dark transitions.

## 2. Popup Icons and Styling

- [x] 2.1 Replace hardcoded popup colors with light/dark CSS custom properties and verify both themes style body, inputs, buttons, focus, and hover states.
- [x] 2.2 Add a bundled local Nerd Font WOFF2 asset for popup icons, wire it through local `@font-face`, and verify static tests assert the font file exists and no external font URLs are introduced.
- [x] 2.3 Replace the visible `Delete` label with a red icon-only trash button that uses the bundled Nerd Font, and verify tests assert the button has a trash icon, danger styling class, `aria-label`, and no visible `Delete` text.

## 3. Preserve Existing Behavior

- [x] 3.1 Preserve label editing, adding, deleting, and storage behavior after the UI changes, and verify existing popup behavior tests still pass.
- [x] 3.2 Preserve GitHub content-script behavior unchanged, and verify content-script behavior tests still pass.

## 4. Documentation and Validation

- [x] 4.1 Update Russian README documentation to mention the light/dark theme toggle and trash icon deletion, and verify README static tests match the new text.
- [x] 4.2 Run `npm test` and verify all tests pass.
- [x] 4.3 Validate the OpenSpec change with `openspec validate --changes enhance-popup-theme-icons --strict` and project specs with `openspec validate --specs --strict`.
