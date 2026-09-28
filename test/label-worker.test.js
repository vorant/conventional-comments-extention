const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const L=require('../src/label-settings'),P=require('../src/site-profiles');
const flush=async()=>{for(let n=0;n<60;n++)await Promise.resolve();};
function setup(stored={}){
  let store=stored,now=0,timerId=0,listener,fail=false,hold=false;
  const timers=new Map(),writes=[],releases=[];
  const event={addListener(){}};
  const chrome={
    runtime:{getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener(fn){listener=fn;}},onInstalled:event,onStartup:event},
    permissions:{contains:async()=>false,onAdded:event,onRemoved:event},
    tabs:{query:async()=>[]},
    scripting:{getRegisteredContentScripts:async()=>[]},
    storage:{local:{get:async()=>({}),set:async()=>{}},onChanged:event,sync:{
      get:async()=>store,
      async set(value){
        writes.push(value);
        if(hold)await new Promise(r=>releases.push(r));
        if(fail)throw Error('QUOTA exceeded');
        store={...store,...value};
      }
    }}
  };
  vm.runInNewContext(fs.readFileSync('src/background.js','utf8'),{
    CCLabels:L,CCProfiles:P,chrome,importScripts(){},console,URL,
    Date:{now:()=>now},setTimeout(fn,ms){timers.set(++timerId,{fn,at:now+ms});return timerId;},clearTimeout(id){timers.delete(id);}
  });
  return {
    async tick(ms=2200){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();},
    send(items,sender={url:'chrome-extension://test/src/popup.html'}){
      return new Promise(resolve=>listener({type:'cc-save-labels',...(Array.isArray(items)?{items}:{settings:items})},sender,resolve));
    },
    command(message){return new Promise(resolve=>listener(message,{url:'chrome-extension://test/src/options.html'},resolve));},
    writes,releases,get:()=>store,hold(value){hold=value;},fail(value){fail=value;}
  };
}
const items=color=>[{text:'same',color}];
test('worker coalesces input, preserves last snapshot and projects strings for rollback',async()=>{
 const h=setup({ccTheme:'dark'}),a=h.send(items('#111111')),b=h.send(items('#222222')),c=h.send(items('#333333'));
 await h.tick(180);assert.equal(h.writes.length,1);assert.ok((await a).ok&&(await b).ok&&(await c).ok);
 assert.equal(h.get()[L.KEY].items[0].color,'#333333');assert.deepEqual(h.get().ccLabels,['same']);assert.equal(h.get().ccTheme,'dark');
});
test('new snapshot during write is serialized and rate-limited; no popup needed after send',async()=>{
 const h=setup();h.hold(true);
 const a=h.send(items('#111111'));await h.tick(180);
 const b=h.send(items('#222222')),c=h.send(items('#333333'));
 assert.equal(h.writes.length,1);h.releases.shift()();await flush();assert.ok((await a).ok);
 await h.tick(1000);assert.equal(h.writes.length,1);
 h.hold(false);await h.tick(1100);
 assert.ok((await b).ok&&(await c).ok);assert.equal(h.writes.length,2);assert.equal(h.get()[L.KEY].items[0].color,'#333333');
});
test('quota errors are returned, retry works and unknown schemas are not overwritten',async()=>{
 const h=setup();h.fail(true);const failed=h.send(items('#111111'));await h.tick();
 assert.match((await failed).error,/QUOTA/);assert.equal(h.get()[L.KEY],undefined);
 h.fail(false);const retry=h.send(items('#222222'));await h.tick();assert.ok((await retry).ok);
 const unknown=setup({[L.KEY]:{schemaVersion:99}}),p=unknown.send(items('#111111'));await unknown.tick();
 assert.equal((await p).ok,false);assert.equal(unknown.writes.length,0);
});
test('content sender cannot write labels and both profile resets leave sync labels intact',async()=>{
 const original={schemaVersion:2,emojisEnabled:false,items:[{text:'same',color:'#123456',emoji:'👩🏽‍💻'}]};
 const h=setup(L.snapshot(original));
 assert.equal((await h.send(items('#111111'),{tab:{id:1},url:'https://github.com/a/b/pull/1'})).ok,false);
 assert.equal(h.writes.length,0);
 assert.ok((await h.command({type:'cc-reset-css',id:'github'})).ok);
 assert.ok((await h.command({type:'cc-remove',id:'github'})).ok);
 assert.deepEqual(h.get()[L.KEY],original);
});

test('worker atomically coalesces complete emoji snapshots and retries latest state',async()=>{
 const h=setup(),first={schemaVersion:2,emojisEnabled:true,items:[{text:'same',color:'#123456',emoji:'👍'},{text:'same',color:'#abcdef',emoji:''}]};
 const last={...first,emojisEnabled:false,items:[{...first.items[1],emoji:'👩🏽‍💻'},{...first.items[0],color:'#654321'}]};
 h.fail(true);const a=h.send(first),b=h.send(last);await h.tick();
 assert.equal((await a).ok,false);assert.equal((await b).ok,false);
 h.fail(false);const retry=h.send(last);await h.tick();assert.ok((await retry).ok);
 assert.deepEqual(h.get()[L.KEY],last);assert.deepEqual(h.get().ccLabels,['same','same']);
 const reopened=L.readSettings(h.get());assert.equal(reopened.emojisEnabled,false);assert.equal(reopened.items[0].emoji,'👩🏽‍💻');
});
