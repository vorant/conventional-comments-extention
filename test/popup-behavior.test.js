const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const L = require('../src/label-settings');
const rootDir = path.resolve(__dirname, "..");
const popupScript = fs.readFileSync(path.join(rootDir, "src/popup.js"), "utf8");

class FakeElement {
  constructor(tagName, id = "") {
    this.tagName = tagName.toLowerCase();
    this.id = id;
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.eventListeners = new Map();
    this.type = "";
    this.value = "";
    this.draggable = false;
    this.className = "";
    this._textContent = "";
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }

  get textContent() {
    return this._textContent;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "draggable") {
      this.draggable = value === "true";
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  addEventListener(type, listener) {
    const previous = this.eventListeners.get(type);
    this.eventListeners.set(type, previous ? (event) => { previous(event); listener(event); } : listener);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  dispatchEvent(event) {
    const listener = this.eventListeners.get(event.type);
    if (listener) {
      event.currentTarget = this;
      listener(event);
    }
  }

  focus() { this.ownerDocument.activeElement = this; }

  click() {
    this.dispatchEvent({ type: "click" });
  }
}

class FakeDocument {
  constructor() {
    this.readyState = "complete";
    this.elements = new Map();
    this.body = new FakeElement("body");

    for (const [id, tagName] of [
      ...["emoji-toggle-row","emoji-view","emoji-title","emoji-current","emoji-status","emoji-container"].map(id=>[id,"div"]),
      ...["emoji-back","emoji-none","emoji-retry"].map(id=>[id,"button"]),
      ["emojis-enabled","input"],
      ["theme-toggle", "button"],
      ["open-settings", "button"],
      ["label-form", "form"],
      ["label-list", "div"],
      ["new-label", "input"], ["labels-status","p"], ["labels-retry","button"]
    ]) {
      const element = new FakeElement(tagName, id); element.ownerDocument = this;
      this.elements.set(id, element);
    }
  }

  createElement(tagName) {
    const element = new FakeElement(tagName); element.ownerDocument = this; return element;
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  addEventListener(type, listener) { this.listeners ||= {}; this.listeners[type] = listener; }
}

function waitForAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function createPopupContext(initialLabels, initialTheme, options = {}) {
  const document = new FakeDocument();
  const storedItems = { ...options.stored };
  const pending = [];
  let setCallCount = 0;
  let optionsCalls = 0;
  if (initialLabels !== undefined) {
    storedItems.ccLabels = initialLabels;
  }
  if (initialTheme !== undefined) {
    storedItems.ccTheme = initialTheme;
  }

  const context = {
    document, CCLabels:L, CCEmojiPicker: { async create() { if(options.pickerError?.())throw Error("load"); return document.createElement("emoji-picker"); } },
    chrome: {
      runtime: { openOptionsPage() { optionsCalls++; }, sendMessage(message) {
        setCallCount++;
        return new Promise(resolve=>{
          const complete=(ok=true)=>{
            if(ok)Object.assign(storedItems,L.snapshot(message.settings));
            resolve({ok,error:"Ошибка записи"});
          };
          if(options.delayed)pending.push(complete);else complete();
        });
      } },
      storage: {
        sync: {
          get(key, callback) {
            const data=Array.isArray(key)?Object.fromEntries(key.map(k=>[k,storedItems[k]])):{[key]:storedItems[key]};
            if(callback)callback(data);else return Promise.resolve(data);
          },
          set(items, callback) {
            setCallCount += 1;
            Object.assign(storedItems, items);
            if (callback) {
              callback();
            }
          }
        }
      }
    }
  };

  vm.runInNewContext(fs.readFileSync(path.join(rootDir, "src/theme.js"), "utf8"), context);
  vm.runInNewContext(popupScript, context);
  await waitForAsyncWork();

  return { document, pending, getOptionsCalls: () => optionsCalls, getSetCallCount: () => setCallCount, storedItems };
}

function renderedLabelInputs(document) {
  return document
    .getElementById("label-list")
    .children.map((row) => row.children[2]);
}

function createDragEvent(type) {
  const data = new Map();
  return {
    type,
    dataTransfer: {
      dropEffect: "",
      effectAllowed: "",
      getData(key) {
        return data.get(key) || "";
      },
      setData(key, value) {
        data.set(key, String(value));
      }
    },
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

test("popup renders default labels before settings are changed", async () => {
  const { document } = await createPopupContext();

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), [
    "praise",
    "nitpick",
    "suggestion",
    "issue",
    "todo",
    "question",
    "thought",
    "chore",
    "note"
  ]);
});

test("popup uses light theme by default", async () => {
  const { document } = await createPopupContext();
  const toggle = document.getElementById("theme-toggle");

  assert.equal(document.body.getAttribute("data-theme"), "light");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
  assert.equal(toggle.textContent, String.fromCodePoint(0xf186));
  assert.equal(toggle.getAttribute("aria-label"), "Включить тёмную тему");
});

test("popup applies a saved dark theme", async () => {
  const { document } = await createPopupContext(["suggestion"], "dark");
  const toggle = document.getElementById("theme-toggle");

  assert.equal(document.body.getAttribute("data-theme"), "dark");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.equal(toggle.textContent, String.fromCodePoint(0xf05a8));
  assert.equal(toggle.getAttribute("title"), "Включить светлую тему");
});

test("popup toggles and persists light and dark themes", async () => {
  const { document, storedItems } = await createPopupContext(["suggestion"]);
  const toggle = document.getElementById("theme-toggle");

  toggle.click();
  await waitForAsyncWork();

  assert.equal(document.body.getAttribute("data-theme"), "dark");
  assert.equal(storedItems.ccTheme, "dark");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");

  toggle.click();
  await waitForAsyncWork();

  assert.equal(document.body.getAttribute("data-theme"), "light");
  assert.equal(storedItems.ccTheme, "light");
  assert.equal(toggle.getAttribute("aria-pressed"), "false");
});

test("popup persists edited labels", async () => {
  const { document, storedItems } = await createPopupContext(["suggestion"]);
  const [input] = renderedLabelInputs(document);

  input.value = "proposal";
  input.dispatchEvent({ type: "input" });
  await waitForAsyncWork();

  assert.deepEqual(storedItems.ccLabels, ["proposal"]);
});

test("popup label rows include a visible drag handle", async () => {
  const { document } = await createPopupContext(["suggestion"]);
  const row = document.getElementById("label-list").children[0];
  const handle = row.children[0];

  assert.equal(row.draggable, true);
  assert.equal(row.getAttribute("draggable"), "true");
  assert.match(handle.className, /drag-handle/);
  assert.equal(handle.getAttribute("aria-hidden"), "true");
  assert.match(handle.children[0].className, /drag-handle-icon-light/);
  assert.match(handle.children[0].className, /nf-icon/);
  assert.match(handle.children[1].className, /drag-handle-icon-dark/);
  assert.match(handle.children[1].className, /nf-icon/);
  assert.equal(handle.children[0].textContent, handle.children[1].textContent);
});

test("popup previews reorder during dragover and saves on drop", async () => {
  const { document, storedItems } = await createPopupContext(["suggestion", "question", "issue"]);
  const list = document.getElementById("label-list");

  list.children[1].dispatchEvent(createDragEvent("dragstart"));
  list.children[0].dispatchEvent(createDragEvent("dragover"));

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), ["question", "suggestion", "issue"]);
  assert.deepEqual(storedItems.ccLabels, ["suggestion", "question", "issue"]);

  document.getElementById("label-list").children[0].dispatchEvent(createDragEvent("drop"));
  await waitForAsyncWork();

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), ["question", "suggestion", "issue"]);
  assert.deepEqual(storedItems.ccLabels, ["question", "suggestion", "issue"]);
});

