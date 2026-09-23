const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {Document,parse}=require('./helpers/dom');const P=require('../src/site-profiles');
const html=fs.readFileSync(`${__dirname}/../src/options.html`,'utf8');const js=fs.readFileSync(`${__dirname}/../src/profile-settings.js`,'utf8');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function setup({delayed=false,search='',initialConfig,theme}={}){
  const doc=parse(new Document(),html);let config=initialConfig,permission=false;let themeListener;const calls=[],pending=[];
  const chrome={storage:{onChanged:{addListener(fn){themeListener=fn;}},sync:{get(key,cb){cb({ccTheme:theme});}},local:{async get(){return {[P.KEY]:config};}}},permissions:{async contains(){return permission;},request(o){calls.push(['request',o]);return Promise.resolve(permission);}},
    runtime:{sendMessage(m){calls.push(['message',m]);return new Promise(resolve=>{const complete=(ok=true)=>{if(ok){if(m.type==='cc-save')config=P.save(config,m.profile);if(m.type==='cc-remove')config=P.remove(config,m.id);if(m.type==='cc-save-css'||m.type==='cc-reset-css')config=P.saveCss(config,m.id,m.css,m.type==='cc-reset-css');}resolve({ok,error:'Ошибка записи'});};if(delayed)pending.push(complete);else complete();});}}};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../src/theme.js`,'utf8'),{document:doc,chrome});
  vm.runInNewContext(js,{document:doc,CCProfiles:P,chrome,URLSearchParams,location:{search}});
  const el=(id)=>doc.getElementById(id);
  const edit=(field,value,event='input')=>{el('profile-'+field).value=value;el('profile-'+field).dispatchEvent({type:event});};
  return {doc,el,edit,calls,pending,changeTheme:(value,area="sync")=>themeListener({ccTheme:{newValue:value}},area),getConfig:()=>config,setPermission(v){permission=v;}};
}
test('form has only built-in profiles, editable fields and two placements',async()=>{
  const h=setup();await flush();assert.deepEqual(h.el('profile-list').children.map(x=>x.textContent),['GitHub','GitLab','Bitbucket']);
  for(const id of ['name','enabled','new','delete','template','containerSelector','anchorSelector','editorAdapter','anchorMode','check'])assert.equal(h.el('profile-'+id),null);
  assert.deepEqual(h.el('profile-placement').children.map(x=>x.value),['before','after']);
  assert.equal(h.el('profile-form').querySelector('button[type="submit"]'),null);
});
test('each editable field autosaves, duplicate change events do not save twice',async()=>{
  const h=setup();await flush();
  for(const [field,value] of [['origin','https://review.example'],['paths','/review/*\n/pull/*'],['editorSelector','textarea.review'],['placement','after']]){
    h.edit(field,value);h.edit(field,value,'change');await flush();
    assert.deepEqual(h.getConfig().overrides.github[field],field==='paths'?value.split('\n'):value);
  }
  assert.equal(h.calls.filter(([,m])=>m.type==='cc-save').length,4);assert.equal(h.el('profile-status').textContent,'Сохранено');
});
test('invalid fields remain visible and do not replace last saved configuration',async()=>{
  const h=setup();await flush();h.edit('placement','after');await flush();const before=JSON.stringify(h.getConfig());
  for(const [field,value] of [['editorSelector','['],['origin','bad']]){h.edit(field,value);await flush();assert.equal(h.el('profile-'+field).value,value);assert.equal(h.el('profile-status').getAttribute('data-error'),'true');assert.equal(JSON.stringify(h.getConfig()),before);}
});
test('rapid edits and switching retain per-profile drafts and ignore old responses',async()=>{
  const h=setup({delayed:true});await flush();h.edit('origin','https://first.example');h.edit('origin','https://last.example');
  h.edit('list','gitlab','change');h.edit('placement','after');
  h.pending.shift()();await flush();assert.equal(h.el('profile-origin').value,'https://gitlab.com');
  h.pending.shift()();await flush();assert.equal(h.el('profile-status').textContent,'Сохранение…');
  h.pending.shift()();await flush();h.edit('list','github','change');
  assert.equal(h.el('profile-origin').value,'https://last.example');assert.equal(h.getConfig().overrides.github.origin,'https://last.example');assert.equal(h.getConfig().overrides.gitlab.placement,'after');
});
test('responses do not render the field again, invalid newer draft masks old success',async()=>{
  const h=setup({delayed:true});await flush();h.edit('origin','https://saved.example');
  const input=h.el('profile-origin');let writes=0,value=input.value;
  Object.defineProperty(input,'value',{get:()=>value,set(v){writes++;value=v;},configurable:true});
  h.pending.shift()();await flush();assert.equal(writes,0);
  h.edit('origin','https://next.example');h.edit('origin','bad');h.pending.shift()();await flush();
  assert.equal(input.value,'bad');assert.equal(h.el('profile-status').getAttribute('data-error'),'true');
});
test('reset while saving supersedes old responses and later edits follow reset',async()=>{
  const h=setup({delayed:true});await flush();h.edit('origin','https://old.example');h.el('profile-reset').click();
  assert.equal(h.el('profile-origin').value,'https://github.com');h.pending.shift()();await flush();assert.equal(h.el('profile-status').textContent,'Сохранение…');
  h.pending.shift()();await flush();assert.equal(P.all(h.getConfig())[0].origin,'https://github.com');
  h.el('profile-reset').click();h.edit('placement','after');h.pending.shift()();await flush();h.pending.shift()();await flush();assert.equal(P.all(h.getConfig())[0].placement,'after');
});
test('write failure can retry the same snapshot through another field event',async()=>{
  const h=setup({delayed:true});await flush();h.edit('placement','after');h.pending.shift()(false);await flush();
  assert.match(h.el('profile-status').textContent,/Ошибка записи/);assert.equal(h.el('profile-connect').disabled,true);
  h.edit('placement','after','change');h.pending.shift()();await flush();assert.equal(h.el('profile-status').textContent,'Сохранено');
});
test('access requires current confirmed snapshot and is requested synchronously only on click',async()=>{
  const h=setup({delayed:true});await flush();h.edit('origin','https://other.example');h.el('profile-connect').click();assert.equal(h.calls.filter(([t])=>t==='request').length,0);
  h.pending.shift()();await flush();assert.equal(h.el('profile-connect').disabled,false);
  h.el('profile-connect').click();assert.deepEqual(Array.from(h.calls.find(([t])=>t==='request')[1].origins),['https://other.example/*']);await flush();
  assert.match(h.el('profile-status').textContent,/не предоставлен/);assert.equal(h.getConfig().overrides.github.origin,'https://other.example');
  h.setPermission(true);h.el('profile-connect').click();await flush();h.pending.shift()();await flush();assert.match(h.el('profile-access').textContent,/разрешён/);
});

for (const [search, expected] of [['?profile=gitlab','gitlab'],['?profile=bitbucket','bitbucket'],['','github'],['?profile=unknown','github']]) {
  test('options selects profile for '+search, async()=>{
    const h=setup({search});await flush();assert.equal(h.el('profile-list').value,expected);
    assert.equal(h.doc.querySelector('details'),null);
  });
}
test('saved values survive reopening options',async()=>{
  const h=setup();await flush();h.edit('origin','https://saved.example');await flush();
  const reopened=setup({initialConfig:h.getConfig()});await flush();
  assert.equal(reopened.el('profile-origin').value,'https://saved.example');
});
test('options shares default and saved theme, live changes preserve invalid draft',async()=>{
  const h=setup();await flush();assert.equal(h.doc.body.getAttribute('data-theme'),'light');
  const dark=setup({theme:'dark'});await flush();assert.equal(dark.doc.body.getAttribute('data-theme'),'dark');
  dark.edit('origin','invalid draft');const status=dark.el('profile-status').textContent;
  dark.changeTheme('light','local');assert.equal(dark.doc.body.getAttribute('data-theme'),'dark');
  dark.changeTheme('light');assert.equal(dark.doc.body.getAttribute('data-theme'),'light');
  assert.equal(dark.el('profile-origin').value,'invalid draft');assert.equal(dark.el('profile-status').textContent,status);
  assert.equal(dark.calls.length,0);
});

test('CSS editor shows actual defaults and accessible controls',async()=>{
  const h=setup();await flush();
  assert.equal(h.el('profile-panelCss').value,P.standardCss);
  assert.equal(h.el('profile-panelCss').getAttribute('spellcheck'),'false');
  assert.equal(h.doc.querySelector('label[for="profile-panelCss"]').textContent,'CSS панели и кнопок');
  assert.equal(h.el('profile-css-reset').textContent,'Восстановить');
  assert.equal(h.el('profile-reset').textContent,'Восстановить профиль');
});
test('CSS autosaves exact incomplete and empty text independently and survives reopening',async()=>{
  const h=setup();await flush();
  for(const css of ['  /* draft */\n.cc-label-button { color:', '']){
    h.edit('panelCss',css);h.edit('panelCss',css,'change');await flush();
    assert.equal(h.getConfig().overrides.github.panelCss,css);
    const reopened=setup({initialConfig:h.getConfig()});await flush();
    assert.equal(reopened.el('profile-panelCss').value,css);
  }
  assert.equal(h.calls.filter(([,m])=>m.type==='cc-save-css').length,2);
  h.edit('list','gitlab','change');assert.equal(h.el('profile-panelCss').value,P.standardCss);
  h.edit('panelCss','gitlab');await flush();h.edit('list','github','change');
  assert.equal(h.el('profile-panelCss').value,'');
});
test('rapid CSS edits and switching keep drafts, status and original text',async()=>{
  const h=setup({delayed:true});await flush();
  h.edit('panelCss','first');h.edit('panelCss','  second\n');
  h.edit('list','gitlab','change');h.edit('panelCss','lab');
  h.pending.shift()();h.pending.shift()();await flush();
  assert.equal(h.el('profile-panelCss').value,'lab');
  assert.equal(h.el('profile-css-status').textContent,'Сохранение…');
  h.pending.shift()();await flush();h.edit('list','github','change');
  assert.equal(h.el('profile-panelCss').value,'  second\n');
  assert.equal(h.el('profile-css-status').textContent,'Сохранено');
});
test('CSS reset works with invalid address and preserves other pending drafts',async()=>{
  const h=setup({delayed:true});await flush();
  h.edit('placement','after');h.edit('origin','bad address');h.edit('panelCss','old');
  h.el('profile-css-reset').click();
  assert.equal(h.el('profile-origin').value,'bad address');
  assert.equal(h.el('profile-panelCss').value,P.standardCss);
  h.pending.shift()();h.pending.shift()();await flush();
  assert.equal(h.el('profile-css-status').textContent,'Сохранение…');
  h.pending.shift()();await flush();
  assert.equal(P.all(h.getConfig())[0].placement,'after');
  assert.equal(P.all(h.getConfig())[0].panelCss,P.standardCss);
  assert.equal(h.el('profile-status').getAttribute('data-error'),'true');
  assert.equal(h.el('profile-origin').value,'bad address');
});
test('full reset supersedes both groups and newer edits supersede reset responses',async()=>{
  const h=setup({delayed:true});await flush();
  h.edit('placement','after');h.edit('panelCss','old');h.el('profile-reset').click();
  h.pending.shift()();h.pending.shift()();await flush();
  assert.equal(h.el('profile-css-status').textContent,'Сохранение…');
  assert.equal(h.el('profile-panelCss').value,P.standardCss);
  h.edit('panelCss','new');h.edit('placement','after');
  h.pending.shift()();await flush();
  assert.equal(h.el('profile-panelCss').value,'new');
  assert.equal(h.el('profile-css-status').textContent,'Сохранение…');
  h.pending.shift()();h.pending.shift()();await flush();
  assert.equal(P.all(h.getConfig())[0].panelCss,'new');
  assert.equal(P.all(h.getConfig())[0].placement,'after');
});
test('CSS reset and newer CSS ignore even out-of-order old acknowledgements',async()=>{
  const h=setup({delayed:true});await flush();
  h.edit('panelCss','old');h.el('profile-css-reset').click();h.edit('panelCss','new');
  const [old,reset,newer]=h.pending;
  newer();await flush();reset(false);old(false);await flush();
  assert.equal(h.el('profile-panelCss').value,'new');
  assert.equal(h.el('profile-css-status').textContent,'Сохранено');
});
test('CSS and full reset errors retain drafts, expose errors and allow retry',async()=>{
  const h=setup({delayed:true});await flush();
  h.edit('panelCss','broken {');h.pending.shift()(false);await flush();
  assert.equal(h.el('profile-panelCss').value,'broken {');
  assert.equal(h.el('profile-css-status').getAttribute('data-error'),'true');
  h.edit('panelCss','broken {','change');h.pending.shift()();await flush();
  assert.equal(h.el('profile-css-status').textContent,'Сохранено');
  h.el('profile-reset').click();h.pending.shift()(false);await flush();
  assert.equal(h.el('profile-status').getAttribute('data-error'),'true');
  assert.equal(h.el('profile-css-status').getAttribute('data-error'),'true');
  h.el('profile-css-reset').click();h.pending.shift()();await flush();
  assert.equal(P.all(h.getConfig())[0].panelCss,P.standardCss);
});
