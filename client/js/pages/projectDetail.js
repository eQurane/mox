import { fetchProjectById } from '../api/projects.js';

const ICON_BACK = '/icons/back-24.svg';
const ICON_EDIT = '/icons/edit-24.svg';
const ICON_LIST = '/icons/list-24.svg';

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
    if (value === false || value == null) return;
    if (key === 'htmlFor') {
      node.htmlFor = value;
      return;
    }
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

function formatDateRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
}

function formatDateTimeRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

const STATUS_SLUG = {
  Запланированный: 'planned',
  Активный: 'active',
  Приостановленный: 'hold',
  Завершенный: 'done',
};

const TASK_STATUS_SLUG = {
  'К выполнению': 'planned',
  'В работе': 'active',
  'На проверке': 'hold',
  Выполнено: 'done',
  Отменено: 'unknown',
};

const MEDIA_STATUS_SLUG = {
  Активный: 'active',
  Удалённый: 'removed',
  Архивный: 'archived',
};

function statusSlug(name) {
  return STATUS_SLUG[name] || 'unknown';
}

function taskStatusSlug(name) {
  return TASK_STATUS_SLUG[name] || 'unknown';
}

function mediaStatusSlug(name) {
  return MEDIA_STATUS_SLUG[name] || 'unknown';
}

