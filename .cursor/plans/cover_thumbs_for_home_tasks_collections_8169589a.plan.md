---
name: Cover thumbs for home/tasks/collections
overview: "Add smart cover thumbnail display to project, task, and collection list cards: show image if cover is an image, show the correct type icon for non-image files, and show `no-image-24.svg` when there is no cover at all."
todos:
  - id: backend-tasks
    content: Add cover_path subquery to GET /api/tasks response in server/src/routes/tasks.js
    status: completed
  - id: backend-collections
    content: Add cover_path subquery to GET /api/collections response in server/src/routes/collections.js
    status: completed
  - id: util-attachCoverThumb
    content: Add attachCoverThumb export to client/js/utils/mediaCardThumb.js
    status: completed
  - id: home-cover
    content: Replace inline image logic in home.js buildProjectCard with attachCoverThumb
    status: completed
  - id: tasks-cover
    content: Wire attachCoverThumb into tasksList.js buildTaskListCard
    status: completed
  - id: collections-cover
    content: Wire attachCoverThumb into collectionsList.js buildCollectionCard
    status: completed
  - id: docs
    content: Update frontend-architecture.mdc and backend-api.mdc documentation
    status: completed
isProject: false
---

# Cover Thumbs for Home / Tasks / Collections

## Current state

- **`#/home`** (`home.js`): `project.coverPath` comes from the API; shows `<img>` if it exists, stays as `.project-card__media--placeholder` otherwise. No type-icon logic, no `no-image` fallback.
- **`#/tasks`** / **`#/collections`**: cards create a plain `.project-card__media--placeholder` div — no cover data is fetched, no icon is shown.
- **`utils/mediaCardThumb.js`**: `attachMediaCardThumb` handles image vs. type-icon for a full `{ path, format, name }` media item. Has no "no cover" / `no-image` case.

## Plan

### 1 — Backend: add `coverPath` to tasks and collections list

**[`server/src/routes/tasks.js`](server/src/routes/tasks.js)** — add cover subquery to the `GET /tasks` SELECT:

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

Map it: `coverPath: row.cover_path` in the tasks row object.

**[`server/src/routes/collections.js`](server/src/routes/collections.js)** — add cover subquery to the `GET /collections` SELECT:

```sql
(
  SELECT m.path
  FROM media m
  WHERE m.collection_id = c.id
  ORDER BY m.upload_at DESC
  LIMIT 1
) AS cover_path
```

Map it: `coverPath: row.cover_path`.

### 2 — Utility: add `attachCoverThumb` to `mediaCardThumb.js`

**[`client/js/utils/mediaCardThumb.js`](client/js/utils/mediaCardThumb.js)** — add export:

```javascript
const ICON_NO_IMAGE = '/icons/no-image-24.svg';

export function attachCoverThumb(mediaTop, coverPath) {
  if (!coverPath) {
    mediaTop.innerHTML = '';
    mediaTop.className = 'project-card__media project-card__media--kind-icon';
    const img = document.createElement('img');
    img.className = 'project-card__kind-icon';
    img.src = ICON_NO_IMAGE;
    img.alt = '';
    img.decoding = 'async';
    mediaTop.append(img);
    return;
  }
  attachMediaCardThumb(mediaTop, { path: coverPath, format: '', name: '' });
}
```

`attachMediaCardThumb` already handles the image vs. type-icon (and error-fallback) logic using the file extension from the path.

### 3 — `home.js`: replace inline image logic

**[`client/js/pages/home.js`](client/js/pages/home.js)** — in `buildProjectCard`:

- Import `attachCoverThumb` from `../utils/mediaCardThumb.js`
- Create the `media` div without any initial modifier class (or with a neutral base class)
- Replace the current `if (project.coverPath) { … img load/error … }` block with a single call: `attachCoverThumb(media, project.coverPath ?? null)`

### 4 — `tasksList.js`: wire up cover

**[`client/js/pages/tasksList.js`](client/js/pages/tasksList.js)** — in `buildTaskListCard`:

- Import `attachCoverThumb`
- After creating `mediaTop`, call `attachCoverThumb(mediaTop, task.coverPath ?? null)`

### 5 — `collectionsList.js`: wire up cover

**[`client/js/pages/collectionsList.js`](client/js/pages/collectionsList.js)** — in `buildCollectionCard`:

- Import `attachCoverThumb`
- Create `mediaTop` as a variable (not inline in `card.append`)
- Call `attachCoverThumb(mediaTop, col.coverPath ?? null)`

### 6 — Documentation sync

Update:
- **[`.cursor/rules/frontend-architecture.mdc`](.cursor/rules/frontend-architecture.mdc)** — add notes about `attachCoverThumb` for `#/home`, `#/tasks`, `#/collections` card sections
- **[`.cursor/rules/backend-api.mdc`](.cursor/rules/backend-api.mdc)** — add `coverPath` to the `GET /api/tasks` and `GET /api/collections` response shape descriptions
