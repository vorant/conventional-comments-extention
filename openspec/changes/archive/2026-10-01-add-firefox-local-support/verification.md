# Verification

## Automated implementation checks

- `npm test`: 192 passed, 0 failed. Existing Chrome-context tests remain, and 81 behavior cases run again with the Firefox `browser` namespace and without `importScripts` in background contexts. These are synthetic API/DOM tests, not real-browser evidence.
- Firefox cases cover startup, registration, revocation, messaging, storage errors, coalesced label saves, popup, theme, options, profiles, CSS, editor insertion and SPA behavior.
- Packaging test checks manifest adaptations, dependency/resource references, source bytes, licenses, stable ID, deterministic rebuild, stale-file removal, adjacent Safari output preservation and rejection of a symlinked dist directory.
- `npm run package:firefox`: generated `dist/firefox` successfully.

- `openspec validate --specs --strict`: 8 specifications passed.
- `openspec validate --changes add-firefox-local-support --strict`: passed.
- `git diff --check`: passed. Apply instructions agree with the pending browser tasks; documentation is drafted but not verified against Firefox UI.

## Browser verification pending

Follow-up: Firefox is now installed at `/Applications/Firefox.app`. Firefox 157.0 was confirmed from Info.plist and the live about:debugging UI on macOS 26.7 (25G229). The 192 automated tests and both OpenSpec validations passed again, and the package was rebuilt. The debugging page reports zero temporary extensions. Two attempts to open the temporary add-on chooser failed with `Sky Computer Use native pipe closed before response`; actual extension loading and browser compatibility remain unverified.

Pending: temporary load through about:debugging; background/UI/resource loading; GitHub text/cursor/multiple-editor/SPA checks; saved settings across popup close, background restart and Reload; site permission rejection/grant/revocation; Chrome and Safari smoke checks; matching the installation guide against actual Firefox UI.

Browser checks are not marked complete on the strength of synthetic tests. See the archive decision below.

## Live Firefox follow-up after user loaded the package

Firefox 157.0 on macOS 26.7: about:debugging lists Conventional Comments from dist/firefox with ID conventional-comments@vorant.local. The user performed the temporary installation.

Verified directly in the browser:
- popup.html opens as an extension tab with all nine default labels, emoji buttons, color controls and rendered icon glyphs.
- Theme toggles from dark to light and survives page reload; original dark theme restored afterwards.
- The Settings button opens options.html through the extension API. GitHub profile, selectors, placement and CSS render; UI reports Site access granted.

Limitations: this checks the popup document in a tab, not yet the toolbar popup lifecycle. Emoji picker loading, console errors, background restart, extension Reload and remaining storage/permission scenarios are still pending. Computer Use click actions fail with a native pipe error; keyboard navigation works.

The GitHub PR page loaded, but Firefox is signed out (Sign in link visible), preventing review-editor testing. User asked to sign in; no comments were submitted. Browser tasks remain incomplete.

## Archive decision

The user deferred the GitHub editor check to their own manual testing and then explicitly requested archive, commit and push. Archive is authorized with the remaining browser verification incomplete. Tasks 3.1–3.5 and the unverified part of documentation task 4.1 remain unchecked; this is not evidence that those scenarios passed. Main specifications retain their behavior contracts.
