const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const {Document,parse}=require('./helpers/dom');const P=require('../src/site-profiles');
const html=fs.readFileSync(`${__dirname}/../src/popup.html`,'utf8');const js=fs.readFileSync(`${__dirname}/../src/profile-settings.js`,'utf8');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function setup(){
  const doc=parse(new Document(),html);let config,permission=false,check='ok';const calls=[];
  const chrome={storage:{local:{async get(){return {[P.KEY]:config};}}},permissions:{async contains(){return permission;},request(o){calls.push(['request',o]);return Promise.resolve(permission);}},
    runtime:{async sendMessage(m){calls.push(['message',m]);if(m.type==='cc-save')config=P.save(config,m.profile);if(m.type==='cc-remove')config=P.remove(config,m.id);return {ok:true,status:check,count:2,valid:2};}}};
  vm.runInNewContext(js,{document:doc,CCProfiles:P,chrome,URLSearchParams,location:{search:''},crypto:{randomUUID:()=> 'new-profile'}});
  const el=(id)=>doc.getElementById(id);const submit=()=>el('profile-form').dispatchEvent({type:'submit',preventDefault(){}});
  return {doc,el,submit,calls,getConfig:()=>config,setPermission(v){permission=v;},setCheck(v){check=v;}};
}
test('settings render built-ins and save positioning without touching label storage',async()=>{
  const h=setup();await flush();assert.equal(h.el('profile-list').children.length,3);
  h.el('profile-placement').value='after';h.submit();await flush();
  assert.equal(h.getConfig().overrides.github.placement,'after');assert.match(h.el('profile-status').textContent,/сохранён/);
});
test('invalid selector shows a field error and sends no save',async()=>{
  const h=setup();await flush();h.el('profile-editorSelector').value='[';h.submit();await flush();
  assert.equal(h.getConfig(),undefined);assert.match(h.el('profile-status').textContent,/editorSelector/);
});
test('manual profile is created, connected, checked and deleted through visible controls',async()=>{
  const h=setup();await flush();h.el('profile-template').value='manual';h.el('profile-new').click();
  h.el('profile-origin').value='https://review.example';h.submit();await flush();assert.equal(h.getConfig().custom.length,1);
  h.el('profile-connect').click();await flush();assert.match(h.el('profile-status').textContent,/не предоставлен/);
  h.setPermission(true);h.el('profile-connect').click();await flush();assert.match(h.el('profile-status').textContent,/разрешён/);
  h.el('profile-check').click();await flush();assert.match(h.el('profile-status').textContent,/редакторов 2/);
  h.setCheck('no-editor');h.el('profile-check').click();await flush();assert.match(h.el('profile-status').textContent,/Откройте поле/);
  h.el('profile-delete').click();await flush();assert.equal(h.getConfig().custom.length,0);
});
test('unsaved edits cannot request permissions for the wrong address; reset preserves other profiles',async()=>{
  const h=setup();await flush();h.el('profile-origin').value='https://other.example';h.el('profile-connect').click();await flush();
  assert.equal(h.calls.filter(([t])=>t==='request').length,0);assert.match(h.el('profile-status').textContent,/Сначала сохраните/);
  h.submit();await flush();h.el('profile-reset').click();await flush();assert.equal(h.el('profile-origin').value,'https://github.com');
});
