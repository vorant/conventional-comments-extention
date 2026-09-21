(function (root) {
  "use strict";
  const KEY = "ccSiteProfiles";
  const defaults = [
    { id: "github", name: "GitHub", origin: "https://github.com", paths: ["/*/*/pull/*"], enabled: true,
      editorSelector: 'textarea[name="comment[body]"], textarea[aria-label*="comment" i], textarea[placeholder*="comment" i]',
      containerSelector: '[class*="MarkdownEditor-module__container"], [class*="AddCommentEditor-module__ConversationCommentBox"], .js-previewable-comment-form, form',
      anchorSelector: '', placement: "before", editorAdapter: "textarea", anchorMode: "github-wrapper" },
    { id: "gitlab", name: "GitLab", origin: "https://gitlab.com", paths: ["/*/-/merge_requests/*"], enabled: true,
      editorSelector: 'textarea[name="note[note]"], textarea.js-note-text', containerSelector: '.note-form, .js-note-form, form',
      anchorSelector: '', placement: "before", editorAdapter: "textarea", anchorMode: "editor" },
    { id: "bitbucket", name: "Bitbucket", origin: "https://bitbucket.org", paths: ["/*/*/pull-requests/*"], enabled: true,
      editorSelector: '.ProseMirror[contenteditable="true"]', containerSelector: '.ak-editor-content-area, .akEditor, form',
      anchorSelector: '', placement: "before", editorAdapter: "rich-text", anchorMode: "editor" }
  ];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function config(value) {
    if (value === undefined) return { schemaVersion: 1, overrides: {}, custom: [], revision: 0 };
    if (!value || value.schemaVersion !== 1 || !value.overrides || typeof value.overrides !== "object" || Array.isArray(value.overrides) || !Array.isArray(value.custom)) {
      throw new Error("Неизвестный формат профилей. Настройки не перезаписаны.");
    }
    return clone(value);
  }
  const editable = ["origin", "paths", "editorSelector", "placement"];
  function all(value) {
    const data = config(value);
    return defaults.map((base) => {
      const profile = { ...clone(base), builtin: true, revision: data.revision || 0 };
      for (const field of editable) {
        if (data.overrides[base.id]?.[field] === undefined) continue;
        try {
          profile[field] = validate({ ...profile, [field]: data.overrides[base.id][field] }, [], root.document)[field];
        } catch { /* An obsolete field falls back independently to its default. */ }
      }
      return profile;
    });
  }

  function pathMatches(mask, pathname) {
    const pattern = mask.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    return new RegExp(`^${pattern}$`).test(pathname);
  }
  // Intersection of two glob languages (literal characters and '*'), without sampling URLs.
  function overlaps(a, b) {
    const queue = [[0, 0]], seen = new Set();
    while (queue.length) {
      const [i, j] = queue.pop(), key = `${i}:${j}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (i === a.length && j === b.length) return true;
      if (a[i] === "*") queue.push([i + 1, j]);
      if (b[j] === "*") queue.push([i, j + 1]);
      if (i < a.length && j < b.length && (a[i] === "*" || b[j] === "*" || a[i] === b[j])) {
        queue.push([a[i] === "*" ? i : i + 1, b[j] === "*" ? j : j + 1]);
      }
    }
    return false;
  }
  function matches(profile, href) {
    try {
      const url = new URL(href);
      return profile.enabled && profile.origin === url.origin && profile.paths.some((p) => pathMatches(p, url.pathname));
    } catch { return false; }
  }
  function select(profiles, href) {
    return defaults.map((base) => profiles.find((p) => p.id === base.id)).find((p) => p && matches(p, href)) || null;
  }
  function originPattern(origin) {
    const url = new URL(origin);
    // Chrome host permissions cover all ports; runtime matching still checks the exact origin.
    return `${url.protocol}//${url.hostname}/*`;
  }
  function validate(input, profiles, doc) {
    const base = defaults.find((p) => p.id === input?.id);
    if (!base) throw new Error("Неизвестный встроенный профиль.");
    const p = { ...clone(base), builtin: true };
    for (const field of editable) if (input[field] !== undefined) p[field] = clone(input[field]);
    let url;
    try { url = new URL(p.origin); } catch { throw new Error("Адрес: укажите полный HTTP(S) адрес сайта."); }
    if (!/^https?:$/.test(url.protocol) || url.hostname.includes("*") || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Адрес: нужен только адрес сайта, без пути, пароля или параметров.");
    }
    p.origin = url.origin;
    if (!Array.isArray(p.paths) || !p.paths.length || p.paths.length > 20 || p.paths.some((s) => typeof s !== "string" || !s.startsWith("/") || s.length > 250 || /[?#\s]/.test(s))) {
      throw new Error("Страницы: задайте пути с начальным /; разрешена маска * (до 20 путей по 250 символов).");
    }
    if (typeof p.editorSelector !== "string" || p.editorSelector.length > 2000 || !p.editorSelector.trim()) throw new Error("Селектор редактора: укажите CSS-селектор.");
    p.editorSelector = p.editorSelector.trim();
    if (doc) {
      try { doc.querySelector(p.editorSelector); } catch { throw new Error("Селектор редактора: неверный CSS-селектор."); }
    }
    if (!["before", "after"].includes(p.placement)) throw new Error("Неизвестное положение панели.");
    return p;
  }
  function save(value, p) {
    const data = config(value), valid = validate(p, [], root.document);
    const item = Object.fromEntries(editable.map((field) => [field, valid[field]]));
    data.revision = (data.revision || 0) + 1;
    data.overrides[p.id] = item;
    return data;
  }
  function remove(value, id) {
    if (!defaults.some((p) => p.id === id)) throw new Error("Неизвестный встроенный профиль.");
    const data = config(value);
    data.revision = (data.revision || 0) + 1;
    delete data.overrides[id];
    return data;
  }
  const api = { KEY, defaults, config, all, pathMatches, overlaps, matches, select, originPattern, validate, save, remove };
  root.CCProfiles = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
