# Mox

Веб-платформа для управления проектами с медиаконтентом: проекты, задания, коллекции, загрузка файлов, комментарии, ролевая модель доступа.

**Стек:** клиент — HTML/CSS/ванильный JavaScript (ES Modules); сервер — Node.js, Express, PostgreSQL; аутентификация — JWT.

Подробный отчёт по архитектуре, API и ролям: [report/README.md](report/README.md). Диаграммы: [report/diagramm.md](report/diagramm.md), [report/deployment.md](report/deployment.md).

---

## Структура репозитория

```
mox/
├── client/           # SPA (hash-роутер, js/pages, js/api)
├── server/           # Express, PostgreSQL, server/storage/
├── report/           # документация и диаграммы
└── README.md         # этот файл
```

---

## Быстрый старт

1. **PostgreSQL** на порту 5432 (или настройте хост в `.env`).

2. **Зависимости и окружение:**
   ```bash
   cd server
   npm install
   cp .env.example .env
   ```
   Отредактируйте `server/.env`.

3. **Инициализация БД** (однократно):
   ```bash
   npm run db:init
   ```

4. **Запуск:**
   ```bash
   npm run dev    # разработка (nodemon)
   npm start      # production
   ```

5. Откройте в браузере `http://localhost:3000/` (порт из `PORT` в `.env`).

---

## Переменные окружения (`server/.env`)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | Подключение PostgreSQL |
| `PORT` | Порт HTTP-сервера (по умолчанию 3000) |
| `JWT_SECRET` | Секрет подписи JWT (в production обязателен сильный ключ) |
| `JWT_EXPIRES_IN` | Срок жизни токена, например `7d` |
| `REGISTER_USER_STATUS` | Статус новой учётной записи при `POST /api/auth/register` — точное имя из `statuses_users` (`Активный` или `На подтверждении`) |
| `INIT_DATE` | Нижняя граница дат при создании таблиц (`db_init`) |

Пример: [server/.env.example](server/.env.example).

---

## Медиафайлы

Загрузки сохраняются в **`server/storage/`** и отдаются по URL **`/storage/<имя_файла>`**. Путь к каталогу задаётся в `server/src/paths.js`.

---

## REST API (группы)

Все маршруты под префиксом **`/api`**. Защищённые эндпоинты требуют заголовок `Authorization: Bearer <JWT>`.

| Префикс | Назначение |
|---------|------------|
| `GET /api/health`, `GET /api/health/db` | Проверка сервера и БД |
| `/api/auth/*` | Регистрация, логин, `GET /auth/me` |
| `/api/projects` | Проекты, участники (`user_project`) |
| `/api/tasks` | Задания |
| `/api/collections` | Коллекции |
| `/api/media` | Медиа: список, загрузка, карточка, PATCH, DELETE, replace |
| `/api/media/:mediaId/comments` | Комментарии к медиа |
| `/api/notifications` | Уведомления (Админ, Менеджер) |
| `/api/admin/*` | Админ-панель (только роль «Админ») |

Полная таблица эндпоинтов: [report/README.md §7](report/README.md#7-rest-api).

---

## Клиент (SPA)

- Hash-роутинг: `#/маршрут` ([`client/js/app.js`](client/js/app.js)).
- После входа JWT и снимок пользователя в **`sessionStorage`** (`mox_token`, `mox_user`).
- **Обычный вход:** `#/login`
- **Демо-вход** (список тестовых аккаунтов на странице): `#/login-special`

Пустой hash по умолчанию ведёт на `#/login`. Неавторизованный доступ к защищённым маршрутам — редирект на `#/login`.

---

## Демо-аккаунты

Страница **`#/login-special`** показывает те же учётные данные в интерфейсе (кнопка «Подставить» заполняет форму). **Только для демонстрации:** пароли попадают в клиентский бандл; не используйте такой подход в production.

| Роль | Email | Пароль |
|------|-------|--------|
| Администратор | admin@admin.com | `X9*q!VY-xqy972P` |
| Внешний подрядчик | andrey@sokolov.ru | `RWKa7h@TEADp!R6` |
| Менеджер | anna@ya.ru | `N5#kc@!ZNxw4W36` |
| Исполнитель | axle@ax.us | `iVEFgw!!rge2b4$` |
| Клиент | coffehouse@ch.ch | `ra!2528_-mkVHj.` |
| Исполнитель | diana@protonmail.com | `gwkrwA7W#n!cYy3` |
| Клиент | green.coast@gc.com | `#c-HntivX87@pdb` |
| Исполнитель | lilith@li.hk | `FG$WuQ-tx9CfPzU` |
| Исполнитель | ser.gamer@gmail.com | `bseTCp#Q-7C-fri` |

Учётные записи должны существовать в БД со статусом **«Активный»**.

---

## Структура `server/src/`

```
server/
├── src/
│   ├── server.js              # Express: статика client/, /storage, /api
│   ├── db.js                  # пул PostgreSQL
│   ├── paths.js               # путь к server/storage/
│   ├── jwtSecret.js
│   ├── middleware/
│   │   ├── auth.js            # requireAuth (Bearer JWT)
│   │   └── requireAdmin.js
│   ├── access/
│   │   └── contractorTaskScope.js
│   └── routes/
│       ├── health.js
│       ├── auth.js
│       ├── projects.js
│       ├── tasks.js
│       ├── collections.js
│       ├── media.js
│       ├── comments.js
│       ├── notifications.js
│       └── admin.js
├── db_init/
│   └── init.js                # схема и seed справочников
├── storage/                   # загруженные файлы (не в git)
├── package.json
└── .env.example
```

Скрипты в `server/package.json`: `start`, `dev`, `db:init`.
