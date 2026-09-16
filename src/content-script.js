(function () {
  "use strict";

  const LABELS = [
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

  const PANEL_CLASS = "cc-label-panel";
  const PROCESSED_ATTRIBUTE = "data-cc-label-panel";

  function isGitHubPullRequestPage() {
    return (
      window.location.hostname === "github.com" &&
      /^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/.test(window.location.pathname)
    );
  }

  function isCommentTextarea(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement)) {
      return false;
    }

    const name = textarea.getAttribute("name") || "";
    const ariaLabel = textarea.getAttribute("aria-label") || "";
    const placeholder = textarea.getAttribute("placeholder") || "";

    return (
      name === "comment[body]" ||
      /leave a comment|add a comment|comment/i.test(ariaLabel) ||
      /leave a comment|add a comment|comment/i.test(placeholder)
    );
  }

  function findCommentContainer(textarea) {
    return (
      textarea.closest('[class*="MarkdownEditor-module__container"]') ||
      textarea.closest('[class*="AddCommentEditor-module__ConversationCommentBox"]') ||
      textarea.closest(".js-previewable-comment-form") ||
      textarea.closest("form") ||
      textarea.parentElement
    );
  }

  function findInsertionTarget(textarea) {
    return (
      textarea.closest('[class*="MarkdownInput-module__inputWrapper"]') ||
      textarea.closest("text-expander") ||
      textarea
    );
  }

  function insertLabel(textarea, label) {
    const prefix = `${label}: `;
    const currentValue = textarea.value;
    const nextValue = currentValue.startsWith(prefix)
      ? currentValue
      : `${prefix}${currentValue}`;

    textarea.value = nextValue;
    textarea.focus();
    textarea.selectionStart = prefix.length;
    textarea.selectionEnd = prefix.length;
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prefix }));
  }

  function createPanel(textarea) {
    const panel = document.createElement("div");
    panel.className = PANEL_CLASS;
    panel.setAttribute("aria-label", "Conventional Comments labels");

    for (const label of LABELS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cc-label-button";
      button.textContent = `${label}:`;
      button.addEventListener("click", () => insertLabel(textarea, label));
      panel.append(button);
    }

    return panel;
  }

  function attachPanel(textarea) {
    if (!isCommentTextarea(textarea) || textarea.hasAttribute(PROCESSED_ATTRIBUTE)) {
      return;
    }

    const container = findCommentContainer(textarea);
    if (!container || container.querySelector(`.${PANEL_CLASS}`)) {
      return;
    }

    const insertionTarget = findInsertionTarget(textarea);
    const insertionParent = insertionTarget.parentElement;
    if (!insertionParent) {
      return;
    }

    textarea.setAttribute(PROCESSED_ATTRIBUTE, "true");
    insertionParent.insertBefore(createPanel(textarea), insertionTarget);
  }

  function scanForCommentFields(root = document) {
    if (!isGitHubPullRequestPage()) {
      return;
    }

    const textareas = root instanceof HTMLTextAreaElement
      ? [root]
      : Array.from(root.querySelectorAll("textarea"));

    for (const textarea of textareas) {
      attachPanel(textarea);
    }
  }

  function observeCommentFields() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            scanForCommentFields(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scanForCommentFields();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observeCommentFields, { once: true });
  } else {
    observeCommentFields();
  }
})();
