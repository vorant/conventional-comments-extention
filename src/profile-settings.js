(function () {
  "use strict";
  const P = globalThis.CCProfiles;
  const $ = (id) => document.getElementById(id);
  const fields = ["origin", "editorSelector", "placement", "paths"];
  const params = new URLSearchParams(location.search);
  const states = new Map();
  let selected;
  const key = (p) => JSON.stringify(fields.map((field) => p[field]));
  const draft = (p) => ({ ...p, paths: p.paths.join("\n") });
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "Нет связи с расширением. Перезагрузите его.");
  }
  function valid(state) {
    return P.validate({ ...state.draft, paths: state.draft.paths.split("\n").map((s) => s.trim()).filter(Boolean) }, [], document);
  }
  function confirmed(state) {
    try { return !state.pending && !state.error && key(valid(state)) === state.saved; } catch { return false; }
  }
  function show(state) {
    if (selected !== state) return;
    $("profile-status").textContent = state.status;
    $("profile-status").setAttribute("data-error", String(state.error));
    $("profile-connect").disabled = !confirmed(state);
    if (!confirmed(state)) $("profile-access").textContent = "Доступ можно разрешить после сохранения корректных настроек.";
    else access(state);
  }
  async function access(state) {
    const version = state.version, origin = valid(state).origin;
    let granted = false;
    try { granted = await chrome.permissions.contains({ origins: [P.originPattern(origin)] }); } catch { /* No permission. */ }
    if (selected !== state || version !== state.version || !confirmed(state)) return;
    $("profile-access").textContent = granted ? "Доступ к сайту разрешён." : "Нет доступа. Разрешите доступ к сайту.";
  }
  function render(state) {
    selected = state;
    for (const field of fields) $("profile-" + field).value = state.draft[field];
    $("profile-list").value = state.draft.id;
    $("profile-warning").textContent = state.draft.id !== "github" ? "Предварительный профиль: проверьте вручную на вашем сайте. Для GitLab выберите Markdown-режим. Тип редактора и размещение определяются предустановкой." : "";
    show(state);
  }
  function write(state, profile, reset = false) {
    const version = ++state.version;
    state.last = key(profile);
    state.pending = true; state.error = false; state.status = "Сохранение…";
    show(state);
    // Send immediately: the worker owns the queue even if the popup closes.
    send(reset ? { type: "cc-remove", id: profile.id } : { type: "cc-save", profile }).then(() => {
      if (version !== state.version) return;
      state.saved = key(profile); state.pending = false; state.status = reset ? "Встроенные настройки восстановлены." : "Сохранено";
      show(state);
    }, (error) => {
      if (version !== state.version) return;
      state.pending = false; state.last = null; state.error = true;
      state.status = `${error.message} Измените поле, чтобы повторить сохранение.`;
      show(state);
    });
  }
  function changed() {
    const state = selected;
    if (!state) return;
    for (const field of fields) state.draft[field] = $("profile-" + field).value;
    let profile;
    try { profile = valid(state); }
    catch (error) {
      ++state.version; state.last = null; state.pending = false; state.error = true; state.status = error.message;
      show(state); return;
    }
    if (key(profile) === state.last) return;
    write(state, profile);
  }
  for (const field of fields) for (const event of ["input", "change"]) $("profile-" + field).addEventListener(event, changed);
  $("profile-form").addEventListener("submit", (event) => event.preventDefault());
  $("profile-list").addEventListener("change", () => render(states.get($("profile-list").value)));
  $("profile-reset").addEventListener("click", () => {
    if (!selected) return;
    const profile = P.defaults.find((p) => p.id === selected.draft.id);
    selected.draft = draft(profile);
    write(selected, profile, true);
    render(selected);
  });
  $("profile-connect").addEventListener("click", () => {
    const state = selected;
    if (!state) return;
    // Also check actual field values, so a stale address can never request access.
    if (fields.some((field) => $("profile-" + field).value !== state.draft[field]) || !confirmed(state)) return;
    const version = state.version;
    try {
      const request = chrome.permissions.request({ origins: [P.originPattern(valid(state).origin)] });
      Promise.resolve(request).then(async (granted) => {
        if (granted) await send({ type: "cc-refresh" });
        if (version !== state.version) return;
        state.status = granted ? "Доступ разрешён." : "Доступ не предоставлен. Настройки сохранены.";
        // Permission denial does not make the saved snapshot invalid.
        show(state);
      }).catch((error) => {
        if (version !== state.version) return;
        state.status = error.message; show(state);
      });
    } catch (error) { state.status = error.message; show(state); }
  });
  async function load() {
    const stored = await chrome.storage.local.get(P.KEY);
    for (const p of P.all(stored[P.KEY])) {
      states.set(p.id, { draft: draft(p), saved: key(p), last: key(p), version: 0, pending: false, error: false, status: "" });
      const option = document.createElement("option"); option.value = p.id; option.textContent = p.name; $("profile-list").append(option);
    }
    render(states.get(params.get("profile")) || states.get("github"));
  }
  if (params.has("profile")) $("site-settings").open = true;
  load().catch((error) => { $("profile-status").textContent = error.message; $("profile-status").setAttribute("data-error", "true"); });
})();
