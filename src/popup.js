(function () {
  "use strict";

  const L = globalThis.CCLabels;
  const ICONS = {
    grip: String.fromCodePoint(0xf0c9),
    trash: String.fromCodePoint(0xf01b4)
  };

  let labels = [];
  let dragState = null;

  let version = 0, lastSnapshot = null;
  const status = document.getElementById("labels-status");
  const retry = document.getElementById("labels-retry");
  function showStatus(text, error = false) {
    status.textContent = text;
    status.setAttribute("data-error", String(error));
    retry.hidden = !error;
  }
  async function saveLabels() {
    const items = L.normalize(labels), snapshot = JSON.stringify(items);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    const current = ++version;
    showStatus("Сохранение…");
    try {
      const result = await chrome.runtime.sendMessage({ type: "cc-save-labels", items });
      if (!result?.ok) throw new Error(result?.error || "Нет связи с расширением.");
      if (current === version) showStatus("Сохранено");
    } catch (error) {
      if (current !== version) return;
      lastSnapshot = null;
      showStatus(error.message, true);
    }
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
    if (event.target?.type === "color" || document.activeElement?.type === "color") { event.preventDefault(); return; }
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
    input.value = label.text;
    input.setAttribute("aria-label", "Label");
    input.addEventListener("input", () => {
      label.text = input.value.trim();
      picker.setAttribute("aria-label", "Цвет label " + (label.text || "без названия"));
      saveLabels();
    });

    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "label-color";
    picker.value = label.color;
    picker.setAttribute("aria-label", "Цвет label " + (label.text || "без названия"));
    picker.setAttribute("title", "Выбрать цвет label");
    picker.setAttribute("draggable", "false");
    picker.addEventListener("pointerdown", () => { row.draggable = false; });
    const enableDrag = () => { row.draggable = true; };
    picker.addEventListener("pointerup", enableDrag);
    picker.addEventListener("pointercancel", enableDrag);
    picker.addEventListener("blur", enableDrag);
    for (const event of ["input", "change"]) picker.addEventListener(event, () => {
      label.color = L.color(picker.value);
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
    row.append(picker);
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

    labels.push({ text: nextLabel, color: L.NEUTRAL });
    input.value = "";
    renderLabels();
    await saveLabels();
  }

  async function init() {
    document.getElementById("open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
    retry.addEventListener("click", () => saveLabels());
    try {
      labels = L.read(await chrome.storage.sync.get(L.KEYS));
      lastSnapshot = JSON.stringify(labels);
      renderLabels();
      document.getElementById("label-form").addEventListener("submit", addLabel);
    } catch (error) {
      showStatus(error.message, true);
      // Do not offer to overwrite an unreadable or unknown configuration.
      retry.hidden = true;
      document.getElementById("new-label").disabled = true;
      document.getElementById("label-form").addEventListener("submit", (event) => event.preventDefault());
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
