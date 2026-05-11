import { fetchProjects } from '../api/projects.js';
import { fetchTasks } from '../api/tasks.js';
import { fetchCollections } from '../api/collections.js';
import { fetchMedia } from '../api/media.js';
import { fetchMe } from '../api/auth.js';
import { appendDashboardSectionTabs } from '../nav/dashboardTabs.js';
import { clearSession, getToken, setSession } from '../auth/session.js';
import { attachMediaCardThumb } from '../utils/mediaCardThumb.js';

const ICON_ACCOUNT = '/icons/account-24.svg';
const ICON_SEARCH = '/icons/search-24.svg';
const ICON_UPDATE = '/icons/update-24.svg';

let mediaListAbort;

/**
 * @typedef {{
 *   q: string,
 *   projectId: string,
 *   taskId: string,
 *   collectionId: string,
 *   statusId: string,
 *   uploadFrom: string,
 *   uploadTo: string,
 * }} MediaFilters
 */

const MEDIA_STATUS_SLUG = {
  Активный: 'active',
  Удалённый: 'removed',
  Архивный: 'archived',
};

function mediaStatusSlug(name) {
  return MEDIA_STATUS_SLUG[name] || 'unknown';
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      node.className = value;
      return;
    }
    if (key === 'textContent') {
      node.textContent = value;
      return;
    }
    if (key === 'htmlFor') {
      node.htmlFor = value;
      return;
    }
    if (value === false || value == null) return;
    if (value === true) {
      node.setAttribute(key, '');
      return;
    }
    node.setAttribute(key, value);
  });
  children.flat().forEach((child) => {
    if (child != null && child !== '') node.append(child);
  });
  return node;
}

function toolbarIconImg(src) {
  return el('img', {
    className: 'header-toolbar__icon',
    src,
    alt: '',
    width: 24,
    height: 24,
    decoding: 'async',
  });
}

function formatDateTimeRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

/** @param {URLSearchParams} searchParams */
function filtersFromSearchParams(searchParams) {
  return {
    q: searchParams.get('q') ?? '',
    projectId: searchParams.get('projectId') ?? '',
    taskId: searchParams.get('taskId') ?? '',
    collectionId: searchParams.get('collectionId') ?? '',
    statusId: searchParams.get('statusId') ?? '',
    uploadFrom: searchParams.get('uploadFrom') ?? '',
    uploadTo: searchParams.get('uploadTo') ?? '',
  };
}

/** @param {MediaFilters} filters */
function writeSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.q.trim()) p.set('q', filters.q.trim());
  if (filters.projectId) p.set('projectId', filters.projectId);
  if (filters.taskId) p.set('taskId', filters.taskId);
  if (filters.collectionId) p.set('collectionId', filters.collectionId);
  if (filters.statusId) p.set('statusId', filters.statusId);
  if (filters.uploadFrom) p.set('uploadFrom', filters.uploadFrom);
  if (filters.uploadTo) p.set('uploadTo', filters.uploadTo);
  return p;
}

/** @param {MediaFilters} filters */
function syncHash(filters) {
  const p = writeSearchParams(filters);
  const tail = p.toString();
  const desired = tail ? `#/media?${tail}` : '#/media';
  if (location.hash !== desired) {
    history.replaceState(null, '', desired);
  }
}

function buildMediaCard(item) {
  const mslug = mediaStatusSlug(item.statusName);
  const card = el('article', {
    className: `project-card project-card--static project-detail__media-card project-card--status-unknown`,
  });

  const mediaTop = el('div');
  attachMediaCardThumb(mediaTop, item);

  const projectLink =
    item.projectId != null
      ? el('a', {
          className: 'project-card__muted project-card__project-link',
          href: `#/project/${encodeURIComponent(String(item.projectId))}`,
          textContent: `Проект: ${item.projectName ?? '—'}`,
        })
      : el('p', {
          className: 'project-card__muted',
          textContent: `Проект: ${item.projectName ?? '—'}`,
        });

  const body = el(
    'div',
    { className: 'project-card__body' },
    el('h2', { className: 'project-card__title', textContent: item.name ?? '' }),
    el('p', {
      className: 'project-card__goal',
      textContent: item.description || '—',
    }),
    el('p', {
      className: 'project-card__muted',
      textContent: `${item.collectionName ?? '—'} · ТЗ: ${item.taskName ?? '—'}`,
    }),
    el('p', {
      className: 'project-card__dates',
      textContent: `${String(item.format || '').toUpperCase()} · ${formatDateTimeRu(item.uploadAt)}`,
    }),
    projectLink,
    el(
      'div',
      { className: 'project-card__footer' },
      el('span', {
        className: `media-badge media-badge--${mslug}`,
        textContent: item.statusName ?? '—',
      }),
    ),
  );
  card.append(mediaTop, body);
  return card;
}

