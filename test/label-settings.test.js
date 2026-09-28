const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/label-settings');
test('legacy labels gain defaults without changing order, duplicates or empty list', () => {
  assert.deepEqual(L.read().map(x=>x.text), ['praise','nitpick','suggestion','issue','todo','question','thought','chore','note']);
  assert.deepEqual(L.read({ccLabels:[]}), []);
  const before={ccLabels:[' issue ', 'custom', 'issue', '', 7, 'constructor']};
  const frozen=JSON.stringify(before), items=L.read(before);
  assert.deepEqual(items.map(x=>x.text),['issue','custom','issue','constructor']);
  assert.deepEqual(items.map(x=>x.color),[L.PALETTE.issue,L.NEUTRAL,L.PALETTE.issue,L.NEUTRAL]);
  assert.equal(JSON.stringify(before),frozen);
});
test('new records retain colors independently, invalid colors fall back and unknown schemas fail', () => {
  const data=L.snapshot([{text:'same',color:'#ABCDEF'},{text:'same',color:'#123456'}]);
  assert.deepEqual(data.ccLabels,['same','same']);
  assert.deepEqual(L.read(data).map(x=>x.color),['#abcdef','#123456']);
  for(const color of ['',null,'red','#fff','#123456;display:none']){
    assert.deepEqual(L.read({[L.KEY]:{schemaVersion:1,items:[{text:'issue',color}]}}),[{text:'issue',color:L.NEUTRAL,emoji:'🚨'}]);
  }
  for(const value of [null,{schemaVersion:99,items:[]},{schemaVersion:1,items:null}]){
    const stored={[L.KEY]:value};const before=JSON.stringify(stored);
    assert.throws(()=>L.read(stored));assert.equal(JSON.stringify(stored),before);
  }
});
test('palette produces opaque contrast-safe colors for both schemes including extreme inputs', () => {
  for(const color of [...Object.values(L.PALETTE),'#000000','#ffffff','#ffff00','#808080','#ff00ff','#00ffff']){
    for(const dark of [false,true]){
      const shades=L.shades(color,dark);
      for(const v of Object.values(shades))assert.match(v,/^#[0-9a-f]{6}$/);
      assert.ok(L.contrast(shades.foreground,shades.background)>=4.5,JSON.stringify({color,dark,shades}));
    }
  }
  assert.notDeepEqual(L.shades('#238636'),L.shades('#238636',true));
});
test('v2 migration preserves explicit absence, duplicates, colors and empty lists', () => {
  assert.deepEqual(L.defaults().map(x=>x.emoji), ['👍','🔍','💡','🚨','✅','❓','💭','🔧','📝']);
  const old={schemaVersion:1,items:[{text:'issue',color:'#123456'},{text:'custom',color:'#abcdef'}]};
  assert.deepEqual(L.readSettings({[L.KEY]:old}),{schemaVersion:2,emojisEnabled:true,items:[{text:'issue',color:'#123456',emoji:'🚨'},{text:'custom',color:'#abcdef',emoji:''}]});
  const value={schemaVersion:2,emojisEnabled:false,items:[{text:'issue',color:'#123456',emoji:''},{text:'issue',color:'#abcdef',emoji:'👩🏽‍💻'},{text:'praise',emoji:'<b>👍</b>'},{text:'note'}]};
  const stored=L.snapshot(value), state=L.readSettings(stored);
  assert.equal(state.emojisEnabled,false);
  assert.deepEqual(state.items.map(x=>x.emoji),['','👩🏽‍💻','','']);
  assert.deepEqual(L.readSettings(L.snapshot({...value,items:[]})).items,[]);
  assert.equal(L.normalize([{text:'issue'}])[0].emoji,'');
  assert.equal(L.read({ccLabels:['issue','unknown']})[0].emoji,'🚨');
});
test('whole emoji clusters and shared prefix keep Unicode and label text intact', () => {
  for(const emoji of ['👍','👍🏽','👩🏽‍💻','👨‍👩‍👧‍👦','🇷🇺','❤️','❤︎','1️⃣','🏴\u{E0067}\u{E0062}\u{E007F}']) {
    assert.equal(L.emoji(emoji),emoji);
    assert.equal(L.prefix({text:'idea💡',emoji}),`${emoji} idea💡: `);
    assert.equal(L.prefix({text:'idea💡',emoji},false),'idea💡: ');
  }
  for(const emoji of ['',null,7,'abc','👍👍','a\u200d💡','\n💡','💡 ','🇷','🏽','<img>']) assert.equal(L.emoji(emoji),'');
  assert.equal(L.display({text:'issue',emoji:''}),'issue');
});
