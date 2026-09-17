## Context

Popup уже хранит labels в `chrome.storage.sync` как массив `ccLabels`, а content script использует этот массив для порядка кнопок в панели GitHub Pull Request comments. Popup rows сейчас состоят из input и icon-only delete button; CSS уже использует локальный Nerd Font для controls и light/dark theme tokens. Manifest объявляет `action.default_popup`, но не задает `action.default_icon` и top-level `icons`.

## Goals / Non-Goals

**Goals:**

- Добавить native drag-and-drop reorder для labels без внешних зависимостей.
- Сохранять новый порядок в существующий `ccLabels`.
- Сохранить редактирование, добавление, удаление и theme toggle.
- Добавить Chrome extension icon assets размеров `16`, `32`, `48`, `128`.
- Подключить иконки в manifest для toolbar/action и extension management UI.

**Non-Goals:**

- Reorder через клавиатуру в этом изменении.
- Touch-specific drag library или внешняя dependency.
- Изменение GitHub content panel UI, кроме порядка labels, который уже приходит из `ccLabels`.
- Публикация в Chrome Web Store.

## Decisions

### Native HTML Drag and Drop

Каждая `.label-row` будет `draggable="true"` и получит drag handle icon как визуальную точку захвата. JS будет хранить исходный массив labels, исходный индекс и текущий preview index. При `dragover` popup перестраивает DOM в preview-порядок, чтобы соседние элементы заняли новые позиции до `drop`. При `drop` preview order сохраняется в `ccLabels`; при `dragend` без drop исходный порядок восстанавливается. Это сохраняет существующую модель: порядок labels - это порядок элементов массива `ccLabels`.

Альтернатива: pointer events с ручной геометрией. Это лучше для touch, но сложнее для маленького popup и тяжелее для текущих fake DOM tests.

### Drag Handle как кнопка/иконка без отдельного действия

Drag handle должен быть видимым icon element в начале строки, с `aria-hidden="true"` и `title`/screen-reader подсказкой на row при необходимости. Строка целиком draggable, чтобы пользователь мог схватить handle или строку. Handle использует уже bundled Nerd Font и содержит theme-specific icon spans: light icon виден в светлой теме, dark icon виден в темной теме.

Альтернатива: отдельные up/down кнопки. Они доступнее с клавиатуры, но пользователь попросил именно drag-and-drop; такие кнопки можно добавить отдельным будущим change.

### Reorder Persistence

После успешного drop сохранять нормализованный массив labels в `ccLabels`. Если drop не меняет позицию, не выполнять лишнее сохранение. После сохранения новые popup открытия и новые GitHub comment panels автоматически используют этот порядок через уже существующую загрузку `ccLabels`.

### Animated Preview

Для preview-перестановки использовать CSS transition/animation на `.label-row`, например короткую `transform` animation для строк, которые сдвигаются во время dragover. Реальная перестановка DOM выполняется сразу при dragover; animation нужна как визуальная подсказка, что второй элемент занял первое место еще до отпускания перетаскиваемого элемента. Animation marker должен ставиться только на диапазон между предыдущей preview-позицией и новой preview-позицией включительно, чтобы элементы вне последнего движения не прыгали. Например, после preview со второй позиции на четвертую следующее движение с четвертой preview-позиции на седьмую должно анимировать только четвертую, пятую, шестую и седьмую строки.

### Extension Icon Assets

Сгенерировать простую bitmap-иконку в четырех PNG sizes: `16`, `32`, `48`, `128`. Визуальный стиль: округлый квадрат/бейдж с контрастным `CC` и небольшим comment/review motif в существующей синей/нейтральной палитре. PNG assets положить в `src/icons/` и подключить в `manifest.json`:

- `icons`: `16`, `32`, `48`, `128`
- `action.default_icon`: те же размеры

Иконки должны быть локальными файлами расширения, без remote assets.

## Risks / Trade-offs

- Native drag-and-drop может вести себя по-разному в popup и fake DOM tests -> держать reorder logic в маленьких функциях, которые можно проверить через synthetic events.
- Preview re-render во время dragover может сбрасывать DOM node, на котором начался drag -> хранить drag state отдельно от DOM node и восстанавливать порядок на drag cancel.
- Drag-and-drop не является полноценной keyboard accessibility заменой -> оставить edit/delete доступными и зафиксировать keyboard reorder как non-goal для этого change.
- Chrome icon assets требуют реальные PNG files -> добавить static tests на наличие files и manifest wiring.
- Очень мелкая `16x16` иконка может терять детали -> дизайн должен быть простым: крупный `CC`, минимум мелких элементов.

## Migration Plan

1. Добавить drag handle и reorder logic в popup, сохранив `ccLabels`.
2. Добавить icon assets и manifest wiring.
3. Обновить тесты и README.
4. Rollback: удалить drag attributes/handlers, вернуть rows без handle, убрать manifest icons и icon files.
