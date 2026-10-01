(function () {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  if (globalThis.__ccLabelsStarted) return;
  globalThis.__ccLabelsStarted = true;
  const L = globalThis.CCLabels;
  const P = globalThis.CCProfiles, A = globalThis.CCEditors, E = globalThis.CCPanel;
  const panels = new Map(), failures = new Map(), shown = new Set(), notices = new Map();
  let profiles = [], labels = L.defaults(), emojisEnabled = true, signature = "", profile = null, scanTimer, retryTimer, loadId = 0;
  let lastHref = location.href;
  let noticeHost, panelStyle;
  function updateStyle() {
    if (!panelStyle?.isConnected) {
      panelStyle = document.createElement("style");
      panelStyle.setAttribute("data-cc-owned", "true");
      panelStyle.setAttribute("data-cc-panel-style", "true");
      (document.head || document.body).append(panelStyle);
    }
    const css = typeof profile.panelCss === "string" ? profile.panelCss : P.standardCss;
    if (panelStyle.textContent !== css) panelStyle.textContent = css;
  }
  function clearUI() {
    panelStyle?.remove(); panelStyle = null;
    for (const [editor, value] of panels) { value.panel.remove(); editor.removeAttribute("data-cc-label-panel"); }
    panels.clear(); failures.clear();
    for (const notice of notices.values()) notice.remove();
    notices.clear();
    noticeHost?.remove(); noticeHost = null;
    clearTimeout(retryTimer);
  }
  function notice(key, detail) {
    const token = `${signature}:${key}`;
    if (shown.has(token) || notices.has(key)) return;
    shown.add(token);
    const box = document.createElement("div");
    box.className = "cc-profile-notice"; box.setAttribute("data-cc-owned", "true"); box.setAttribute("role", "status");
    const text = document.createElement("p"); text.textContent = `${profile.name}: ${detail}`;
    const settings = document.createElement("button"); settings.type = "button"; settings.textContent = "Open profile settings";
    const profileId = profile.id;
    settings.addEventListener("click", () => extensionApi.runtime.sendMessage({ type: "cc-open-settings", id: profileId }).catch(() => {}));
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Close";
    close.addEventListener("click", () => { box.remove(); notices.delete(key); });
    box.append(text, settings, close);
    if (!noticeHost?.isConnected) {
      noticeHost = document.createElement("div"); noticeHost.className = "cc-profile-notices";
      noticeHost.setAttribute("data-cc-owned", "true"); document.body.append(noticeHost);
    }
    noticeHost.append(box); notices.set(key, box);
  }
  const buttonColors = new WeakMap();
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  function darkScheme(editor) {
    const scheme = getComputedStyle(editor.parentElement || editor).colorScheme.split(/\s+/);
    if (scheme.includes("dark") && !scheme.includes("light")) return true;
    if (scheme.includes("light") && !scheme.includes("dark")) return false;
    return systemTheme.matches;
  }
  function colorPanel(panel, editor) {
    const dark = darkScheme(editor);
    Array.from(panel.children).forEach((button, index) => {
      const shades = L.shades(labels[index].color, dark);
      const text = L.display(labels[index], emojisEnabled) + ":";
      if (button.textContent !== text) button.textContent = text;
      // Inline important wins over profile CSS, including hover/focus and gradients.
      // Color transitions must not briefly reveal the overridden profile color.
      const previous = buttonColors.get(button) || {};
      const styles = { color: shades.foreground, background: shades.background, "border-color": shades.border };
      for (const [property, value] of Object.entries(styles)) {
        if (previous[property] === value) continue;
        button.style.setProperty(property, value, "important");
      }
      buttonColors.set(button, styles);
    });
  }
  function createPanel(editor) {
    const panel = document.createElement("div"); panel.className = "cc-label-panel";
    panel.setAttribute("data-cc-owned", "true"); panel.setAttribute("aria-label", "Conventional Comments labels");
    const current = profile;
    for (const [index, label] of labels.entries()) {
      const button = document.createElement("button"); button.type = "button"; button.className = "cc-label-button"; button.textContent = L.display(label, emojisEnabled) + ":";
      button.style.setProperty("transition-property", "none", "important");
      button.addEventListener("click", () => {
        try { A.insert(editor, L.prefix(labels[index], emojisEnabled), current.editorAdapter); }
        catch (error) { notice("insert", error.message); }
      });
      panel.append(button);
    }
    return panel;
  }
  function scan() {
    scanTimer = null;
    const selected = P.select(profiles, location.href);
    const nextSignature = selected ? JSON.stringify({ ...selected, panelCss: undefined, revision: undefined }) : "";
    if (profile?.revision !== selected?.revision) shown.clear();
    if (nextSignature !== signature) { clearUI(); signature = nextSignature; }
    profile = selected;
    if (!profile || !labels.length) { clearUI(); return; }
    updateStyle();
    const result = E.inspect(document, profile, A), live = new Set(result.items.map((i) => i.editor));
    const errorKeys = new Set();
    for (const [editor, value] of panels) {
      if (!live.has(editor) || !value.panel.isConnected) { value.panel.remove(); editor.removeAttribute("data-cc-label-panel"); panels.delete(editor); }
    }
    let retry = false;
    for (const item of result.items) {
      const { editor, anchor, error, detail } = item;
      const existing = panels.get(editor);
      if (error) {
        if (existing) { existing.panel.remove(); editor.removeAttribute("data-cc-label-panel"); panels.delete(editor); }
        if (error === "unsupported") continue;
        errorKeys.add(error);
        const failure = failures.get(editor);
        if (!failure || failure.error !== error) failures.set(editor, { error, since: Date.now() });
        if (Date.now() - failures.get(editor).since >= 500) notice(error, detail);
        else retry = true;
        continue;
      }
      failures.delete(editor);
      if (existing && existing.anchor === anchor && E.inPlace(existing.panel, anchor, profile.placement)) { colorPanel(existing.panel, editor); continue; }
      if (existing) existing.panel.remove();
      const panel = createPanel(editor);
      E.place(panel, anchor, profile.placement);
      colorPanel(panel, editor);
      editor.setAttribute("data-cc-label-panel", "true"); panels.set(editor, { panel, anchor });
    }
    for (const editor of failures.keys()) if (!live.has(editor)) failures.delete(editor);
    for (const [key, box] of notices) if (key !== "insert" && !errorKeys.has(key)) { box.remove(); notices.delete(key); }
    clearTimeout(retryTimer);
    if (retry) retryTimer = setTimeout(scan, 510);
  }
  function schedule() { if (!scanTimer) scanTimer = setTimeout(scan, 30); }
  async function reload() {
    const id = ++loadId;
    try {
      const [response, stored] = await Promise.all([
        extensionApi.runtime.sendMessage({ type: "cc-config" }), extensionApi.storage.sync.get(L.KEYS)
      ]);
      if (id !== loadId) return;
      if (!response?.ok) throw new Error("Profiles are unavailable");
      profiles = response.profiles;
      let nextLabels;
      try { const settings = L.readSettings(stored); nextLabels = settings.items; emojisEnabled = settings.emojisEnabled; }
      catch { nextLabels = L.legacy(stored[L.LEGACY_KEY]); emojisEnabled = true; }
      if (JSON.stringify(nextLabels.map((l) => l.text)) !== JSON.stringify(labels.map((l) => l.text))) clearUI();
      labels = nextLabels; scan();
    } catch { if (id === loadId) { profiles = []; clearUI(); } }
  }
  extensionApi.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === "cc-ping") { respond({ ok: true }); return; }
    if (message.type === "cc-reload") { reload().then(() => respond({ ok: true })); return true; }
    if (message.type === "cc-stop") { ++loadId; profiles = []; profile = null; signature = ""; clearUI(); respond({ ok: true }); return; }

  });
  extensionApi.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes[L.KEY] || changes[L.LEGACY_KEY]) || area === "local" && changes[P.KEY]) reload();
  });
  function start() {
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => !change.target.closest?.('[data-cc-owned]'))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "name", "aria-label", "placeholder", "contenteditable", "disabled", "readonly"] });
    const themeObserver = new MutationObserver(schedule);
    for (const element of [document.documentElement, document.body]) {
      themeObserver.observe(element, { attributes: true, attributeFilter: ["class", "style", "data-theme", "data-color-mode", "data-dark-theme", "data-light-theme"] });
    }
    systemTheme.addEventListener("change", schedule);
    window.addEventListener("popstate", schedule);
    // Also covers pushState/replaceState from isolated-world content scripts.
    setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; schedule(); } }, 500);
    reload();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
