## Диаграмма потока: экран «Проекты» (#/home)

```mermaid
sequenceDiagram
  participant Браузер
  participant app.js
  participant home.js
  participant Сервер

  Браузер->>app.js: hashchange → #/home
  app.js->>home.js: renderHomePage(appRoot)

  home.js->>Сервер: GET /api/auth/me
  Сервер-->>home.js: данные пользователя

  home.js->>Браузер: рендер шапки (вкладки по роли, колокольчик, меню)

  home.js->>Сервер: GET /api/projects
  Note over Сервер: Админ/Менеджер → все проекты<br/>Остальные → только через членство
  Сервер-->>home.js: информация о проектах

  home.js->>Браузер: сетка карточек проектов
```

## Упрощённый поток (роль «Исполнитель»)

Для сокращения числа веток взят **Исполнитель**: нет колокольчика уведомлений, карточки «Новый проект» и списка всех проектов — только проекты с активным членством в `user_project`. Поиск по названию остаётся на клиенте, без отдельного запроса.

```mermaid
sequenceDiagram

  box Клиент
    participant Браузер
    participant SPA as исполняемые файлы<br>app.js · home.js
    participant API as api/
  end

  box Сервер
    participant Express as server.js
    participant Routes as routes/
    participant БД as PostgreSQL
  end
  
  Браузер->>SPA: открытие /home
  SPA->>API: fetchMe()
  API->>Express: GET /api/auth/me
  Express->>Routes: обработчик<br>auth.js
  Routes->>БД: пользователь и роль
  БД-->>SPA: профиль (Исполнитель)

  SPA->>Браузер: отрисовка шапки

  SPA->>API: fetchProjects()
  API->>Express: GET /api/projects
  Express->>Routes: projects.js + requireAuth
  Routes->>БД: проекты JOIN user_project
  БД-->>SPA: список проектов

  SPA->>Браузер: отрисовка сетки карточек
```