test("popup marks only the latest changed row range during reorder preview", async () => {
  const { document } = await createPopupContext([
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight"
  ]);
  const list = document.getElementById("label-list");

  list.children[1].dispatchEvent(createDragEvent("dragstart"));
  list.children[3].dispatchEvent(createDragEvent("dragover"));

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), [
    "one",
    "three",
    "four",
    "two",
    "five",
    "six",
    "seven",
    "eight"
  ]);
  assert.deepEqual(
    document
      .getElementById("label-list")
      .children.map((row) => row.getAttribute("data-drag-preview") === "true"),
    [false, true, true, true, false, false, false, false]
  );
  assert.deepEqual(
    document
      .getElementById("label-list")
      .children.map((row) => row.getAttribute("data-dragging") === "true"),
    [false, false, false, true, false, false, false, false]
  );

  document.getElementById("label-list").children[6].dispatchEvent(createDragEvent("dragover"));

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), [
    "one",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "two",
    "eight"
  ]);
  assert.deepEqual(
    document
      .getElementById("label-list")
      .children.map((row) => row.getAttribute("data-drag-preview") === "true"),
    [false, false, false, true, true, true, true, false]
  );
  assert.deepEqual(
    document
      .getElementById("label-list")
      .children.map((row) => row.getAttribute("data-dragging") === "true"),
    [false, false, false, false, false, false, true, false]
  );
});

