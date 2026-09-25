(function (root) {
  "use strict";
  function target(editor, profile) {
    const container = profile.containerSelector ? editor.closest(profile.containerSelector) : editor.parentElement;
    if (!container) return { error: "container", detail: "No panel location found next to the editor. Check the editor selector; this site version may be incompatible with the preset." };
    let anchor = editor;
    if (profile.anchorSelector) {
      const candidates = [...container.querySelectorAll(profile.anchorSelector)];
      if (container.matches(profile.anchorSelector)) candidates.unshift(container);
      const editors = [...container.querySelectorAll(profile.editorSelector)];
      if (candidates.length !== 1 || editors.length !== 1) return { error: "anchor", detail: "Could not determine a unique panel location for this editor." };
      anchor = candidates[0];
    } else if (profile.anchorMode === "github-wrapper") {
      anchor = editor.closest('[class*="MarkdownInput-module__inputWrapper"]') || editor.closest("text-expander") || editor;
    }
    const inside = profile.placement === "prepend" || profile.placement === "append";
    const parent = inside ? anchor : anchor.parentElement;
    if (!container.contains(anchor) || !parent || parent.closest('[contenteditable="true"]') || (inside && /^(textarea|input|img|br|hr|select|option|button|iframe)$/i.test(anchor.tagName))) {
      return { error: "placement", detail: "The element does not support the selected panel position." };
    }
    return { anchor };
  }
  function inspect(doc, profile, adapters) {
    let editors;
    try { editors = [...doc.querySelectorAll(profile.editorSelector)].filter((e) => !e.closest('[data-cc-owned]')); }
    catch { return { status: "selector", detail: "Invalid editor CSS selector.", items: [] }; }
    const items = editors.map((editor) => {
      if (!adapters.supports(editor, profile.editorAdapter)) return { editor, error: "unsupported", detail: "The editor is incompatible with the site preset. Check the editor selector." };
      try { return { editor, ...target(editor, profile) }; }
      catch { return { editor, error: "selector", detail: "Could not determine the panel location using the site preset." }; }
    });
    const failed = items.find((i) => i.error);
    return { status: !items.length ? "no-editor" : failed ? failed.error : "ok", detail: failed?.detail, items };
  }
  function place(panel, anchor, placement) {
    if (placement === "before") anchor.parentElement.insertBefore(panel, anchor);
    else if (placement === "after") anchor.parentElement.insertBefore(panel, anchor.nextSibling);
    else if (placement === "prepend") anchor.insertBefore(panel, anchor.firstChild);
    else anchor.append(panel);
  }
  function inPlace(panel, anchor, placement) {
    if (placement === "before") return panel.nextSibling === anchor;
    if (placement === "after") return anchor.nextSibling === panel;
    if (placement === "prepend") return anchor.firstChild === panel;
    return anchor.lastChild === panel;
  }
  root.CCPanel = { target, inspect, place, inPlace };
  if (typeof module !== "undefined") module.exports = root.CCPanel;
})(globalThis);
