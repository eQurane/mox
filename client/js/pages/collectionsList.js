import { fetchProjects } from '../api/projects.js';
import { fetchTasks } from '../api/tasks.js';
import { fetchCollections } from '../api/collections.js';
import { fetchMe } from '../api/auth.js';
import { appendDashboardSectionTabs } from '../nav/dashboardTabs.js';
import { clearSession, getToken, setSession } from '../auth/session.js';

const ICON_ACCOUNT = '/icons/account-24.svg';
const ICON_SEARCH = '/icons/search-24.svg';
const ICON_UPDATE = '/icons/update-24.svg';

let collectionsListAbort;

/**
 * @typedef {{
 *   q: string,
 *   projectId: string,
 *   taskId: string,
 *   taskStatusId: string,
 *   projectStatusId: string,
 *   createdFrom: string,
 *   createdTo: string,
 *   lastEditedFrom: string,
 *   lastEditedTo: string,
 * }} CollectionFilters
 */

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
    taskStatusId: searchParams.get('taskStatusId') ?? '',
    projectStatusId: searchParams.get('projectStatusId') ?? '',
    createdFrom: searchParams.get('createdFrom') ?? '',
    createdTo: searchParams.get('createdTo') ?? '',
    lastEditedFrom: searchParams.get('lastEditedFrom') ?? '',
    lastEditedTo: searchParams.get('lastEditedTo') ?? '',
  };
}

/** @param {CollectionFilters} filters */
function writeSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.q.trim()) p.set('q', filters.q.trim());
  if (filters.projectId) p.set('projectId', filters.projectId);
  if (filters.taskId) p.set('taskId', filters.taskId);
  if (filters.taskStatusId) p.set('taskStatusId', filters.taskStatusId);
  if (filters.projectStatusId) p.set('projectStatusId', filters.projectStatusId);
  if (filters.createdFrom) p.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) p.set('createdTo', filters.createdTo);
  if (filters.lastEditedFrom) p.set('lastEditedFrom', filters.lastEditedFrom);
  if (filters.lastEditedTo) p.set('lastEditedTo', filters.lastEditedTo);
  return p;
}

/** @param {CollectionFilters} filters */
function syncHash(filters) {
  const p = writeSearchParams(filters);
  const tail = p.toString();
  const desired = tail ? `#/collections?${tail}` : '#/collections';
  if (location.hash !== desired) {
    history.replaceState(null, '', desired);
  }
}

function buildCollectionCard(col) {
  const card = el('article', {
    className: 'project-card project-card--static project-card--status-unknown',
  });
  const projectLink = el('a', {
    className: 'project-card__muted project-card__project-link',
    href: `#/project/${encodeURIComponent(col.projectId)}`,
    textContent: `Проект: ${col.projectName ?? '—'}`,
  });
  const body = el(
    'div',
    { className: 'project-card__body' },
    el('h2', { className: 'project-card__title', textContent: col.name ?? '' }),
    el('p', { className: 'project-card__goal', textContent: col.description || '—' }),
    el('p', {
      className: 'project-card__muted',
      textContent: `Техническое задание: ${col.taskName ?? '—'}`,
    }),
    el('p', {
      className: 'project-card__dates',
      textContent: `Создано: ${formatDateTimeRu(col.createdAt)} · Изменено: ${formatDateTimeRu(col.lastEditedAt)}`,
    }),
    projectLink,
  );
  card.append(el('div', { className: 'project-card__media project-card__media--placeholder' }), body);
  return card;
}

