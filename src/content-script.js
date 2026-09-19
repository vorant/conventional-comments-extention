(function () {
  "use strict";
  if (globalThis.__ccLabelsStarted) return;
  globalThis.__ccLabelsStarted = true;
  const DEFAULT_LABELS = ["praise", "nitpick", "suggestion", "issue", "todo", "question", "thought", "chore", "note"];
  const P = globalThis.CCProfiles, A = globalThis.CCEditors, E = globalThis.CCPanel;
  const panels = new Map(), failures = new Map(), shown = new Set(), notices = new Map();
  let profiles = [], labels = DEFAULT_LABELS, signature = "", profile = null, scanTimer, retryTimer, loadId = 0;
  let lastHref = location.href;
  let noticeHost;
  function clearUI() {
    for (const [editor, value] of panels) { value.panel.remove(); editor.removeAttribute("data-cc-label-panel"); }
    panels.clear(); failures.clear();
    for (const notice of notices.values()) notice.remove();
    notices.clear();
    noticeHost?.remove(); noticeHost = null;
    clearTimeout(retryTimer);
  }
  function notice(key, detail) {
    const token = `${signature}:${key}`;
    if (shown.has(token)) return;
    shown.add(token);
    const box = document.createElement("div");
    box.className = "cc-profile-notice"; box.setAttribute("data-cc-owned", "true"); box.setAttribute("role", "status");
    const text = document.createElement("p"); text.textContent = `${profile.name}: ${detail}`;
    const settings = document.createElement("button"); settings.type = "button"; settings.textContent = "Открыть настройки профиля";
    const profileId = profile.id;
    settings.addEventListener("click", () => chrome.runtime.sendMessage({ type: "cc-open-settings", id: profileId }).catch(() => {}));
    const close = document.createElement("button"); close.type = "button"; close.textContent = "Закрыть";
    close.addEventListener("click", () => { box.remove(); notices.delete(key); });
    box.append(text, settings, close);
    if (!noticeHost?.isConnected) {
      noticeHost = document.createElement("div"); noticeHost.className = "cc-profile-notices";
      noticeHost.setAttribute("data-cc-owned", "true"); document.body.append(noticeHost);
    }
    noticeHost.append(box); notices.set(key, box);
  }
  function createPanel(editor) {
    const panel = document.createElement("div"); panel.className = "cc-label-panel";
    panel.setAttribute("data-cc-owned", "true"); panel.setAttribute("aria-label", "Conventional Comments labels");
    const current = profile;
    for (const label of labels) {
      const button = document.createElement("button"); button.type = "button"; button.className = "cc-label-button"; button.textContent = `${label}:`;
      button.addEventListener("click", () => {
        try { A.insert(editor, label, current.editorAdapter); }
        catch (error) { notice("insert", error.message); }
      });
      panel.append(button);
    }
    return panel;
  }
  function scan() {
    scanTimer = null;
    const selected = P.select(profiles, location.href);
    const nextSignature = selected ? JSON.stringify(selected) : "";
    if (nextSignature !== signature) { clearUI(); profile = selected; signature = nextSignature; }
    if (!profile || !labels.length) { clearUI(); return; }
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
      if (existing && existing.anchor === anchor && E.inPlace(existing.panel, anchor, profile.placement)) continue;
      if (existing) existing.panel.remove();
      const panel = createPanel(editor);
      E.place(panel, anchor, profile.placement);
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
        chrome.runtime.sendMessage({ type: "cc-config" }), chrome.storage.sync.get("ccLabels")
      ]);
      if (id !== loadId) return;
      if (!response?.ok) throw new Error("Профили недоступны");
      profiles = response.profiles;
      const nextLabels = Array.isArray(stored.ccLabels) ? stored.ccLabels.filter((l) => typeof l === "string").map((l) => l.trim()).filter(Boolean) : DEFAULT_LABELS;
      if (JSON.stringify(nextLabels) !== JSON.stringify(labels)) clearUI();
      labels = nextLabels; scan();
    } catch { if (id === loadId) { profiles = []; clearUI(); } }
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type === "cc-ping") { respond({ ok: true }); return; }
    if (message.type === "cc-reload") { reload().then(() => respond({ ok: true })); return true; }
    if (message.type === "cc-stop") { ++loadId; profiles = []; profile = null; signature = ""; clearUI(); respond({ ok: true }); return; }
    if (message.type === "cc-inspect") {
      const p = profiles.find((candidate) => candidate.id === message.id);
      if (!p) { respond({ status: "no-access" }); return; }
      if (!P.matches(p, location.href)) { respond({ status: "wrong-url" }); return; }
      const result = E.inspect(document, p, A);
      respond({ status: result.status, detail: result.detail, count: result.items.length,
        valid: result.items.filter((i) => !i.error).length });
    }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.ccLabels || area === "local" && changes[P.KEY]) reload();
  });
  function start() {
    const observer = new MutationObserver((changes) => {
      if (changes.some((change) => !change.target.closest?.('[data-cc-owned]'))) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "name", "aria-label", "placeholder", "contenteditable", "disabled", "readonly"] });
    window.addEventListener("popstate", schedule);
    // Also covers pushState/replaceState from isolated-world content scripts.
    setInterval(() => { if (location.href !== lastHref) { lastHref = location.href; schedule(); } }, 500);
    reload();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
