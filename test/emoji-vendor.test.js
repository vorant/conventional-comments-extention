const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
test('pinned vendor modules, English data and licenses are complete and unchanged',()=>{
 const root=path.resolve('src/vendor'),checksums=require('../src/vendor/checksums.json');
 for(const [name,sha]of Object.entries(checksums))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex'),sha,name);
 for(const file of ['emoji-picker-element/picker.js','emoji-picker-element/database.js','emoji-picker-element/i18n/en.js']){
  const text=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of text.matchAll(/import\s+[^;]*?from\s+['"]([^'"]+)['"]/g)){
   assert.ok(match[1].startsWith('.'));assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),match[1])));
  }
  assert.doesNotMatch(text,/\beval\s*\(|new Function\s*\(/);
 }
 const data=require('../src/vendor/emoji-picker-element-data/en.json');
 assert.equal(data.find(x=>x.emoji==='💡').annotation,'light bulb');
 for(const name of ['emoji-picker-element','emoji-picker-element-data'])assert.match(fs.readFileSync(path.join(root,name,'LICENSE'),'utf8'),/Apache License/);
 const loader=fs.readFileSync('src/emoji-picker.js','utf8');assert.match(loader,/dataSource: extensionApi.runtime.getURL\("src\/vendor\/emoji-picker-element-data\/en.json"\)/);
 assert.match(loader,/locale: "en"/);
 assert.equal(require('../src/vendor/emoji-picker-element/package.json').version,'1.29.1');
 assert.equal(require('../src/vendor/emoji-picker-element-data/package.json').version,'1.8.0');
 assert.equal(fs.existsSync(path.join(root,'emoji-picker-element-data/ru.json')),false);
 assert.equal(fs.existsSync(path.join(root,'emoji-picker-element/i18n/ru_RU.js')),false);
 const manifest=require('../manifest.json');assert.equal(manifest.minimum_chrome_version,'102');assert.ok(manifest.content_scripts.every(s=>s.js.every(p=>!p.includes('vendor')&&!p.includes('emoji-picker.js'))));
});
