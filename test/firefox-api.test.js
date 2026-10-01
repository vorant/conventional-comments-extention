const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

for (const file of ['background.test.js', 'label-worker.test.js', 'content-script-behavior.test.js', 'popup-behavior.test.js', 'profile-settings.test.js']) {
  const filename = path.join(__dirname, file);
  const localRequire = createRequire(filename);
  const firefoxVm = { ...vm, runInNewContext(source, context, ...args) {
    if (context.chrome) {
      context.browser = context.chrome;
      delete context.chrome;
      delete context.importScripts;
    }
    return vm.runInNewContext(source, context, ...args);
  } };
  const namedTest = (name, ...args) => test(`Firefox API: ${name}`, ...args);
  const requireForFirefox = (name) => name === 'node:vm' ? firefoxVm : name === 'node:test' ? namedTest : localRequire(name);
  const run = vm.runInThisContext(
    `(function(require, __dirname, __filename) {${fs.readFileSync(filename, 'utf8')}\n})`,
    { filename },
  );
  run(requireForFirefox, __dirname, filename);
}
