const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function extractDefaultLabels(script) {
  const match = script.match(/const DEFAULT_LABELS = \[([\s\S]*?)\];/);
  assert.ok(match);
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (labelMatch) => labelMatch[1]);
}

test("manifest declares GitHub Pull Request content script and popup settings", () => {
  const manifest = JSON.parse(readText("manifest.json"));
  const expectedIcons = {
    "16": "src/icons/icon-16.png",
    "32": "src/icons/icon-32.png",
    "48": "src/icons/icon-48.png",
    "128": "src/icons/icon-128.png"
  };

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.options_ui, { page: "src/options.html", open_in_tab: true });
  assert.ok(fs.existsSync(path.join(rootDir, manifest.options_ui.page)));
  assert.deepEqual(manifest.permissions, ["storage", "scripting", "activeTab"]);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.deepEqual(manifest.icons, expectedIcons);
  assert.deepEqual(manifest.action, {
    default_popup: "src/popup.html",
    default_icon: expectedIcons
  });
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://github.com/*"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["src/panel-styles.js", "src/label-settings.js", "src/site-profiles.js", "src/editor-adapters.js", "src/panel-engine.js", "src/content-script.js"]);
  assert.deepEqual(manifest.content_scripts[0].css, ["src/content-style.css"]);

  for (const iconPath of Object.values(expectedIcons)) {
    assert.ok(fs.existsSync(path.join(rootDir, iconPath)));
    assert.doesNotMatch(iconPath, /https?:\/\//);
  }
});

test("content script is bundled in dependency order with site profiles", () => {
  const manifest = JSON.parse(readText("manifest.json"));
  for (const file of manifest.content_scripts[0].js) assert.ok(fs.existsSync(path.join(rootDir,file)));
  assert.equal(manifest.content_scripts[0].js.at(-1), "src/content-script.js");
});

test("popup and content script use one shared label model", () => {
  for (const file of ["src/popup.js", "src/content-script.js"]) assert.match(readText(file), /globalThis.CCLabels/);
  const html = readText("src/popup.html");
  assert.ok(html.indexOf('src="label-settings.js"') < html.indexOf('src="popup.js"'));
  assert.ok(JSON.parse(readText("manifest.json")).content_scripts[0].js.indexOf("src/label-settings.js") <
    JSON.parse(readText("manifest.json")).content_scripts[0].js.indexOf("src/content-script.js"));
});

test("popup static assets are wired without external dependencies", () => {
  const popupHtml = readText("src/popup.html");
  const popupCss = readText("src/shared.css") + readText("src/popup.css");
  const fontPath = path.join(rootDir, "src/fonts/symbols-nerd-font.woff2");
  const fontLicensePath = path.join(rootDir, "src/fonts/NERD_FONTS_LICENSE");

  assert.match(popupHtml, /<link rel="stylesheet" href="popup\.css">/);
  assert.match(popupHtml, /<script src="popup\.js"><\/script>/);
  assert.match(popupHtml, /id="theme-toggle"/);
  assert.doesNotMatch(popupHtml, /(?:src|href)="https?:\/\//);
  assert.match(popupCss, /@font-face/);
  assert.match(popupCss, /fonts\/symbols-nerd-font\.woff2/);
  assert.match(popupCss, /body\[data-theme="dark"\]/);
  assert.match(popupCss, /input:focus/);
  assert.match(popupCss, /button:hover,\nbutton:focus/);
  assert.match(popupCss, /delete-button/);
  assert.match(popupCss, /drag-handle/);
  assert.match(popupCss, /drag-handle-icon-light/);
  assert.match(popupCss, /drag-handle-icon-dark/);
  assert.match(popupCss, /@keyframes cc-row-shift/);
  assert.doesNotMatch(popupCss, /https?:\/\//);
  assert.ok(fs.existsSync(fontPath));
  assert.ok(fs.existsSync(fontLicensePath));
});

test("user documentation includes usage guidance and bundled screenshots", () => {
  const readme = readText("README.md");
  const listing = readText("docs/chrome-web-store-description.txt");
  for (const text of [readme, listing]) {
    assert.doesNotMatch(text, /[А-Яа-яЁё]/);
    assert.match(text, /https:\/\/conventionalcomments\.org\//);
    assert.match(text, /Allow site access/);
    assert.match(text, /preview support/);
  }
  const images = [...readme.matchAll(/!\[([^\]]+)\]\(([^)]+)\)/g)];
  assert.ok(images.length >= 3);
  for (const [, alt, file] of images) {
    assert.ok(alt.trim());
    const bytes = fs.readFileSync(path.join(rootDir, file));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", file);
  }
});

test("options owns the profile form and both pages load shared theme assets", () => {
  const popup = readText("src/popup.html");
  const options = readText("src/options.html");
  assert.doesNotMatch(popup, /profile-form|site-settings|profile-settings.js|site-profiles.js/);
  assert.ok(popup.indexOf('id="theme-toggle"') < popup.indexOf('id="open-settings"'));
  assert.match(popup, /id="open-settings"[^>]*aria-label="Settings"[^>]*title="Settings"/);
  assert.match(options, /id="profile-form"/);
  assert.doesNotMatch(options, /<details|theme-toggle|label-form/);
  for (const html of [popup, options]) {
    assert.match(html, /href="shared.css"/);
    assert.match(html, /src="theme.js"/);
    for (const [, asset] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      assert.ok(fs.existsSync(path.join(rootDir, "src", asset)), asset);
    }
  }
});

test('extension pages and metadata use English without changing host access', () => {
  const manifest = JSON.parse(readText('manifest.json'));
  assert.equal(manifest.name, 'Conventional Comments');
  assert.match(manifest.description, /^Add Conventional Comments labels to code reviews/);
  assert.equal(manifest.minimum_chrome_version, '102');
  assert.deepEqual(manifest.host_permissions, ['https://github.com/*']);
  for (const file of ['src/popup.html', 'src/options.html']) {
    const html = readText(file);
    assert.match(html, /<html lang="en">/);
    assert.doesNotMatch(html, /[А-Яа-яЁё]/);
  }
  assert.match(readText('src/options.html'), /<title>Settings — Conventional Comments<\/title>/);
  // Audit quoted own UI strings, allowing Unicode user data and source comments.
  for (const name of ['popup', 'profile-settings', 'theme', 'content-script', 'panel-engine', 'editor-adapters', 'background', 'label-settings', 'site-profiles']) {
    const source = readText(`src/${name}.js`);
    for (const match of source.matchAll(/(["'`])(?:\\.|(?!\1)[^\\])*?\1/g)) {
      assert.doesNotMatch(match[0], /[А-Яа-яЁё]/, `${name}: ${match[0]}`);
    }
  }
});