test("popup no-op drop keeps label order without saving", async () => {
  const { document, getSetCallCount, storedItems } = await createPopupContext(["suggestion", "question"]);
  const list = document.getElementById("label-list");
  const callsBeforeDrag = getSetCallCount();

  list.children[0].dispatchEvent(createDragEvent("dragstart"));
  list.children[0].dispatchEvent(createDragEvent("drop"));
  await waitForAsyncWork();

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), ["suggestion", "question"]);
  assert.deepEqual(storedItems.ccLabels, ["suggestion", "question"]);
  assert.equal(getSetCallCount(), callsBeforeDrag);
});

test("popup restores order when drag is cancelled after preview", async () => {
  const { document, storedItems } = await createPopupContext(["suggestion", "question", "issue"]);
  const list = document.getElementById("label-list");

  list.children[0].dispatchEvent(createDragEvent("dragstart"));
  list.children[2].dispatchEvent(createDragEvent("dragover"));

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), ["question", "issue", "suggestion"]);

  document.getElementById("label-list").children[2].dispatchEvent(createDragEvent("dragend"));
  await waitForAsyncWork();

  assert.deepEqual(renderedLabelInputs(document).map((input) => input.value), ["suggestion", "question", "issue"]);
  assert.deepEqual(storedItems.ccLabels, ["suggestion", "question", "issue"]);
});

test("popup adds only non-empty labels", async () => {
  const { document, storedItems } = await createPopupContext(["question"]);
  const form = document.getElementById("label-form");
  const input = document.getElementById("new-label");

  input.value = "   ";
  form.dispatchEvent({ type: "submit", preventDefault() {} });
  await waitForAsyncWork();
  assert.deepEqual(storedItems.ccLabels, ["question"]);

  input.value = "idea💡";
  form.dispatchEvent({ type: "submit", preventDefault() {} });
  await waitForAsyncWork();

  assert.deepEqual(storedItems.ccLabels, ["question", "idea💡"]);
  assert.deepEqual(renderedLabelInputs(document).map((labelInput) => labelInput.value), ["question", "idea💡"]);
});

test("popup deletes labels including the last remaining label", async () => {
  const { document, storedItems } = await createPopupContext(["todo"]);
  const deleteButton = document.getElementById("label-list").children[0].children[4];

  deleteButton.click();
  await waitForAsyncWork();

  assert.deepEqual(storedItems.ccLabels, []);
  assert.deepEqual(renderedLabelInputs(document), []);
});

test("popup delete control is a red icon-only trash button", async () => {
  const { document } = await createPopupContext(["todo"]);
  const deleteButton = document.getElementById("label-list").children[0].children[4];

  assert.match(deleteButton.className, /delete-button/);
  assert.match(deleteButton.className, /nf-icon/);
  assert.equal(deleteButton.getAttribute("aria-label"), "Удалить label");
  assert.equal(deleteButton.getAttribute("title"), "Удалить label");
  assert.notEqual(deleteButton.textContent, "Delete");
  assert.ok(deleteButton.textContent.length > 0);
});

test("settings button opens Chrome options without writing labels", async () => {
  const h = await createPopupContext(["todo"]);
  h.document.getElementById("open-settings").click();
  assert.equal(h.getOptionsCalls(), 1);
  assert.equal(h.getSetCallCount(), 0);
  assert.deepEqual(renderedLabelInputs(h.document).map(input => input.value), ["todo"]);
});

