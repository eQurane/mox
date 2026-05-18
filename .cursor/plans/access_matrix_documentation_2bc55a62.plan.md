---
name: Access Matrix Documentation
overview: Создание документации по матрице доступа в виде markdown файла с таблицами прав для каждой роли и визуальными диаграммами системы разграничения прав.
todos:
  - id: create_doc_structure
    content: Создать файл .cursor/rules/access-matrix.mdc с метаданными и структурой разделов
    status: completed
  - id: roles_section
    content: Написать раздел с описанием ролей и их назначением, добавить mermaid диаграмму иерархии
    status: completed
  - id: auth_mechanism
    content: Документировать механизм JWT авторизации и middleware requireAuth
    status: completed
  - id: api_matrix
    content: Создать детальную таблицу матрицы доступа к API эндпоинтам
    status: completed
  - id: ui_matrix
    content: Создать таблицу доступа к страницам фронтенда
    status: completed
  - id: project_membership
    content: Описать систему членства в проектах через user_project
    status: completed
  - id: sequence_diagram
    content: Добавить mermaid sequence diagram процесса проверки прав
    status: completed
  - id: constants_reference
    content: Перечислить все константы проверки ролей с ссылками на файлы
    status: completed
isProject: false
---

# Матрица доступа: документация и визуализация

## Обзор

Создадим файл [`.cursor/rules/access-matrix.mdc`](.cursor/rules/access-matrix.mdc) с полной документацией системы разграничения прав доступа в проекте mox.

## Структура документа

### 1. Введение и общая схема
- Описание 5 ролей системы (Админ, Менеджер, Исполнитель, Внешний подрядчик, Клиент)
- Mermaid диаграмма иерархии ролей с уровнями доступа

### 2. Механизм авторизации
- Схема работы JWT токенов
- Как `roleId` передается и проверяется
- Mermaid flowchart процесса проверки прав на backend

### 3. Матрица доступа к API
Таблица в формате:

| Эндпоинт | Метод | Админ | Менеджер | Исполнитель | Внешний подрядчик | Клиент | Примечания |
|----------|-------|-------|----------|-------------|-------------------|--------|------------|

Разделы:
- **Аутентификация** (`/api/auth/*`)
- **Проекты** (`/api/projects/*`)
- **Задачи** (`/api/tasks/*`)
- **Коллекции** (`/api/collections/*`)
- **Медиа** (`/api/media/*`)
- **Комментарии** (`/api/media/:id/comments`)
- **Уведомления** (`/api/notifications`)

### 4. Матрица доступа к UI
Таблица доступа к страницам фронтенда:

| Страница (hash) | Админ | Менеджер | Исполнитель | Внешний подрядчик | Клиент |
|-----------------|-------|----------|-------------|-------------------|--------|

### 5. Членство в проектах
- Описание таблицы `user_project`
- Логика `excluded_at IS NULL`
- Как роли Исполнитель и Клиент получают доступ к проектам

### 6. Визуальная схема проверки прав
Mermaid диаграмма последовательности:
- Запрос с JWT → middleware `requireAuth` → извлечение `roleId` → проверка роли → проверка членства в проекте (если нужно) → доступ/отказ

### 7. Константы проверки на backend
Перечисление всех используемых наборов ролей:
- `ROLES_ALL_PROJECTS`
- `ROLES_CAN_MODIFY`
- `ROLES_CAN_COMMENT`
- `ROLES_WITH_NOTIFICATIONS`
- `ASSIGNABLE_ROLE_NAMES`
- `TASK_ROLE_NAMES`

С указанием файлов, где они используются.

## Источники данных

Документация будет составлена на основе:
- [`server/src/routes/*.js`](server/src/routes/) - логика проверки прав на каждом эндпоинте
- [`server/src/middleware/auth.js`](server/src/middleware/auth.js) - middleware авторизации
- [`server/db_init/init.js`](server/db_init/init.js) - определение ролей
- [`client/js/app.js`](client/js/app.js) - проверки прав на фронтенде
- [`.cursor/rules/backend-api.mdc`](.cursor/rules/backend-api.mdc) - спецификация API

## Формат файла

- Заголовок `description` для правил Cursor
- Указание `globs` для применения к релевантным файлам
- Форматирование: таблицы, диаграммы mermaid, примеры кода
- Условные обозначения:
  - ✅ - Полный доступ
  - 👁️ - Только чтение
  - ⚠️ - Ограниченный доступ (с условиями)
  - ❌ - Запрещено

## Диаграммы

1. **Hierarchy diagram** - иерархия ролей (graph TD)
2. **Sequence diagram** - процесс проверки прав при запросе к API
3. **Flowchart** - алгоритм определения доступа к проекту через `user_project`