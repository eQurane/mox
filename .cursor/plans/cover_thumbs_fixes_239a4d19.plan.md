---
name: Cover thumbs fixes
overview: Fix thumbnail display on `#/project/:id` (project hero, task cards, collection cards) and `#/project/:id/tasks/:taskId` (collection cards) by adding missing `coverPath` to backend responses and wiring `attachCoverThumb`/`attachMediaCardThumb` in the frontend.
todos:
  - id: backend-projects
    content: Add coverPath subqueries to tasks and collections in GET /api/projects/:id (projects.js)
    status: completed
  - id: backend-tasks
    content: Add coverPath subquery to collections in GET /api/tasks/:id (tasks.js)
    status: completed
  - id: frontend-project-detail
    content: Fix hero cover + task/collection card thumbs in projectDetail.js using attachCoverThumb
    status: completed
  - id: frontend-task-detail
    content: Fix collection card thumbs in taskDetail.js using attachCoverThumb
    status: completed
  - id: docs
    content: Update backend-api.mdc and frontend-architecture.mdc to document coverPath fields and attachCoverThumb usage
    status: completed
isProject: false
---

# Fix Cover Thumbnails on Project & Task Detail Pages

## Root Cause Analysis

Three categories of bugs:

**1. Backend — missing `coverPath` in `GET /api/projects/:id`**
In [`server/src/routes/projects.js`](server/src/routes/projects.js) lines 336–381, tasks and collections queries omit the `coverPath` subquery. Without it, `task.coverPath` and `col.coverPath` are `undefined` on the client.

**2. Backend — missing `coverPath` in `GET /api/tasks/:id`**
In [`server/src/routes/tasks.js`](server/src/routes/tasks.js) lines 467–487, the collections query also omits `coverPath`.

**3. Frontend — cards render a blank placeholder div instead of a thumb**
- [`client/js/pages/projectDetail.js`](client/js/pages/projectDetail.js):
  - **Hero cover** (lines 203–219): uses inline `<img>` logic, no `no-image-24.svg` fallback → replace with `attachCoverThumb(heroMedia, project.coverPath)`
  - **Task cards** `buildTaskCard` (line 273): `el('div', { className: 'project-card__media project-card__media--placeholder' })` → call `attachCoverThumb`
  - **Collection cards** `buildCollectionCard` (line 298): same blank div → call `attachCoverThumb`
- [`client/js/pages/taskDetail.js`](client/js/pages/taskDetail.js):
  - **Collection cards** `buildCollectionCard` (line 244): same blank div → call `attachCoverThumb`
  - Imports only `attachMediaCardThumb`; needs `attachCoverThumb` too

## Changes

### Backend — `server/src/routes/projects.js`

Add `coverPath` subquery to the **tasks** query (after `st.name AS status_name`):
```sql
(
  SELECT m.path
    FROM media m
    JOIN collections c ON c.id = m.collection_id
   WHERE c.task_id = t.id
   ORDER BY m.upload_at DESC
   LIMIT 1
) AS cover_path
```
Map it: `coverPath: row.cover_path ?? null`.

Add `coverPath` subquery to the **collections** query (after `c.last_edited_at`):
```sql
(
  SELECT m.path
    FROM media m
   WHERE m.collection_id = c.id
   ORDER BY m.upload_at DESC
   LIMIT 1
) AS cover_path
```
Map it: `coverPath: row.cover_path ?? null`.

### Backend — `server/src/routes/tasks.js`

Add `coverPath` subquery to the **collections** query in `GET /tasks/:id` (lines 467–487):
```sql
(
  SELECT m.path
    FROM media m
   WHERE m.collection_id = c.id
   ORDER BY m.upload_at DESC
   LIMIT 1
) AS cover_path
```
Map it: `coverPath: row.cover_path ?? null`.

### Frontend — `client/js/pages/projectDetail.js`

- Add `attachCoverThumb` to the import on line 3.
- Replace hero cover block (lines 203–219) with `attachCoverThumb(heroMedia, project.coverPath)`.
- In `buildTaskCard`: replace the static placeholder div with:
```js
const mediaTop = el('div');
attachCoverThumb(mediaTop, task.coverPath ?? null);
card.append(mediaTop, body);
```
- In `buildCollectionCard`: same pattern using `col.coverPath ?? null`.

### Frontend — `client/js/pages/taskDetail.js`

- Add `attachCoverThumb` to the import on line 4.
- In `buildCollectionCard`: replace the static placeholder div with:
```js
const mediaTop = el('div');
attachCoverThumb(mediaTop, col.coverPath ?? null);
card.append(mediaTop, body);
```

### Documentation — `.cursor/rules/backend-api.mdc`

Update `GET /api/projects/:id` response docs:
- `tasks` array: add `coverPath` field description (path to last media from any collection of the task, or `null`)
- `collections` array: add `coverPath` field description (path to last media of the collection, or `null`)

Update `GET /api/tasks/:id` response docs:
- `collections` array: add `coverPath` field

### Documentation — `.cursor/rules/frontend-architecture.mdc`

Update `#/project/:id` section: mention that task and collection cards use `attachCoverThumb` from `utils/mediaCardThumb.js`.

Update `#/project/:id/tasks/:taskId` section: same for collection cards.
