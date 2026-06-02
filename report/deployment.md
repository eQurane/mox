# Диаграмма развёртывания (Mox)

Описывает **физические и логические узлы** при запуске системы. Для потоков запросов см. [diagramm.md](diagramm.md); для модулей внутри процесса — [README.md §2](README.md#2-клиент-серверная-архитектура).

Точка входа: `server/src/server.js` — один процесс Node.js раздаёт SPA (`client/`), REST API (`/api`) и медиа (`/storage` → `server/storage/`).

---

## Базовое развёртывание (один хост)

Подходит для локальной разработки и небольшого production: PostgreSQL на том же или соседнем хосте, без отдельного reverse proxy.

```mermaid
flowchart TB
  subgraph Client["Клиент"]
    Browser["Браузер<br/>SPA · sessionStorage JWT"]
  end

  subgraph AppHost["Хост приложения"]
    Node["Node.js<br/>npm start → server.js<br/>PORT из .env"]
    Env[".env<br/>JWT_SECRET · DATABASE_* · REGISTER_USER_STATUS"]
    ClientDir["client/<br/>статика SPA"]
    Storage[("server/storage/<br/>медиафайлы на диске")]
    Node --- Env
    Node --> ClientDir
    Node --> Storage
  end

  subgraph Database["База данных"]
    PG[("PostgreSQL<br/>БД mox")]
  end

  Browser -->|"HTTP(S)<br/>/, /api/*, /storage/*"| Node
  Node -->|"pg.Pool<br/>DATABASE_*"| PG
```

**Инициализация (однократно):** `npm run db:init` в каталоге `server/` — создание БД и схемы (`db_init/init.js`).

**Проверка работоспособности:** `GET /api/health`, `GET /api/health/db`.

---

## Рекомендуемое production-развёртывание

Типовая схема: TLS и лимиты загрузки на reverse proxy, приложение за прокси, PostgreSQL на отдельном узле или managed-сервисе, **постоянный том** для `server/storage/`.

```mermaid
flowchart LR
  User["Пользователь"]

  subgraph Edge["Периметр"]
    Proxy["Nginx / Caddy<br/>TLS · client_max_body_size"]
  end

  subgraph AppTier["Узел приложения"]
    Node["Node.js Express<br/>PORT"]
    Vol[("Persistent volume<br/>server/storage/")]
    EnvFile[".env / secrets"]
    Node --- Vol
    Node --- EnvFile
  end

  subgraph DBTier["Узел БД"]
    PG[("PostgreSQL")]
  end

  User -->|"HTTPS"| Proxy
  Proxy -->|"proxy_pass :PORT"| Node
  Node -->|"TCP 5432"| PG
```

> При **нескольких** экземплярах Node за балансировщиком каталог `storage/` должен быть **общим** (NFS, сетевой том и т.п.) или позже — внешнее object storage. Иначе файл, загруженный на инстанс A, не откроется с инстанса B.

---

## Артефакты и зависимости на узле приложения

```mermaid
flowchart TB
  subgraph Repo["Репозиторий / артефакт деплоя"]
    ServerPkg["server/<br/>package.json · src/ · db_init/"]
    ClientPkg["client/<br/>index.html · js/ · styles/"]
  end

  subgraph Runtime["Среда выполнения"]
    NodeRuntime["Node.js ≥ LTS"]
    NpmDeps["node_modules<br/>npm install --production"]
  end

  subgraph External["Внешние сервисы"]
    PG2[("PostgreSQL")]
    Disk[("Диск storage/")]
  end

  ServerPkg --> NodeRuntime
  ClientPkg --> NodeRuntime
  ServerPkg --> NpmDeps
  NodeRuntime --> PG2
  NodeRuntime --> Disk
```

| Компонент | Расположение | Назначение |
|-----------|--------------|------------|
| SPA | `client/` | Hash-роутер, страницы, `fetch` к `/api` |
| API | `server/src/routes/` | REST, JWT, multer-загрузки |
| Медиа на диске | `server/storage/` | Файлы; URL в БД: `/storage/<имя>` |
| Метаданные | PostgreSQL | Пользователи, проекты, медиа, комментарии |
| Секреты | `.env` на сервере | `JWT_SECRET` (обязателен при `NODE_ENV=production`), `DATABASE_*`, `REGISTER_USER_STATUS` |

---

## Потоки по границам узлов

```mermaid
flowchart LR
  B["Браузер"]

  subgraph Node["Express :PORT"]
    Static["express.static(client/)"]
    API["/api → routes/*"]
    Files["/storage → server/storage/"]
  end

  PG[("PostgreSQL")]

  B -->|"GET /, /js/*, /styles/*"| Static
  B -->|"GET/POST /api/* + Bearer JWT"| API
  B -->|"GET /storage/*"| Files
  API -->|"SQL"| PG
  API -->|"fs write/read"| Files
```
