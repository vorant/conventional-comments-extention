(function (root) {
  "use strict";
  const KEY = "ccLabelSettings", LEGACY_KEY = "ccLabels";
  const NEUTRAL = "#6b7280";
  const PALETTE = Object.freeze({
    praise: "#238636", nitpick: NEUTRAL, suggestion: "#0969da",
    issue: "#cf222e", todo: "#bc4c00", question: "#8250df",
    thought: "#7061aa", chore: "#78665c", note: "#087e9b"
  });
  const EMOJIS = Object.freeze({ praise: "👍", nitpick: "🔍", suggestion: "💡", issue: "🚨", todo: "✅", question: "❓", thought: "💭", chore: "🔧", note: "📝" });
  const defaultEmoji = (text) => Object.hasOwn(EMOJIS, text) ? EMOJIS[text] : "";
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  function emoji(value) {
    if (typeof value !== "string" || !value || [...segmenter.segment(value)].length !== 1) return "";
    // A single cluster containing only emoji components; never arbitrary text or markup.
    const part = "\\p{Extended_Pictographic}[\\uFE0E\\uFE0F]?\\p{Emoji_Modifier}?";
    const sequence = new RegExp(`^(?:${part})(?:\\u200D${part})*$`, "u");
    return sequence.test(value) || /^(?:\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3|\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F})$/u.test(value) ? value : "";
  }
  const display = (item, enabled = true) => enabled && emoji(item.emoji) ? `${item.emoji} ${item.text}` : item.text;
  const prefix = (item, enabled = true) => `${display(item, enabled)}: `;
  const color = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : NEUTRAL;
  const defaults = () => Object.entries(PALETTE).map(([text, color]) => ({ text, color, emoji: defaultEmoji(text) }));
  function legacy(value) {
    if (!Array.isArray(value)) return defaults();
    return value.filter((text) => typeof text === "string").map((text) => text.trim()).filter(Boolean)
      .map((text) => ({ text, color: Object.hasOwn(PALETTE, text) ? PALETTE[text] : NEUTRAL, emoji: defaultEmoji(text) }));
  }
  function normalize(items) {
    if (!Array.isArray(items)) throw new Error("Unknown label format. Settings have not been overwritten.");
    return items.filter((item) => item && typeof item.text === "string" && item.text.trim())
      .map((item) => ({ text: item.text.trim(), color: color(item.color), emoji: emoji(item.emoji) }));
  }
  function settings(value) {
    if (!value || ![1, 2].includes(value.schemaVersion)) throw new Error("Unknown label settings version. Settings have not been overwritten.");
    const items = normalize(value.items);
    if (value.schemaVersion === 1) for (const item of items) item.emoji = defaultEmoji(item.text);
    return { schemaVersion: 2, emojisEnabled: value.emojisEnabled !== false, items };
  }
  function readSettings(stored = {}) {
    return stored[KEY] === undefined
      ? { schemaVersion: 2, emojisEnabled: true, items: legacy(stored[LEGACY_KEY]) }
      : settings(stored[KEY]);
  }
  function read(stored = {}) { return readSettings(stored).items; }
  function snapshot(value) {
    const clean = settings(Array.isArray(value) ? { schemaVersion: 2, items: value } : value);
    return { [KEY]: clean, [LEGACY_KEY]: clean.items.map((item) => item.text) };
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
  const api = { KEY, LEGACY_KEY, KEYS: [KEY, LEGACY_KEY], NEUTRAL, PALETTE, EMOJIS, emoji, display, prefix, settings, readSettings, color, defaults, legacy, normalize, read, snapshot, shades, contrast };
  root.CCLabels = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
