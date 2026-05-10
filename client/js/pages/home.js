import { fetchProjects } from '../api/projects.js';
import { fetchMe } from '../api/auth.js';
import { clearSession, getToken, setSession } from '../auth/session.js';
import { appendDashboardSectionTabs } from '../nav/dashboardTabs.js';
const ICON_ACCOUNT = '/icons/account-24.svg';
const ICON_SEARCH = '/icons/search-24.svg';
const ICON_UPDATE = '/icons/update-24.svg';

let homeLifecycleAbort;

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

function formatDateRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

const STATUS_SLUG = {
  Запланированный: 'planned',
  Активный: 'active',
  Приостановленный: 'hold',
  Завершенный: 'done',
};

function statusSlug(name) {
  return STATUS_SLUG[name] || 'unknown';
}

function canCreateProject(roleName) {
  return roleName === 'Админ' || roleName === 'Менеджер';
}

function buildCreateCard() {
  const card = el('a', {
    className: 'project-card project-card--create',
    href: '#/projects/new',
  });
  card.append(
    el('div', { className: 'project-card__create-inner' }, el('span', { className: 'project-card__create-plus', textContent: '+' })),
    el('div', { className: 'project-card__body project-card__body--create' }, el('h2', { className: 'project-card__title', textContent: 'Новый проект' })),
  );
  return card;
}

function buildProjectCard(project) {
  const slug = statusSlug(project.statusName);
  const card = el('a', {
    className: `project-card project-card--status-${slug}`,
    href: `#/project/${project.id}`,
  });

  const media = el('div', { className: 'project-card__media project-card__media--placeholder' });
  if (project.coverPath) {
    const img = el('img', {
      className: 'project-card__img',
      alt: '',
      src: project.coverPath,
      loading: 'lazy',
    });
    img.addEventListener('load', () => {
      media.classList.remove('project-card__media--placeholder');
    });
    img.addEventListener('error', () => {
      img.remove();
      media.classList.add('project-card__media--placeholder');
    });
    media.append(img);
  }

  const badge = el('span', { className: `project-card__badge project-card__badge--${slug}`, textContent: project.statusName });

  const body = el(
    'div',
    { className: 'project-card__body' },
    el('h2', { className: 'project-card__title', textContent: project.name }),
    el('p', { className: 'project-card__goal', textContent: project.goal }),
    el('p', { className: 'project-card__dates', textContent: `${formatDateRu(project.startDate)} — ${formatDateRu(project.endDate)}` }),
    el('div', { className: 'project-card__footer' }, badge),
  );

  card.append(media, body);
  return card;
}

export async function renderHomePage(container) {
  homeLifecycleAbort?.abort();
  homeLifecycleAbort = new AbortController();
  const { signal } = homeLifecycleAbort;

  container.innerHTML = '';

  const main = el('main', { className: 'dashboard' });
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

  main.innerHTML = '';

  let cachedProjects = [];
  let allowCreateFlag = false;

  const header = el('header', { className: 'app-header' });

  const brand = el('div', { className: 'app-header__brand' });

  const nav = el('nav', { className: 'app-header__nav', 'aria-label': 'Разделы' });
  appendDashboardSectionTabs(nav, {
    active: 'home',
    roleName: user.roleName,
    isAdmin: user.roleName === 'Админ',
  });  brand.append(nav);

  const searchWrap = el('div', { className: 'app-header__search', role: 'search' });
  searchWrap.append(
    el('label', { className: 'visually-hidden', htmlFor: 'project-search', textContent: 'Поиск проектов по названию' }),
    el(
      'div',
      { className: 'app-header__search-field' },
      el('img', { className: 'app-header__search-icon', src: ICON_SEARCH, alt: '', width: 24, height: 24, decoding: 'async' }),
      el('input', {
        type: 'search',
        id: 'project-search',
        className: 'app-header__search-input',
        placeholder: 'Поиск по названию',
        autocomplete: 'off',
        enterKeyHint: 'search',
      }),
    ),
  );
  const searchInput = searchWrap.querySelector('#project-search');

  const actions = el('div', { className: 'app-header__actions' });
  const refreshBtn = el('button', {
    type: 'button',
    className: 'button button-ghost button-icon',
    title: 'Обновить список проектов',
    'aria-label': 'Обновить список проектов',
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

  const statusRegion = el('div', { className: 'dashboard__status', role: 'status', 'aria-live': 'polite' });
  const grid = el('div', { className: 'projects-grid' });
  main.append(statusRegion, grid);

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

  const showProjectError = (message) => {
    statusRegion.innerHTML = '';
    statusRegion.append(el('p', { className: 'message message_error', textContent: message }));
  };

  const clearStatus = () => {
    statusRegion.innerHTML = '';
  };

  function renderProjectGrid() {
    clearStatus();
    grid.innerHTML = '';

    if (allowCreateFlag) {
      grid.append(buildCreateCard());
    }

    const q = searchInput.value.trim().toLowerCase();
    const list = q ? cachedProjects.filter((p) => typeof p.name === 'string' && p.name.toLowerCase().includes(q)) : cachedProjects;

    if (!allowCreateFlag && cachedProjects.length === 0) {
      grid.append(
        el(
          'div',
          { className: 'projects-empty' },
          el('p', { className: 'projects-empty__title', textContent: 'Нет доступных проектов' }),
          el('p', { className: 'projects-empty__muted', textContent: 'Когда вас добавят в проект, он появится здесь.' }),
        ),
      );
      return;
    }

    if (allowCreateFlag && cachedProjects.length === 0) {
      return;
    }

    if (list.length === 0 && q) {
      grid.append(
        el(
          'div',
          { className: 'projects-empty projects-empty--inline' },
          el('p', { className: 'projects-empty__muted', textContent: 'По запросу ничего не найдено.' }),
        ),
      );
      return;
    }

    list.forEach((p) => {
      grid.append(buildProjectCard(p));
    });
  }

  async function loadProjects() {
    grid.innerHTML = '';
    grid.append(el('p', { className: 'projects-grid__loading', textContent: 'Загрузка проектов…' }));
    refreshBtn.disabled = true;
    searchInput.disabled = true;

    try {
      const { projects } = await fetchProjects();
      cachedProjects = Array.isArray(projects) ? projects : [];
      allowCreateFlag = canCreateProject(user.roleName);
      renderProjectGrid();
    } catch (err) {
      grid.innerHTML = '';
      showProjectError(err.message || 'Не удалось загрузить проекты.');
    } finally {
      refreshBtn.disabled = false;
      searchInput.disabled = false;
    }
  }

  searchInput.addEventListener('input', () => {
    if (!refreshBtn.disabled) {
      renderProjectGrid();
    }
  });

  refreshBtn.addEventListener('click', () => {
    loadProjects();
  });

  await loadProjects();
}
