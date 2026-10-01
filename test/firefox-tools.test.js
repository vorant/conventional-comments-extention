const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-firefox-tools-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of ['scripts', 'src', 'manifest.json', 'LICENSE']) {
    fs.cpSync(path.join(__dirname, '..', file), path.join(dir, file), { recursive: true });
  }
  const call = (action, env = {}) => spawnSync(process.execPath, ['scripts/firefox-tools.js', action], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, ...env },
  });
  const stub = () => {
    fs.mkdirSync(path.join(dir, 'node_modules/web-ext/bin'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules/web-ext/bin/web-ext.js'), `
      const fs = require('node:fs');
      const args = process.argv.slice(2);
      const manifest = JSON.parse(fs.readFileSync('dist/firefox/manifest.json'));
      if (!manifest.background.scripts || manifest.background.service_worker) process.exit(9);
      fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
      if (args[0] === 'lint' && process.env.FAIL_LINT) process.exit(7);
    `);
  };
  const calls = () => fs.readFileSync(path.join(dir, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  return { dir, call, stub, calls };
}

test('Firefox tooling fails clearly without local dependency and does not prepare output', (t) => {
  const h = fixture(t), result = h.call('zip');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm ci/);
  assert.equal(fs.existsSync(path.join(h.dir, 'dist')), false);
});

test('lint failure stops both archive and browser launch', (t) => {
  const h = fixture(t); h.stub();
  for (const action of ['zip', 'run']) {
    const result = h.call(action, { FAIL_LINT: '1' });
    assert.equal(result.status, 7);
    assert.doesNotMatch(result.stdout, /Archive created/);
  }
  assert.deepEqual(h.calls().map(a => a[0]), ['lint', 'lint']);
});

test('Firefox commands prepare fresh files and pass versioned output and spaced browser path as arguments', (t) => {
  const h = fixture(t); h.stub();
  const manifest = JSON.parse(fs.readFileSync(path.join(h.dir, 'manifest.json')));
  assert.equal(h.call('zip').status, 0);
  let calls = h.calls();
  assert.deepEqual(calls.map(a => a[0]), ['lint', 'build']);
  assert.ok(calls[1].includes(`conventional-comments-firefox-${manifest.version}.zip`));
  assert.ok(calls[1].includes('--overwrite-dest'));
  fs.writeFileSync(path.join(h.dir, 'dist/firefox/stale.txt'), 'stale');
  fs.writeFileSync(path.join(h.dir, 'src/fresh.txt'), 'fresh');
  const browser = path.join(h.dir, 'Firefox Test');
  fs.writeFileSync(browser, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  assert.equal(h.call('run', { FIREFOX_BIN: browser }).status, 0);
  calls = h.calls();
  assert.deepEqual(calls.slice(-2).map(a => a[0]), ['lint', 'run']);
  assert.equal(calls.at(-1).at(-1), browser);
  assert.equal(fs.existsSync(path.join(h.dir, 'dist/firefox/stale.txt')), false);
  assert.equal(fs.readFileSync(path.join(h.dir, 'dist/firefox/src/fresh.txt'), 'utf8'), 'fresh');
  assert.equal(calls.at(-1).includes('--firefox-profile'), false);
});

test('preparation failure prevents calling web-ext', (t) => {
  const h = fixture(t); h.stub();
  fs.writeFileSync(path.join(h.dir, 'manifest.json'), '{invalid');
  assert.notEqual(h.call('zip').status, 0);
  assert.equal(fs.existsSync(path.join(h.dir, 'calls.jsonl')), false);
});

test('invalid Firefox executable is diagnosed before starting any tool', (t) => {
  const h = fixture(t); h.stub();
  const result = h.call('run', { FIREFOX_BIN: path.join(h.dir, 'missing Firefox') });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FIREFOX_BIN is not an executable file/);
  assert.equal(fs.existsSync(path.join(h.dir, 'calls.jsonl')), false);
});

test('real web-ext ZIP replaces stale resources and keeps neighbouring packages intact', {
  skip: !fs.existsSync(path.join(__dirname, '../node_modules/web-ext/bin/web-ext.js')),
}, (t) => {
  const h = fixture(t);
  fs.symlinkSync(path.resolve(__dirname, '../node_modules'), path.join(h.dir, 'node_modules'), 'dir');
  fs.mkdirSync(path.join(h.dir, 'dist/safari'), { recursive: true });
  fs.writeFileSync(path.join(h.dir, 'dist/safari/keep.txt'), 'safari');
  fs.writeFileSync(path.join(h.dir, 'dist/chrome.zip'), 'chrome');
  fs.writeFileSync(path.join(h.dir, 'src/old.txt'), 'old');
  fs.writeFileSync(path.join(h.dir, 'src/current.txt'), 'before');
  const version = JSON.parse(fs.readFileSync(path.join(h.dir, 'manifest.json'))).version;
  const archive = path.join(h.dir, `dist/conventional-comments-firefox-${version}.zip`);
  for (const pass of [0, 1]) {
    if (pass) {
      fs.unlinkSync(path.join(h.dir, 'src/old.txt'));
      fs.writeFileSync(path.join(h.dir, 'src/current.txt'), 'after');
    }
    const result = h.call('zip');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const unzip = (...args) => {
      const result = spawnSync('unzip', args, { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    const entries = unzip('-Z1', archive).trim().split('\n');
    assert.ok(entries.includes('manifest.json'));
    assert.ok(entries.includes('LICENSE'));
    assert.ok(entries.every(e => e === 'manifest.json' || e === 'LICENSE' || e.startsWith('src/')));
    const manifest = JSON.parse(unzip('-p', archive, 'manifest.json'));
    assert.ok(manifest.background.scripts);
    assert.equal(manifest.background.service_worker, undefined);
    assert.equal(unzip('-p', archive, 'src/current.txt'), pass ? 'after' : 'before');
    assert.equal(entries.includes('src/old.txt'), !pass);
    assert.equal(fs.readFileSync(path.join(h.dir, 'dist/safari/keep.txt'), 'utf8'), 'safari');
    assert.equal(fs.readFileSync(path.join(h.dir, 'dist/chrome.zip'), 'utf8'), 'chrome');
  }
});
