(function () {
  "use strict";
  const P = globalThis.CCProfiles;
  const $ = (id) => document.getElementById(id);
  const fields = ["name", "origin", "editorSelector", "containerSelector", "anchorSelector", "placement", "editorAdapter", "anchorMode"];
  const params = new URLSearchParams(location.search);
  let profiles = [], selected = null, busy = false;
  function status(text, error = false) { $("profile-status").textContent = text; $("profile-status").setAttribute("data-error", String(error)); }
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || "Нет связи с расширением. Перезагрузите его.");
    return result;
  }
  function readForm() {
    const p = { ...selected };
    for (const field of fields) p[field] = $("profile-" + field).value;
    p.paths = $("profile-paths").value.split("\n").map((s) => s.trim()).filter(Boolean);
    p.enabled = $("profile-enabled").checked;
    return P.validate(p, profiles, document);
  }
  async function access() {
    const id = selected.id, origin = selected.origin;
    let granted = false;
    try { granted = await chrome.permissions.contains({ origins: [P.originPattern(origin)] }); } catch { /* Unsaved address. */ }
    if (selected.id !== id || selected.origin !== origin) return;
    $("profile-access").textContent = granted ? "Доступ к сайту разрешён." : "Нет доступа. Сохраните профиль и разрешите доступ к сайту.";
  }
  function render(p) {
    selected = { ...p };
    for (const field of fields) $("profile-" + field).value = p[field];
    $("profile-paths").value = p.paths.join("\n"); $("profile-enabled").checked = p.enabled;
    $("profile-list").value = p.id;
    $("profile-reset").disabled = !p.builtin;
    $("profile-delete").disabled = p.builtin || !profiles.some((item) => item.id === p.id);
    $("profile-warning").textContent = [p.id, p.templateId].some((id) => ["gitlab", "bitbucket"].includes(id)) ? "Предварительный профиль: проверьте вручную на вашем сайте. Для GitLab выберите Markdown-режим. Корпоративная версия может потребовать других селекторов." : "";
    access();
  }
  async function load(id) {
    const stored = await chrome.storage.local.get(P.KEY);
    profiles = P.all(stored[P.KEY]);
    $("profile-list").replaceChildren();
    for (const p of profiles) { const option = document.createElement("option"); option.value = p.id; option.textContent = p.name; $("profile-list").append(option); }
    render(profiles.find((p) => p.id === id) || profiles[0]);
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    try { await action(); } catch (error) { status(error.message, true); } finally { busy = false; }
  }
  $("profile-list").addEventListener("change", () => { if (!busy) { render(profiles.find((p) => p.id === $("profile-list").value)); status(""); } });
  $("profile-new").addEventListener("click", () => {
    if (busy) return;
    const template = P.defaults.find((p) => p.id === $("profile-template").value);
    render({ ...(template || P.defaults[0]), id: crypto.randomUUID(), templateId: template?.id || "manual", builtin: false,
      name: "Мой сайт", origin: "", paths: template ? [...template.paths] : ["/*"],
      ...(template ? {} : { editorSelector: "textarea", containerSelector: "", anchorSelector: "", anchorMode: "editor", editorAdapter: "textarea" }) });
    status("Укажите адрес сайта и сохраните профиль.");
  });
  $("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => { const p = readForm(); await send({ type: "cc-save", profile: p }); await load(p.id); status("Профиль сохранён. Откройте поле комментария и нажмите «Проверить профиль»."); });
  });
  $("profile-reset").addEventListener("click", () => run(async () => {
    const id = selected.id; await send({ type: "cc-remove", id }); await load(id); status("Встроенные настройки восстановлены.");
  }));
  $("profile-delete").addEventListener("click", () => run(async () => {
    await send({ type: "cc-remove", id: selected.id }); await load(); status("Профиль удалён.");
  }));
  $("profile-connect").addEventListener("click", () => {
    if (busy) return;
    try {
      const p = profiles.find((item) => item.id === selected.id);
      if (!p || JSON.stringify(readForm()) !== JSON.stringify(p)) throw new Error("Сначала сохраните изменения профиля.");
      // Must be invoked synchronously from the click, before any await.
      const request = chrome.permissions.request({ origins: [P.originPattern(p.origin)] });
      run(async () => {
        const granted = await request;
        if (granted) await send({ type: "cc-refresh" });
        await access();
        status(granted ? "Доступ разрешён. Можно проверить профиль." : "Доступ не предоставлен. Профиль сохранён, но не подключён.", !granted);
      });
    } catch (error) { status(error.message, true); }
  });
  $("profile-check").addEventListener("click", () => run(async () => {
    const saved = profiles.find((p) => p.id === selected.id);
    if (!saved || JSON.stringify(readForm()) !== JSON.stringify(saved)) throw new Error("Сначала сохраните изменения профиля.");
    const result = await send({ type: "cc-check", id: selected.id, tabId: Number(params.get("tab")) || undefined });
    const messages = {
      ok: `Проверка селекторов успешна: найдено редакторов ${result.count}, подходящих мест ${result.valid}.`,
      "no-editor": "Редактор не найден. Откройте поле комментария и повторите проверку. Если оно уже открыто, проверьте CSS-селектор редактора.",
      "no-access": "Нет доступа к сайту. Нажмите «Разрешить доступ к сайту».",
      "wrong-url": "Адрес активной вкладки не соответствует профилю. Откройте подходящую страницу.",
      "no-tab": "Нет активной вкладки для проверки.",
      "no-connection": "Нет связи с вкладкой. Обновите страницу и повторите проверку.",
      disabled: "Профиль отключён. Включите его и сохраните.",
      unsupported: "Найденный редактор не поддерживается выбранным типом. Проверьте настройку типа редактора."
    };
    status(messages[result.status] || result.detail || "Не удалось проверить профиль.", result.status !== "ok");
  }));
  if (params.has("profile")) $("site-settings").open = true;
  load(params.get("profile")).catch((error) => status(error.message, true));
})();
