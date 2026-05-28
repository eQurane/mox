---
name: Hero full-width text fix
overview: "Исправить узкую колонку текста в главной карточке (hero) на страницах задание и коллекции: переопределить CSS-сетку hero для экранов без колонки обложки. При желании — одна правка в правилах фронтенда."
todos:
  - id: css-override
    content: "Добавить в main.css медиа-правило .task-detail .project-detail__hero { grid-template-columns: 1fr; }"
    status: completed
  - id: docs-optional
    content: "По желанию: одна правка frontend-architecture.mdc про одноколоночный hero на задания/коллекции"
    status: completed
isProject: false
---

# Исправление ширины текста в hero на задание и коллекциях

## Причина

В [`client/styles/main.css`](client/styles/main.css) блок `.project-detail__hero` на ширине от 720px использует двухколоночную сетку:

```879:882:client/styles/main.css
@media (min-width: 720px) {
  .project-detail__hero {
    grid-template-columns: minmax(200px, 340px) 1fr;
  }
}
```

На [странице проекта](client/js/pages/projectDetail.js) в hero два дочерних узла: `.project-detail__hero-media` и сводка — раскладка корректна.

На [странице задания](client/js/pages/taskDetail.js) и [странице коллекции](client/js/pages/collectionDetail.js) в hero только один ребёнок — `.project-detail__summary` (обложки нет). Браузер кладёт его в **первую** колонку (`minmax(200px, 340px)`), вторая колонка остаётся пустой, поэтому описание визуально «не на всю ширину» карточки.

Оба экрана уже помечают корень как `<main class="dashboard project-detail task-detail">` — класс `task-detail` больше нигде на `main` не используется.

## Изменение в стилях

Добавить после существующего блока `@media (min-width: 720px)` для `.project-detail__hero` правило с **большей специфичностью**, чтобы только страницы задания/коллекции получали одну колонку на всю ширину:

- Селектор: `.task-detail .project-detail__hero` (внутри того же `@media (min-width: 720px)`).
- Значение: `grid-template-columns: 1fr` (либо эквивалент — например `minmax(0, 1fr)` при необходимости для переполнения длинных строк).

Страница проекта (`main` без `task-detail`) не затрагивается.

## Документация (по необходимости)

Если нужна синхронизация с текстом правил: в [`.cursor/rules/frontend-architecture.mdc`](.cursor/rules/frontend-architecture.mdc) в подпунктах про `#/project/:id/tasks/:taskId` и `#/project/:id/collections/:collectionId` добавить короткую фразу, что верхняя карточка — **текстовая без колонки обложки**, сетка hero на широких экранах **одноколоночная** (в отличие от карточки проекта с обложкой). Это опционально и не дублирует детали CSS, только намерение макета.

## Проверка вручную

1. Открыть задание с длинным описанием на ширине &gt;720px — текст должен занимать всю ширину белой карточки hero.
2. Открыть коллекцию — то же для описания.
3. Открыть проект с обложкой — двухколоночный hero без регрессий.
