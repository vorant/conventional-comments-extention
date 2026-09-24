(function (root) {
  "use strict";
  const KEY = "ccLabelSettings", LEGACY_KEY = "ccLabels";
  const NEUTRAL = "#6b7280";
  const PALETTE = Object.freeze({
    praise: "#238636", nitpick: NEUTRAL, suggestion: "#0969da",
    issue: "#cf222e", todo: "#bc4c00", question: "#8250df",
    thought: "#7061aa", chore: "#78665c", note: "#087e9b"
  });
  const color = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : NEUTRAL;
  const defaults = () => Object.entries(PALETTE).map(([text, color]) => ({ text, color }));
  function legacy(value) {
    if (!Array.isArray(value)) return defaults();
    return value.filter((text) => typeof text === "string").map((text) => text.trim()).filter(Boolean)
      .map((text) => ({ text, color: Object.hasOwn(PALETTE, text) ? PALETTE[text] : NEUTRAL }));
  }
  function normalize(items) {
    if (!Array.isArray(items)) throw new Error("Неизвестный формат labels. Настройки не перезаписаны.");
    return items.filter((item) => item && typeof item.text === "string" && item.text.trim())
      .map((item) => ({ text: item.text.trim(), color: color(item.color) }));
  }
  function read(stored = {}) {
    const value = stored[KEY];
    if (value === undefined) return legacy(stored[LEGACY_KEY]);
    if (!value || value.schemaVersion !== 1) throw new Error("Неизвестная версия настроек labels. Настройки не перезаписаны.");
    return normalize(value.items);
  }
  function snapshot(items) {
    const clean = normalize(items);
    return { [KEY]: { schemaVersion: 1, items: clean }, [LEGACY_KEY]: clean.map((item) => item.text) };
  }
  const rgb = (hex) => color(hex).slice(1).match(/../g).map((value) => parseInt(value, 16));
  const hex = (channels) => "#" + channels.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, amount) => a.map((v, i) => Math.round(v * (1 - amount) + b[i] * amount));
  function luminance(channels) {
    const linear = channels.map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  }
  function contrast(a, b) {
    const x = luminance(rgb(a)), y = luminance(rgb(b));
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function shades(value, dark = false) {
    const base = rgb(value), surface = dark ? [22, 27, 34] : [255, 255, 255];
    const background = hex(mix(surface, base, dark ? 0.22 : 0.10));
    const border = hex(mix(surface, base, dark ? 0.65 : 0.30));
    const target = dark ? [255, 255, 255] : [0, 0, 0];
    let foreground = hex(base);
    for (let step = 1; contrast(foreground, background) < 4.5 && step <= 100; step++) {
      foreground = hex(mix(base, target, step / 100));
    }
    return { foreground, background, border };
  }
  const api = { KEY, LEGACY_KEY, KEYS: [KEY, LEGACY_KEY], NEUTRAL, PALETTE, color, defaults, legacy, normalize, read, snapshot, shades, contrast };
  root.CCLabels = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
