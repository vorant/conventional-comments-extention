(function () {
  "use strict";
  const THEME_STORAGE_KEY = "ccTheme";
  const THEMES = ["light", "dark"];
  const ICONS = { moon: String.fromCodePoint(0xf186), sun: String.fromCodePoint(0xf05a8) }; // nf-md-white_balance_sunny
  let theme = "light";
  const getStorageArea = () => globalThis.chrome?.storage?.sync;
  function normalizeTheme(value) {
    return THEMES.includes(value) ? value : "light";
  }

  function readTheme() {
    const storage = getStorageArea();
    if (!storage || typeof storage.get !== "function") {
      return Promise.resolve("light");
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (!settled) {
          settled = true;
          resolve(normalizeTheme(value));
        }
      };

      try {
        const result = storage.get(THEME_STORAGE_KEY, (items) => {
          settle(items && items[THEME_STORAGE_KEY]);
        });

        if (result && typeof result.then === "function") {
          result.then((items) => settle(items && items[THEME_STORAGE_KEY]), () => settle(undefined));
        }
      } catch (error) {
        settle(undefined);
      }
    });
  }

  function saveTheme() {
    const storage = getStorageArea();
    if (!storage || typeof storage.set !== "function") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        const result = storage.set({ [THEME_STORAGE_KEY]: theme }, resolve);
        if (result && typeof result.then === "function") {
          result.then(resolve, resolve);
        }
      } catch (error) {
        resolve();
      }
    });
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
  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
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
