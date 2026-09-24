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
    assert.deepEqual(L.read({[L.KEY]:{schemaVersion:1,items:[{text:'issue',color}]}}),[{text:'issue',color:L.NEUTRAL}]);
  }
  for(const value of [null,{schemaVersion:2,items:[]},{schemaVersion:1,items:null}]){
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
