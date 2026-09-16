const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

test("manifest declares a minimal GitHub Pull Request content script", () => {
  const manifest = JSON.parse(readText("manifest.json"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.permissions, undefined);
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

test("content script exposes the MVP Conventional Comments labels", () => {
  const script = readText("src/content-script.js");
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

  for (const label of expectedLabels) {
    assert.match(script, new RegExp(`"${label}"`));
  }
});

test("README documents GitHub-only scope in Russian", () => {
  const readme = readText("README.md");

  assert.match(readme, /GitHub Pull Requests/);
  assert.match(readme, /В MVP не входят GitLab, Bitbucket/);
  assert.match(readme, /Локальная установка/);
});
