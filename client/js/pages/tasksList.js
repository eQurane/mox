import { fetchProjects } from '../api/projects.js';
import { fetchTasks } from '../api/tasks.js';
import { fetchMe } from '../api/auth.js';
import { appendDashboardSectionTabs } from '../nav/dashboardTabs.js';
import { clearSession, getToken, setSession } from '../auth/session.js';
import { attachCoverThumb } from '../utils/mediaCardThumb.js';
import { renderNotificationBell } from '../utils/notificationBell.js';

const ICON_ACCOUNT = '/icons/account-24.svg';
const ICON_SEARCH = '/icons/search-24.svg';
const ICON_UPDATE = '/icons/update-24.svg';

const TASK_STATUS_SLUG = {
  'К выполнению': 'planned',
  'В работе': 'active',
  'На проверке': 'hold',
  Выполнено: 'done',
  Отменено: 'unknown',
};

function taskStatusSlug(name) {
  return TASK_STATUS_SLUG[name] || 'unknown';
}

let tasksListAbort;

/** @typedef {{ q: string, projectId: string, statusId: string, deadlineFrom: string, deadlineTo: string }} TaskFilters */

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
    statusId: searchParams.get('statusId') ?? '',
    deadlineFrom: searchParams.get('deadlineFrom') ?? '',
    deadlineTo: searchParams.get('deadlineTo') ?? '',
  };
}

/** @param {TaskFilters} filters */
function writeSearchParams(filters) {
  const p = new URLSearchParams();
  if (filters.q.trim()) p.set('q', filters.q.trim());
  if (filters.projectId) p.set('projectId', filters.projectId);
  if (filters.statusId) p.set('statusId', filters.statusId);
  if (filters.deadlineFrom) p.set('deadlineFrom', filters.deadlineFrom);
  if (filters.deadlineTo) p.set('deadlineTo', filters.deadlineTo);
  return p;
}

/** @param {TaskFilters} filters */
function syncHash(filters) {
  const p = writeSearchParams(filters);
  const tail = p.toString();
  const desired = tail ? `#/tasks?${tail}` : '#/tasks';
  if (location.hash !== desired) {
    history.replaceState(null, '', desired);
  }
}

/** Для карточки-ссылки: переход по hash без вложенных `<a>`. */
function hashNavControl(text, hash) {
  const span = el('span', {
    className: 'project-card__muted project-card__project-link project-card__hash-link',
    role: 'link',
    tabIndex: 0,
    textContent: text,
  });
  const go = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const h = hash.startsWith('#') ? hash : `#${hash}`;
    location.hash = h;
  };
  span.addEventListener('click', go);
  span.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      go(ev);
    }
  });
  return span;
}

function buildTaskListCard(task) {
  const tslug = taskStatusSlug(task.statusName);
  const collectionsHref =
    task.projectId != null && task.id != null
      ? `#/collections?projectId=${encodeURIComponent(String(task.projectId))}&taskId=${encodeURIComponent(String(task.id))}`
      : task.id != null
        ? `#/collections?taskId=${encodeURIComponent(String(task.id))}`
        : '#/collections';
  const mediaHref =
    task.projectId != null && task.id != null
      ? `#/media?projectId=${encodeURIComponent(String(task.projectId))}&taskId=${encodeURIComponent(String(task.id))}`
      : task.id != null
        ? `#/media?taskId=${encodeURIComponent(String(task.id))}`
        : '#/media';
  const detailHref =
    task.projectId != null && task.id != null
      ? `#/project/${encodeURIComponent(String(task.projectId))}/tasks/${encodeURIComponent(String(task.id))}`
      : null;

  const mediaTop = el('div', { className: 'project-card__media' });
  attachCoverThumb(mediaTop, task.coverPath ?? null);
  const body = el(
    'div',
    { className: 'project-card__body' },
    el('h2', { className: 'project-card__title', textContent: task.name ?? '' }),
    el('p', { className: 'project-card__goal', textContent: task.description ?? '' }),
    el('p', {
      className: 'project-card__dates',
      textContent: `Дедлайн: ${formatDateTimeRu(task.deadline)}`,
    }),
    el('p', {
      className: 'project-card__muted',
      textContent: `Роль: ${task.roleName ?? '—'}`,
    }),
    el(
      'div',
      { className: 'project-card__footer' },
      el('span', {
        className: `project-card__badge project-card__badge--${tslug}`,
        textContent: task.statusName ?? '—',
      }),
    ),
  );

  if (detailHref) {
    const card = el('a', {
      className: `project-card project-card--static project-card--link project-card--status-${tslug}`,
      href: detailHref,
    });
    const footer = body.querySelector('.project-card__footer');
    const projectCtl =
      task.projectId != null
        ? hashNavControl(`Проект: ${task.projectName ?? '—'}`, `#/project/${encodeURIComponent(String(task.projectId))}`)
        : el('p', {
            className: 'project-card__muted',
            textContent: `Проект: ${task.projectName ?? '—'}`,
          });
    footer.before(projectCtl, hashNavControl('Коллекции', collectionsHref), hashNavControl('Медиа', mediaHref));
    card.append(mediaTop, body);
    return card;
  }

  const card = el('article', {
    className: `project-card project-card--static project-card--status-${tslug}`,
  });
  const projectLink =
    task.projectId != null
      ? el('a', {
          className: 'project-card__muted project-card__project-link',
          href: `#/project/${encodeURIComponent(task.projectId)}`,
          textContent: `Проект: ${task.projectName ?? '—'}`,
        })
      : el('p', {
          className: 'project-card__muted',
          textContent: `Проект: ${task.projectName ?? '—'}`,
        });
  const footerEl = body.querySelector('.project-card__footer');
  footerEl.before(
    projectLink,
    el('a', {
      className: 'project-card__muted project-card__project-link',
      href: collectionsHref,
      textContent: 'Коллекции',
    }),
    el('a', {
      className: 'project-card__muted project-card__project-link',
      href: mediaHref,
      textContent: 'Медиа',
    }),
  );
  card.append(mediaTop, body);
  return card;
}