/** @param {URLSearchParams} searchParams */
export async function renderMediaListPage(container, searchParams) {
  mediaListAbort?.abort();
  mediaListAbort = new AbortController();
  const { signal } = mediaListAbort;

  container.innerHTML = '';

  const main = el('main', { className: 'dashboard tasks-page' });
  const loadingP = el('p', { className: 'register-muted', textContent: 'Загрузка…' });
  main.append(loadingP);
  container.append(main);

  let user;
  try {
    user = await fetchMe();
    const tok = getToken();
    if (tok) setSession(tok, user);
  } catch {
    clearSession();
    location.hash = '#/login';
    return;
  }

  loadingP.remove();

  /** @type {MediaFilters} */
  let filters = filtersFromSearchParams(searchParams ?? new URLSearchParams());

  let searchDebounceTimer = null;

  const header = el('header', { className: 'app-header tasks-page__header' });

  const brand = el('div', { className: 'app-header__brand' });

  const nav = el('nav', { className: 'app-header__nav', 'aria-label': 'Разделы' });
  appendDashboardSectionTabs(nav, {
    active: 'media',
    roleName: user.roleName,
    isAdmin: user.roleName === 'Админ',
  });
  brand.append(nav);

  const searchWrap = el('div', { className: 'app-header__search', role: 'search' });
  searchWrap.append(
    el('label', { className: 'visually-hidden', htmlFor: 'media-search', textContent: 'Поиск медиа по имени файла' }),
    el(
      'div',
      { className: 'app-header__search-field' },
      el('img', { className: 'app-header__search-icon', src: ICON_SEARCH, alt: '', width: 24, height: 24, decoding: 'async' }),
      el('input', {
        type: 'search',
        id: 'media-search',
        className: 'app-header__search-input',
        placeholder: 'Поиск по имени файла',
        autocomplete: 'off',
        enterKeyHint: 'search',
        value: filters.q,
      }),
    ),
  );
  const searchInput = /** @type {HTMLInputElement} */ (searchWrap.querySelector('#media-search'));

  const actions = el('div', { className: 'app-header__actions' });
  const refreshBtn = el('button', {
    type: 'button',
    className: 'button button-ghost button-icon',
    title: 'Обновить список',
    'aria-label': 'Обновить список медиа',
  });
  refreshBtn.append(toolbarIconImg(ICON_UPDATE));

  const userWrap = el('div', { className: 'user-menu' });
  const userBtn = el('button', {
    type: 'button',
    className: 'button button-ghost button-icon user-menu__toggle',
    title: 'Учётная запись',
    'aria-label': 'Меню учётной записи',
    'aria-expanded': 'false',
    'aria-haspopup': 'true',
  });
  userBtn.append(toolbarIconImg(ICON_ACCOUNT));

  const panel = el('div', {
    className: 'user-menu__panel',
    hidden: true,
    role: 'menu',
  });
  panel.append(
    el(
      'div',
      { className: 'user-menu__who' },
      el('div', { className: 'user-menu__name', textContent: user.name }),
      el('div', { className: 'user-menu__email', textContent: user.email }),
    ),
    el('button', { type: 'button', className: 'user-menu__logout', role: 'menuitem', textContent: 'Выйти' }),
  );
  userWrap.append(userBtn, panel);
  panel.addEventListener('click', (e) => e.stopPropagation());
  actions.append(refreshBtn, userWrap);
  header.append(brand, actions);
  main.append(header);

  main.append(searchWrap);

  const filterBar = el('div', { className: 'tasks-filters' });
  const projectSelect = el('select', { className: 'tasks-filters__select', id: 'media-filter-project', 'aria-label': 'Фильтр по проекту' });
  projectSelect.append(el('option', { value: '', textContent: 'Все проекты' }));

  const taskSelect = el('select', {
    className: 'tasks-filters__select',
    id: 'media-filter-task',
    'aria-label': 'Фильтр по техническому заданию',
  });
  taskSelect.append(el('option', { value: '', textContent: 'Все технические задания' }));
  taskSelect.disabled = true;

  const collectionSelect = el('select', {
    className: 'tasks-filters__select',
    id: 'media-filter-collection',
    'aria-label': 'Фильтр по коллекции',
  });
  collectionSelect.append(el('option', { value: '', textContent: 'Все коллекции' }));
  collectionSelect.disabled = true;

  const statusSelect = el('select', {
    className: 'tasks-filters__select',
    id: 'media-filter-status',
    'aria-label': 'Фильтр по статусу медиа',
  });
  statusSelect.append(el('option', { value: '', textContent: 'Все статусы медиа' }));

  const uploadFromInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'media-filter-upload-from',
      'aria-label': 'Дата загрузки с',
      value: filters.uploadFrom,
    })
  );
  const uploadToInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'media-filter-upload-to',
      'aria-label': 'Дата загрузки по',
      value: filters.uploadTo,
    })
  );

  filterBar.append(
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'media-filter-project', textContent: 'Проект' }),
      projectSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'media-filter-task', textContent: 'Техническое задание' }),
      taskSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'media-filter-collection', textContent: 'Коллекция' }),
      collectionSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'media-filter-status', textContent: 'Статус' }),
      statusSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field tasks-filters__field--dates tasks-filters__field--row2' },
      el('span', { className: 'tasks-filters__label', textContent: 'Дата загрузки' }),
      el(
        'div',
        { className: 'tasks-filters__dates-wrap' },
        uploadFromInput,
        el('span', { className: 'tasks-filters__dash', textContent: '—' }),
        uploadToInput,
      ),
    ),
  );
  main.append(filterBar);

  const statusRegion = el('div', { className: 'dashboard__status', role: 'status', 'aria-live': 'polite' });
  const grid = el('div', { className: 'projects-grid tasks-page__grid' });
  main.append(statusRegion, grid);

  projectSelect.value = filters.projectId;
  taskSelect.value = filters.taskId;
  collectionSelect.value = filters.collectionId;
  statusSelect.value = filters.statusId;

  let menuOpen = false;
  const setMenuOpen = (open) => {
    menuOpen = open;
    userBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
  };

  userBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  });

  panel.querySelector('.user-menu__logout')?.addEventListener('click', () => {
    clearSession();
    location.hash = '#/login';
  });

  document.addEventListener(
    'click',
    () => {
      if (menuOpen) setMenuOpen(false);
    },
    { signal },
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        userBtn.focus();
      }
    },
    { signal },
  );

  function setFilterInputsDisabled(disabled) {
    searchInput.disabled = disabled;
    projectSelect.disabled = disabled;
    taskSelect.disabled = disabled || !filters.projectId;
    collectionSelect.disabled = disabled || !filters.projectId;
    statusSelect.disabled = disabled;
    uploadFromInput.disabled = disabled;
    uploadToInput.disabled = disabled;
  }

  function populateProjectOptions(rows) {
    while (projectSelect.options.length > 1) projectSelect.remove(1);
    for (const p of rows) {
      projectSelect.append(el('option', { value: String(p.id), textContent: p.name }));
    }
    if (filters.projectId && !Array.from(projectSelect.options).some((o) => o.value === filters.projectId)) {
      filters = { ...filters, projectId: '', taskId: '', collectionId: '' };
      projectSelect.value = '';
      syncHash(filters);
    } else {
      projectSelect.value = filters.projectId;
    }
  }

  function populateStatusOptions(rows) {
    while (statusSelect.options.length > 1) statusSelect.remove(1);
    for (const row of rows) {
      statusSelect.append(el('option', { value: String(row.id), textContent: row.name }));
    }
    if (filters.statusId && !Array.from(statusSelect.options).some((o) => o.value === filters.statusId)) {
      filters = { ...filters, statusId: '' };
      statusSelect.value = '';
      syncHash(filters);
    } else {
      statusSelect.value = filters.statusId;
    }
  }

  async function populateTaskOptions(projectIdStr) {
    while (taskSelect.options.length > 1) taskSelect.remove(1);
    taskSelect.value = '';
    if (!projectIdStr) {
      taskSelect.disabled = true;
      taskSelect.options[0].textContent = 'Все технические задания';
      return;
    }
    taskSelect.disabled = false;
    taskSelect.options[0].textContent = 'Все технические задания';
    try {
      const data = await fetchTasks({ projectId: projectIdStr });
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      for (const t of tasks) {
        taskSelect.append(el('option', { value: String(t.id), textContent: t.name ?? String(t.id) }));
      }
    } catch {
      /* оставить только «все» */
    }
    if (filters.taskId && !Array.from(taskSelect.options).some((o) => o.value === filters.taskId)) {
      filters = { ...filters, taskId: '', collectionId: '' };
      taskSelect.value = '';
      syncHash(filters);
    } else {
      taskSelect.value = filters.taskId;
    }
  }

  async function populateCollectionOptions(projectIdStr, taskIdStr) {
    while (collectionSelect.options.length > 1) collectionSelect.remove(1);
    collectionSelect.value = '';
    if (!projectIdStr) {
      collectionSelect.disabled = true;
      collectionSelect.options[0].textContent = 'Все коллекции';
      return;
    }
    collectionSelect.disabled = false;
    collectionSelect.options[0].textContent = 'Все коллекции';
    try {
      const payload = { projectId: projectIdStr };
      if (taskIdStr) payload.taskId = taskIdStr;
      const data = await fetchCollections(payload);
      const cols = Array.isArray(data.collections) ? data.collections : [];
      for (const c of cols) {
        collectionSelect.append(el('option', { value: String(c.id), textContent: c.name ?? String(c.id) }));
      }
    } catch {
      /* оставить только «все» */
    }
    if (filters.collectionId && !Array.from(collectionSelect.options).some((o) => o.value === filters.collectionId)) {
      filters = { ...filters, collectionId: '' };
      collectionSelect.value = '';
      syncHash(filters);
    } else {
      collectionSelect.value = filters.collectionId;
    }
  }

  function readFiltersFromInputs() {
    return {
      q: searchInput.value,
      projectId: projectSelect.value,
      taskId: taskSelect.value,
      collectionId: collectionSelect.value,
      statusId: statusSelect.value,
      uploadFrom: uploadFromInput.value,
      uploadTo: uploadToInput.value,
    };
  }

  function filtersToPayload() {
    const payload = {};
    if (filters.q.trim()) payload.q = filters.q.trim();
    if (filters.projectId) payload.projectId = filters.projectId;
    if (filters.taskId) payload.taskId = filters.taskId;
    if (filters.collectionId) payload.collectionId = filters.collectionId;
    if (filters.statusId) payload.statusId = filters.statusId;
    if (filters.uploadFrom) payload.uploadFrom = filters.uploadFrom;
    if (filters.uploadTo) payload.uploadTo = filters.uploadTo;
    return payload;
  }

  async function loadMedia(showLoading) {
    if (showLoading !== false) {
      grid.innerHTML = '';
      grid.append(el('p', { className: 'projects-grid__loading', textContent: 'Загрузка…' }));
    }

    refreshBtn.disabled = true;
    setFilterInputsDisabled(true);

    statusRegion.innerHTML = '';

    try {
      const payload = filtersToPayload();
      const [{ projects }, mediaData] = await Promise.all([fetchProjects(), fetchMedia(payload)]);

      const projectRows = Array.isArray(projects) ? projects : [];
      populateProjectOptions(projectRows);

      const statusRows = Array.isArray(mediaData.statuses) ? mediaData.statuses : [];
      populateStatusOptions(statusRows);

      const mediaRows = Array.isArray(mediaData.media) ? mediaData.media : [];

      if (filters.taskId && !filters.projectId && mediaRows.length > 0) {
        const pid = String(mediaRows[0].projectId ?? '');
        if (pid) {
          filters = { ...filters, projectId: pid };
          projectSelect.value = pid;
          syncHash(filters);
          await populateTaskOptions(pid);
          taskSelect.value = filters.taskId;
          await populateCollectionOptions(pid, filters.taskId);
        }
      } else if (filters.projectId) {
        await populateTaskOptions(filters.projectId);
        await populateCollectionOptions(filters.projectId, filters.taskId);
      } else {
        await populateTaskOptions('');
        await populateCollectionOptions('', '');
      }

      grid.innerHTML = '';

      if (mediaRows.length === 0) {
        grid.append(
          el(
            'div',
            { className: 'projects-empty projects-empty--inline' },
            el('p', { className: 'tasks-page__empty-text', textContent: 'Подходящих медиа не найдено.' }),
          ),
        );
      } else {
        mediaRows.forEach((m) => grid.append(buildMediaCard(m)));
      }
    } catch (err) {
      grid.innerHTML = '';
      statusRegion.append(
        el('p', {
          className: 'message message_error',
          role: 'alert',
          textContent: err.message || 'Не удалось загрузить медиа.',
        }),
      );
    } finally {
      refreshBtn.disabled = false;
      setFilterInputsDisabled(false);
    }
  }

  searchInput.addEventListener('input', () => {
    filters = { ...filters, q: searchInput.value };
    if (searchDebounceTimer != null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      searchDebounceTimer = null;
      syncHash(filters);
      loadMedia();
    }, 300);
  });

  function onFilterCommit() {
    filters = readFiltersFromInputs();
    syncHash(filters);
    loadMedia();
  }

  projectSelect.addEventListener('change', async () => {
    filters = {
      ...readFiltersFromInputs(),
      taskId: '',
      collectionId: '',
    };
    syncHash(filters);
    await loadMedia();
  });

  taskSelect.addEventListener('change', async () => {
    filters = {
      ...readFiltersFromInputs(),
      collectionId: '',
    };
    syncHash(filters);
    await loadMedia();
  });

  collectionSelect.addEventListener('change', onFilterCommit);
  statusSelect.addEventListener('change', onFilterCommit);
  uploadFromInput.addEventListener('change', onFilterCommit);
  uploadToInput.addEventListener('change', onFilterCommit);

  refreshBtn.addEventListener('click', () => {
    filters = readFiltersFromInputs();
    syncHash(filters);
    loadMedia();
  });

  await loadMedia();
}
