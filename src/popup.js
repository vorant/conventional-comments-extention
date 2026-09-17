(function () {
  "use strict";

  const DEFAULT_LABELS = [
    "praise",
    "nitpick",
    "suggestion",
    "issue",
    "todo",
    "question",
    "thought",
    "chore",
    "note"
  ];

  const LABEL_STORAGE_KEY = "ccLabels";
  const THEME_STORAGE_KEY = "ccTheme";
  const THEMES = ["light", "dark"];
  const ICONS = {
    moon: String.fromCodePoint(0xf186),
    sun: String.fromCodePoint(0xf185),
    trash: String.fromCodePoint(0xf01b4)
  };

  let labels = [];
  let theme = "light";

  function getStorageArea() {
    return globalThis.chrome && chrome.storage && chrome.storage.sync
      ? chrome.storage.sync
      : null;
  }

  function normalizeLabels(value, fallback) {
    if (!Array.isArray(value)) {
      return fallback.slice();
    }

    return value
      .filter((label) => typeof label === "string")
      .map((label) => label.trim())
      .filter(Boolean);
  }

  function readLabels() {
    const storage = getStorageArea();
    if (!storage || typeof storage.get !== "function") {
      return Promise.resolve(DEFAULT_LABELS.slice());
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (!settled) {
          settled = true;
          resolve(normalizeLabels(value, DEFAULT_LABELS));
        }
      };

      try {
        const result = storage.get(LABEL_STORAGE_KEY, (items) => {
          settle(items && items[LABEL_STORAGE_KEY]);
        });

        if (result && typeof result.then === "function") {
          result.then((items) => settle(items && items[LABEL_STORAGE_KEY]), () => settle(undefined));
        }
      } catch (error) {
        settle(undefined);
      }
    });
  }

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

  function saveLabels() {
    const storage = getStorageArea();
    const savedLabels = normalizeLabels(labels, []);
    if (!storage || typeof storage.set !== "function") {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        const result = storage.set({ [LABEL_STORAGE_KEY]: savedLabels }, resolve);
        if (result && typeof result.then === "function") {
          result.then(resolve, resolve);
        }
      } catch (error) {
        resolve();
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
    toggle.className = "icon-button theme-toggle nf-icon";
    toggle.textContent = theme === "dark" ? ICONS.sun : ICONS.moon;
    toggle.setAttribute("aria-pressed", String(theme === "dark"));
  }

  function toggleTheme() {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
    saveTheme();
  }

  function createLabelRow(label, index) {
    const row = document.createElement("div");
    row.className = "label-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = label;
    input.setAttribute("aria-label", "Label");
    input.addEventListener("input", () => {
      labels[index] = input.value.trim();
      saveLabels();
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-button delete-button nf-icon";
    removeButton.textContent = ICONS.trash;
    removeButton.setAttribute("aria-label", "Удалить label");
    removeButton.setAttribute("title", "Удалить label");
    removeButton.addEventListener("click", () => {
      labels.splice(index, 1);
      renderLabels();
      saveLabels();
    });

    row.append(input);
    row.append(removeButton);
    return row;
  }

  function renderLabels() {
    const list = document.getElementById("label-list");
    list.textContent = "";

    labels.forEach((label, index) => {
      list.append(createLabelRow(label, index));
    });
  }

  async function addLabel(event) {
    event.preventDefault();

    const input = document.getElementById("new-label");
    const nextLabel = input.value.trim();
    if (!nextLabel) {
      input.value = "";
      return;
    }

    labels.push(nextLabel);
    input.value = "";
    renderLabels();
    await saveLabels();
  }

  async function init() {
    [labels, theme] = await Promise.all([readLabels(), readTheme()]);
    applyTheme();
    renderLabels();
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("label-form").addEventListener("submit", addLabel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