/** @param {URLSearchParams} searchParams */
export async function renderTasksListPage(container, searchParams) {
  tasksListAbort?.abort();
  tasksListAbort = new AbortController();
  const { signal } = tasksListAbort;

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

  /** @type {TaskFilters} */
  let filters = filtersFromSearchParams(searchParams ?? new URLSearchParams());

  let searchDebounceTimer = null;

  const header = el('header', { className: 'app-header tasks-page__header' });

  const brand = el('div', { className: 'app-header__brand' });

  const nav = el('nav', { className: 'app-header__nav', 'aria-label': 'Разделы' });
  appendDashboardSectionTabs(nav, {
    active: 'tasks',
    roleName: user.roleName,
    isAdmin: user.roleName === 'Админ',
  });
  brand.append(nav);

  const searchWrap = el('div', { className: 'app-header__search', role: 'search' });
  searchWrap.append(
    el('label', { className: 'visually-hidden', htmlFor: 'task-search', textContent: 'Поиск технических заданий по названию' }),
    el(
      'div',
      { className: 'app-header__search-field' },
      el('img', { className: 'app-header__search-icon', src: ICON_SEARCH, alt: '', width: 24, height: 24, decoding: 'async' }),
      el('input', {
        type: 'search',
        id: 'task-search',
        className: 'app-header__search-input',
        placeholder: 'Поиск по названию',
        autocomplete: 'off',
        enterKeyHint: 'search',
        value: filters.q,
      }),
    ),
  );
  const searchInput = /** @type {HTMLInputElement} */ (searchWrap.querySelector('#task-search'));

  const actions = el('div', { className: 'app-header__actions' });
  const refreshBtn = el('button', {
    type: 'button',
    className: 'button button-ghost button-icon',
    title: 'Обновить список',
    'aria-label': 'Обновить список технических заданий',
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
  actions.append(refreshBtn);
  const bellCleanup = renderNotificationBell(actions);
  window.addEventListener('hashchange', () => bellCleanup(), { once: true });
  actions.append(userWrap);
  header.append(brand, actions);
  main.append(header);

  main.append(searchWrap);

  const filterBar = el('div', { className: 'tasks-filters' });
  const projectSelect = el('select', { className: 'tasks-filters__select', id: 'task-filter-project', 'aria-label': 'Фильтр по проекту' });
  projectSelect.append(el('option', { value: '', textContent: 'Все проекты' }));

  const statusSelect = el('select', { className: 'tasks-filters__select', id: 'task-filter-status', 'aria-label': 'Фильтр по статусу' });
  statusSelect.append(el('option', { value: '', textContent: 'Все статусы' }));

  const deadlineFromInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'task-filter-deadline-from',
      'aria-label': 'Дедлайн с',
      value: filters.deadlineFrom,
    })
  );
  const deadlineToInput = /** @type {HTMLInputElement} */ (
    el('input', {
      type: 'date',
      className: 'tasks-filters__date',
      id: 'task-filter-deadline-to',
      'aria-label': 'Дедлайн по',
      value: filters.deadlineTo,
    })
  );

  filterBar.append(
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'task-filter-project', textContent: 'Проект' }),
      projectSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field' },
      el('label', { className: 'tasks-filters__label', htmlFor: 'task-filter-status', textContent: 'Статус' }),
      statusSelect,
    ),
    el(
      'div',
      { className: 'tasks-filters__field tasks-filters__field--dates' },
      el('span', { className: 'tasks-filters__label', textContent: 'Дедлайн' }),
      el('div', { className: 'tasks-filters__dates-wrap' }, deadlineFromInput, el('span', { className: 'tasks-filters__dash', textContent: '—' }), deadlineToInput),
    ),
  );
  main.append(filterBar);

  const statusRegion = el('div', { className: 'dashboard__status', role: 'status', 'aria-live': 'polite' });
  const grid = el('div', { className: 'projects-grid tasks-page__grid' });
  main.append(statusRegion, grid);

  projectSelect.value = filters.projectId;
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

  function populateStatusOptions(rows) {
    while (statusSelect.options.length > 1) statusSelect.remove(1);
    for (const row of rows) {
      statusSelect.append(el('option', { value: String(row.id), textContent: row.name }));
    }
    if (filters.statusId && !Array.from(statusSelect.options).some((o) => o.value === filters.statusId)) {
      filters = { ...filters, statusId: '' };
      statusSelect.value = '';
    } else {
      statusSelect.value = filters.statusId;
    }
  }

  function populateProjectOptions(rows) {
    while (projectSelect.options.length > 1) projectSelect.remove(1);
    for (const p of rows) {
      projectSelect.append(el('option', { value: String(p.id), textContent: p.name }));
    }
    if (filters.projectId && !Array.from(projectSelect.options).some((o) => o.value === filters.projectId)) {
      filters = { ...filters, projectId: '' };
      projectSelect.value = '';
      syncHash(filters);
    } else {
      projectSelect.value = filters.projectId;
    }
  }

  function filtersToPayload() {
    const payload = {};
    if (filters.q.trim()) payload.q = filters.q.trim();
    if (filters.projectId) payload.projectId = filters.projectId;
    if (filters.statusId) payload.statusId = filters.statusId;
    if (filters.deadlineFrom) payload.deadlineFrom = filters.deadlineFrom;
    if (filters.deadlineTo) payload.deadlineTo = filters.deadlineTo;
    return payload;
  }

  async function loadTasks(showLoading) {
    if (showLoading !== false) {
      grid.innerHTML = '';
      grid.append(el('p', { className: 'projects-grid__loading', textContent: 'Загрузка…' }));
    }

    refreshBtn.disabled = true;
    searchInput.disabled = true;
    projectSelect.disabled = true;
    statusSelect.disabled = true;
    deadlineFromInput.disabled = true;
    deadlineToInput.disabled = true;

    statusRegion.innerHTML = '';

    try {
      const payload = filtersToPayload();
      const [{ projects }, data] = await Promise.all([
        fetchProjects(),
        fetchTasks(payload),
      ]);

      const projectRows = Array.isArray(projects) ? projects : [];
      populateProjectOptions(projectRows);

      const statusRows = Array.isArray(data.statuses) ? data.statuses : [];
      populateStatusOptions(statusRows);

      const tasks = Array.isArray(data.tasks) ? data.tasks : [];

      grid.innerHTML = '';

      if (tasks.length === 0) {
        grid.append(
          el(
            'div',
            { className: 'projects-empty projects-empty--inline' },
            el('p', { className: 'tasks-page__empty-text', textContent: 'Подходящих технических заданий не найдено.' }),
          ),
        );
      } else {
        tasks.forEach((t) => grid.append(buildTaskListCard(t)));
      }
    } catch (err) {
      grid.innerHTML = '';
      statusRegion.append(
        el('p', { className: 'message message_error', role: 'alert', textContent: err.message || 'Не удалось загрузить задачи.' }),
      );
    } finally {
      refreshBtn.disabled = false;
      searchInput.disabled = false;
      projectSelect.disabled = false;
      statusSelect.disabled = false;
      deadlineFromInput.disabled = false;
      deadlineToInput.disabled = false;
    }
  }

  searchInput.addEventListener('input', () => {
    filters = { ...filters, q: searchInput.value };
    if (searchDebounceTimer != null) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = window.setTimeout(() => {
      searchDebounceTimer = null;
      syncHash(filters);
      loadTasks();
    }, 300);
  });

  function onFilterCommit() {
    filters = {
      ...filters,
      q: searchInput.value,
      projectId: projectSelect.value,
      statusId: statusSelect.value,
      deadlineFrom: deadlineFromInput.value,
      deadlineTo: deadlineToInput.value,
    };
    syncHash(filters);
    loadTasks();
  }

  projectSelect.addEventListener('change', onFilterCommit);
  statusSelect.addEventListener('change', onFilterCommit);
  deadlineFromInput.addEventListener('change', onFilterCommit);
  deadlineToInput.addEventListener('change', onFilterCommit);

  refreshBtn.addEventListener('click', () => {
    filters = {
      ...filters,
      q: searchInput.value,
      projectId: projectSelect.value,
      statusId: statusSelect.value,
      deadlineFrom: deadlineFromInput.value,
      deadlineTo: deadlineToInput.value,
    };
    syncHash(filters);
    loadTasks();
  });

  await loadTasks(false);
}
