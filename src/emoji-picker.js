(function (root) {
  "use strict";
  // Modules and data are loaded lazily; the picker never uses its CDN default.
  let modules;
  root.CCEmojiPicker = {
    async create() {
      modules ||= Promise.all([
        import("./vendor/emoji-picker-element/picker.js"),
        import("./vendor/emoji-picker-element/i18n/en.js")
      ]).catch((error) => { modules = null; throw error; });
      const [{ default: Picker }, { default: i18n }] = await modules;
      const picker = new Picker({ locale: "en", i18n, dataSource: chrome.runtime.getURL("src/vendor/emoji-picker-element-data/en.json") });
      try { await picker.database.ready(); }
      catch (error) { await picker.database.close(); throw error; }
      return picker;
    }
  };
})(globalThis);
