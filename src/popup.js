(function () {
  "use strict";
  const extensionApi = globalThis.browser ?? globalThis.chrome;

  const L = globalThis.CCLabels;
  const ICONS = {
    grip: String.fromCodePoint(0xf0c9),
    trash: String.fromCodePoint(0xf01b4)
  };

  let labels = [];
  let emojisEnabled = true;
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
    const settings = L.settings({ schemaVersion: 2, emojisEnabled, items: labels }), snapshot = JSON.stringify(settings);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    const current = ++version;
    showStatus("Saving…");
    try {
      const result = await extensionApi.runtime.sendMessage({ type: "cc-save-labels", settings });
      if (!result?.ok) throw new Error(result?.error || "Cannot connect to the extension.");
      if (current === version) showStatus("Saved");
    } catch (error) {
      if (current !== version) return;
      lastSnapshot = null;
      showStatus(error.message, true);
    }
  }

  let emojiTarget = null, emojiOpener = null, emojiPicker = null, pickerLoading = null, emojiSession = 0;
  const element = (id) => document.getElementById(id);
  function closeEmoji(restoreFocus = true) {
    ++emojiSession;
    const opener = emojiOpener;
    emojiTarget = null; emojiOpener = null;
    element("emoji-view").hidden = true;
    element("label-form").hidden = false;
    element("emoji-toggle-row").hidden = false;
    if (restoreFocus) opener?.focus();
  }
  function chooseEmoji(value) {
    if (!emojiTarget || !labels.includes(emojiTarget)) return;
    emojiTarget.emoji = L.emoji(value);
    emojiOpener.textContent = emojiTarget.emoji || "＋";
    closeEmoji();
    saveLabels();
  }
  async function loadEmoji() {
    element("emoji-status").textContent = "Loading…";
    element("emoji-retry").hidden = true;
    try {
      if (!emojiPicker) {
        pickerLoading ||= rootPicker();
        emojiPicker = await pickerLoading;
      }
      emojiPicker.className = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
      element("emoji-status").textContent = "";
    } catch {
      pickerLoading = null;
      element("emoji-status").textContent = "Could not load emoji. Try again.";
      element("emoji-retry").hidden = false;
    }
  }
  async function rootPicker() {
    const picker = await globalThis.CCEmojiPicker.create();
    picker.addEventListener("emoji-click-sync", async (event) => {
      const session = emojiSession;
      try {
        const detail = await event.detail;
        if (session === emojiSession) chooseEmoji(detail.unicode);
      } catch {
        if (session === emojiSession) element("emoji-status").textContent = "Could not select the emoji. Try again.";
      }
    });
    picker.addEventListener("dragstart", (event) => event.preventDefault());
    element("emoji-container").append(picker);
    return picker;
  }
  function openEmoji(label, button) {
    if (dragState) return;
    ++emojiSession;
    emojiTarget = label; emojiOpener = button;
    element("emoji-title").textContent = "Emoji for label " + (label.text || "unnamed");
    element("emoji-current").textContent = "Current: " + (label.emoji || "No emoji");
    element("label-form").hidden = true;
    element("emoji-toggle-row").hidden = true;
    element("emoji-view").hidden = false;
    element("emoji-back").focus();
    loadEmoji();
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
    handle.setAttribute("title", "Drag to reorder label");

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
    if (emojiTarget || event.target?.className === "label-emoji" || document.activeElement?.className === "label-emoji" || event.target?.type === "color" || document.activeElement?.type === "color") { event.preventDefault(); return; }
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
      picker.setAttribute("aria-label", "Color for label " + (label.text || "unnamed"));
      emojiButton.setAttribute("aria-label", "Emoji for label " + (label.text || "unnamed"));
      saveLabels();
    });

    const picker = document.createElement("input");
    picker.type = "color";
    picker.className = "label-color";
    picker.value = label.color;
    picker.setAttribute("aria-label", "Color for label " + (label.text || "unnamed"));
    picker.setAttribute("title", "Choose label color");
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

    const emojiButton = document.createElement("button");
    emojiButton.type = "button";
    emojiButton.className = "label-emoji";
    emojiButton.textContent = label.emoji || "＋";
    emojiButton.setAttribute("aria-label", "Emoji for label " + (label.text || "unnamed"));
    emojiButton.setAttribute("draggable", "false");
    emojiButton.addEventListener("click", () => openEmoji(label, emojiButton));
    emojiButton.addEventListener("pointerdown", () => { row.draggable = false; });
    for (const event of ["pointerup", "pointercancel", "blur"]) emojiButton.addEventListener(event, enableDrag);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "icon-button delete-button nf-icon";
    removeButton.textContent = ICONS.trash;
    removeButton.setAttribute("aria-label", "Delete label");
    removeButton.setAttribute("title", "Delete label");
    removeButton.addEventListener("click", () => {
      labels.splice(index, 1);
      renderLabels();
      saveLabels();
    });

    row.append(createDragHandle());
    row.append(emojiButton);
    row.append(input);
    row.append(picker);
    row.append(removeButton);
    return row;
  }

  function renderLabels() {
    if (emojiTarget) closeEmoji(false);
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

    labels.push({ text: nextLabel, color: L.NEUTRAL, emoji: "" });
    input.value = "";
    renderLabels();
    await saveLabels();
  }

  async function init() {
    document.getElementById("open-settings").addEventListener("click", () => extensionApi.runtime.openOptionsPage());
    element("emoji-back").addEventListener("click", () => closeEmoji());
    element("emoji-none").addEventListener("click", () => chooseEmoji(""));
    element("emoji-retry").addEventListener("click", loadEmoji);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && emojiTarget) { event.preventDefault(); event.stopPropagation(); closeEmoji(); }
    });
    element("theme-toggle").addEventListener("click", () => {
      if (emojiPicker) emojiPicker.className = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
    });
    retry.addEventListener("click", () => saveLabels());
    try {
      const settings = L.readSettings(await extensionApi.storage.sync.get(L.KEYS));
      labels = settings.items;
      emojisEnabled = settings.emojisEnabled;
      lastSnapshot = JSON.stringify(settings);
      element("emojis-enabled").checked = emojisEnabled;
      element("emojis-enabled").addEventListener("change", () => {
        emojisEnabled = element("emojis-enabled").checked;
        saveLabels();
      });
      renderLabels();
      document.getElementById("label-form").addEventListener("submit", addLabel);
    } catch (error) {
      showStatus(error.message, true);
      // Do not offer to overwrite an unreadable or unknown configuration.
      retry.hidden = true;
      element("emojis-enabled").disabled = true;
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
