# Локальный emoji-picker-element

Версии зафиксированы: `emoji-picker-element@1.29.1` и `emoji-picker-element-data@1.8.0`. Источники: [компонент](https://github.com/nolanlawson/emoji-picker-element), [каталог](https://github.com/nolanlawson/emoji-picker-element-data). Оба пакета поставляются с исходными лицензиями Apache-2.0 в соседних каталогах.

Из npm-пакета компонента без изменений скопированы `picker.js`, его единственный импорт `database.js`, `i18n/en.js`, `package.json` и `LICENSE`. Из пакета данных скопирован `en/cldr-native/data.json` как `en.json`, а также `package.json` и `LICENSE`. Контрольные суммы исходных файлов — в `checksums.json`. Карты исходников не нужны для исполнения и не поставляются.

`src/emoji-picker.js` лениво импортирует модуль и английский i18n, создаёт единственный экземпляр с явными locale `en` и локальным dataSource. CDN-default сторонней библиотеки не используется. Каталог не загружается content script и не записывается в storage.sync; готовый компонент индексирует его в IndexedDB. Установка npm-зависимостей и сборщик для расширения не нужны.

## Обновление

1. Выбрать точные версии и скачать `npm pack emoji-picker-element@<версия> emoji-picker-element-data@<версия>` во временную папку.
2. Извлечь перечисленные выше файлы, сохранив пути модуля и i18n и переименовав только JSON каталога. Проверить новые транзитивные импорты и лицензии; включить все runtime-ресурсы.
3. Обновить версии здесь, `package.json` поставленных пакетов и SHA-256 в `checksums.json`.
4. Повторить тесты, запуск установленного MV3 offline с пустой IndexedDB, английский поиск, обе темы, ошибку/retry, клавиатуру и упаковку `make package`.

## Совместимость

Минимум расширения остаётся Chrome 102. Выполнен аудит синтаксиса и API поставленных ES-модулей: custom elements, Shadow DOM, динамический import, IndexedDB (включая commit), AbortController/обработчики с signal, ResizeObserver, replaceChildren/replaceWith, queueMicrotask, optional chaining и Unicode property escapes доступны в этом минимуме. `Intl.Segmenter` модели доступен с Chrome 87; Object.hasOwn — с Chrome 93. Новые Unicode-символы зависят от системного шрифта; библиотека фильтрует неподдерживаемые эмодзи. В runtime нет eval, new Function, удалённых импортов или внешних скриптов; штатная MV3 CSP не ослаблена.

Фактический браузерный прогон выполнен в Chrome 153.0.8010.53 на macOS 26.7; запуск Chrome 102 не проводился. Upstream гарантирует только актуальные браузеры, поэтому при каждом обновлении нужен повторный аудит минимума, а не предположение по номеру версии пакета. Результаты приёмки — в `docs/english-interface-verification.md` в репозитории.

Английские ресурсы взяты из тех же фиксированных npm-пакетов; русские ресурсы больше не поставляются. Locale en использует собственную IndexedDB, поэтому прежний русский индекс не влияет на английский поиск. Записанные в ccLabelSettings Unicode-эмодзи и общий флаг не мигрируют; история избранного и оттенка кожи пикера может начаться заново для новой локали.
