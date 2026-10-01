# Local Firefox installation

This package targets Firefox desktop and uses a temporary installation. Automated packaging and API behavior tests pass. On Firefox 157.0 / macOS 26.7, the temporary package loads, the popup document and Settings open, and theme changes survive page reload. Review-editor behavior and the remaining browser lifecycle checks are still pending. GitLab and Bitbucket remain preview integrations.

1. From the project directory, run `npm run package:firefox`.
2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and select `dist/firefox/manifest.json` in this project.
4. Open the extension from the extensions menu. Check its site permissions and allow access to GitHub. In the extension's Settings, grant other configured site origins individually; saving a profile alone does not grant access.
5. Reload a GitHub PR page, open a supported review comment editor, and select a label. Use the popup to edit labels, emoji, colors, and theme, or open Settings for site profiles and CSS.

After source changes, run `npm run package:firefox` again, click **Reload** for Conventional Comments on the debugging page, then refresh the GitHub tab. Use **Remove** on the debugging page to remove the temporary installation.

Firefox removes temporary extensions when the browser restarts. Load the manifest again and check site access as needed. Settings recovery after removal or reinstallation is not guaranteed. The stable add-on ID identifies this local package; it does not make the installation permanent. Settings are independent of Chrome and Safari, and migration or cross-browser synchronization is not provided.

This method requires neither signing nor publication on Mozilla Add-ons. It does not produce a signed XPI for permanent installation. Firefox Android and older Firefox versions have not been verified.

See Mozilla's [temporary installation instructions](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).
