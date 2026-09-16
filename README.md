# Conventional Comments для GitHub

Chrome-расширение помогает писать комментарии в GitHub Pull Requests в формате Conventional Comments. Когда пользователь открывает стандартное поле комментария к строке кода, расширение добавляет рядом с ним кнопки labels. Клик по label вставляет префикс вроде `suggestion: ` в начало комментария.

## MVP

В первой версии поддерживается только GitHub Pull Requests:

- страницы `https://github.com/*/*/pull/*`;
- стандартные комментарии к строкам кода в Pull Request;
- labels `praise`, `nitpick`, `suggestion`, `issue`, `todo`, `question`, `thought`, `chore`, `note`;
- вставка выбранного label в начало поля комментария.

В MVP не входят GitLab, Bitbucket, настройки, popup, AI-подсказки, decorations вроде `(non-blocking)` и публикация в Chrome Web Store.

## Локальная установка

1. Откройте `chrome://extensions`.
2. Включите Developer mode.
3. Нажмите Load unpacked.
4. Выберите корневую папку этого проекта.
5. Откройте GitHub Pull Request и перейдите на вкладку Files changed.
6. Нажмите кнопку добавления комментария к строке кода.

Над стандартным полем комментария должна появиться панель Conventional Comments labels.

## Проверка вручную

- На GitHub Pull Request панель появляется только после открытия поля комментария к строке.
- Кнопка `suggestion:` вставляет `suggestion: ` в пустое поле.
- Кнопка `question:` вставляет `question: ` перед уже введенным текстом.
- Отправка и отмена комментария продолжают работать стандартными кнопками GitHub.
- На GitLab и Bitbucket расширение не добавляет интерфейс.

## Документация

Документация проекта ведется на русском языке. Формат Conventional Comments описан на сайте: https://conventionalcomments.org/
