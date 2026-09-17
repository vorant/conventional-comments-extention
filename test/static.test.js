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

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.deepEqual(manifest.action, { default_popup: "src/popup.html" });
  assert.deepEqual(manifest.content_scripts[0].matches, ["https://github.com/*/*/pull/*"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["src/content-script.js"]);
  assert.deepEqual(manifest.content_scripts[0].css, ["src/content-style.css"]);
});

test("content script keeps MVP limited to github.com pull requests", () => {
  const script = readText("src/content-script.js");

  assert.match(script, /window\.location\.hostname === "github\.com"/);
  assert.match(script, /pull\\\/\\d\+/);
  assert.doesNotMatch(script, /gitlab|bitbucket/i);
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
  assert.doesNotMatch(popupHtml, /https?:\/\//);
  assert.match(popupCss, /@font-face/);
  assert.match(popupCss, /fonts\/symbols-nerd-font\.woff2/);
  assert.match(popupCss, /body\[data-theme="dark"\]/);
  assert.match(popupCss, /input:focus/);
  assert.match(popupCss, /button:hover,\nbutton:focus/);
  assert.match(popupCss, /delete-button/);
  assert.doesNotMatch(popupCss, /https?:\/\//);
  assert.ok(fs.existsSync(fontPath));
  assert.ok(fs.existsSync(fontLicensePath));
});

test("README documents GitHub-only scope in Russian", () => {
  const readme = readText("README.md");

  assert.match(readme, /GitHub Pull Requests/);
  assert.match(readme, /настройки labels/);
  assert.match(readme, /светл[а-я]+ и темн[а-я]+ тем/);
  assert.match(readme, /иконку корзины/);
  assert.match(readme, /В MVP не входят GitLab, Bitbucket/);
  assert.match(readme, /Локальная установка/);
});
