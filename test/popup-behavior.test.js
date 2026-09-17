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
    this.eventListeners.set(type, listener);
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
      ["theme-toggle", "button"],
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

async function createPopupContext(initialLabels, initialTheme) {
  const document = new FakeDocument();
  const storedItems = {};
  let setCallCount = 0;
  if (initialLabels !== undefined) {
    storedItems.ccLabels = initialLabels;
  }
  if (initialTheme !== undefined) {
    storedItems.ccTheme = initialTheme;
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

  vm.runInNewContext(popupScript, context);
  await waitForAsyncWork();

  return { document, getSetCallCount: () => setCallCount, storedItems };
}

function renderedLabelInputs(document) {
  return document
    .getElementById("label-list")
    .children.map((row) => row.children[1]);
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
});

test("popup applies a saved dark theme", async () => {
  const { document } = await createPopupContext(["suggestion"], "dark");
  const toggle = document.getElementById("theme-toggle");

  assert.equal(document.body.getAttribute("data-theme"), "dark");
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
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
  const deleteButton = document.getElementById("label-list").children[0].children[2];

  deleteButton.click();
  await waitForAsyncWork();

  assert.deepEqual(storedItems.ccLabels, []);
  assert.deepEqual(renderedLabelInputs(document), []);
});

test("popup delete control is a red icon-only trash button", async () => {
  const { document } = await createPopupContext(["todo"]);
  const deleteButton = document.getElementById("label-list").children[0].children[2];

  assert.match(deleteButton.className, /delete-button/);
  assert.match(deleteButton.className, /nf-icon/);
  assert.equal(deleteButton.getAttribute("aria-label"), "Удалить label");
  assert.equal(deleteButton.getAttribute("title"), "Удалить label");
  assert.notEqual(deleteButton.textContent, "Delete");
  assert.ok(deleteButton.textContent.length > 0);
});
