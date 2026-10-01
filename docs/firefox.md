# Local Firefox installation

This package targets Firefox desktop and uses a temporary installation. Automated packaging and API behavior tests pass. On Firefox 157.0 / macOS 26.7, the temporary package loads, the popup document and Settings open, and theme changes survive page reload. Review-editor behavior and the remaining browser lifecycle checks are still pending. GitLab and Bitbucket remain preview integrations.

## Build tools

Use Node.js 22 or newer (web-ext requires at least Node.js 20), npm 8 or newer, and Make. The tools are pinned to web-ext 10.7.0 in the lockfile and do not ship inside the extension. Install them once from the project directory:

```sh
npm ci
```

| Command | Result |
| --- | --- |
| `make build-firefox` | Prepare `dist/firefox` for manual loading; equivalent to `npm run package:firefox` |
| `make lint-firefox` | Prepare and validate the current Firefox package |
| `make run-firefox` | Prepare, validate and launch Firefox with a temporary extension in a separate temporary profile |
| `make package-firefox` | Prepare, validate and create `dist/conventional-comments-firefox-<version>.zip` |
| `make help` | Show these commands and the existing Chrome packaging command |

The ZIP version comes from `manifest.json`. Repeating packaging replaces the same version's Firefox ZIP with current resources. The ZIP is unsigned; it does not enable permanent installation. The existing `make package` still creates the Chrome ZIP, and `npm run package:safari` prepares the Safari folder.

If Firefox is not found automatically, provide its executable path:

```sh
make run-firefox FIREFOX_BIN="/Applications/Firefox.app/Contents/MacOS/firefox"
```

The development browser uses a temporary profile, so your usual Firefox login and settings are not copied. Stop the development command with Ctrl+C and run it again after editing `src`: web-ext watches the prepared `dist/firefox` folder, not the original source tree. No source-copy watcher is provided.

Validation errors stop packaging and launch. Warnings remain visible. The initial web-ext check reports missing Firefox data-collection metadata and an unsafe innerHTML assignment in bundled code; these warnings do not establish AMO readiness. Tools are resolved locally and never silently downloaded by a build command; if they are missing, run `npm ci`.

## Manual temporary installation

1. From the project directory, run `npm run package:firefox`.
2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `dist/firefox/manifest.json` in this project.
4. Open the extension from the extensions menu. Check its site permissions and allow access to GitHub. In the extension's Settings, grant other configured site origins individually; saving a profile alone does not grant access.
5. Reload a GitHub PR page, open a supported review comment editor, and select a label. Use the popup to edit labels, emoji, colors, and theme, or open Settings for site profiles and CSS.

After source changes, run `npm run package:firefox` again, click **Reload** for Conventional Comments on the debugging page, then refresh the GitHub tab. Use **Remove** on the debugging page to remove the temporary installation.

Firefox removes temporary extensions when the browser restarts. Load the manifest again and check site access as needed. Settings recovery after removal or reinstallation is not guaranteed. The stable add-on ID identifies this local package; it does not make the installation permanent. Settings are independent of Chrome and Safari, and migration or cross-browser synchronization is not provided.

This method requires neither signing nor publication on Mozilla Add-ons. It does not produce a signed XPI for permanent installation. Firefox Android and older Firefox versions have not been verified.

See Mozilla's [temporary installation instructions](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
