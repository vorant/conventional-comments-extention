(function (root) {
  "use strict";
  function supports(editor, kind) {
    if (editor.disabled || editor.readOnly) return false;
    return kind === "textarea" ? editor.tagName.toLowerCase() === "textarea" :
      kind === "rich-text" && editor.getAttribute("contenteditable") === "true" && typeof editor.ownerDocument.execCommand === "function";
  }
  function insert(editor, label, kind) {
    if (!supports(editor, kind)) throw new Error("Этот редактор не поддерживается выбранным способом вставки.");
    const prefix = `${label}: `;
    editor.focus();
    if (kind === "textarea") {
      const value = editor.value.startsWith(prefix) ? editor.value : prefix + editor.value;
      const win = editor.ownerDocument.defaultView;
      const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")?.set;
      if (setter) setter.call(editor, value); else editor.value = value;
      editor.setSelectionRange(prefix.length, prefix.length);
      editor.dispatchEvent(new win.InputEvent("input", { bubbles: true, inputType: "insertText", data: prefix }));
      return;
    }
    // Use the browser editing operation, never replace rich-text HTML or framework state.
    const doc = editor.ownerDocument, selection = doc.getSelection(), range = doc.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    if (!(editor.textContent || "").startsWith(prefix)) {
      if (!doc.execCommand("insertText", false, prefix)) throw new Error("Редактор отклонил вставку. Этот редактор несовместим с предустановкой сайта.");
    } else {
      const walker = doc.createTreeWalker(editor, 4);
      let remaining = prefix.length, node;
      while ((node = walker.nextNode())) {
        if (remaining <= node.textContent.length) {
          range.setStart(node, remaining); range.collapse(true);
          selection.removeAllRanges(); selection.addRange(range); break;
        }
        remaining -= node.textContent.length;
      }
    }
  }
  root.CCEditors = { supports, insert };
  if (typeof module !== "undefined") module.exports = root.CCEditors;
})(globalThis);
