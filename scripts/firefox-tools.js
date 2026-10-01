const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const action = process.argv[2];
if (!['lint', 'run', 'zip'].includes(action)) {
  console.error('Usage: node scripts/firefox-tools.js <lint|run|zip>');
  process.exit(1);
}
const cli = path.join(root, 'node_modules/web-ext/bin/web-ext.js');
if (!fs.existsSync(cli)) {
  console.error('Firefox tools are missing. Run npm ci to install the pinned web-ext.');
  process.exit(1);
}
if (action === 'run' && process.env.FIREFOX_BIN) {
  try {
    fs.accessSync(process.env.FIREFOX_BIN, fs.constants.X_OK);
    if (!fs.statSync(process.env.FIREFOX_BIN).isFile()) throw new Error('Not a file');
  } catch {
    console.error(`FIREFOX_BIN is not an executable file: ${process.env.FIREFOX_BIN}`);
    process.exit(1);
  }
}

function run(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd: root, stdio: 'inherit', env: { ...process.env, NO_UPDATE_NOTIFIER: '1' },
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}

run(path.join(__dirname, 'package-firefox.js'));
const common = ['--source-dir', path.join(root, 'dist/firefox'), '--no-config-discovery'];
run(cli, ['lint', ...common]);
if (action === 'zip') {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'dist/firefox/manifest.json'), 'utf8'));
  const filename = `conventional-comments-firefox-${version}.zip`;
  run(cli, ['build', ...common, '--artifacts-dir', path.join(root, 'dist'),
    '--filename', filename, '--overwrite-dest']);
  console.log(`Archive created: ${path.join(root, 'dist', filename)}`);
} else if (action === 'run') {
  const args = ['run', ...common];
  if (process.env.FIREFOX_BIN) args.push('--firefox', process.env.FIREFOX_BIN);
  run(cli, args);
}
