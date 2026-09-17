const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  addEventListener(type, listener) {
    this.eventListeners.set(type, listener);
  }

  dispatchEvent(event) {
    const listener = this.eventListeners.get(event.type);
    if (listener) {
      listener(event);
    }
  }

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
      ["label-form", "form"],
      ["label-list", "div"],
      ["new-label", "input"]
    ]) {
      this.elements.set(id, new FakeElement(tagName, id));
    }
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  addEventListener() {}
}

function waitForAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function createPopupContext(initialLabels) {
  const document = new FakeDocument();
  const storedItems = {};
  if (initialLabels !== undefined) {
    storedItems.ccLabels = initialLabels;
  }

  const context = {
    document,
    chrome: {
      storage: {
        sync: {
          get(key, callback) {
            callback({ [key]: storedItems[key] });
          },
          set(items, callback) {
            Object.assign(storedItems, items);
            if (callback) {
              callback();
            }
          }
        }
      }
    }
  };

  vm.runInNewContext(popupScript, context);
  await waitForAsyncWork();

  return { document, storedItems };
}

function renderedLabelInputs(document) {
  return document
    .getElementById("label-list")
    .children.map((row) => row.children[0]);
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

test("popup persists edited labels", async () => {
  const { document, storedItems } = await createPopupContext(["suggestion"]);
  const [input] = renderedLabelInputs(document);

  input.value = "proposal";
  input.dispatchEvent({ type: "input" });
  await waitForAsyncWork();

  assert.deepEqual(storedItems.ccLabels, ["proposal"]);
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
  const deleteButton = document.getElementById("label-list").children[0].children[1];

  deleteButton.click();
  await waitForAsyncWork();

  assert.deepEqual(storedItems.ccLabels, []);
  assert.deepEqual(renderedLabelInputs(document), []);
});
