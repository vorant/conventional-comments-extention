# extension-packaging Specification

## Purpose

Описывает packaging-поведение Chrome extension, которое влияет на установку и отображение расширения в Chrome UI, но не относится напрямую к popup или GitHub Pull Request comment UI.

## Requirements

### Requirement: Расширение имеет собственную иконку в Chrome UI

Расширение SHALL объявлять собственную иконку для Chrome extension UI, включая toolbar/action icon и manifest icons.

#### Scenario: Пользователь видит расширение в панели Chrome

- **WHEN** пользователь устанавливает расширение как unpacked extension
- **THEN** Chrome показывает для расширения собственную иконку вместо дефолтной иконки расширения

#### Scenario: Chrome запрашивает стандартные размеры иконки

- **WHEN** Chrome отображает расширение в местах, где нужны размеры `16`, `32`, `48` или `128`
- **THEN** manifest ссылается на существующие icon assets этих размеров
