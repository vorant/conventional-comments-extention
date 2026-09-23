const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const P=require('../src/site-profiles');
const source=fs.readFileSync(`${__dirname}/../src/background.js`,'utf8');
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
function setup(initial={}, registrations=[]){
  let store=initial,registered=registrations,listeners=[],failRegister=false;const granted=new Set(['https://github.com/*']);const calls=[],events={};
  const event=(key)=>({addListener(fn){events[key]=fn;}});
  const tabs=[{id:1,url:'https://github.com/a/b/pull/1'},{id:2,url:'https://gitlab.com/a/b/-/merge_requests/1'}];const injected=new Set([1]);
  const chrome={runtime:{onMessage:{addListener(fn){listeners.push(fn);}},onInstalled:event('installed'),onStartup:event('startup'),getURL:(p)=>'chrome-extension://test/'+p},
    storage:{local:{async get(){return store;},async set(value){store={...store,...value};}},onChanged:event('storage')},
    permissions:{async contains({origins}){return origins.every(o=>granted.has(o));},onAdded:event('added'),onRemoved:event('removed')},
    scripting:{async getRegisteredContentScripts(){return registered;},async registerContentScripts(items){if(failRegister)throw new Error('registration failed');registered.push(...items);calls.push(['register',items]);},async unregisterContentScripts(){registered=[];},async insertCSS(o){calls.push(['css',o]);},async executeScript(o){injected.add(o.target.tabId);calls.push(['inject',o]);}},
    tabs:{async query(q){return q.active?[tabs[0]]:tabs;},async get(id){return tabs.find(t=>t.id===id);},async create(o){calls.push(['open',o]);},async sendMessage(id,m){calls.push(['message',id,m]);if(!injected.has(id))throw new Error('no receiver');return m.type==='cc-inspect'?{status:'ok',count:1,valid:1}:{ok:true};}}
  };
  vm.runInNewContext(source,{CCProfiles:P,importScripts(){},chrome,URL,console:{error(){}}});
  const send=(m,sender={url:'chrome-extension://test/src/options.html'})=>new Promise(resolve=>listeners[0](m,sender,resolve));
  return {send,events,calls,granted,tabs,getStore:()=>store,getRegistered:()=>registered,failRegistration(){failRegister=true;}};
}
test('startup retains GitHub access and registers only granted optional sites',async()=>{
  const h=setup();await flush();assert.equal(h.getRegistered().length,0);
  h.granted.add('https://gitlab.com/*');h.events.added();await flush();
  assert.deepEqual(Array.from(h.getRegistered()[0].matches),['https://gitlab.com/*']);
  assert.equal(h.calls.filter(([t])=>t==='inject').length,1);
  h.events.startup();await flush();assert.equal(h.calls.filter(([t])=>t==='inject').length,1);
  assert.deepEqual(Array.from((await h.send({type:'cc-config'})).profiles,p=>p.id),['github','gitlab']);
});
test('revocation unregisters site and tells already injected tab to stop',async()=>{
  const h=setup();await flush();h.granted.add('https://gitlab.com/*');h.events.added();await flush();
  h.granted.delete('https://gitlab.com/*');h.events.removed();await flush();
  assert.equal(h.getRegistered().length,0);
  assert.ok(h.calls.some(([t,id,m])=>t==='message'&&id===2&&m.type==='cc-stop'));
});
test('save changes address, ignores hidden fields and reset restores defaults',async()=>{
  const h=setup({ccLabels:['note'],ccTheme:'dark'});await flush();
  assert.equal((await h.send({type:'cc-save',profile:{...P.all()[0],origin:'https://other.example',enabled:false}})).ok,true);
  assert.equal(h.getStore()[P.KEY].overrides.github.enabled,undefined);
  assert.equal((await h.send({type:'cc-config'})).profiles.length,0);
  assert.ok(h.calls.some(([t,id,m])=>t==='message'&&id===1&&m.type==='cc-stop'));
  assert.equal((await h.send({type:'cc-remove',id:'github'})).ok,true);
  assert.equal((await h.send({type:'cc-config'})).profiles[0].id,'github');
  assert.deepEqual(h.getStore().ccLabels,['note']);assert.equal(h.getStore().ccTheme,'dark');
});
test('old custom registration is cleaned up without deleting data or revoking permission',async()=>{
  const config={schemaVersion:1,overrides:{},custom:[{...P.defaults[0],id:'old',origin:'https://old.example'}]};
  const h=setup({[P.KEY]:config},[{id:'cc-sites',matches:['https://old.example/*']}]);
  h.tabs.push({id:3,url:'https://old.example/review'});h.granted.add('https://old.example/*');await flush();
  assert.equal(h.getRegistered().length,0);assert.deepEqual(h.getStore()[P.KEY],config);
  assert.ok(h.calls.some(([t,id,m])=>t==='message'&&id===3&&m.type==='cc-stop'));
  assert.ok(h.granted.has('https://old.example/*'));
  for(const message of [{type:'cc-save',profile:{...P.defaults[0],id:'custom'}},{type:'cc-remove',id:'custom'},{type:'cc-check',id:'github'}]) assert.equal((await h.send(message)).ok,false);
});
test('unknown schema is never overwritten',async()=>{
  const initial={[P.KEY]:{schemaVersion:99},ccTheme:'dark'},h=setup(initial);await flush();
  assert.equal((await h.send({type:'cc-save',profile:P.defaults[0]})).ok,false);
  assert.deepEqual(h.getStore(),initial);
});
test('page content cannot save profiles and settings links open options with validated profile',async()=>{
  const h=setup();await flush();const sender={tab:{id:1,url:h.tabs[0].url},url:h.tabs[0].url};
  assert.equal((await h.send({type:'cc-save',profile:P.all()[0]},sender)).ok,false);
  await h.send({type:'cc-open-settings',id:'github'},sender);
  assert.ok(h.calls.find(([t])=>t==='open')[1].url.endsWith('src/options.html?profile=github'));
  const count=h.calls.filter(([t])=>t==='open').length;
  assert.equal((await h.send({type:'cc-open-settings',id:'unknown'})).ok,false);
  assert.equal(h.calls.filter(([t])=>t==='open').length,count);
});
test('registration failure is reported rather than claiming connection',async()=>{
  const h=setup();await flush();h.granted.add('https://gitlab.com/*');h.failRegistration();
  const response=await h.send({type:'cc-save',profile:P.all()[1]});assert.equal(response.ok,false);assert.match(response.error,/registration/);
});
