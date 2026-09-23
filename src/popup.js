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
  const ICONS = {
    grip: String.fromCodePoint(0xf0c9),
    trash: String.fromCodePoint(0xf01b4)
  };

  let labels = [];
  let dragState = null;

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

  function getReorderedLabels(sourceLabels, fromIndex, toIndex) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= sourceLabels.length ||
      toIndex >= sourceLabels.length
    ) {
      return sourceLabels.slice();
    }

    const nextLabels = sourceLabels.slice();
    const [movedLabel] = nextLabels.splice(fromIndex, 1);
    nextLabels.splice(toIndex, 0, movedLabel);
    return nextLabels;
  }

  function isDragPreviewIndex(index) {
    if (
      !dragState ||
      dragState.animationFirstIndex === null ||
      dragState.animationLastIndex === null
    ) {
      return false;
    }

    return index >= dragState.animationFirstIndex && index <= dragState.animationLastIndex;
  }

  function createDragHandle() {
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.setAttribute("aria-hidden", "true");
    handle.setAttribute("title", "Перетащить label");

    const lightIcon = document.createElement("span");
    lightIcon.className = "drag-handle-icon drag-handle-icon-light nf-icon";
    lightIcon.textContent = ICONS.grip;

    const darkIcon = document.createElement("span");
    darkIcon.className = "drag-handle-icon drag-handle-icon-dark nf-icon";
    darkIcon.textContent = ICONS.grip;

    handle.append(lightIcon);
    handle.append(darkIcon);
    return handle;
  }

  function onLabelDragStart(event, index) {
    dragState = {
      animationFirstIndex: null,
      animationLastIndex: null,
      dropped: false,
      originalIndex: index,
      originalLabels: labels.slice(),
      previewIndex: index
    };

    event.currentTarget.setAttribute("data-dragging", "true");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(index));
    }
  }

  function previewLabelDrop(dropIndex) {
    if (!dragState || dropIndex === dragState.previewIndex) {
      return;
    }

    const previousPreviewIndex = dragState.previewIndex;
    labels = getReorderedLabels(dragState.originalLabels, dragState.originalIndex, dropIndex);
    dragState.animationFirstIndex = Math.min(previousPreviewIndex, dropIndex);
    dragState.animationLastIndex = Math.max(previousPreviewIndex, dropIndex);
    dragState.previewIndex = dropIndex;
    renderLabels();
  }

  function onLabelDragOver(event, dropIndex) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }

    previewLabelDrop(dropIndex);
  }

  function onLabelDragEnd(event) {
    event.currentTarget.removeAttribute("data-dragging");
    if (!dragState || dragState.dropped) {
      return;
    }

    labels = dragState.originalLabels.slice();
    dragState = null;
    renderLabels();
  }

  async function onLabelDrop(event, dropIndex) {
    event.preventDefault();
    if (!dragState) {
      return;
    }

    previewLabelDrop(dropIndex);
    dragState.dropped = true;
    const shouldSave = dragState.originalIndex !== dragState.previewIndex;
    dragState = null;
    renderLabels();

    if (shouldSave) {
      await saveLabels();
    }
  }

  function createLabelRow(label, index) {
    const row = document.createElement("div");
    row.className = "label-row";
    row.draggable = true;
    row.setAttribute("draggable", "true");
    row.setAttribute("data-label-index", String(index));
    if (dragState) {
      if (isDragPreviewIndex(index)) {
        row.setAttribute("data-drag-preview", "true");
      }
      if (index === dragState.previewIndex) {
        row.setAttribute("data-dragging", "true");
      }
    }
    row.addEventListener("dragstart", (event) => onLabelDragStart(event, index));
    row.addEventListener("dragover", (event) => onLabelDragOver(event, index));
    row.addEventListener("drop", (event) => onLabelDrop(event, index));
    row.addEventListener("dragend", onLabelDragEnd);

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

    row.append(createDragHandle());
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
    document.getElementById("open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
    document.getElementById("label-form").addEventListener("submit", addLabel);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
