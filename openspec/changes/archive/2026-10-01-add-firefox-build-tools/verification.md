# Firefox build tools verification

- Environment: macOS 26.7, Node.js 26.7.0, npm 11.19.0, Firefox 157.0.
- web-ext 10.7.0 is pinned; published engines require Node >=20 and npm >=8. `npm ci` succeeded (328 installed packages, audit reported zero vulnerabilities); local `web-ext --version` returned 10.7.0.
- `make help` lists all four Firefox targets and describes `make package` as Chrome packaging.
- `make build-firefox`, `make lint-firefox` and `make -j package-firefox` succeeded. Firefox ZIP: `dist/conventional-comments-firefox-0.2.0.zip`.
- Lint: 0 errors, 0 notices, 2 visible warnings: `MISSING_DATA_COLLECTION_PERMISSIONS` in manifest.json and `UNSAFE_VAR_ASSIGNMENT` in src/vendor/emoji-picker-element/picker.js:399. Neither is suppressed; publication readiness is not claimed.
- `npm test`: 198 passed, 0 failed/skipped. Tests include real web-ext ZIP creation/rebuild, resource modification/removal, root manifest and licenses, neighbour preservation, missing-tool diagnostics, preparation/lint failure propagation, and a browser executable path containing spaces.
- `make package` and `npm run package:safari` succeeded with their existing output formats.
- `make run-firefox FIREFOX_BIN=/Applications/Firefox.app/Contents/MacOS/firefox` launched Firefox and web-ext reported installation of the temporary add-on. Process inspection confirmed a separate generated temporary profile, `-no-remote`, and the specified Firefox binary. The test web-ext process was stopped with SIGINT afterwards (exit 130).
- An invalid FIREFOX_BIN now fails immediately with a clear executable-file diagnostic, before starting web-ext. Verified with a missing path containing spaces.

- Strict OpenSpec validation passed for all 9 main specs and this change; git diff --check passed. Apply progress: 8/9 tasks complete.

## Remaining browser check

Opening the extension UI in the newly launched temporary-profile Firefox remains unverified: Computer Use targets the user's regular Firefox instance rather than the web-ext process. Task 3.1 remains unchecked for this part. Installation is confirmed by web-ext output, but this is not a substitute for the UI check. No GitHub review-editor validation from the previous change is implied.

## Archive decision

The user explicitly requested archiving after being informed that 8/9 tasks were complete and the temporary-profile UI check was pending. The change is archived with task 3.1 still unchecked; this does not claim the remaining UI check passed. All four added packaging requirements are synchronized to the main specification.
