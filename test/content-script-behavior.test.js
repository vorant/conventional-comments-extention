const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");
const contentScript = fs.readFileSync(path.join(rootDir, "src/content-script.js"), "utf8");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toLowerCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.className = "";
    this.textContent = "";
    this.eventListeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  insertBefore(child, reference) {
    const index = this.children.indexOf(reference);
    assert.notEqual(index, -1);
    child.parentElement = this;
    this.children.splice(index, 0, child);
  }

  addEventListener(type, listener) {
    this.eventListeners.set(type, listener);
  }

  dispatchEvent(event) {
    this.lastEvent = event;
    return true;
  }

  click() {
    const listener = this.eventListeners.get("click");
    if (listener) {
      listener();
    }
  }

  focus() {
    this.focused = true;
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.className.split(/\s+/).includes(selector.slice(1));
    }

    const classContains = selector.match(/^\[class\*="([^"]+)"\]$/);
    if (classContains) {
      return this.className.includes(classContains[1]);
    }

    return this.tagName === selector.toLowerCase();
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];

    function walk(node) {
      for (const child of node.children) {
        if (child.matches(selector)) {
          found.push(child);
        }
        walk(child);
      }
    }

    walk(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class FakeTextarea extends FakeElement {
  constructor() {
    super("textarea");
    this.value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("document");
    this.body = new FakeElement("body");
    this.readyState = "complete";
    this.children = [this.body];
    this.body.parentElement = this;
  }

  createElement(tagName) {
    if (tagName.toLowerCase() === "textarea") {
      return new FakeTextarea();
    }

    return new FakeElement(tagName);
  }
}

function createContext({
  hostname = "github.com",
  pathname = "/owner/repo/pull/1/files",
  storedLabels
} = {}) {
  const document = new FakeDocument();
  const observers = [];

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }

    observe() {}
  }

  const context = {
    document,
    window: {
      location: {
        hostname,
        pathname
      }
    },
    HTMLElement: FakeElement,
    HTMLTextAreaElement: FakeTextarea,
    InputEvent: class FakeInputEvent {
      constructor(type, init) {
        this.type = type;
        Object.assign(this, init);
      }
    },
    MutationObserver: FakeMutationObserver
  };

  if (storedLabels !== undefined) {
    context.chrome = {
      storage: {
        sync: {
          get(key, callback) {
            callback({ [key]: storedLabels });
          }
        }
      }
    };
  }

  context.window.document = document;
  return { context, document, observers };
}

function waitForAsyncWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function createGitHubCommentForm(document) {
  const form = document.createElement("form");
  form.className = "js-previewable-comment-form";

  const expander = document.createElement("text-expander");
  const textarea = document.createElement("textarea");
  textarea.setAttribute("name", "comment[body]");

  expander.append(textarea);
  form.append(expander);
  return { form, textarea };
}

function createModernGitHubCommentForm(document) {
  const editor = document.createElement("div");
  editor.className = "MarkdownEditor-module__container__H4O8J";

  const inputWrapper = document.createElement("div");
  inputWrapper.className = "MarkdownInput-module__inputWrapper__vOI3M";

  const textAreaWrapper = document.createElement("span");
  textAreaWrapper.className = "MarkdownInput-module__textArea__BRDa8 prc-components-TextInputBaseWrapper-wY-n0";

  const textarea = document.createElement("textarea");
  textarea.setAttribute("aria-label", "Markdown value");
  textarea.setAttribute("placeholder", "Leave a comment");

  textAreaWrapper.append(textarea);
  inputWrapper.append(textAreaWrapper);
  editor.append(inputWrapper);

  return { editor, inputWrapper, textAreaWrapper, textarea };
}

test("adds label panel to an existing GitHub pull request comment textarea", async () => {
  const { context, document } = createContext();
  const { form, textarea } = createGitHubCommentForm(document);
  document.body.append(form);

  vm.runInNewContext(contentScript, context);
  await waitForAsyncWork();

  const panel = form.querySelector(".cc-label-panel");
  assert.ok(panel);
  assert.equal(panel.children.length, 9);

  const suggestionButton = panel.children.find((button) => button.textContent === "suggestion:");
  suggestionButton.click();

  assert.equal(textarea.value, "suggestion: ");
  assert.equal(textarea.selectionStart, "suggestion: ".length);
  assert.ok(textarea.focused);
});

test("places the panel above the modern GitHub textarea wrapper", async () => {
  const { context, document } = createContext();
  const { editor, inputWrapper, textAreaWrapper, textarea } = createModernGitHubCommentForm(document);
  document.body.append(editor);

  vm.runInNewContext(contentScript, context);
  await waitForAsyncWork();

  const panel = editor.querySelector(".cc-label-panel");
  assert.ok(panel);
  assert.equal(editor.children[0], panel);
  assert.equal(editor.children[1], inputWrapper);
  assert.equal(textAreaWrapper.children[0], textarea);
});

test("inserts selected label before existing text", async () => {
  const { context, document } = createContext();
  const { form, textarea } = createGitHubCommentForm(document);
  textarea.value = "Нужно уточнить поведение.";
  document.body.append(form);

  vm.runInNewContext(contentScript, context);
  await waitForAsyncWork();

  const panel = form.querySelector(".cc-label-panel");
  const questionButton = panel.children.find((button) => button.textContent === "question:");
  questionButton.click();

  assert.equal(textarea.value, "question: Нужно уточнить поведение.");
});

test("does not add UI outside github.com pull requests", () => {
  const { context, document } = createContext({
    hostname: "gitlab.com",
    pathname: "/owner/repo/-/merge_requests/1"
  });
  const { form } = createGitHubCommentForm(document);
  document.body.append(form);

  vm.runInNewContext(contentScript, context);

  assert.equal(form.querySelector(".cc-label-panel"), null);
});

test("handles dynamically added comment forms once", async () => {
  const { context, document, observers } = createContext();
  vm.runInNewContext(contentScript, context);

  const { form, textarea } = createGitHubCommentForm(document);
  document.body.append(form);

  observers[0].callback([{ addedNodes: [form] }]);
  observers[0].callback([{ addedNodes: [form] }]);
  await waitForAsyncWork();

  assert.equal(form.querySelectorAll(".cc-label-panel").length, 1);
  assert.equal(textarea.getAttribute("data-cc-label-panel"), "true");
});

test("renders saved custom labels and inserts the selected value", async () => {
  const { context, document } = createContext({ storedLabels: ["proposal", "idea💡"] });
  const { form, textarea } = createGitHubCommentForm(document);
  document.body.append(form);

  vm.runInNewContext(contentScript, context);
  await waitForAsyncWork();

  const panel = form.querySelector(".cc-label-panel");
  assert.equal(panel.children.length, 2);

  const ideaButton = panel.children.find((button) => button.textContent === "idea💡:");
  ideaButton.click();

  assert.equal(textarea.value, "idea💡: ");
});

test("does not render an empty panel for an intentionally empty label list", async () => {
  const { context, document, observers } = createContext({ storedLabels: [] });
  const { form, textarea } = createGitHubCommentForm(document);
  document.body.append(form);

  vm.runInNewContext(contentScript, context);
  await waitForAsyncWork();

  assert.equal(form.querySelector(".cc-label-panel"), null);
  assert.equal(textarea.getAttribute("data-cc-label-panel"), "true");

  observers[0].callback([{ addedNodes: [form] }]);
  await waitForAsyncWork();

  assert.equal(form.querySelectorAll(".cc-label-panel").length, 0);
});
