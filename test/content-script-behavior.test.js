const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { Document, parse } = require('./helpers/dom');
const P = require('../src/site-profiles');
const A = require('../src/editor-adapters');
const E = require('../src/panel-engine');
const source = fs.readFileSync(path.join(__dirname,'../src/content-script.js'),'utf8');
const flush = async () => { for(let i=0;i<10;i++) await Promise.resolve(); };
function create(options={}) {
  const doc = new Document();
  parse(doc, options.html || '<form class="js-previewable-comment-form"><text-expander><textarea name="comment[body]"></textarea></text-expander></form>');
  let profiles = options.profiles || P.all(), labels = options.labels, now = 0, id = 0;
  const timers = new Map(), intervals = [], observers = [], runtimeListeners = [], storageListeners = [], sent = [];
  const location = {href:options.href || 'https://github.com/a/b/pull/12'};
  const context = { document:doc, location, CCProfiles:P, CCEditors:A, CCPanel:E,
    window:{addEventListener(){}}, Date:{now:()=>now},
    setTimeout(fn,ms){timers.set(++id,{fn,time:now+ms});return id;},clearTimeout(id){timers.delete(id);},setInterval(fn){intervals.push(fn);},
    MutationObserver:class { constructor(fn){observers.push(fn);} observe(){} },
    chrome:{runtime:{onMessage:{addListener(fn){runtimeListeners.push(fn);}},async sendMessage(message){sent.push(message);return message.type==='cc-config'?{ok:true,profiles}: {ok:true};}},
      storage:{sync:{async get(){return {ccLabels:labels};}},onChanged:{addListener(fn){storageListeners.push(fn);}}}}
  };
  const ctx=vm.createContext(context);vm.runInContext(source,ctx);
  async function tick(ms=31){now+=ms;for(let n=0;n<10;n++){const due=[...timers].filter(([,t])=>t.time<=now);if(!due.length)break;for(const [key,t] of due){timers.delete(key);t.fn();await flush();}}await flush();}
  function mutate(){observers[0]([{target:doc.body}]);}
  async function message(message){let reply;const pending=runtimeListeners[0](message,{},r=>{reply=r;});if(pending)await flush();return reply;}
  return {doc,sent,flush,tick,mutate,message,context:ctx,
    async changeLabels(value){labels=value;storageListeners[0]({ccLabels:{}},'sync');await flush();},
    async changeProfiles(value){profiles=value;await message({type:'cc-reload'});},
    async navigate(url){location.href=url;intervals.forEach(fn=>fn());await tick();}
  };
}
test('existing GitHub editor uses saved labels, native input, prefix and cursor',async()=>{
  const h=create({labels:['question','idea💡']});await h.flush();
  const panel=h.doc.querySelector('.cc-label-panel'),editor=h.doc.querySelector('textarea');
  assert.equal(panel.children.length,2);editor.value='Текст';panel.children[1].click();
  assert.equal(editor.value,'idea💡: Текст');assert.equal(editor.selectionStart,'idea💡: '.length);assert.equal(editor.lastEvent.type,'input');
  panel.children[1].click();assert.equal(editor.value,'idea💡: Текст');
});
test('modern GitHub wrapper gets the panel above it',async()=>{
  const h=create({html:'<div class="MarkdownEditor-module__container"><div class="MarkdownInput-module__inputWrapper"><textarea placeholder="Leave a comment"></textarea></div></div>'});await h.flush();
  assert.ok(h.doc.querySelector('.cc-label-panel').nextSibling.className.includes('inputWrapper'));
});
test('dynamic editors, duplicate bootstrap, node removal and multiple fields',async()=>{
  const h=create();await h.flush();
  parse(h.doc,'<form><textarea name="comment[body]"></textarea></form>');h.mutate();await h.tick();
  assert.equal(h.doc.querySelectorAll('.cc-label-panel').length,2);
  vm.runInContext(source,h.context);h.mutate();await h.tick();assert.equal(h.doc.querySelectorAll('.cc-label-panel').length,2);
  h.doc.querySelector('textarea').remove();h.mutate();await h.tick();assert.equal(h.doc.querySelectorAll('.cc-label-panel').length,1);
});
test('SPA route cleanup and return, disabled profiles and revoked permissions',async()=>{
  const h=create();await h.flush();await h.navigate('https://github.com/a/b/issues/1');assert.equal(h.doc.querySelector('.cc-label-panel'),null);
  await h.navigate('https://github.com/a/b/pull/1');assert.ok(h.doc.querySelector('.cc-label-panel'));
  await h.changeProfiles([]);assert.equal(h.doc.querySelector('.cc-label-panel'),null);
  await h.changeProfiles(P.all());assert.ok(h.doc.querySelector('.cc-label-panel'));
  await h.message({type:'cc-stop'});h.mutate();await h.tick();assert.equal(h.doc.querySelector('.cc-label-panel'),null);
});
test('empty labels produce no panel or errors and new labels rebuild panels',async()=>{
  const h=create({labels:[]});await h.flush();assert.equal(h.doc.querySelector('.cc-label-panel'),null);
  await h.changeLabels(['todo']);assert.equal(h.doc.querySelector('.cc-label-panel').children.length,1);
  await h.changeLabels([]);assert.equal(h.doc.querySelector('.cc-label-panel'),null);assert.equal(h.doc.querySelector('.cc-profile-notice'),null);
});
test('missing anchor is delayed, deduplicated, closable and automatically restored',async()=>{
  const p={...P.all()[0],anchorSelector:'.toolbar'};
  const h=create({profiles:[p]});await h.flush();assert.equal(h.doc.querySelector('.cc-profile-notice'),null);
  await h.tick(510);assert.ok(h.doc.querySelector('.cc-profile-notice'));
  h.mutate();await h.tick(1000);assert.equal(h.doc.querySelectorAll('.cc-profile-notice').length,1);
  const buttons=h.doc.querySelector('.cc-profile-notice').querySelectorAll('button');buttons[0].click();await h.flush();assert.equal(h.sent.at(-1).id,'github');
  buttons[1].click();h.mutate();await h.tick(1000);assert.equal(h.doc.querySelector('.cc-profile-notice'),null);
  const anchor=h.doc.createElement('div');anchor.className='toolbar';h.doc.querySelector('form').append(anchor);h.mutate();await h.tick();assert.ok(h.doc.querySelector('.cc-label-panel'));
});
test('no open editor is normal and removed explicit diagnostics is ignored',async()=>{
  const h=create({html:'<div></div>'});await h.flush();await h.tick(1000);assert.equal(h.doc.querySelector('.cc-profile-notice'),null);
  assert.equal(await h.message({type:'cc-inspect',id:'github'}),undefined);
});
test('automatic placement notice preserves text and uses available settings',async()=>{
  const h=create();await h.flush();const editor=h.doc.querySelector('textarea');editor.value='untouched';
  await h.changeProfiles([{...P.all()[0],containerSelector:'.missing'}]);await h.tick(510);
  const notice=h.doc.querySelector('.cc-profile-notice');assert.ok(notice);assert.match(notice.textContent,/предустановкой/);
  assert.doesNotMatch(notice.textContent,/Выберите другой тип|containerSelector|anchorSelector|Проверить профиль/);
  assert.equal(editor.value,'untouched');
});
test('profile changes reposition active editor without changing text',async()=>{
  const h=create();await h.flush();const editor=h.doc.querySelector('textarea');editor.value='Draft';
  await h.changeProfiles([{...P.all()[0],placement:'after'}]);
  assert.equal(h.doc.querySelector('text-expander').nextSibling.className,'cc-label-panel');assert.equal(editor.value,'Draft');
});
test('site moving an anchor away from its panel restores adjacency',async()=>{
  const h=create();await h.flush();const wrapper=h.doc.querySelector('text-expander'),form=h.doc.querySelector('form');
  const separator=h.doc.createElement('div');form.append(separator);form.append(wrapper);h.mutate();await h.tick();
  assert.equal(h.doc.querySelector('.cc-label-panel').nextSibling,wrapper);
});
test('restoration clears visible errors and a new settings revision may notify again',async()=>{
  const p={...P.all()[0],anchorSelector:'.missing'};const h=create({profiles:[p]});await h.flush();await h.tick(510);
  assert.ok(h.doc.querySelector('.cc-profile-notice'));
  await h.changeProfiles([{...p,anchorSelector:'',revision:1}]);assert.equal(h.doc.querySelector('.cc-profile-notice'),null);assert.ok(h.doc.querySelector('.cc-label-panel'));
  await h.changeProfiles([{...p,revision:2}]);await h.tick(510);assert.ok(h.doc.querySelector('.cc-profile-notice'));
});