const rowPicker=(h,index=0)=>h.document.getElementById('label-list').children[index].children[3];
const pick=(h,value,index=0)=>{const p=rowPicker(h,index);p.value=value;p.dispatchEvent({type:'input'});};
test('native picker exposes default color and accessible name, rename preserves color',async()=>{
 const h=await createPopupContext(['praise']);
 const picker=rowPicker(h);
 assert.equal(picker.type,'color');assert.equal(picker.value,L.PALETTE.praise);
 assert.equal(picker.getAttribute('aria-label'),'Цвет label praise');
 pick(h,'#123456');await waitForAsyncWork();
 const input=renderedLabelInputs(h.document)[0];input.value='renamed';input.dispatchEvent({type:'input'});await waitForAsyncWork();
 assert.deepEqual(h.storedItems[L.KEY].items,[{text:'renamed',color:'#123456',emoji:'👍'}]);
 assert.equal(picker.getAttribute('aria-label'),'Цвет label renamed');
 const reopened=await createPopupContext(undefined,undefined,{stored:h.storedItems});
 assert.equal(rowPicker(reopened).value,'#123456');
});
test('duplicate names have independent colors and reorder/cancel preserve each record',async()=>{
 const h=await createPopupContext(['same','same','issue']);
 pick(h,'#123456',0);pick(h,'#abcdef',1);await waitForAsyncWork();
 const list=h.document.getElementById('label-list');
 list.children[0].dispatchEvent(createDragEvent('dragstart'));list.children[2].dispatchEvent(createDragEvent('dragover'));
 assert.deepEqual(list.children.map(row=>row.children[3].value),['#abcdef',L.PALETTE.issue,'#123456']);
 list.children[2].dispatchEvent(createDragEvent('dragend'));
 assert.deepEqual(list.children.map(row=>row.children[3].value),['#123456','#abcdef',L.PALETTE.issue]);
 list.children[0].dispatchEvent(createDragEvent('dragstart'));list.children[2].dispatchEvent(createDragEvent('drop'));await waitForAsyncWork();
 assert.deepEqual(h.storedItems[L.KEY].items.map(x=>x.color),['#abcdef',L.PALETTE.issue,'#123456']);
});
test('new standard-named label starts neutral and deletion removes its color',async()=>{
 const h=await createPopupContext([]);
 const input=h.document.getElementById('new-label');input.value='praise';
 h.document.getElementById('label-form').dispatchEvent({type:'submit',preventDefault(){}});
 await waitForAsyncWork();assert.equal(rowPicker(h).value,L.NEUTRAL);
 pick(h,'#123456');await waitForAsyncWork();h.document.getElementById('label-list').children[0].children[4].click();
 await waitForAsyncWork();assert.deepEqual(h.storedItems[L.KEY].items,[]);
});
test('picker interaction prevents dragging without replacing text draft',async()=>{
 const h=await createPopupContext(['note']),row=h.document.getElementById('label-list').children[0],picker=rowPicker(h);
 picker.dispatchEvent({type:'pointerdown'});assert.equal(row.draggable,false);
 picker.dispatchEvent({type:'pointerup'});assert.equal(row.draggable,true);
 const event=createDragEvent('dragstart');event.target=picker;row.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 assert.equal(renderedLabelInputs(h.document)[0].value,'note');
});
test('last edit owns status, stale replies do not alter drafts and failed snapshot can retry',async()=>{
 const h=await createPopupContext(['note'],'dark',{delayed:true});
 pick(h,'#111111');pick(h,'#222222');
 assert.equal(h.document.getElementById('labels-status').textContent,'Сохранение…');
 h.pending[1]();await waitForAsyncWork();h.pending[0](false);await waitForAsyncWork();
 assert.equal(h.document.getElementById('labels-status').textContent,'Сохранено');assert.equal(rowPicker(h).value,'#222222');
 pick(h,'#333333');h.pending[2](false);await waitForAsyncWork();
 assert.equal(h.document.getElementById('labels-retry').hidden,false);
 assert.equal(rowPicker(h).value,'#333333');assert.equal(h.document.body.getAttribute('data-theme'),'dark');
 h.document.getElementById('labels-retry').click();h.pending[3]();await waitForAsyncWork();
 assert.equal(h.storedItems[L.KEY].items[0].color,'#333333');assert.equal(h.document.getElementById('labels-retry').hidden,true);
});
test('unknown storage schema blocks edits without replacing stored settings',async()=>{
 const stored={[L.KEY]:{schemaVersion:99}},h=await createPopupContext(undefined,undefined,{stored});
 assert.equal(h.getSetCallCount(),0);assert.equal(h.document.getElementById('new-label').disabled,true);
 assert.match(h.document.getElementById('labels-status').textContent,/версия/);assert.deepEqual(h.storedItems,stored);
});
const emojiButton=(h,index=0)=>h.document.getElementById('label-list').children[index].children[1];
const selectEmoji=async(h,value,index=0)=>{emojiButton(h,index).click();await waitForAsyncWork();h.document.getElementById('emoji-container').children[0].dispatchEvent({type:'emoji-click-sync',detail:{unicode:value}});await waitForAsyncWork();};
test('emoji toggle keeps individual choices editable and persists across reopen',async()=>{
 const h=await createPopupContext(['suggestion','same']);
 assert.equal(h.document.getElementById('emojis-enabled').checked,true);
 assert.equal(emojiButton(h).textContent,'💡');
 const toggle=h.document.getElementById('emojis-enabled');toggle.checked=false;toggle.dispatchEvent({type:'change'});
 await selectEmoji(h,'👩🏽‍💻');assert.equal(h.storedItems[L.KEY].emojisEnabled,false);
 emojiButton(h,1).click();h.document.getElementById('emoji-none').click();await waitForAsyncWork();
 const reopened=await createPopupContext(undefined,undefined,{stored:h.storedItems});
 assert.equal(reopened.document.getElementById('emojis-enabled').checked,false);assert.equal(emojiButton(reopened).textContent,'👩🏽‍💻');
 const enable=reopened.document.getElementById('emojis-enabled');enable.checked=true;enable.dispatchEvent({type:'change'});await waitForAsyncWork();
 assert.deepEqual(reopened.storedItems[L.KEY].items.map(x=>x.emoji),['👩🏽‍💻','']);
});
test('emoji cancellation restores focus, loading retries and rebuilding invalidates target',async()=>{
 let fail=true;const h=await createPopupContext(['note'],undefined,{pickerError:()=>fail});
 const opener=emojiButton(h);opener.click();await waitForAsyncWork();
 assert.equal(h.document.getElementById('emoji-retry').hidden,false);
 fail=false;h.document.getElementById('emoji-retry').click();await waitForAsyncWork();
 assert.equal(h.document.getElementById('emoji-retry').hidden,true);
 h.document.listeners.keydown({key:'Escape',preventDefault(){},stopPropagation(){}});
 assert.equal(h.document.activeElement,opener);assert.equal(opener.textContent,'📝');assert.equal(h.getSetCallCount(),0);
 opener.click();h.document.getElementById('label-list').children[0].children[4].click();await waitForAsyncWork();
 h.document.getElementById('emoji-container').children[0].dispatchEvent({type:'emoji-click-sync',detail:{unicode:'👍'}});await waitForAsyncWork();
 assert.deepEqual(h.storedItems[L.KEY].items,[]);assert.equal(h.document.getElementById('emoji-view').hidden,true);
});
test('duplicate emoji records survive rename, reorder and cancelled preview; picker cannot drag',async()=>{
 const h=await createPopupContext(['same','same']);await selectEmoji(h,'👍',0);await selectEmoji(h,'💡',1);
 const input=renderedLabelInputs(h.document)[0];input.value='renamed';input.dispatchEvent({type:'input'});await waitForAsyncWork();
 const list=h.document.getElementById('label-list');
 const event=createDragEvent('dragstart');event.target=emojiButton(h);list.children[0].dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 h.document.activeElement=null;
 list.children[0].dispatchEvent(createDragEvent('dragstart'));list.children[1].dispatchEvent(createDragEvent('dragover'));
 assert.deepEqual(list.children.map(row=>row.children[1].textContent),['💡','👍']);list.children[1].dispatchEvent(createDragEvent('dragend'));
 assert.deepEqual(list.children.map(row=>row.children[1].textContent),['👍','💡']);
 list.children[0].dispatchEvent(createDragEvent('dragstart'));list.children[1].dispatchEvent(createDragEvent('drop'));await waitForAsyncWork();
 assert.deepEqual(h.storedItems[L.KEY].items.map(x=>[x.text,x.emoji]),[['same','💡'],['renamed','👍']]);
});
test('late emoji save failure cannot roll back flag or latest choice; retry sends full snapshot',async()=>{
 const h=await createPopupContext(['note'],undefined,{delayed:true});
 await selectEmoji(h,'👍');const toggle=h.document.getElementById('emojis-enabled');toggle.checked=false;toggle.dispatchEvent({type:'change'});
 h.pending[1]();await waitForAsyncWork();h.pending[0](false);await waitForAsyncWork();
 assert.equal(h.document.getElementById('labels-status').textContent,'Сохранено');
 await selectEmoji(h,'💡');h.pending[2](false);await waitForAsyncWork();h.document.getElementById('labels-retry').click();h.pending[3]();await waitForAsyncWork();
 assert.equal(h.storedItems[L.KEY].emojisEnabled,false);assert.equal(h.storedItems[L.KEY].items[0].emoji,'💡');
});

test('delayed picker choice cannot write into a reopened row',async()=>{
 const h=await createPopupContext(['same','same']);emojiButton(h,0).click();await waitForAsyncWork();
 let resolve;const detail=new Promise(r=>{resolve=r;});
 h.document.getElementById('emoji-container').children[0].dispatchEvent({type:'emoji-click-sync',detail});
 h.document.getElementById('emoji-back').click();emojiButton(h,1).click();resolve({unicode:'💡'});await waitForAsyncWork();
 assert.equal(emojiButton(h,0).textContent,'＋');assert.equal(emojiButton(h,1).textContent,'＋');assert.equal(h.getSetCallCount(),0);
});