function isProbablyImage(format, path) {
  const ext = String(format || '')
    .replace(/^\./, '')
    .toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return true;
  const p = String(path || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(p);
}

function buildSectionCreateCard(href, label) {
  const card = el('a', {
    className: 'project-card project-card--create',
    href,
  });
  card.append(
    el(
      'div',
      { className: 'project-card__create-inner' },
      el('span', { className: 'project-card__create-plus', textContent: '+' }),
    ),
    el(
      'div',
      { className: 'project-card__body project-card__body--create' },
      el('h2', { className: 'project-card__title', textContent: label }),
    ),
  );
  return card;
}

function sectionHeading(href, text) {
  return el(
    'a',
    {
      className: 'project-detail__section-heading',
      href,
      textContent: text,
    },
  );
}

export async function renderProjectDetailPage(container, projectId) {
  container.innerHTML = '';
  const main = el('main', { className: 'dashboard project-detail' });

  const toolbar = el('div', { className: 'project-detail__toolbar' });
  const toolbarStart = el('div', { className: 'project-detail__toolbar-start' });
  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Назад к проектам',
      title: 'Назад к проектам',
    },
    el('img', {
      className: 'header-toolbar__icon',
      src: ICON_BACK,
      alt: '',
      width: 24,
      height: 24,
      decoding: 'async',
    }),
  );
  backBtn.addEventListener('click', () => {
    location.hash = '#/home';
  });

  const editBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Редактировать проект',
      title: 'Редактировать проект',
      hidden: true,
    },
    el('img', {
      className: 'header-toolbar__icon',
      src: ICON_EDIT,
      alt: '',
      width: 24,
      height: 24,
      decoding: 'async',
    }),
  );

  toolbarStart.append(backBtn, el('h1', { className: 'project-detail__page-title', textContent: 'Проект' }));
  toolbar.append(toolbarStart, editBtn);

  const loading = el('p', { className: 'project-detail__loading', textContent: 'Загрузка…' });
  main.append(toolbar, loading);
  container.append(main);

  let data;
  try {
    data = await fetchProjectById(projectId);
  } catch (err) {
    loading.remove();
    const errP = el('p', {
      className: 'message message_error',
      role: 'alert',
      textContent: err.message || 'Не удалось загрузить проект.',
    });
    const backLink = el('a', {
      className: 'button primary project-detail__back-link',
      href: '#/home',
      textContent: 'К проектам',
    });
    main.append(el('div', { className: 'project-detail__error' }, errP, backLink));
    return;
  }

  loading.remove();

  const project = data.project ?? {};
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const collections = Array.isArray(data.collections) ? data.collections : [];
  const media = Array.isArray(data.media) ? data.media : [];

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const collById = new Map(collections.map((c) => [c.id, c]));

  const pageTitle = main.querySelector('.project-detail__page-title');
  if (pageTitle && project.name) {
    pageTitle.textContent = project.name;
  }

  editBtn.hidden = false;
  editBtn.addEventListener('click', () => {
    location.hash = `#/project/${projectId}/edit`;
  });

  const slug = statusSlug(project.statusName);
  const heroMedia = el('div', { className: 'project-detail__hero-media project-card__media project-card__media--placeholder' });
  if (project.coverPath) {
    const img = el('img', {
      className: 'project-card__img',
      alt: '',
      src: project.coverPath,
      loading: 'eager',
    });
    img.addEventListener('load', () => {
      heroMedia.classList.remove('project-card__media--placeholder');
    });
    img.addEventListener('error', () => {
      img.remove();
      heroMedia.classList.add('project-card__media--placeholder');
    });
    heroMedia.append(img);
  }

  const badge = el('span', {
    className: `project-card__badge project-card__badge--${slug}`,
    textContent: project.statusName ?? '—',
  });

  const summary = el(
    'div',
    { className: 'project-detail__summary' },
    el('p', { className: 'project-detail__goal', textContent: project.goal ?? '' }),
    el(
      'p',
      { className: 'project-detail__dates' },
      `${formatDateRu(project.startDate)} — ${formatDateRu(project.endDate)}`,
    ),
    el('div', { className: 'project-detail__badge-row' }, badge),
  );

  const hero = el(
    'div',
    { className: `project-detail__hero project-detail__hero--status-${slug}` },
    heroMedia,
    summary,
  );

  function buildTaskCard(task) {
    const tslug = taskStatusSlug(task.statusName);
    const card = el('article', {
      className: `project-card project-card--static project-card--status-${tslug}`,
    });
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
    card.append(el('div', { className: 'project-card__media project-card__media--placeholder' }), body);
    return card;
  }

  function buildCollectionCard(col) {
    const card = el('article', {
      className: 'project-card project-card--static project-card--status-unknown',
    });
    const taskTitle = taskById.get(col.taskId)?.name ?? '—';
    const body = el(
      'div',
      { className: 'project-card__body' },
      el('h2', { className: 'project-card__title', textContent: col.name ?? '' }),
      el('p', { className: 'project-card__goal', textContent: col.description || '—' }),
      el('p', {
        className: 'project-card__muted',
        textContent: `ТЗ: ${taskTitle}`,
      }),
      el('p', {
        className: 'project-card__dates',
        textContent: `Создано: ${formatDateTimeRu(col.createdAt)} · Изм.: ${formatDateTimeRu(col.lastEditedAt)}`,
      }),
    );
    card.append(el('div', { className: 'project-card__media project-card__media--placeholder' }), body);
    return card;
  }

  function buildMediaCard(item) {
    const mslug = mediaStatusSlug(item.statusName);
    const card = el('article', {
      className: `project-card project-card--static project-detail__media-card project-card--status-unknown`,
    });
    const collection = collById.get(item.collectionId);
    const taskTitle = collection ? taskById.get(collection.taskId)?.name ?? '—' : '—';
    const collectionTitle = collection?.name ?? '—';

    const mediaTop = el('div', { className: 'project-card__media project-card__media--placeholder' });
    if (isProbablyImage(item.format, item.path)) {
      const img = el('img', {
        className: 'project-card__img',
        alt: '',
        src: item.path,
        loading: 'lazy',
      });
      img.addEventListener('load', () => {
        mediaTop.classList.remove('project-card__media--placeholder');
      });
      img.addEventListener('error', () => {
        img.remove();
      });
      mediaTop.append(img);
    }

    const body = el(
      'div',
      { className: 'project-card__body' },
      el('h2', { className: 'project-card__title', textContent: item.name ?? '' }),
      el('p', {
        className: 'project-card__muted',
        textContent: `${collectionTitle} · ТЗ: ${taskTitle}`,
      }),
      el('p', {
        className: 'project-card__dates',
        textContent: `${String(item.format || '').toUpperCase()} · ${formatDateTimeRu(item.uploadAt)}`,
      }),
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

  const hrefTasksNew = `#/project/${projectId}/tasks/new`;
  const hrefTasksList = `#/tasks?projectId=${encodeURIComponent(String(projectId))}`;
  const hrefCollections = `#/project/${projectId}/collections/new`;
  const hrefMedia = `#/project/${projectId}/media/new`;

  const tasksSectionHead = el(
    'div',
    { className: 'project-detail__section-head' },
    el(
      'h2',
      { className: 'project-detail__section-title project-detail__section-title--tasks' },
      el('a', {
        className: 'project-detail__section-heading',
        href: hrefTasksList,
        textContent: 'Технические задания',
      }),
      el(
        'a',
        {
          className: 'button button-ghost button-icon project-detail__section-list-btn',
          href: hrefTasksList,
          'aria-label': 'Список всех технических заданий проекта',
          title: 'Список технических заданий',
        },
        el('img', {
          className: 'header-toolbar__icon',
          src: ICON_LIST,
          alt: '',
          width: 24,
          height: 24,
          decoding: 'async',
        }),
      ),
    ),
    el('a', { className: 'project-detail__section-add', href: hrefTasksNew, textContent: 'Добавить ТЗ' }),
  );

  const tasksGrid = el('div', { className: 'projects-grid projects-grid--detail' });
  if (tasks.length === 0) {
    tasksGrid.append(buildSectionCreateCard(hrefTasksNew, 'Добавить ТЗ'));
  } else {
    tasks.forEach((t) => tasksGrid.append(buildTaskCard(t)));
  }

  const colGrid = el('div', { className: 'projects-grid projects-grid--detail' });
  if (collections.length === 0) {
    colGrid.append(buildSectionCreateCard(hrefCollections, 'Новая коллекция'));
  } else {
    collections.forEach((c) => colGrid.append(buildCollectionCard(c)));
  }

  const mediaGrid = el('div', { className: 'projects-grid projects-grid--detail' });
  if (media.length === 0) {
    mediaGrid.append(buildSectionCreateCard(hrefMedia, 'Добавить медиа'));
  } else {
    media.forEach((m) => mediaGrid.append(buildMediaCard(m)));
  }

  const sections = el(
    'div',
    { className: 'project-detail__sections' },
    el(
      'section',
      { className: 'project-detail__section' },
      tasksSectionHead,
      tasksGrid,
    ),
    el(
      'section',
      { className: 'project-detail__section' },
      el('h2', { className: 'project-detail__section-title' }, sectionHeading(hrefCollections, 'Коллекции')),
      colGrid,
    ),
    el(
      'section',
      { className: 'project-detail__section' },
      el('h2', { className: 'project-detail__section-title' }, sectionHeading(hrefMedia, 'Мультимедиа')),
      mediaGrid,
    ),
  );

  main.append(hero, sections);
}
