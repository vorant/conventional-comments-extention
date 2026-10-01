# Local Safari installation

The local package was reported working by the user on the inspected environment: macOS 26.7 (25G229), Safari 27.0. Older Safari versions have not been verified. GitLab and Bitbucket remain preview integrations.

1. From the project directory, run `npm run package:safari`.
2. Open Safari → Settings → Advanced and enable “Show features for web developers”.
3. Open the Developer tab and click “Add Temporary Extension…”. Approve the unsigned-extension prompt if shown.
4. Select the project's `dist/safari` folder, which contains `manifest.json`.
5. In Settings → Extensions, enable Conventional Comments and allow access to GitHub. Grant other site origins individually when needed; saving a site profile does not grant access.
6. Reload your GitHub PR page, open a review editor, and select a label. Open the toolbar popup to edit labels or access Settings.

To update, run `npm run package:safari` again, then reload the temporary extension in Safari's Extensions settings and refresh the page. Use the uninstall control there to remove it.

Safari removes temporary extensions when you quit Safari or after 24 hours. Add the folder again and grant access as needed. Settings recovery after removal or reinstallation is not guaranteed. Safari settings are local: there is no promised cloud sync or migration from Chrome. This installation method does not require Xcode, an App Store submission, or a paid developer account.

See [Apple's installation instructions](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension). Detailed lifecycle and permission failure checks remain unverified; user acceptance covers the reported working installation.