/** @param {URLSearchParams} searchParams */
export async function renderCollectionsListPage(container, searchParams) {
  collectionsListAbort?.abort();
  collectionsListAbort = new AbortController();
  const { signal } = collectionsListAbort;

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

  /** @type {CollectionFilters} */
  let filters = filtersFromSearchParams(searchParams ?? new URLSearchParams());

  let searchDebounceTimer = null;

  const header = el('header', { className: 'app-header tasks-page__header' });

  const brand = el('div', { className: 'app-header__brand' });

  const nav = el('nav', { className: 'app-header__nav', 'aria-label': 'Разделы' });
  appendDashboardSectionTabs(nav, {
    active: 'collections',
    roleName: user.roleName,
    isAdmin: user.roleName === 'Админ',
  });
  brand.append(nav);

  const searchWrap = el('div', { className: 'app-header__search', role: 'search' });
  searchWrap.append(
    el('label', { className: 'visually-hidden', htmlFor: 'collection-search', textContent: 'Поиск коллекций по названию' }),
    el(
      'div',
      { className: 'app-header__search-field' },
      el('img', { className: 'app-header__search-icon', src: ICON_SEARCH, alt: '', width: 24, height: 24, decoding: 'async' }),
      el('input', {
        type: 'search',
        id: 'collection-search',
        className: 'app-header__search-input',
        placeholder: 'Поиск по названию',
        autocomplete: 'off',
        enterKeyHint: 'search',
        value: filters.q,
      }),
    ),
  );
  const searchInput = /** @type {HTMLInputElement} */ (searchWrap.querySelector('#collection-search'));

  const actions = el('div', { className: 'app-header__actions' });
  const refreshBtn = el('button', {
    type: 'button',
    className: 'button button-ghost button-icon',
    title: 'Обновить список',
    'aria-label': 'Обновить список коллекций',
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
    el('div', { className: 'user-menu__who' },
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
  const projectSelect = el('select', { className: 'tasks-filters__select', id: 'collection-filter-project', 'aria-label': 'Фильтр по проекту' });
  projectSelect.append(el('option', { value: '', textContent: 'Все проекты' }));

  const taskSelect = el('select', {
    className: 'tasks-filters__select',
    id: 'collection-filter-task',
    'aria-label': 'Фильтр по техническому заданию',
  });
  taskSelect.append(el('option', { value: '', textContent: 'Все технические задания' }));
  taskSelect.disabled = true;

  const projectStatusSelect = el('select', {
    className: 'tasks-filters__select',
    id: 'collection-filter-project-status',
    'aria-label': 'Фильтр по статусу проекта',
  });
  projectStatusSelect.append(el('option', { value: '', textContent: 'Все статусы проекта' }));

  const taskStatusSelect = el('select', {
    className: 'tasks-filters__select',
    id: 'collection-filter-task-status',
    'aria-label': 'Фильтр по статусу технического задания',
  });
  taskStatusSelect.append(el('option', { value: '', textContent: 'Все статусы технического задания' }));

  const createdFromInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'collection-filter-created-from',
      'aria-label': 'Дата создания коллекции с',
      value: filters.createdFrom,
    })
  );
  const createdToInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'collection-filter-created-to',
      'aria-label': 'Дата создания коллекции по',
      value: filters.createdTo,
    })
  );

  const lastEditedFromInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'collection-filter-edited-from',
      'aria-label': 'Дата последнего изменения с',
      value: filters.lastEditedFrom,
    })
  );
  const lastEditedToInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'collection-filter-edited-to',
      'aria-label': 'Дата последнего изменения по',
      value: filters.lastEditedTo,
    })
  );

  filterBar.append(
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'collection-filter-project', textContent: 'Проект' }),
      projectSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'collection-filter-task', textContent: 'Техническое задание' }),
      taskSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'collection-filter-project-status', textContent: 'Статус проекта' }),
      projectStatusSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'collection-filter-task-status', textContent: 'Статус технического задания' }),
      taskStatusSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field tasks-filters__field--dates' },
      el('span', { className: 'tasks-filters__label', textContent: 'Дата создания' }),
      el(
        'div',
        { className: 'tasks-filters__dates-wrap' },
        createdFromInput,
        el('span', { className: 'tasks-filters__dash', textContent: '—' }),
        createdToInput,
      ),
    ),
    el(
      'div',
      { className: 'tasks-filters__field tasks-filters__field--dates' },
      el('span', { className: 'tasks-filters__label', textContent: 'Дата последнего изменения' }),
      el(
        'div',
        { className: 'tasks-filters__dates-wrap' },
        lastEditedFromInput,
        el('span', { className: 'tasks-filters__dash', textContent: '—' }),
        lastEditedToInput,
      ),
    ),
  );
  main.append(filterBar);

  const statusRegion = el('div', { className: 'dashboard__status', role: 'status', 'aria-live': 'polite' });
  const grid = el('div', { className: 'projects-grid tasks-page__grid' });
  main.append(statusRegion, grid);

  projectSelect.value = filters.projectId;
  taskSelect.value = filters.taskId;
  projectStatusSelect.value = filters.projectStatusId;
  taskStatusSelect.value = filters.taskStatusId;

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
    projectStatusSelect.disabled = disabled;
    taskStatusSelect.disabled = disabled;
    createdFromInput.disabled = disabled;
    createdToInput.disabled = disabled;
    lastEditedFromInput.disabled = disabled;
    lastEditedToInput.disabled = disabled;
  }

  function populateProjectOptions(rows) {
    while (projectSelect.options.length > 1) projectSelect.remove(1);
    for (const p of rows) {
      projectSelect.append(el('option', { value: String(p.id), textContent: p.name }));
    }
    if (filters.projectId && !Array.from(projectSelect.options).some((o) => o.value === filters.projectId)) {
      filters = { ...filters, projectId: '', taskId: '' };
      projectSelect.value = '';
      syncHash(filters);
    } else {
      projectSelect.value = filters.projectId;
    }
  }

  function populateTaskStatusOptions(rows) {
    while (taskStatusSelect.options.length > 1) taskStatusSelect.remove(1);
    for (const row of rows) {
      taskStatusSelect.append(el('option', { value: String(row.id), textContent: row.name }));
    }
    if (filters.taskStatusId && !Array.from(taskStatusSelect.options).some((o) => o.value === filters.taskStatusId)) {
      filters = { ...filters, taskStatusId: '' };
      taskStatusSelect.value = '';
      syncHash(filters);
    } else {
      taskStatusSelect.value = filters.taskStatusId;
    }
  }

  function populateProjectStatusOptions(rows) {
    while (projectStatusSelect.options.length > 1) projectStatusSelect.remove(1);
    for (const row of rows) {
      projectStatusSelect.append(el('option', { value: String(row.id), textContent: row.name }));
    }
    if (filters.projectStatusId && !Array.from(projectStatusSelect.options).some((o) => o.value === filters.projectStatusId)) {
      filters = { ...filters, projectStatusId: '' };
      projectStatusSelect.value = '';
      syncHash(filters);
    } else {
      projectStatusSelect.value = filters.projectStatusId;
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
      filters = { ...filters, taskId: '' };
      taskSelect.value = '';
      syncHash(filters);
    } else {
      taskSelect.value = filters.taskId;
    }
  }

  function readFiltersFromInputs() {
    return {
      q: searchInput.value,
      projectId: projectSelect.value,
      taskId: taskSelect.value,
      taskStatusId: taskStatusSelect.value,
      projectStatusId: projectStatusSelect.value,
      createdFrom: createdFromInput.value,
      createdTo: createdToInput.value,
      lastEditedFrom: lastEditedFromInput.value,
      lastEditedTo: lastEditedToInput.value,
    };
  }

  function filtersToPayload() {
    const payload = {};
    if (filters.q.trim()) payload.q = filters.q.trim();
    if (filters.projectId) payload.projectId = filters.projectId;
    if (filters.taskId) payload.taskId = filters.taskId;
    if (filters.taskStatusId) payload.taskStatusId = filters.taskStatusId;
    if (filters.projectStatusId) payload.projectStatusId = filters.projectStatusId;
    if (filters.createdFrom) payload.createdFrom = filters.createdFrom;
    if (filters.createdTo) payload.createdTo = filters.createdTo;
    if (filters.lastEditedFrom) payload.lastEditedFrom = filters.lastEditedFrom;
    if (filters.lastEditedTo) payload.lastEditedTo = filters.lastEditedTo;
    return payload;
  }

  async function loadCollections(showLoading) {
    if (showLoading !== false) {
      grid.innerHTML = '';
      grid.append(el('p', { className: 'projects-grid__loading', textContent: 'Загрузка…' }));
    }

    refreshBtn.disabled = true;
    setFilterInputsDisabled(true);

    statusRegion.innerHTML = '';

    try {
      const payload = filtersToPayload();
      const [{ projects }, collectionsData] = await Promise.all([
        fetchProjects(),
        fetchCollections(payload),
      ]);

      const projectRows = Array.isArray(projects) ? projects : [];
      populateProjectOptions(projectRows);

      const taskStatusRows = Array.isArray(collectionsData.taskStatuses) ? collectionsData.taskStatuses : [];
      populateTaskStatusOptions(taskStatusRows);
      const projectStatusRows = Array.isArray(collectionsData.projectStatuses) ? collectionsData.projectStatuses : [];
      populateProjectStatusOptions(projectStatusRows);

      const cols = Array.isArray(collectionsData.collections) ? collectionsData.collections : [];

      if (filters.taskId && !filters.projectId && cols.length > 0) {
        const pid = String(cols[0].projectId ?? '');
        if (pid) {
          filters = { ...filters, projectId: pid };
          projectSelect.value = pid;
          syncHash(filters);
          await populateTaskOptions(pid);
          taskSelect.value = filters.taskId;
        }
      } else if (filters.projectId) {
        await populateTaskOptions(filters.projectId);
      } else {
        await populateTaskOptions('');
      }

      grid.innerHTML = '';

      if (cols.length === 0) {
        grid.append(
          el(
            'div',
            { className: 'projects-empty projects-empty--inline' },
            el('p', { className: 'tasks-page__empty-text', textContent: 'Подходящих коллекций не найдено.' }),
          ),
        );
      } else {
        cols.forEach((c) => grid.append(buildCollectionCard(c)));
      }
    } catch (err) {
      grid.innerHTML = '';
      statusRegion.append(
        el('p', { className: 'message message_error', role: 'alert', textContent: err.message || 'Не удалось загрузить коллекции.' }),
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
      loadCollections();
    }, 300);
  });

  function onFilterCommit() {
    filters = readFiltersFromInputs();
    syncHash(filters);
    loadCollections();
  }

  projectSelect.addEventListener('change', async () => {
    filters = {
      ...readFiltersFromInputs(),
      taskId: '',
    };
    syncHash(filters);
    await loadCollections();
  });

  taskSelect.addEventListener('change', onFilterCommit);
  taskStatusSelect.addEventListener('change', onFilterCommit);
  projectStatusSelect.addEventListener('change', onFilterCommit);
  createdFromInput.addEventListener('change', onFilterCommit);
  createdToInput.addEventListener('change', onFilterCommit);
  lastEditedFromInput.addEventListener('change', onFilterCommit);
  lastEditedToInput.addEventListener('change', onFilterCommit);

  refreshBtn.addEventListener('click', () => {
    filters = readFiltersFromInputs();
    syncHash(filters);
    loadCollections();
  });

  await loadCollections(false);
}
