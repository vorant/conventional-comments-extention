const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist', 'safari');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
delete manifest.minimum_chrome_version;

// Never follow an output symlink into another directory.
const dist = path.dirname(output);
if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) {
  throw new Error('dist must not be a symbolic link');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
fs.cpSync(path.join(root, 'src'), path.join(output, 'src'), {
  recursive: true,
  filter: (source) => !path.basename(source).startsWith('.'),
});
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(output, 'LICENSE'));
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Safari package prepared: ${output}`);
