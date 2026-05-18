import { fetchTaskById } from '../api/tasks.js';
import { getUserSnapshot } from '../auth/session.js';
import { el } from './projectFormShared.js';
import { attachMediaCardThumb, attachCoverThumb } from '../utils/mediaCardThumb.js';

const ICON_BACK = '/icons/back-24.svg';
const ICON_EDIT = '/icons/edit-24.svg';
const ICON_LIST = '/icons/list-24.svg';

function formatDateTimeRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

const TASK_STATUS_SLUG = {
  'К выполнению': 'planned',
  'В работе': 'active',
  'На проверке': 'hold',
  Выполнено: 'done',
  Отменено: 'unknown',
};

const MEDIA_STATUS_SLUG = {
  Активный: 'active',
  'Удалённый': 'removed',
  Архивный: 'archived',
};

function taskStatusSlug(name) {
  return TASK_STATUS_SLUG[name] || 'unknown';
}

function mediaStatusSlug(name) {
  return MEDIA_STATUS_SLUG[name] || 'unknown';
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

/**
 * @param {HTMLElement} container
 * @param {string} projectId
 * @param {string} taskId
 */
export async function renderTaskDetailPage(container, projectId, taskId) {
  container.innerHTML = '';
  const main = el('main', { className: 'dashboard project-detail task-detail' });

  const toolbar = el('div', { className: 'project-detail__toolbar' });
  const toolbarStart = el('div', { className: 'project-detail__toolbar-start' });
  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Назад к проекту',
      title: 'Назад к проекту',
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
    location.hash = `#/project/${projectId}`;
  });

  const editBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Редактировать ТЗ',
      title: 'Редактировать',
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

  toolbarStart.append(
    backBtn,
    el('h1', { className: 'project-detail__page-title', textContent: 'Техническое задание' }),
  );
  toolbar.append(toolbarStart, editBtn);

  const loading = el('p', { className: 'project-detail__loading', textContent: 'Загрузка…' });
  main.append(toolbar, loading);
  container.append(main);

  let data;
  try {
    data = await fetchTaskById(taskId);
  } catch (err) {
    loading.remove();
    const errP = el('p', {
      className: 'message message_error',
      role: 'alert',
      textContent: err.message || 'Не удалось загрузить техническое задание.',
    });
    const backLink = el('a', {
      className: 'button primary project-detail__back-link',
      href: `#/project/${projectId}`,
      textContent: 'К проекту',
    });
    main.append(el('div', { className: 'project-detail__error' }, errP, backLink));
    return;
  }

  loading.remove();

  const task = data.task ?? {};
  const collections = Array.isArray(data.collections) ? data.collections : [];
  const mediaList = Array.isArray(data.media) ? data.media : [];

  const user = getUserSnapshot() || {};
  const roleName = user.roleName;
  const canManageTasks = roleName === 'Админ' || roleName === 'Менеджер';
  const hideGlobalBrowseLinks =
    roleName === 'Клиент' || roleName === 'Внешний подрядчик';
  const hideNewCollectionControls =
    roleName === 'Клиент' || roleName === 'Внешний подрядчик';
  const pidNum = Number(projectId);
  const taskPid = task.projectId;

  const pageTitle = main.querySelector('.project-detail__page-title');
  if (pageTitle && task.name) {
    pageTitle.textContent = task.name;
  }

  if (taskPid != null && Number(taskPid) !== pidNum) {
    main.append(
      el('div', { className: 'project-detail__error' }, el(
        'p',
        {
          className: 'message message_error',
          role: 'alert',
          textContent: 'Это техническое задание относится к другому проекту.',
        },
      )),
      el('a', {
        className: 'button primary project-detail__back-link',
        href: `#/project/${encodeURIComponent(String(taskPid))}/tasks/${encodeURIComponent(String(task.id))}`,
        textContent: 'Открыть в правильном проекте',
      }),
      el(
        'a',
        {
          className: 'button button-ghost project-detail__back-link',
          href: `#/project/${projectId}`,
          textContent: 'К проекту',
        },
      ),
    );
    return;
  }

  if (roleName === 'Админ' || roleName === 'Менеджер') {
    editBtn.hidden = false;
    editBtn.addEventListener('click', () => {
      location.hash = `#/project/${projectId}/tasks/${taskId}/edit`;
    });
  }

  const tslug = taskStatusSlug(task.statusName);

  const summary = el(
    'div',
    { className: 'task-detail__summary project-detail__summary' },
    el('p', { className: 'project-detail__goal', textContent: task.description ?? 'Нет описания.' }),
    el(
      'p',
      { className: 'project-detail__dates' },
      `Дедлайн: ${formatDateTimeRu(task.deadline)}`,
    ),
    el('p', {
      className: 'project-card__muted',
      textContent: `Роль исполнителя: ${task.roleName ?? '—'}`,
    }),
    el('p', { className: 'project-card__muted' }, 'Проект: ', el('a', {
      className: 'project-detail__task-project-link',
      href: `#/project/${encodeURIComponent(String(task.projectId ?? projectId))}`,
      textContent: task.projectName ?? '—',
    })),
    el('div', { className: 'project-detail__badge-row' }, el(
      'span',
      {
        className: `project-card__badge project-card__badge--${tslug}`,
        textContent: task.statusName ?? '—',
      },
    )),
  );

  const hero = el(
    'div',
    { className: `project-detail__hero project-detail__hero--status-${tslug}` },
    summary,
  );

  const collById = new Map(collections.map((c) => [c.id, c]));

  function buildCollectionCard(col) {
    const colHref =
      `#/project/${encodeURIComponent(String(projectId))}/collections/${encodeURIComponent(String(col.id))}`;
    const card = el('a', {
      className: 'project-card project-card--static project-card--link project-card--status-unknown',
      href: colHref,
    });
    const body = el(
      'div',
      { className: 'project-card__body' },
      el('h2', { className: 'project-card__title', textContent: col.name ?? '' }),
      el('p', { className: 'project-card__goal', textContent: col.description || '—' }),
      el('p', {
        className: 'project-card__dates',
        textContent: `Создано: ${formatDateTimeRu(col.createdAt)} · Изм.: ${formatDateTimeRu(col.lastEditedAt)}`,
      }),
    );
    const colMediaTop = el('div');
    attachCoverThumb(colMediaTop, col.coverPath ?? null);
    card.append(colMediaTop, body);
    return card;
  }

  function buildMediaCard(item) {
    const mslug = mediaStatusSlug(item.statusName);
    const card = el('article', {
      className: `project-card project-card--static project-card--link project-detail__media-card project-card--status-unknown`,
      style: 'cursor:pointer',
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      location.hash = `#/media/${encodeURIComponent(String(item.id))}`;
    });
    const collection = collById.get(item.collectionId);
    const collectionTitle = collection?.name ?? '—';

    const mediaTop = el('div');
    attachMediaCardThumb(mediaTop, item);

    const body = el(
      'div',
      { className: 'project-card__body' },
      el('h2', { className: 'project-card__title', textContent: item.name ?? '' }),
      el('p', {
        className: 'project-card__muted',
        textContent: `Коллекция: ${collectionTitle}`,
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

  const hrefCollectionsList =
    `#/collections?projectId=${encodeURIComponent(String(projectId))}&taskId=${encodeURIComponent(String(taskId))}`;
  const hrefMediaList =
    `#/media?projectId=${encodeURIComponent(String(projectId))}&taskId=${encodeURIComponent(String(taskId))}`;
  const hrefCollectionsNew =
    `#/project/${encodeURIComponent(String(projectId))}/tasks/${encodeURIComponent(String(taskId))}/collections/new`;
  const hrefMediaNew = `#/project/${projectId}/media/new`;

  const collectionsSectionHead = el(
    'div',
    { className: 'project-detail__section-head' },
    el(
      'h2',
      { className: 'project-detail__section-title project-detail__section-title--tasks' },
      !hideGlobalBrowseLinks ? el('a', {
        className: 'project-detail__section-heading',
        href: hrefCollectionsList,
        textContent: 'Коллекции',
      }) : el('span', {
        className: 'project-detail__section-heading',
        textContent: 'Коллекции',
      }),
      !hideGlobalBrowseLinks ? el(
        'a',
        {
          className: 'button button-ghost button-icon project-detail__section-list-btn',
          href: hrefCollectionsList,
          'aria-label': 'Список коллекций по этому техническому заданию',
          title: 'Список коллекций',
        },
        el('img', {
          className: 'header-toolbar__icon',
          src: ICON_LIST,
          alt: '',
          width: 24,
          height: 24,
          decoding: 'async',
        }),
      ) : null,
    ),
  );

  const collectionsGrid = el('div', { className: 'projects-grid projects-grid--detail' });
  if (!hideNewCollectionControls) {
    collectionsGrid.append(buildSectionCreateCard(hrefCollectionsNew, 'Новая коллекция'));
  }
  if (collections.length === 0) {
    if (hideGlobalBrowseLinks) {
      collectionsGrid.append(el('p', { className: 'project-detail__muted', textContent: 'Нет коллекций.' }));
    }
  } else {
    collections.forEach((c) => collectionsGrid.append(buildCollectionCard(c)));
  }

  const mediaSectionHead = el(
    'div',
    { className: 'project-detail__section-head' },
    el(
      'h2',
      { className: 'project-detail__section-title project-detail__section-title--tasks' },
      !hideGlobalBrowseLinks ? el('a', {
        className: 'project-detail__section-heading',
        href: hrefMediaList,
        textContent: 'Мультимедиа',
      }) : el('span', {
        className: 'project-detail__section-heading',
        textContent: 'Мультимедиа',
      }),
      !hideGlobalBrowseLinks ? el(
        'a',
        {
          className: 'button button-ghost button-icon project-detail__section-list-btn',
          href: hrefMediaList,
          'aria-label': 'Список медиа по этому техническому заданию',
          title: 'Список медиа',
        },
        el('img', {
          className: 'header-toolbar__icon',
          src: ICON_LIST,
          alt: '',
          width: 24,
          height: 24,
          decoding: 'async',
        }),
      ) : null,
    ),
  );

  const mediaGrid = el('div', { className: 'projects-grid projects-grid--detail' });
  if (canManageTasks || roleName === 'Внешний подрядчик') {
    mediaGrid.append(buildSectionCreateCard(hrefMediaNew, 'Добавить медиа'));
  }
  if (mediaList.length === 0) {
    if (hideGlobalBrowseLinks && roleName !== 'Внешний подрядчик') {
      mediaGrid.append(el('p', { className: 'project-detail__muted', textContent: 'Нет медиа.' }));
    }
  } else {
    mediaList.forEach((m) => mediaGrid.append(buildMediaCard(m)));
  }

  const sections = el(
    'div',
    { className: 'project-detail__sections' },
    el(
      'section',
      { className: 'project-detail__section' },
      collectionsSectionHead,
      collectionsGrid,
    ),
    el(
      'section',
      { className: 'project-detail__section' },
      mediaSectionHead,
      mediaGrid,
    ),
  );

  main.append(hero, sections);
}
