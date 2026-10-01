(function () {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const P = globalThis.CCProfiles;
  const $ = (id) => document.getElementById(id);
  const fields = ["origin", "editorSelector", "placement", "paths"];
  const params = new URLSearchParams(location.search);
  const states = new Map();
  let selected;
  const key = (p) => JSON.stringify(fields.map((field) => p[field]));
  const draft = (p) => ({ ...p, paths: p.paths.join("\n") });
  async function send(message) {
    const result = await extensionApi.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "Cannot connect to the extension. Reload it.");
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
    if (!confirmed(state)) $("profile-access").textContent = "Save valid settings before allowing site access.";
    else access(state);
  }
  async function access(state) {
    const version = state.version, origin = valid(state).origin;
    let granted = false;
    try { granted = await extensionApi.permissions.contains({ origins: [P.originPattern(origin)] }); } catch { /* No permission. */ }
    if (selected !== state || version !== state.version || !confirmed(state)) return;
    $("profile-access").textContent = granted ? "Site access granted." : "No access. Allow site access to continue.";
  }
  function render(state) {
    selected = state;
    for (const field of fields) $("profile-" + field).value = state.draft[field];
    $("profile-list").value = state.draft.id;
    $("profile-warning").textContent = state.draft.id !== "github" ? "Preview profile: verify it on your site. For GitLab, use Markdown mode. The preset determines the editor type and placement." : "";
    $("profile-panelCss").value = state.css.draft;
    showCss(state);
    show(state);
  }
  function write(state, profile, reset = false) {
    const version = ++state.version;
    state.last = key(profile);
    state.pending = true; state.error = false; state.status = "Saving…";
    show(state);
    // Send immediately: the worker owns the queue even if the settings page closes.
    const request = send(reset ? { type: "cc-remove", id: profile.id } : { type: "cc-save", profile });
    request.then(() => {
      if (version !== state.version) return;
      state.saved = key(profile); state.pending = false; state.status = reset ? "Default profile settings restored." : "Saved";
      show(state);
    }, (error) => {
      if (version !== state.version) return;
      state.pending = false; state.last = null; state.error = true;
      state.status = `${error.message} Edit a field to retry saving.`;
      show(state);
    });
    return request;
  }
  function showCss(state) {
    if (selected !== state) return;
    $("profile-css-status").textContent = state.css.status;
    $("profile-css-status").setAttribute("data-error", String(state.css.error));
  }
  function beginCss(state, value) {
    state.css.draft = value;
    state.css.last = value;
    state.css.error = false;
    state.css.status = "Saving…";
    const version = ++state.css.version;
    showCss(state);
    return version;
  }
  function finishCss(state, version, request, reset) {
    request.then(() => {
      if (state.css.version !== version) return;
      state.css.status = reset ? "Default styles restored." : "Saved";
      showCss(state);
    }, (error) => {
      if (state.css.version !== version) return;
      state.css.last = null; state.css.error = true;
      state.css.status = `${error.message} Edit the CSS or retry resetting styles.`;
      showCss(state);
    });
  }
  function cssChanged() {
    const state = selected;
    if (!state) return;
    const value = $("profile-panelCss").value;
    if (value === state.css.last) return;
    const version = beginCss(state, value);
    finishCss(state, version, send({ type: "cc-save-css", id: state.draft.id, css: value }), false);
  }
  for (const event of ["input", "change"]) $("profile-panelCss").addEventListener(event, cssChanged);
  $("profile-css-reset").addEventListener("click", () => {
    const state = selected;
    if (!state) return;
    const version = beginCss(state, P.standardCss);
    $("profile-panelCss").value = state.css.draft;
    finishCss(state, version, send({ type: "cc-reset-css", id: state.draft.id }), true);
  });
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
    const version = beginCss(selected, P.standardCss);
    finishCss(selected, version, write(selected, profile, true), true);
    render(selected);
  });
  $("profile-connect").addEventListener("click", () => {
    const state = selected;
    if (!state) return;
    // Also check actual field values, so a stale address can never request access.
    if (fields.some((field) => $("profile-" + field).value !== state.draft[field]) || !confirmed(state)) return;
    const version = state.version;
    try {
      const request = extensionApi.permissions.request({ origins: [P.originPattern(valid(state).origin)] });
      Promise.resolve(request).then(async (granted) => {
        if (granted) await send({ type: "cc-refresh" });
        if (version !== state.version) return;
        state.status = granted ? "Access granted." : "Access not granted. Settings saved.";
        // Permission denial does not make the saved snapshot invalid.
        show(state);
      }).catch((error) => {
        if (version !== state.version) return;
        state.status = error.message; show(state);
      });
    } catch (error) { state.status = error.message; show(state); }
  });
  async function load() {
    const stored = await extensionApi.storage.local.get(P.KEY);
    for (const p of P.all(stored[P.KEY])) {
      states.set(p.id, { css: { draft: p.panelCss, last: p.panelCss, version: 0, error: false, status: "" }, draft: draft(p), saved: key(p), last: key(p), version: 0, pending: false, error: false, status: "" });
      const option = document.createElement("option"); option.value = p.id; option.textContent = p.name; $("profile-list").append(option);
    }
    render(states.get(params.get("profile")) || states.get("github"));
  }
  load().catch((error) => { $("profile-status").textContent = error.message; $("profile-status").setAttribute("data-error", "true"); });
})();
