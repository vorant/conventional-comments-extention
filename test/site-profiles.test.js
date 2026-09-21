const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/site-profiles');
const A = require('../src/editor-adapters');
const E = require('../src/panel-engine');
const { Document, parse } = require('./helpers/dom');
const fs = require('node:fs');
const fixture = () => parse(new Document(), fs.readFileSync(`${__dirname}/fixtures/editors.html`, 'utf8'));
const custom = (extra = {}) => ({ ...P.defaults[0], builtin: false, id: 'local', name: 'Корпоративный', origin: 'https://git.example:8443', paths: ['/review/*'], editorSelector: '.review-comment', containerSelector: '.review', anchorSelector: '.toolbar', anchorMode: 'editor', ...extra });
test('glob intersection detects actual overlaps including empty wildcards', () => {
  for (const [a,b] of [['/a*','/*b'], ['/pull/*','/pull/12'], ['/a*b*c','/ab*bc'], ['/x*','/x']]) assert.equal(P.overlaps(a,b),true,`${a} ${b}`);
  for (const [a,b] of [['/pull/*','/issues/*'], ['/a*x','/a*y']]) assert.equal(P.overlaps(a,b),false);
  assert.equal(P.pathMatches('/a.b/*','/axb/1'),false);
});
test('profiles persist overrides separately and reset without changing labels', () => {
  const data = P.save(undefined, {...P.defaults[0], placement:'after'});
  assert.equal(P.all(JSON.parse(JSON.stringify(data)))[0].placement,'after');
  assert.equal(P.all(P.remove(data,'github'))[0].placement,'before');
  assert.equal(data.ccLabels,undefined);
  assert.throws(()=>P.config({schemaVersion:2}),/формат/);
});
test('only built-ins apply, hidden overrides are ignored and matching follows default order', () => {
  const data={schemaVersion:1,revision:4,custom:[custom()],overrides:{github:{name:'Other',enabled:false,editorAdapter:'rich-text',containerSelector:'.old',anchorSelector:'.old',anchorMode:'editor',placement:'after',origin:'https://git.example:8443',paths:['/review/*'],editorSelector:'.review'},gitlab:{origin:'https://git.example:8443',paths:['/*']}}};
  const before=JSON.stringify(data), profiles=P.all(data);
  assert.equal(profiles.length,3);assert.equal(profiles[0].name,'GitHub');assert.equal(profiles[0].enabled,true);
  for(const field of ['editorAdapter','containerSelector','anchorSelector','anchorMode']) assert.equal(profiles[0][field],P.defaults[0][field]);
  assert.equal(profiles[0].placement,'after');assert.equal(profiles[0].editorSelector,'.review');
  assert.equal(P.select(profiles,'https://git.example:8443/review/12').id,'github');
  assert.equal(P.select(profiles,'https://git.example/review/12'),null);
  assert.equal(P.originPattern(profiles[0].origin),'https://git.example/*');
  assert.equal(JSON.stringify(data),before);
  assert.deepEqual(P.save(data,profiles[0]).custom,data.custom);
  assert.deepEqual(P.remove(data,'github').custom,data.custom);
  for(const fn of [()=>P.save(data,custom()),()=>P.remove(data,'local'),()=>P.save({schemaVersion:2},profiles[0])]) assert.throws(fn);
});
test('obsolete fields fall back separately while valid overrides survive',()=>{
  const profiles=P.all({schemaVersion:1,custom:[],overrides:{github:{origin:'bad',paths:['/valid/*'],editorSelector:'',placement:'append'}}});
  assert.equal(profiles[0].origin,P.defaults[0].origin);assert.equal(profiles[0].placement,'before');
  assert.equal(profiles[0].editorSelector,P.defaults[0].editorSelector);assert.deepEqual(profiles[0].paths,['/valid/*']);
});
test('validation rejects invalid editable fields without changing input', () => {
  const doc=new Document(),p=P.all()[0],before=JSON.stringify(p);
  for(const extra of [{editorSelector:'['},{origin:'https://a/path'},{origin:'javascript:alert(1)'},{paths:['?query']},{placement:'append'}]) assert.throws(()=>P.validate({...p,...extra},[],doc));
  assert.equal(JSON.stringify(p),before);
});
test('GitHub wrapper and GitLab textarea are resolved in synthetic fixtures', () => {
  const doc = fixture();
  const github = E.inspect(doc,P.defaults[0],A);
  assert.equal(github.status,'ok'); assert.ok(github.items[0].anchor.className.includes('inputWrapper'));
  const gitlab = E.inspect(doc,P.defaults[1],A);
  assert.equal(gitlab.status,'ok');
  A.insert(gitlab.items[0].editor,'idea💡','textarea');
  assert.equal(gitlab.items[0].editor.value,'idea💡: ');
});
test('placement uses each comment container and supports all positions', () => {
  for (const position of ['before','after','prepend','append']) {
    const doc=fixture(), p=custom({placement:position});
    const items=E.inspect(doc,p,A).items; assert.equal(items.length,2);
    for(const {anchor,editor} of items) {
      const panel=doc.createElement('div'); E.place(panel,anchor,position);
      if(position==='before') assert.equal(panel.nextSibling,anchor);
      if(position==='after') assert.equal(anchor.nextSibling,panel);
      if(position==='prepend') assert.equal(anchor.firstChild,panel);
      if(position==='append') assert.equal(anchor.children.at(-1),panel);
      assert.ok(editor.closest('.review').contains(panel));
    }
  }
});
test('missing, ambiguous and unsuitable anchors are diagnosed; late anchor recovers', () => {
  const doc=fixture(), p=custom({anchorSelector:'.missing'});
  assert.equal(E.inspect(doc,p,A).status,'anchor');
  const anchor=doc.createElement('div');anchor.className='missing';doc.querySelector('.review').append(anchor);
  assert.ok(E.inspect(doc,p,A).items[0].anchor);
  const another=doc.createElement('div');another.className='missing';anchor.parentElement.append(another);
  assert.equal(E.inspect(doc,p,A).items[0].error,'anchor');
  assert.equal(E.inspect(doc,custom({anchorSelector:'',placement:'append'}),A).status,'placement');
});
test('ambiguous shared container never borrows a neighbouring comment anchor', () => {
  const doc=fixture();
  assert.equal(E.inspect(doc,custom({containerSelector:'.corporate-fixture'}),A).status,'anchor');
});
test('textarea native setter, focus, cursor and input update are preserved without duplicating prefix', () => {
  const doc=new Document(), editor=doc.createElement('textarea');editor.value='Original';
  let input=0;editor.addEventListener('input',()=>input++);
  A.insert(editor,'question','textarea');A.insert(editor,'question','textarea');
  assert.equal(editor.value,'question: Original');assert.equal(editor.selectionStart,10);assert.equal(editor.selectionEnd,10);assert.equal(doc.activeElement,editor);assert.equal(input,2);
  editor.readOnly=true;assert.equal(A.supports(editor,'textarea'),false);
});
test('rich text adapter delegates insertion to editing command and never assigns HTML', () => {
  const doc=fixture(), editor=doc.querySelector('.ProseMirror');let command;
  doc.getSelection=()=>({removeAllRanges(){},addRange(){}});doc.createRange=()=>({selectNodeContents(){},collapse(){}});
  doc.execCommand=(...args)=>{command=args;return true;};
  const before=editor.textContent;
  A.insert(editor,'note','rich-text');assert.deepEqual(command,['insertText',false,'note: ']);assert.equal(editor.textContent,before);
  doc.execCommand=()=>false;assert.throws(()=>A.insert(editor,'note','rich-text'),/отклонил/);
});
test('placement never inserts toolbar inside an editable rich-text subtree',()=>{
  const doc=fixture();doc.execCommand=()=>true;
  const p={...P.defaults[2],anchorSelector:'.ProseMirror',placement:'append'};
  assert.equal(E.inspect(doc,p,A).status,'placement');
});
test('wildcard hostname is rejected rather than requesting unintended hosts',()=>{
  assert.throws(()=>P.validate({...P.defaults[0],origin:'https://*.example.com'},[]),/Адрес/);
});
