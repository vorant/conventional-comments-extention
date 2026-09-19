// Small deterministic DOM used by node:test. Layout and browser editing are not simulated.
class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.parentElement = null;
    this.attributes = new Map(); this.listeners = new Map(); this._text = ""; this.value = ""; this.disabled = false; this.readOnly = false;
  }
  get className() { return this.getAttribute("class") || ""; }
  set className(value) { this.setAttribute("class", value); }
  get textContent() { return this._text + this.children.map((e) => e.textContent).join(""); }
  set textContent(value) { this._text = String(value); for (const child of this.children) child.parentElement = null; this.children = []; }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children.at(-1) || null; }
  get nextSibling() { const list = this.parentElement?.children || []; return list[list.indexOf(this) + 1] || null; }
  get isConnected() { return !!this.ownerDocument?.contains(this); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node, ref) {
    node.remove();
    const index = ref ? this.children.indexOf(ref) : this.children.length;
    if (index < 0) throw new Error("Not a child");
    this.children.splice(index, 0, node); node.parentElement = this;
  }
  replaceChildren(...nodes) { for (const node of [...this.children]) node.remove(); this.append(...nodes); }
  remove() { if (this.parentElement) { const a = this.parentElement.children; a.splice(a.indexOf(this), 1); this.parentElement = null; } }
  contains(node) { return node === this || this.children.some((c) => c.contains(node)); }
  matches(selector) {
    if (!selector || (selector.match(/\[/g) || []).length !== (selector.match(/\]/g) || []).length) throw new Error("Invalid selector");
    return selector.split(",").some((s) => {
      let rest = s.trim();
      const attrs = [...rest.matchAll(/\[([\w-]+)(?:(\*=|=)"([^"]*)"( i)?)?\]/g)];
      rest = rest.replace(/\[[^\]]*\]/g, "");
      const tag = rest.match(/^[\w-]+/)?.[0];
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      for (const [, cls] of rest.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(cls)) return false;
      const id = rest.match(/#([\w-]+)/)?.[1]; if (id && this.getAttribute("id") !== id) return false;
      return attrs.every(([, key, op, expected, insensitive]) => {
        let value = this.getAttribute(key); if (value === null) return false;
        if (!op) return true;
        if (insensitive) { value = value.toLowerCase(); expected = expected.toLowerCase(); }
        return op === "=" ? value === expected : value.includes(expected);
      });
    });
  }
  closest(selector) { for (let e = this; e; e = e.parentElement) if (e.matches(selector)) return e; return null; }
  querySelectorAll(selector) {
    // Validate even for an empty subtree.
    this.matches(selector);
    const out = [];
    const walk = (e) => { for (const child of e.children) { if (child.matches(selector)) out.push(child); walk(child); } };
    walk(this); return out;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  dispatchEvent(event) { event.target ||= this; for (const fn of this.listeners.get(event.type) || []) fn(event); this.lastEvent = event; return true; }
  click() { if (!this.disabled) this.dispatchEvent({ type: "click", preventDefault() {} }); }
  focus() { this.ownerDocument.activeElement = this; this.focused = true; }
}
class Textarea extends Element {
  constructor(doc) { super("textarea", doc); this.selectionStart = 0; this.selectionEnd = 0; }
  get value() { return this._value || ""; }
  set value(v) { this._value = v; }
  setSelectionRange(a, b) { this.selectionStart = a; this.selectionEnd = b; }
}
class Document extends Element {
  constructor() {
    super("document"); this.ownerDocument = this; this.readyState = "complete";
    this.body = new Element("body", this); this.append(this.body);
    this.defaultView = { HTMLTextAreaElement: Textarea, InputEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } } };
  }
  createElement(tag) { return tag.toLowerCase() === "textarea" ? new Textarea(this) : new Element(tag, this); }
  getElementById(id) { return this.querySelector(`#${id}`); }
}
function parse(doc, html) {
  const stack = [doc.body];
  html = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
    if (token.startsWith("</")) { if (stack.length > 1) stack.pop(); continue; }
    if (token.startsWith("<!")) continue;
    if (!token.startsWith("<")) { stack.at(-1)._text += token.trim(); continue; }
    const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
    const node = doc.createElement(tag);
    for (const [, key, value] of token.matchAll(/([\w-]+)="([^"]*)"/g)) { node.setAttribute(key, value); if (key === "value") node.value = value; }
    stack.at(-1).append(node);
    if (!/^(input|link|meta|img|br|hr)$/.test(tag)) stack.push(node);
  }
  return doc;
}
module.exports = { Element, Textarea, Document, parse };
