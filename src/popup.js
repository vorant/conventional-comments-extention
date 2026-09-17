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
  let labels = [];

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
    removeButton.textContent = "Delete";
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
    labels = await readLabels();
    renderLabels();
    document.getElementById("label-form").addEventListener("submit", addLabel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
