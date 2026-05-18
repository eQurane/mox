import { fetchCollectionById } from '../api/collections.js';
import { getUserSnapshot } from '../auth/session.js';
import { el } from './projectFormShared.js';
import { attachMediaCardThumb } from '../utils/mediaCardThumb.js';

const ICON_BACK = '/icons/back-24.svg';
const ICON_EDIT = '/icons/edit-24.svg';

const MEDIA_STATUS_SLUG = {
  Активный: 'active',
  'Удалённый': 'removed',
  Архивный: 'archived',
};

function formatDateTimeRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
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
 * @param {string} collectionId
 */
export async function renderCollectionDetailPage(container, projectId, collectionId) {
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
      'aria-label': 'Редактировать коллекцию',
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
    el('h1', { className: 'project-detail__page-title', textContent: 'Коллекция' }),
  );
  toolbar.append(toolbarStart, editBtn);

  const loading = el('p', { className: 'project-detail__loading', textContent: 'Загрузка…' });
  main.append(toolbar, loading);
  container.append(main);

  let data;
  try {
    data = await fetchCollectionById(collectionId);
  } catch (err) {
    loading.remove();
    const errP = el('p', {
      className: 'message message_error',
      role: 'alert',
      textContent: err instanceof Error ? err.message : 'Не удалось загрузить коллекцию.',
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

  const collection = data.collection ?? {};
  const mediaList = Array.isArray(data.media) ? data.media : [];

  const user = getUserSnapshot() || {};
  const roleName = user.roleName;
  const pidNum = Number(projectId);
  const collPid = collection.projectId;

  const pageTitle = main.querySelector('.project-detail__page-title');
  if (pageTitle && collection.name) {
    pageTitle.textContent = collection.name;
  }

  if (collPid != null && Number(collPid) !== pidNum) {
    main.append(
      el('div', { className: 'project-detail__error' }, el(
        'p',
        {
          className: 'message message_error',
          role: 'alert',
          textContent: 'Эта коллекция относится к другому проекту.',
        },
      )),
      el('a', {
        className: 'button primary project-detail__back-link',
        href: `#/project/${encodeURIComponent(String(collPid))}/collections/${encodeURIComponent(String(collection.id))}`,
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
      location.hash = `#/project/${projectId}/collections/${collectionId}/edit`;
    });
  }

  const taskHref = `#/project/${encodeURIComponent(String(collection.projectId ?? projectId))}/tasks/${encodeURIComponent(String(collection.taskId ?? ''))}`;
  const projectHref = `#/project/${encodeURIComponent(String(collection.projectId ?? projectId))}`;

  const summary = el(
    'div',
    { className: 'task-detail__summary project-detail__summary' },
    el('p', { className: 'project-detail__goal', textContent: collection.description ?? 'Нет описания.' }),
    el(
      'p',
      { className: 'project-detail__dates' },
      el('span', { className: 'project-detail__dates-segment' }, `Создано: ${formatDateTimeRu(collection.createdAt)}`),
      ' · ',
      el('span', { className: 'project-detail__dates-segment' }, `Изменено: ${formatDateTimeRu(collection.lastEditedAt)}`),
    ),
    el('p', { className: 'project-card__muted' }, 'Техническое задание: ', el('a', {
      className: 'project-detail__task-project-link',
      href: taskHref,
      textContent: collection.taskName ?? '—',
    })),
    el('p', { className: 'project-card__muted' }, 'Проект: ', el('a', {
      className: 'project-detail__task-project-link',
      href: projectHref,
      textContent: collection.projectName ?? '—',
    })),
  );

  const hero = el(
    'div',
    { className: 'project-detail__hero project-detail__hero--status-unknown' },
    summary,
  );

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

    const mediaTop = el('div');
    attachMediaCardThumb(mediaTop, item);

    const body = el(
      'div',
      { className: 'project-card__body' },
      el('h2', { className: 'project-card__title', textContent: item.name ?? '' }),
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

  const hrefMediaNew =
    `#/project/${encodeURIComponent(String(projectId))}/media/new?collectionId=${encodeURIComponent(String(collectionId))}`;

  const mediaSectionHead = el(
    'div',
    { className: 'project-detail__section-head' },
    el('h2', { className: 'project-detail__section-title project-detail__section-title--tasks', textContent: 'Мультимедиа' }),
  );

  const mediaGrid = el('div', { className: 'projects-grid projects-grid--detail' });
  if (
    roleName === 'Админ'
    || roleName === 'Менеджер'
    || roleName === 'Внешний подрядчик'
    || roleName === 'Исполнитель'
  ) {
    mediaGrid.append(buildSectionCreateCard(hrefMediaNew, 'Добавить медиа'));
  }
  if (mediaList.length === 0 && roleName === 'Клиент') {
    mediaGrid.append(el('p', { className: 'project-detail__muted', textContent: 'Нет медиа.' }));
  } else {
    mediaList.forEach((m) => mediaGrid.append(buildMediaCard(m)));
  }

  const sections = el(
    'div',
    { className: 'project-detail__sections' },
    el(
      'section',
      { className: 'project-detail__section' },
      mediaSectionHead,
      mediaGrid,
    ),
  );

  main.append(hero, sections);
}
