# Отчёт по проекту Mox

## Содержание

1. [Общее описание](#1-общее-описание)
2. [Клиент-серверная архитектура](#2-клиент-серверная-архитектура)
3. [Серверная часть](#3-серверная-часть)
4. [Клиентская часть](#4-клиентская-часть)
5. [Доменная модель и иерархия сущностей](#5-доменная-модель-и-иерархия-сущностей)
6. [Роли и права доступа](#6-роли-и-права-доступа)
7. [REST API](#7-rest-api)
8. [Поток аутентификации](#8-поток-аутентификации)

---

## 1. Общее описание

**Mox** — веб-платформа для управления проектами с медиаконтентом. Система позволяет организовывать работу над проектами: создавать технические задания, группировать медиафайлы в коллекции, оставлять комментарии и получать уведомления об активности.

**Ключевые возможности:**

- Управление проектами, техническими заданиями и коллекциями
- Загрузка, замена и архивирование медиафайлов (изображения, видео, аудио, документы)
- Комментирование медиа участниками проекта
- Ролевая модель доступа с гибкими ограничениями по видимости
- Уведомления о новых комментариях в реальном времени (polling)

**Технологический стек:**

| Слой | Технологии |
|---|---|
| Фронтенд | HTML + CSS + ванильный JavaScript (ES Modules), без фреймворков |
| Бэкенд | Node.js, Express.js |
| База данных | PostgreSQL (`pg`, connection pool) |
| Аутентификация | JWT (`jsonwebtoken`), хэширование паролей `bcryptjs` |
| Хранение файлов | Файловая система (`storage/` в корне репозитория) |
| Разработка | `nodemon`, `dotenv`, `cors` |

---

## 2. Клиент-серверная архитектура

```mermaid
graph TD
    subgraph Browser["🌐 Браузер (Client)"]
        HTML["index.html\n#app"]
        Router["js/app.js\nhash-роутер"]
        Pages["js/pages/*.js\nэкраны"]
        ApiLayer["js/api/*.js\nfetch + Bearer JWT"]
        Session["js/auth/session.js\nsessionStorage"]

        HTML --> Router
        Router --> Pages
        Pages --> ApiLayer
        Router --> Session
    end

    subgraph Server["🖥️ Сервер (Node.js / Express)"]
        ServerJS["server.js\nточка входа"]
        Middleware["middleware/auth.js\njwt.verify"]
        Routes["routes/*.js\nauth, projects, tasks,\ncollections, media,\ncomments, notifications"]

        ServerJS --> Middleware
        Middleware --> Routes
    end

    subgraph DB["🗄️ PostgreSQL"]
        Tables["users, projects, tasks,\ncollections, media, comments"]
    end

    Storage["💾 storage/\nмедиафайлы на диске"]

    ApiLayer -- "REST /api\nAuthorization: Bearer JWT" --> ServerJS
    ServerJS -- "статика client/" --> HTML
    ServerJS -- "статика /storage" --> Storage
    Routes -- "pg.Pool / SQL" --> Tables
    Routes -- "multer / fs" --> Storage
```

**Принципы взаимодействия:**

- Весь обмен данными — через REST API с префиксом `/api`, формат JSON
- Исключение: загрузка файлов — `multipart/form-data` (`POST /api/media`, `POST /api/media/:id/replace`)
- JWT-токен выдаётся при логине и хранится в `sessionStorage` на стороне клиента
- Каждый защищённый запрос передаёт токен в заголовке `Authorization: Bearer <token>`
- Медиафайлы после загрузки на сервер раздаются как статика по пути `/storage/<filename>`

---

## 3. Серверная часть

### Структура файлов

```
server/
├── src/
│   ├── server.js             ← точка входа: Express-приложение
│   │                           раздаёт client/ как статику,
│   │                           storage/ по пути /storage,
│   │                           монтирует роутеры на /api
│   ├── db.js                 ← пул подключений PostgreSQL (pg.Pool)
│   ├── paths.js              ← абсолютный путь к storage/
│   ├── jwtSecret.js          ← JWT_SECRET и JWT_EXPIRES_IN из env
│   ├── middleware/
│   │   └── auth.js           ← bearerToken + requireAuth
│   └── routes/
│       ├── health.js         ← GET /api/health, /api/health/db
│       ├── auth.js           ← register, login, /auth/me
│       ├── projects.js       ← CRUD проектов + create-options
│       ├── tasks.js          ← CRUD ТЗ + create-options
│       ├── collections.js    ← CRUD коллекций
│       ├── media.js          ← загрузка, замена, soft-delete
│       ├── comments.js       ← комментарии к медиа
│       └── notifications.js  ← уведомления (derived query)
└── db_init/
    └── init.js               ← создание БД, схемы, seed справочников
```

### Схема модулей сервера

```mermaid
graph LR
    ENV[".env"] --> ServerJS

    subgraph Entry["Точка входа"]
        ServerJS["server.js"]
    end

    subgraph Config["Конфигурация"]
        DB["db.js\npg.Pool"]
        JWT["jwtSecret.js\nJWT_SECRET"]
        Paths["paths.js\nstorage path"]
    end

    subgraph MW["Middleware"]
        Auth["auth.js\nbearerToken\nrequireAuth"]
    end

    subgraph Routes["Роутеры /api"]
        Health["health.js"]
        AuthR["auth.js"]
        Projects["projects.js"]
        Tasks["tasks.js"]
        Collections["collections.js"]
        Media["media.js"]
        Comments["comments.js"]
        Notif["notifications.js"]
    end

    ServerJS --> DB
    ServerJS --> JWT
    ServerJS --> Paths
    ServerJS --> Auth
    ServerJS --> Health
    ServerJS --> AuthR
    ServerJS --> Projects
    ServerJS --> Tasks
    ServerJS --> Collections
    ServerJS --> Media
    ServerJS --> Comments
    ServerJS --> Notif

    Auth --> JWT
    Projects --> DB
    Tasks --> DB
    Collections --> DB
    Media --> DB
    Media --> Paths
    Comments --> DB
    Notif --> DB
    AuthR --> DB
```

### Переменные окружения (`server/.env`)

| Переменная | Назначение |
|---|---|
| `PORT` | Порт сервера (по умолчанию `3000`) |
| `DATABASE_HOST` / `_PORT` / `_NAME` / `_USER` / `_PASSWORD` | Параметры PostgreSQL |
| `JWT_SECRET` | Секрет подписи JWT (обязателен в production) |
| `JWT_EXPIRES_IN` | Срок жизни токена (по умолчанию `7d`) |
| `REGISTER_USER_STATUS` | Статус нового пользователя (по умолчанию `Активный`) |
| `INIT_DATE` | Нижняя граница дат для валидации (по умолчанию `2026-05-01`) |

### Поток авторизации запроса

```mermaid
flowchart TD
    REQ["Входящий запрос\nAuthorization: Bearer token"]
    EXTRACT["bearerToken()\nИзвлечь токен из заголовка"]
    VERIFY{"jwt.verify(token)"}
    SET["req.userId = …\nreq.roleId = …"]
    ROLE{"Роль\nдопускает\nдействие?"}
    HANDLER["Route Handler\nбизнес-логика + SQL"]
    RESP["JSON-ответ"]
    E401["401 Unauthorized"]
    E403["403 Forbidden"]

    REQ --> EXTRACT
    EXTRACT --> VERIFY
    VERIFY -- "OK" --> SET
    VERIFY -- "FAIL" --> E401
    SET --> ROLE
    ROLE -- "да" --> HANDLER
    ROLE -- "нет" --> E403
    HANDLER --> RESP
```

---

## 4. Клиентская часть

### Структура файлов

```
client/
├── index.html                ← оболочка SPA: <div id="app">
├── styles/main.css           ← все стили приложения
├── icons/                    ← SVG-иконки (back, save, edit, list,
│                               no-image, notifications, video, music,
│                               table, docs)
└── js/
    ├── app.js                ← bootstrap + hash-роутер
    ├── auth/
    │   └── session.js        ← getToken, setSession, clearSession,
    │                           isLoggedIn, getUserSnapshot
    │                           (хранилище: sessionStorage)
    ├── api/
    │   ├── auth.js           ← login, register, fetchMe
    │   ├── projects.js       ← fetchProjects, fetchProjectById,
    │   │                       createProject, updateProject, …
    │   ├── tasks.js          ← fetchTasks, fetchTaskById,
    │   │                       createTask, updateTask, …
    │   ├── collections.js    ← fetchCollections, fetchCollectionById, …
    │   ├── media.js          ← fetchMedia, uploadMedia, replaceMedia,
    │   │                       updateMedia, deleteMedia, …
    │   ├── comments.js       ← fetchComments, addComment
    │   └── notifications.js  ← fetchNotifications
    ├── utils/
    │   ├── mediaCardThumb.js ← attachMediaCardThumb, attachCoverThumb
    │   └── notificationBell.js ← renderNotificationBell (polling 30с)
    ├── nav/
    │   └── dashboardTabs.js  ← шапка с вкладками
    └── pages/
        ├── login.js / register.js
        ├── home.js / admin.js
        ├── projectNew.js / projectEdit.js / projectDetail.js
        ├── tasksList.js / taskNew.js / taskEdit.js / taskDetail.js
        ├── collectionsList.js / collectionNew.js
        │   collectionEdit.js / collectionDetail.js
        ├── mediaList.js / mediaNew.js / mediaDetail.js
        └── projectFormShared.js / taskFormShared.js
```

### Схема модулей клиента

```mermaid
graph TD
    HTML["index.html\n#app"] --> AppJS["app.js\nhash-роутер"]

    AppJS --> Session["auth/session.js\nsessionStorage"]
    AppJS --> Pages

    subgraph Pages["js/pages/ — экраны"]
        Home["home.js"]
        ProjD["projectDetail.js"]
        ProjN["projectNew.js"]
        ProjE["projectEdit.js"]
        Tasks["tasksList / taskNew\ntaskEdit / taskDetail"]
        Colls["collectionsList / collectionNew\ncollectionEdit / collectionDetail"]
        Media["mediaList / mediaNew\nmediaDetail"]
        Auth["login.js / register.js"]
        Admin["admin.js"]
    end

    subgraph API["js/api/ — HTTP-клиент"]
        AProj["projects.js"]
        ATasks["tasks.js"]
        AColls["collections.js"]
        AMedia["media.js"]
        AComm["comments.js"]
        ANotif["notifications.js"]
        AAuth["auth.js"]
    end

    subgraph Utils["js/utils/"]
        Thumb["mediaCardThumb.js\nattachMediaCardThumb\nattachCoverThumb"]
        Bell["notificationBell.js\npolling 30с"]
    end

    Nav["nav/dashboardTabs.js\nшапка + вкладки"]

    Pages --> API
    Pages --> Thumb
    Pages --> Bell
    Pages --> Nav
    API -- "fetch /api\nBearer JWT" --> Backend["🖥️ Сервер"]
```

### Роутинг и защита маршрутов

```mermaid
flowchart TD
    URL["URL изменился\n(hashchange)"] --> NORM["Нормализация:\npath + searchParams"]
    NORM --> LOGIN_CHECK{"isLoggedIn()?"}
    LOGIN_CHECK -- "нет" --> REDIR_LOGIN["→ #/login"]
    LOGIN_CHECK -- "да" --> ROLE_CHECK{"Роль\nдопускает\nмаршрут?"}
    ROLE_CHECK -- "нет" --> REDIR_HOME["→ #/home"]
    ROLE_CHECK -- "да" --> RENDER["render…Page(appRoot, …)"]
    RENDER --> API_CALL["js/api/*.js\nGET /api/…"]
    API_CALL --> DOM["DOM API\n→ вставка в #app"]
```

---

## 5. Доменная модель и иерархия сущностей

```mermaid
erDiagram
    users {
        int id PK
        string name
        string email
        string password_hash
        int role_id FK
        int status_id FK
    }
    roles {
        int id PK
        string name
    }
    projects {
        int id PK
        string name
        string goal
        date start_date
        date end_date
        int status_id FK
    }
    user_project {
        int user_id FK
        int project_id FK
        timestamp included_at
        timestamp excluded_at
    }
    tasks {
        int id PK
        int project_id FK
        string name
        string description
        date deadline
        int role_id FK
        int status_id FK
    }
    collections {
        int id PK
        int task_id FK
        string name
        string description
        timestamp created_at
        timestamp last_edited_at
    }
    media {
        int id PK
        int collection_id FK
        string path
        string name
        string format
        string description
        timestamp upload_at
        int status_id FK
    }
    comments {
        int id PK
        int media_id FK
        int user_id FK
        string text
        timestamp created_at
    }

    users }o--|| roles : "имеет роль"
    users }o--o{ user_project : "участвует"
    projects }o--o{ user_project : "содержит"
    projects ||--o{ tasks : "включает"
    tasks ||--o{ collections : "включает"
    collections ||--o{ media : "содержит"
    media ||--o{ comments : "получает"
    comments }o--|| users : "написан"
```

**Обложки (`coverPath`)** вычисляются динамически — последний загруженный медиафайл по цепочке вниз (`upload_at DESC`). Отдельного поля в БД нет.

---

## 6. Роли и права доступа

```mermaid
graph LR
    subgraph Roles["Роли"]
        Admin["Админ"]
        Manager["Менеджер"]
        Executor["Исполнитель"]
        Client["Клиент"]
        External["Внешний\nподрядчик"]
    end

    subgraph Access["Уровни доступа"]
        Full["Все проекты\n+ все действия"]
        ManageOwn["Все проекты\n+ создание/редактирование"]
        ViewOwn["Свои проекты\n+ комментарии + медиа"]
        ProjectOnly["Только свои проекты\n(без ТЗ/медиа/коллекций)"]
        None["Нет доступа"]
    end

    Admin --> Full
    Manager --> ManageOwn
    Executor --> ViewOwn
    Client --> ProjectOnly
    External --> None
```

**Матрица прав:**

| Действие | Админ | Менеджер | Исполнитель | Клиент | Внеш. |
|---|:---:|:---:|:---:|:---:|:---:|
| Просмотр всех проектов | ✓ | ✓ | — | — | — |
| Просмотр своих проектов | ✓ | ✓ | ✓ | ✓ | — |
| Создание / редактирование проекта | ✓ | ✓ | — | — | — |
| Просмотр ТЗ / коллекций / медиа | ✓ | ✓ | ✓ | — | — |
| Создание ТЗ | ✓ | ✓ | — | — | — |
| Создание коллекции (`POST /api/collections`, член проекта) | ✓ | ✓ | ✓ | — | — |
| Загрузка медиа (`POST /api/media`) | ✓ | ✓ | ✓ | — | — |
| Редактирование описания медиа | ✓ | ✓ | ✓ | — | — |
| Soft-delete медиа | ✓ | ✓ | ✓ | — | — |
| Замена файла медиа | ✓ | ✓ | — | — | — |
| Комментарии | ✓ | ✓ | ✓ | — | — |
| Уведомления (колокольчик) | ✓ | ✓ | — | — | — |
| Раздел `/admin` | ✓ | — | — | — | — |
| Назначить Менеджера участником | ✓ | — | — | — | — |

---

## 7. REST API

### Сводная таблица эндпоинтов

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/api/health` | Статус сервера | публичный |
| GET | `/api/health/db` | Проверка БД | публичный |
| GET | `/api/auth/register-options` | Список ролей | публичный |
| POST | `/api/auth/register` | Регистрация | публичный |
| POST | `/api/auth/login` | Логин, выдача JWT | публичный |
| GET | `/api/auth/me` | Текущий пользователь | Bearer |
| GET | `/api/projects` | Список проектов | Bearer |
| GET | `/api/projects/create-options` | Справочники для формы | Bearer, Админ/Менеджер |
| POST | `/api/projects` | Создать проект | Bearer, Админ/Менеджер |
| GET | `/api/projects/:id` | Карточка проекта (с ТЗ, коллекциями, медиа) | Bearer |
| PATCH | `/api/projects/:id` | Обновить проект | Bearer, Админ/Менеджер |
| GET | `/api/tasks` | Список ТЗ (с фильтрами) | Bearer |
| GET | `/api/tasks/create-options` | Справочники для формы ТЗ | Bearer, Админ/Менеджер |
| POST | `/api/tasks` | Создать ТЗ | Bearer, Админ/Менеджер |
| GET | `/api/tasks/:id` | Карточка ТЗ | Bearer |
| PATCH | `/api/tasks/:id` | Обновить ТЗ | Bearer, Админ/Менеджер |
| GET | `/api/collections` | Список коллекций (с фильтрами) | Bearer |
| POST | `/api/collections` | Создать коллекцию | Bearer, Админ/Менеджер/Исполнитель |
| GET | `/api/collections/:id` | Карточка коллекции (с медиа) | Bearer |
| PATCH | `/api/collections/:id` | Обновить коллекцию | Bearer, Админ/Менеджер |
| GET | `/api/media` | Список медиа (с фильтрами) | Bearer |
| POST | `/api/media` | Загрузить файл (multipart) | Bearer, Админ/Менеджер/Исполнитель/подрядчик |
| GET | `/api/media/:id` | Карточка медиа | Bearer |
| PATCH | `/api/media/:id` | Обновить описание | Bearer, Мен/Адм/Исп |
| DELETE | `/api/media/:id` | Soft-delete → статус «Удалённый» | Bearer, Мен/Адм/Исп |
| POST | `/api/media/:id/replace` | Заменить файл (новая запись + архив старой) | Bearer, Админ/Менеджер |
| GET | `/api/media/:id/comments` | Список комментариев | Bearer, Мен/Адм/Исп |
| POST | `/api/media/:id/comments` | Добавить комментарий | Bearer, Мен/Адм/Исп |
| GET | `/api/notifications` | Последние комментарии по проектам | Bearer, Админ/Менеджер |

---

## 8. Поток аутентификации

```mermaid
sequenceDiagram
    participant B as Браузер
    participant S as Сервер
    participant DB as PostgreSQL

    Note over B,DB: Регистрация
    B->>S: POST /api/auth/register {name, email, password, roleId}
    S->>DB: SELECT role WHERE id = roleId
    S->>S: bcryptjs.hash(password, 10)
    S->>DB: INSERT INTO users
    S-->>B: 201 {id, name, email, roleName}

    Note over B,DB: Логин
    B->>S: POST /api/auth/login {email, password}
    S->>DB: SELECT user WHERE email = ?
    S->>S: bcryptjs.compare(password, hash)
    S->>S: Проверка статуса «Активный»
    S->>S: jwt.sign({userId, roleId})
    S-->>B: 200 {token, user}
    B->>B: sessionStorage: mox_token, mox_user

    Note over B,DB: Защищённый запрос
    B->>S: GET /api/projects\nAuthorization: Bearer token
    S->>S: jwt.verify(token) → userId, roleId
    S->>DB: SELECT projects (с фильтром по роли)
    S-->>B: 200 {projects: [...]}

    Note over B: Выход
    B->>B: clearSession()\nsessionStorage очищен
    B->>B: location.hash = '#/login'
```
