"use strict";
importScripts("panel-styles.js", "site-profiles.js", "label-settings.js");
const P = globalThis.CCProfiles, L = globalThis.CCLabels;
const FILES = ["src/panel-styles.js", "src/label-settings.js", "src/site-profiles.js", "src/editor-adapters.js", "src/panel-engine.js", "src/content-script.js"];
const CSS = ["src/content-style.css"];
let queue = Promise.resolve();
const serial = (action) => { const result = queue.then(action); queue = result.catch(() => {}); return result; };
async function data() { return P.config((await chrome.storage.local.get(P.KEY))[P.KEY]); }
async function allowed(profiles) {
  const result = [];
  for (const p of profiles) if (p.enabled && await chrome.permissions.contains({ origins: [P.originPattern(p.origin)] })) result.push(p);
  return result;
}
async function ensureTab(tab) {
  try { await chrome.tabs.sendMessage(tab.id, { type: "cc-ping" }); }
  catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: CSS });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: FILES });
  }
  await chrome.tabs.sendMessage(tab.id, { type: "cc-reload" });
}
async function reconcile() {
  const profiles = await allowed(P.all(await data()));
  const patterns = [...new Set(profiles.filter((p) => p.origin !== "https://github.com").map((p) => P.originPattern(p.origin)))].sort();
  const current = await chrome.scripting.getRegisteredContentScripts();
  const own = current.filter((s) => s.id === "cc-sites");
  if (JSON.stringify(own[0]?.matches || []) !== JSON.stringify(patterns) ||
      (own.length && JSON.stringify(own[0].js) !== JSON.stringify(FILES))) {
    if (own.length) await chrome.scripting.unregisterContentScripts({ ids: ["cc-sites"] });
    if (patterns.length) await chrome.scripting.registerContentScripts([{ id: "cc-sites", matches: patterns, excludeMatches: ["https://github.com/*"], js: FILES, css: CSS, runAt: "document_idle", persistAcrossSessions: true }]);
  }
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map(async (tab) => {
    let origin;
    try { origin = new URL(tab.url).origin; } catch { /* URL can be hidden after permission revocation. */ }
    if (profiles.some((p) => p.origin === origin)) await ensureTab(tab);
    else { try { await chrome.tabs.sendMessage(tab.id, { type: "cc-stop" }); } catch { /* No injected context. */ } }
  }));
}
// Coalesce picker input in the worker so closing the popup cannot cancel accepted work.
// Space writes below sync's hourly quota as well as its per-minute burst limit.
let labelPending, labelWriting = false, labelTimer, labelLastWrite = -Infinity;
function saveLabels(items) {
  const value = L.snapshot(items);
  return new Promise((resolve, reject) => {
    const waiters = labelPending?.waiters || [];
    waiters.push({ resolve, reject });
    labelPending = { value, waiters };
    scheduleLabels();
  });
}
function scheduleLabels() {
  if (labelWriting || !labelPending) return;
  clearTimeout(labelTimer);
  labelTimer = setTimeout(flushLabels, Math.max(180, 2100 - (Date.now() - labelLastWrite)));
}
async function flushLabels() {
  const batch = labelPending;
  labelPending = null;
  labelWriting = true;
  try {
    // Refuse to overwrite an unknown schema even if it arrived since popup load.
    L.read(await chrome.storage.sync.get(L.KEYS));
    labelLastWrite = Date.now();
    await chrome.storage.sync.set(batch.value);
    for (const waiter of batch.waiters) waiter.resolve({ ok: true });
  } catch (error) {
    for (const waiter of batch.waiters) waiter.reject(error);
  } finally {
    labelWriting = false;
    scheduleLabels();
  }
}

function extensionPage(sender) { return !sender.tab || sender.url?.startsWith(chrome.runtime.getURL("")); }
async function handle(message, sender) {
  if (message.type === "cc-config") return { ok: true, profiles: await allowed(P.all(await data())) };
  if (message.type === "cc-open-settings") {
    const profiles = P.all(await data());
    if (!profiles.some((p) => p.id === message.id)) throw new Error("Профиль не найден.");
    await chrome.tabs.create({ url: chrome.runtime.getURL(`src/options.html?profile=${encodeURIComponent(message.id)}`) });
    return { ok: true };
  }
  if (!extensionPage(sender)) throw new Error("Действие доступно только в настройках расширения.");
  if (message.type === "cc-save-labels") return saveLabels(message.items);
  if (message.type === "cc-refresh") { await serial(reconcile); return { ok: true }; }
  if (["cc-save", "cc-remove", "cc-save-css", "cc-reset-css"].includes(message.type)) {
    return serial(async () => {
      const old = await data();
      const next = message.type === "cc-save" ? P.save(old, P.validate(message.profile, P.all(old)))
        : message.type === "cc-remove" ? P.remove(old, message.id)
        : P.saveCss(old, message.id, message.css, message.type === "cc-reset-css");
      await chrome.storage.local.set({ [P.KEY]: next });
      await reconcile();
      return { ok: true };
    });
  }
  throw new Error("Неизвестная команда.");
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (!message?.type?.startsWith("cc-")) return;
  handle(message, sender).then(respond, (error) => respond({ ok: false, error: error.message }));
  return true;
});
const sync = () => serial(reconcile).catch((error) => console.error("Conventional Comments:", error));
chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
chrome.permissions.onAdded.addListener(sync);
chrome.permissions.onRemoved.addListener(sync);
chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes[P.KEY]) sync(); });
sync();
