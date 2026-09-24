const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { Document, parse } = require('./helpers/dom');
const P = require('../src/site-profiles');
const L = require('../src/label-settings');
const A = require('../src/editor-adapters');
const E = require('../src/panel-engine');
const source = fs.readFileSync(path.join(__dirname,'../src/content-script.js'),'utf8');
const flush = async () => { for(let i=0;i<10;i++) await Promise.resolve(); };
function create(options={}) {
  const doc = new Document();
  parse(doc, options.html || '<form class="js-previewable-comment-form"><text-expander><textarea name="comment[body]"></textarea></text-expander></form>');
  let profiles = options.profiles || P.all(), labels = options.labels, settings = options.settings, now = 0, id = 0;
  let scheme = options.scheme || "normal", systemDark = false, themeListener;
  const timers = new Map(), intervals = [], observers = [], runtimeListeners = [], storageListeners = [], sent = [];
  const location = {href:options.href || 'https://github.com/a/b/pull/12'};
  const context = { document:doc, location, CCProfiles:P, CCEditors:A, CCPanel:E, CCLabels:L,
    getComputedStyle:()=>({colorScheme:scheme}),
    window:{addEventListener(){},matchMedia(){return {get matches(){return systemDark;},addEventListener(event,fn){themeListener=fn;}};}}, Date:{now:()=>now},
    setTimeout(fn,ms){timers.set(++id,{fn,time:now+ms});return id;},clearTimeout(id){timers.delete(id);},setInterval(fn){intervals.push(fn);},
    MutationObserver:class { constructor(fn){observers.push(fn);} observe(){} },
    chrome:{runtime:{onMessage:{addListener(fn){runtimeListeners.push(fn);}},async sendMessage(message){sent.push(message);return message.type==='cc-config'?{ok:true,profiles}: {ok:true};}},
      storage:{sync:{async get(){return {ccLabels:labels,[L.KEY]:settings};}},onChanged:{addListener(fn){storageListeners.push(fn);}}}}
  };
  const ctx=vm.createContext(context);vm.runInContext(source,ctx);
  async function tick(ms=31){now+=ms;for(let n=0;n<10;n++){const due=[...timers].filter(([,t])=>t.time<=now);if(!due.length)break;for(const [key,t] of due){timers.delete(key);t.fn();await flush();}}await flush();}
  function mutate(){observers[0]([{target:doc.body}]);}
  async function message(message){let reply;const pending=runtimeListeners[0](message,{},r=>{reply=r;});if(pending)await flush();return reply;}
  return {doc,sent,flush,tick,mutate,message,context:ctx,
    async changeColors(items){settings={schemaVersion:1,items};storageListeners[0]({[L.KEY]:{}},'sync');await flush();},
    async theme(value,dark=false){scheme=value;systemDark=dark;observers[1]([]);themeListener();await tick();},
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

test('one style replaces defaults in place for all panels without modifying drafts',async()=>{
  const h=create({html:'<form><textarea name="comment[body]"></textarea></form><form><textarea name="comment[body]"></textarea></form>'});await h.flush();
  const styles=()=>h.doc.querySelectorAll('[data-cc-panel-style]');
  const style=styles()[0],panels=h.doc.querySelectorAll('.cc-label-panel'),editor=h.doc.querySelector('textarea');
  editor.value='Draft';assert.equal(style.textContent,P.standardCss);
  for(const css of ['.cc-label-button { color: red; }','','</style><script>not HTML</script>']){
    await h.changeProfiles([{...P.all()[0],panelCss:css,revision:1}]);
    assert.equal(styles().length,1);assert.equal(styles()[0],style);
    assert.equal(style.textContent,css);assert.equal(style.children.length,0);
    assert.deepEqual(h.doc.querySelectorAll('.cc-label-panel'),panels);
    assert.equal(editor.value,'Draft');
    h.mutate();await h.tick();assert.equal(styles()[0],style);
  }
  await h.changeProfiles(P.all());assert.equal(style.textContent,P.standardCss);
  style.remove();h.mutate();await h.tick();assert.equal(styles().length,1);
});
test('styles follow SPA, selected profile and stop/reload permission lifecycle',async()=>{
  const profiles=P.all().map(p=>({...p,origin:'https://github.com',paths:p.id==='github'?['/a/*']:['/b/*'],editorSelector:'textarea',containerSelector:'form',panelCss:p.id}));
  const h=create({profiles,href:'https://github.com/a/1'});await h.flush();
  const css=()=>h.doc.querySelector('[data-cc-panel-style]');
  assert.equal(css().textContent,'github');
  await h.navigate('https://github.com/b/1');assert.equal(css().textContent,'gitlab');
  assert.equal(h.doc.querySelectorAll('[data-cc-panel-style]').length,1);
  await h.navigate('https://github.com/c/1');assert.equal(css(),null);
  await h.navigate('https://github.com/a/1');assert.equal(css().textContent,'github');
  await h.message({type:'cc-stop'});h.mutate();await h.tick();assert.equal(css(),null);
  await h.changeProfiles(profiles);assert.equal(css().textContent,'github');
  await h.changeProfiles([]);assert.equal(css(),null);
});
test('CSS revisions preserve existing diagnostics without leaving duplicate notices',async()=>{
  const p={...P.all()[0],containerSelector:'.missing'};
  const h=create({profiles:[p]});await h.flush();await h.tick(510);
  for(let revision=1;revision<=3;revision++){
    await h.changeProfiles([{...p,revision,panelCss:'/* '+revision+' */'}]);
    await h.tick(510);assert.equal(h.doc.querySelectorAll('.cc-profile-notice').length,1);
  }
  h.doc.querySelector('.cc-profile-notice').querySelectorAll('button')[1].click();
  await h.changeProfiles([{...p,revision:4}]);await h.tick(510);
  assert.equal(h.doc.querySelectorAll('.cc-profile-notice').length,1);
});

test('color-only changes keep every button, focus and editor text with empty or custom CSS',async()=>{
 const h=create({html:'<form><textarea name="comment[body]"></textarea></form><form><textarea name="comment[body]"></textarea></form>'});await h.flush();
 const buttons=h.doc.querySelectorAll('.cc-label-button'),editor=h.doc.querySelector('textarea');
 buttons[0].focus();editor.value='unchanged';
 const items=L.defaults();items[0].color='#ff8800';
 await h.changeColors(items);
 assert.deepEqual(h.doc.querySelectorAll('.cc-label-button'),buttons);
 assert.equal(h.doc.activeElement,buttons[0]);assert.equal(editor.value,'unchanged');
 for(const button of [buttons[0],buttons[9]]){
  assert.equal(button.style.getPropertyValue('background'),L.shades('#ff8800').background);
  for(const prop of ['color','background','border-color'])assert.equal(button.style.getPropertyPriority(prop),'important');
 }
 for(const panelCss of ['', '.cc-label-button { color: red !important }']){
  await h.changeProfiles([{...P.all()[0],panelCss}]);
  assert.equal(h.doc.querySelector('.cc-label-button'),buttons[0]);
  assert.equal(buttons[0].style.getPropertyValue('color'),L.shades('#ff8800').foreground);
 }
 parse(h.doc,'<form><textarea name="comment[body]"></textarea></form>');h.mutate();await h.tick();
 assert.equal(h.doc.querySelectorAll('.cc-label-button')[18].style.getPropertyValue('background'),L.shades('#ff8800').background);
 await h.message({type:'cc-stop'});assert.equal(h.doc.querySelector('.cc-label-button'),null);
});
test('site color-scheme wins over system, theme change recolors in place without observer churn',async()=>{
 const h=create({labels:['praise'],scheme:'light'});await h.flush();
 const button=h.doc.querySelector('.cc-label-button');
 await h.theme('dark',false);assert.equal(button.style.getPropertyValue('background'),L.shades(L.PALETTE.praise,true).background);
 await h.theme('light',true);assert.equal(button.style.getPropertyValue('background'),L.shades(L.PALETTE.praise,false).background);
 await h.theme('normal',true);assert.equal(button.style.getPropertyValue('background'),L.shades(L.PALETTE.praise,true).background);
 let writes=0;const original=button.style.setProperty;button.style.setProperty=(...args)=>{writes++;original(...args);};
 h.mutate();await h.tick();h.mutate();await h.tick();assert.equal(writes,0);
});
test('colored records insert only text and unknown settings fall back to legacy without dropping panels',async()=>{
 const h=create({settings:{schemaVersion:1,items:[{text:'idea💡',color:'#123456'}]}});await h.flush();
 const button=h.doc.querySelector('.cc-label-button');button.click();
 assert.equal(h.doc.querySelector('textarea').value,'idea💡: ');assert.equal(button.textContent,'idea💡:');
 const fallback=create({labels:['note'],settings:{schemaVersion:99}});await fallback.flush();
 assert.equal(fallback.doc.querySelector('.cc-label-button').textContent,'note:');
});
