# DOM-признаки GitHub Pull Request review comments

Задача MVP - не заменить интерфейс GitHub, а аккуратно добавить панель labels рядом с уже открытым полем комментария к строке кода.

## Устойчивые признаки

- Расширение работает только на URL вида `https://github.com/<owner>/<repo>/pull/<number>`.
- Поле комментария определяется через `textarea`.
- В новом GitHub Pull Request UI реальное поле может не иметь `name`, но имеет `aria-label="Markdown value"` и `placeholder="Leave a comment"`.
- В старом UI ожидаемый признак формы GitHub - `name="comment[body]"`.
- Дополнительные признаки для разных состояний редактора - `aria-label` или `placeholder`, содержащие `comment`, `leave a comment` или `add a comment`.
- Для защиты от повторной обработки textarea помечается атрибутом `data-cc-label-panel`.

## Размещение панели

Панель вставляется перед ближайшей подходящей оберткой textarea:

- `[class*="MarkdownInput-module__inputWrapper"]` в новом GitHub Pull Request UI;
- `text-expander`, если GitHub использует его вокруг textarea;
- иначе перед самой textarea.

В новом UI сама textarea лежит внутри `inline-flex` wrapper-а. Если вставить панель прямо перед textarea, она окажется слева от поля. Поэтому для актуального GitHub UI панель вставляется уровнем выше, перед input wrapper, внутри вертикального контейнера markdown editor.

## Ограничения проверки

Проверка через CDP на реальном открытом GitHub Pull Request показала:

- кнопка строки имеет `aria-label="Add comment"`;
- поле комментария имеет `aria-label="Markdown value"` и `placeholder="Leave a comment"`;
- URL вкладки Files changed в новом GitHub UI может выглядеть как `/pull/<number>/changes`;
- загрузка unpacked extension в тестовом профиле Chrome может быть заблокирована локальной политикой профиля, поэтому поведение content script дополнительно проверялось CDP-инъекцией на реальном DOM GitHub.
