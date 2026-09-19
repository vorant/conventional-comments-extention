(function (root) {
  "use strict";
  const KEY = "ccSiteProfiles";
  const defaults = [
    { id: "github", name: "GitHub", origin: "https://github.com", paths: ["/*/*/pull/*"], enabled: true,
      editorSelector: 'textarea[name="comment[body]"], textarea[aria-label*="comment" i], textarea[placeholder*="comment" i]',
      containerSelector: '[class*="MarkdownEditor-module__container"], [class*="AddCommentEditor-module__ConversationCommentBox"], .js-previewable-comment-form, form',
      anchorSelector: '', placement: "before", editorAdapter: "textarea", anchorMode: "github-wrapper" },
    { id: "gitlab", name: "GitLab (предварительный)", origin: "https://gitlab.com", paths: ["/*/-/merge_requests/*"], enabled: true,
      editorSelector: 'textarea[name="note[note]"], textarea.js-note-text', containerSelector: '.note-form, .js-note-form, form',
      anchorSelector: '', placement: "before", editorAdapter: "textarea", anchorMode: "editor" },
    { id: "bitbucket", name: "Bitbucket (предварительный)", origin: "https://bitbucket.org", paths: ["/*/*/pull-requests/*"], enabled: true,
      editorSelector: '.ProseMirror[contenteditable="true"]', containerSelector: '.ak-editor-content-area, .akEditor, form',
      anchorSelector: '', placement: "before", editorAdapter: "rich-text", anchorMode: "editor" }
  ];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  function config(value) {
    if (value === undefined) return { schemaVersion: 1, overrides: {}, custom: [], revision: 0 };
    if (!value || value.schemaVersion !== 1 || !value.overrides || !Array.isArray(value.custom)) {
      throw new Error("Неизвестный формат профилей. Настройки не перезаписаны.");
    }
    return clone(value);
  }
  function all(value) {
    const data = config(value);
    return [...defaults.map((p) => ({ ...clone(p), ...data.overrides[p.id], id: p.id, builtin: true, revision: data.revision || 0 })),
      ...data.custom.map((p) => ({ ...p, builtin: false, revision: data.revision || 0 }))];
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
    return profiles.find((p) => !p.builtin && matches(p, href)) || profiles.find((p) => matches(p, href)) || null;
  }
  function originPattern(origin) {
    const url = new URL(origin);
    // Chrome host permissions cover all ports; runtime matching still checks the exact origin.
    return `${url.protocol}//${url.hostname}/*`;
  }
  function validate(input, profiles, doc) {
    const p = clone(input);
    if (!p || typeof p.id !== "string" || !/^[a-zA-Z0-9-]+$/.test(p.id) || typeof p.enabled !== "boolean") throw new Error("Некорректный идентификатор или состояние профиля.");
    if (typeof p.name !== "string" || !p.name.trim()) throw new Error("Имя: укажите название профиля.");
    p.name = p.name.trim();
    let url;
    try { url = new URL(p.origin); } catch { throw new Error("Адрес: укажите полный HTTP(S) адрес сайта."); }
    if (!/^https?:$/.test(url.protocol) || url.hostname.includes("*") || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Адрес: нужен только адрес сайта, без пути, пароля или параметров.");
    }
    p.origin = url.origin;
    if (!Array.isArray(p.paths) || !p.paths.length || p.paths.length > 20 || p.paths.some((s) => typeof s !== "string" || !s.startsWith("/") || s.length > 250 || /[?#\s]/.test(s))) {
      throw new Error("Страницы: задайте пути с начальным /; разрешена маска * (до 20 путей по 250 символов).");
    }
    for (const field of ["editorSelector", "containerSelector", "anchorSelector"]) {
      if (typeof p[field] !== "string" || p[field].length > 2000 || (field === "editorSelector" && !p[field].trim())) throw new Error(`${field}: укажите CSS-селектор.`);
      p[field] = p[field].trim();
      if (p[field] && doc) {
        try { doc.querySelector(p[field]); } catch { throw new Error(`${field}: неверный CSS-селектор.`); }
      }
    }
    if (!["before", "after", "prepend", "append"].includes(p.placement)) throw new Error("Неизвестное положение панели.");
    if (!["textarea", "rich-text"].includes(p.editorAdapter)) throw new Error("Неизвестный тип редактора.");
    if (!["editor", "github-wrapper"].includes(p.anchorMode)) throw new Error("Неизвестный способ размещения.");
    for (const other of profiles) {
      if (other.id !== p.id && !other.builtin && !p.builtin && other.origin === p.origin && other.paths.some((a) => p.paths.some((b) => overlaps(a, b)))) {
        throw new Error(`Страницы пересекаются с профилем «${other.name}». Измените маски или удалите другой профиль.`);
      }
    }
    return p;
  }
  function save(value, p) {
    const data = config(value), item = clone(p);
    delete item.builtin;
    delete item.revision;
    data.revision = (data.revision || 0) + 1;
    if (defaults.some((d) => d.id === p.id)) data.overrides[p.id] = item;
    else data.custom = [...data.custom.filter((d) => d.id !== p.id), item];
    return data;
  }
  function remove(value, id) {
    const data = config(value);
    data.revision = (data.revision || 0) + 1;
    delete data.overrides[id];
    data.custom = data.custom.filter((p) => p.id !== id);
    return data;
  }
  const api = { KEY, defaults, config, all, pathMatches, overlaps, matches, select, originPattern, validate, save, remove };
  root.CCProfiles = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
