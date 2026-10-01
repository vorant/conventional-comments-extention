(function () {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const THEME_STORAGE_KEY = "ccTheme";
  const THEMES = ["light", "dark"];
  const ICONS = { moon: String.fromCodePoint(0xf186), sun: String.fromCodePoint(0xf05a8) }; // nf-md-white_balance_sunny
  let theme = "light";
  const getStorageArea = () => extensionApi?.storage?.sync;
  function normalizeTheme(value) {
    return THEMES.includes(value) ? value : "light";
  }

  async function readTheme() {
    try {
      const items = await getStorageArea()?.get(THEME_STORAGE_KEY);
      return normalizeTheme(items?.[THEME_STORAGE_KEY]);
    } catch { return "light"; }
  }

  async function saveTheme() {
    try { await getStorageArea()?.set({ [THEME_STORAGE_KEY]: theme }); }
    catch { /* Keep the selected theme for this page when storage is unavailable. */ }
  }

  function applyTheme() {
    document.body.setAttribute("data-theme", theme);

    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;
    toggle.className = "icon-button theme-toggle nf-icon";
    toggle.textContent = theme === "dark" ? ICONS.sun : ICONS.moon;
    const action = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
    toggle.setAttribute("aria-label", action);
    toggle.setAttribute("title", action);
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
    saveTheme();
  }

  let revision = 0;
  applyTheme();
  extensionApi?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "sync" || !changes[THEME_STORAGE_KEY]) return;
    revision++;
    theme = normalizeTheme(changes[THEME_STORAGE_KEY].newValue);
    applyTheme();
  });
  const initialRevision = revision;
  readTheme().then((value) => {
    if (revision !== initialRevision) return;
    theme = value;
    applyTheme();
  });
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    revision++;
    toggleTheme();
  });
})();
