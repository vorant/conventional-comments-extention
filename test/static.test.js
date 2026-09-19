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
  assert.deepEqual(manifest.permissions, ["storage", "scripting", "activeTab"]);
  assert.deepEqual(manifest.optional_host_permissions, ["https://*/*", "http://*/*"]);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.deepEqual(manifest.icons, expectedIcons);
  assert.deepEqual(manifest.action, {
    default_popup: "src/popup.html",
    default_icon: expectedIcons
  });
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://github.com/*"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["src/site-profiles.js", "src/editor-adapters.js", "src/panel-engine.js", "src/content-script.js"]);
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

test("popup and content script expose the same default Conventional Comments labels", () => {
  const contentScript = readText("src/content-script.js");
  const popupScript = readText("src/popup.js");
  const expectedLabels = [
    "praise",
    "nitpick",
    "suggestion",
    "issue",
    "todo",
    "question",
    "thought",
    "chore",
    "note"
  ];

  assert.deepEqual(extractDefaultLabels(contentScript), expectedLabels);
  assert.deepEqual(extractDefaultLabels(popupScript), expectedLabels);
});

test("popup static assets are wired without external dependencies", () => {
  const popupHtml = readText("src/popup.html");
  const popupCss = readText("src/popup.css");
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

test("README documents site profiles in Russian", () => {
  const readme = readText("README.md");

  assert.match(readme, /GitHub Pull Requests/);
  assert.match(readme, /настройки labels/);
  assert.match(readme, /перетаскив/);
  assert.match(readme, /иконк[а-я]+ расширения/);
  assert.match(readme, /светл[а-я]+ и темн[а-я]+ тем/);
  assert.match(readme, /иконку корзины/);
  assert.match(readme, /Проверить профиль/);
  assert.match(readme, /предварительн/);
  assert.match(readme, /Локальная установка/);
});
