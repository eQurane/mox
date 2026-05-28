---
name: storage в server
overview: Перенести физический каталог медиа из корня репозитория в `server/storage/`, обновить `paths.js` и `.gitignore`, переместить существующие файлы. Публичные URL `/storage/…` и код клиента не меняются.
todos:
  - id: move-files
    content: Переместить содержимое корневого storage/ в server/storage/, удалить пустой старый каталог
    status: completed
  - id: update-paths
    content: Обновить server/src/paths.js (serverRoot + server/storage)
    status: completed
  - id: update-gitignore
    content: Заменить storage/ на server/storage/ в .gitignore
    status: completed
  - id: sync-docs
    content: Синхронизировать .cursor/rules/* и report/README.md (опционально server/README.md)
    status: completed
  - id: verify
    content: "Проверить: статика /storage, новая загрузка, админ large-files"
    status: completed
isProject: false
---

# Перенос `storage/` в `server/storage/`

## Зачем и что не меняется

Да, по логике хранилище относится к серверу: загрузки, multer, статика Express и админ-скан — всё в [`server/`](server/). Клиент и БД работают только с **публичным** путём `/storage/<имя_файла>` ([`media.path`](server/src/routes/media.js)); его **не трогаем**.

```mermaid
flowchart LR
  Client["Клиент img src=/storage/file"]
  Express["server.js express.static"]
  Disk["server/storage/file"]
  DB["media.path = /storage/file"]
  Client --> Express
  Express --> Disk
  DB -.->|тот же URL| Client
```

## Текущее состояние

- [`server/src/paths.js`](server/src/paths.js): `storageDir = <repoRoot>/storage`, где `repoRoot = join(__dirname, '..', '..')`.
- [`server/src/server.js`](server/src/server.js): `mkdirSync(storageDir)`, `app.use('/storage', express.static(storageDir))`.
- Использование `storageDir`: [`media.js`](server/src/routes/media.js) (multer), [`admin.js`](server/src/routes/admin.js) (скан >50 МБ, hard-delete).
- [`.gitignore`](.gitignore): строка `storage/` (корень репо).
- Клиент: только URL из API; правок в `client/` **не требуется**.

## Шаги реализации

### 1. Физический перенос данных

По вашему ответу — в корневом `storage/` уже есть файлы:

1. Создать `server/storage/` (если нет).
2. Переместить содержимое `storage/*` → `server/storage/` (PowerShell: `Move-Item` или `robocopy` + удаление пустого старого каталога).
3. Удалить пустой корневой `storage/`, если он остался.

После перезапуска сервера превью и ссылки продолжат работать: имена файлов и `media.path` те же.

### 2. Код сервера (один файл)

Обновить [`server/src/paths.js`](server/src/paths.js):

```javascript
const serverRoot = path.join(__dirname, '..');
/** Каталог для загружаемых медиа: `<server>/storage`. */
export const storageDir = path.join(serverRoot, 'storage');
```

Убрать неиспользуемый `repoRoot`. Остальной серверный код (`server.js`, `media.js`, `admin.js`) **без изменений** — везде импорт `storageDir`.

### 3. `.gitignore`

Заменить:

```gitignore
storage/
```

на:

```gitignore
server/storage/
```

(опционально оставить `storage/` ещё одной строкой на случай случайного воссоздания старого каталога — не обязательно.)

### 4. Документация (синхронизация)

Обновить формулировки «в корне репозитория» → «в `server/storage/`»:

| Файл | Что поменять |
|------|----------------|
| [`.cursor/rules/project-structure.mdc`](.cursor/rules/project-structure.mdc) | `server.js`, `paths.js`, пункт про `storage/` в admin |
| [`.cursor/rules/backend-api.mdc`](.cursor/rules/backend-api.mdc) | вводный абзац, `POST /api/media`, `GET …/large-files` |
| [`.cursor/rules/database-schema.mdc`](.cursor/rules/database-schema.mdc) | примечание к `media` |
| [`.cursor/rules/access-matrix.mdc`](.cursor/rules/access-matrix.mdc) | примечание к large-files (по желанию) |
| [`.cursor/rules/frontend-architecture.mdc`](.cursor/rules/frontend-architecture.mdc) | текст про админ-вкладку «Медиа» |
| [`report/README.md`](report/README.md) | таблица, mermaid, дерево `server/`, API-таблица |

Исторические [`.cursor/plans/*.plan.md`](.cursor/plans/) — **не обязательно** (архив планов); при желании — точечно в планах про загрузку медиа.

[`server/README.md`](server/README.md) — упоминаний `storage` нет; можно добавить одну строку: «загрузки → `server/storage/`, URL `/storage/…`».

### 5. Проверка после переноса

- Запустить сервер из `server/`: каталог `server/storage/` создаётся при старте (`mkdirSync` уже есть).
- Открыть существующее медиа в UI — картинка/файл по старому `path`.
- Загрузить новый файл — появляется в `server/storage/`, в БД `/storage/<uuid>…`.
- Админ → вкладка «Медиа»: large-files видит файлы в новом каталоге.

## Риски

| Риск | Митигация |
|------|-----------|
| Файлы остались в старом `storage/` | Явный шаг переноса перед деплоем |
| Деплой с отдельным volume | Смонтировать volume в `server/storage/` (не в корень репо) |
| Orphan-файлы только в старом каталоге | После переноса проверить админ «крупные файлы»; при необходимости дочистить старый каталог вручную |

## Итог по объёму изменений

- **Код:** 1 файл (`paths.js`) + перенос файлов на диске + `.gitignore`.
- **Клиент / API / БД:** без изменений.
- **Документация:** 5–6 rule/report файлов.
