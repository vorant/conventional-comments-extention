const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

test('Safari packaging preserves sources and licenses, excludes tooling, and rebuilds deterministically', () => {
  const root = path.resolve(__dirname, '..');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-safari-'));
  try {
    for (const entry of ['src', 'scripts', 'manifest.json', 'LICENSE']) {
      fs.cpSync(path.join(root, entry), path.join(temp, entry), { recursive: true });
    }
    const original = fs.readFileSync(path.join(temp, 'manifest.json'), 'utf8');
    fs.writeFileSync(path.join(temp, 'src', '.DS_Store'), 'excluded');
    const build = () => execFileSync(process.execPath, [path.join(temp, 'scripts/package-safari.js')]);
    build();
    const output = path.join(temp, 'dist/safari');
    const snapshot = (dir) => Object.fromEntries(fs.readdirSync(dir, { recursive: true })
      .filter((file) => fs.statSync(path.join(dir, file)).isFile())
      .sort().map((file) => [file, fs.readFileSync(path.join(dir, file)).toString('base64')]));
    const first = snapshot(output);
    const expected = JSON.parse(original);
    delete expected.minimum_chrome_version;
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'))), expected);
    const references = [
      ...Object.values(expected.icons),
      ...Object.values(expected.action.default_icon),
      expected.action.default_popup, expected.options_ui.page, expected.background.service_worker,
      ...expected.content_scripts.flatMap((entry) => [...entry.js, ...entry.css]),
    ];
    for (const file of references) assert.ok(fs.statSync(path.join(output, file)).isFile(), file);
    for (const [file, content] of Object.entries(snapshot(path.join(root, 'src')))) {
      if (!file.split(path.sep).some((part) => part.startsWith('.'))) {
        assert.equal(first[path.join('src', file)], content, file);
      }
    }
    assert.deepEqual(fs.readdirSync(output).sort(), ['LICENSE', 'manifest.json', 'src']);
    assert.equal(fs.existsSync(path.join(output, 'src/.DS_Store')), false);
    fs.writeFileSync(path.join(output, 'stale.txt'), 'stale');
    fs.writeFileSync(path.join(temp, 'dist/keep.txt'), 'keep');
    build();
    assert.deepEqual(snapshot(output), first);
    assert.equal(fs.readFileSync(path.join(temp, 'dist/keep.txt'), 'utf8'), 'keep');
    assert.equal(fs.readFileSync(path.join(temp, 'manifest.json'), 'utf8'), original);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
