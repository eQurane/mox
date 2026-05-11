import { fetchMediaById, updateMedia, deleteMedia, replaceMedia } from '../api/media.js';
import { fetchComments, addComment } from '../api/comments.js';
import { getUserSnapshot } from '../auth/session.js';
import { el } from './projectFormShared.js';
import { isProbablyImage, mediaKindFromExtension } from '../utils/mediaCardThumb.js';
import { renderNotificationBell } from '../utils/notificationBell.js';

const ICON_BACK = '/icons/back-24.svg';
const ICON_EDIT = '/icons/edit-24.svg';
const ICON_SAVE = '/icons/save-24.svg';
const ICON_UPDATE = '/icons/update-24.svg';

const FILE_KIND_ICONS = {
  video: '/icons/video-24.svg',
  audio: '/icons/music-24.svg',
  table: '/icons/table-24.svg',
  docs: '/icons/docs-24.svg',
};

const MEDIA_STATUS_SLUG = {
  Активный: 'active',
  Удалённый: 'removed',
  Архивный: 'archived',
};

function mediaStatusSlug(name) {
  return MEDIA_STATUS_SLUG[name] || 'unknown';
}

function formatDateTimeRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
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

/** @param {{ format?: string, path?: string, name?: string }} media */
function buildMediaPlayer(media) {
  const wrap = el('div', { className: 'media-player' });
  const format = media.format || '';
  const filePath = media.path || '';

  if (isProbablyImage(format, filePath)) {
    const img = el('img', {
      className: 'media-player__img',
      src: filePath,
      alt: media.name || '',
    });
    wrap.append(img);
    return wrap;
  }

  const kind = mediaKindFromExtension(format);

  if (kind === 'video') {
    const video = /** @type {HTMLVideoElement} */ (el('video', {
      className: 'media-player__video',
      controls: true,
      src: filePath,
    }));
    wrap.append(video);
    return wrap;
  }

  if (kind === 'audio') {
    const audioWrap = el('div', { className: 'media-player__audio-wrap' });
    const kindIcon = el('img', {
      className: 'media-player__kind-icon',
      src: FILE_KIND_ICONS.audio,
      alt: '',
      width: 80,
      height: 80,
      decoding: 'async',
    });
    const audio = /** @type {HTMLAudioElement} */ (el('audio', {
      className: 'media-player__audio',
      controls: true,
      src: filePath,
    }));
    audioWrap.append(kindIcon, audio);
    wrap.append(audioWrap);
    return wrap;
  }

  // table / docs — иконка
  const iconWrap = el('div', { className: 'media-player__icon-wrap' });
  const kindIcon = el('img', {
    className: 'media-player__kind-icon',
    src: FILE_KIND_ICONS[kind] || FILE_KIND_ICONS.docs,
    alt: kind,
    width: 80,
    height: 80,
    decoding: 'async',
  });
  const kindLabel = el('p', {
    className: 'media-player__kind-label',
    textContent: String(format || kind || '').toUpperCase(),
  });
  iconWrap.append(kindIcon, kindLabel);
  wrap.append(iconWrap);
  return wrap;
}

/** Модульный cleanup для опроса колокольчика */
let stopBellPolling = null;

/**
 * @param {HTMLElement} container
 * @param {string | number} mediaId
 */
export async function renderMediaDetailPage(container, mediaId) {
  if (stopBellPolling) {
    stopBellPolling();
    stopBellPolling = null;
  }

  container.innerHTML = '';
  const main = el('main', { className: 'dashboard project-detail media-detail-page' });

  // --- Toolbar ---
  const toolbar = el('div', { className: 'project-detail__toolbar' });
  const toolbarStart = el('div', { className: 'project-detail__toolbar-start' });

  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Назад к списку медиа',
      title: 'Назад',
    },
    toolbarIconImg(ICON_BACK),
  );
  backBtn.addEventListener('click', () => {
    location.hash = '#/media';
  });

  const pageTitle = el('h1', { className: 'project-detail__page-title', textContent: 'Медиа' });
  toolbarStart.append(backBtn, pageTitle);

  const toolbarActions = el('div', { className: 'app-header__actions' });
  toolbar.append(toolbarStart, toolbarActions);

  const loading = el('p', { className: 'project-detail__loading', textContent: 'Загрузка…' });
  main.append(toolbar, loading);
  container.append(main);

  // Добавляем колокольчик уведомлений
  stopBellPolling = renderNotificationBell(toolbarActions);

  // Cleanup при уходе со страницы
  window.addEventListener(
    'hashchange',
    () => {
      if (stopBellPolling) {
        stopBellPolling();
        stopBellPolling = null;
      }
    },
    { once: true },
  );

  // --- Загрузка медиа ---
  let data;
  try {
    data = await fetchMediaById(mediaId);
  } catch (err) {
    loading.remove();
    main.append(
      el(
        'div',
        { className: 'project-detail__error' },
        el('p', {
          className: 'message message_error',
          role: 'alert',
          textContent: err instanceof Error ? err.message : 'Не удалось загрузить медиа.',
        }),
        el('a', {
          className: 'button primary project-detail__back-link',
          href: '#/media',
          textContent: 'К списку медиа',
        }),
      ),
    );
    return;
  }

  loading.remove();

  const media = data.media ?? {};
  const user = getUserSnapshot() || {};
  const roleName = user.roleName;
  const canEditDescription = ['Админ', 'Менеджер', 'Исполнитель'].includes(roleName);
  const canReplace = ['Админ', 'Менеджер'].includes(roleName);
  const canDelete = ['Админ', 'Менеджер', 'Исполнитель'].includes(roleName);
  const canComment = ['Админ', 'Менеджер', 'Исполнитель'].includes(roleName);

  if (media.name) pageTitle.textContent = media.name;

  // --- Двухколоночный layout ---
  const layout = el('div', { className: 'media-detail' });

  // Левая колонка: плеер
  const playerCol = el('div', { className: 'media-detail__player' });
  playerCol.append(buildMediaPlayer(media));
  layout.append(playerCol);

  // Правая колонка: сайдбар с метаданными
  const sidebarCol = el('div', { className: 'media-detail__sidebar' });

  // Статус + формат + дата
  const mslug = mediaStatusSlug(media.statusName);
  const metaBlock = el(
    'div',
    { className: 'media-detail__meta' },
    el(
      'div',
      { className: 'media-detail__meta-row' },
      el('span', { className: 'media-detail__meta-label', textContent: 'Статус' }),
      el('span', {
        className: `media-badge media-badge--${mslug}`,
        textContent: media.statusName ?? '—',
      }),
    ),
    el(
      'div',
      { className: 'media-detail__meta-row' },
      el('span', { className: 'media-detail__meta-label', textContent: 'Формат' }),
      el('span', {
        className: 'media-detail__meta-value',
        textContent: String(media.format || '').toUpperCase() || '—',
      }),
    ),
    el(
      'div',
      { className: 'media-detail__meta-row' },
      el('span', { className: 'media-detail__meta-label', textContent: 'Загружено' }),
      el('span', {
        className: 'media-detail__meta-value',
        textContent: formatDateTimeRu(media.uploadAt),
      }),
    ),
  );

  // Ссылки на проект / ТЗ / коллекцию
  const linksBlock = el('div', { className: 'media-detail__links' });
  if (media.projectId != null) {
    linksBlock.append(
      el(
        'p',
        { className: 'media-detail__link-row' },
        el('span', { className: 'media-detail__link-label', textContent: 'Проект: ' }),
        el('a', {
          href: `#/project/${encodeURIComponent(String(media.projectId))}`,
          textContent: media.projectName ?? '—',
        }),
      ),
    );
  }
  if (media.taskId != null && media.projectId != null) {
    linksBlock.append(
      el(
        'p',
        { className: 'media-detail__link-row' },
        el('span', { className: 'media-detail__link-label', textContent: 'ТЗ: ' }),
        el('a', {
          href: `#/project/${encodeURIComponent(String(media.projectId))}/tasks/${encodeURIComponent(String(media.taskId))}`,
          textContent: media.taskName ?? '—',
        }),
      ),
    );
  }
  if (media.collectionId != null && media.projectId != null) {
    linksBlock.append(
      el(
        'p',
        { className: 'media-detail__link-row' },
        el('span', { className: 'media-detail__link-label', textContent: 'Коллекция: ' }),
        el('a', {
          href: `#/project/${encodeURIComponent(String(media.projectId))}/collections/${encodeURIComponent(String(media.collectionId))}`,
          textContent: media.collectionName ?? '—',
        }),
      ),
    );
  }

  // Описание с inline-редактированием
  const descBlock = el('div', { className: 'media-detail__desc-block' });
  const descHeader = el(
    'div',
    { className: 'media-detail__desc-header' },
    el('span', { className: 'media-detail__meta-label', textContent: 'Описание' }),
  );

  const descText = el('p', {
    className: 'media-detail__desc-text',
    textContent: media.description || 'Нет описания.',
  });

  if (canEditDescription) {
    const editDescBtn = el(
      'button',
      {
        type: 'button',
        className: 'button button-ghost button-icon media-detail__desc-edit-btn',
        title: 'Редактировать описание',
        'aria-label': 'Редактировать описание',
      },
      toolbarIconImg(ICON_EDIT),
    );

    const saveDescBtn = el(
      'button',
      {
        type: 'button',
        className: 'button button-ghost button-icon media-detail__desc-edit-btn',
        title: 'Сохранить описание',
        'aria-label': 'Сохранить описание',
        hidden: true,
      },
      toolbarIconImg(ICON_SAVE),
    );

    descHeader.append(editDescBtn, saveDescBtn);

    const descTextarea = /** @type {HTMLTextAreaElement} */ (el('textarea', {
      className: 'media-detail__desc-textarea',
      hidden: true,
      rows: 4,
      'aria-label': 'Описание медиа',
    }));
    descTextarea.value = media.description || '';

    const descError = el('p', { className: 'message message_error', hidden: true });

    let currentDescription = media.description || '';

    function startDescEdit() {
      descText.hidden = true;
      descTextarea.hidden = false;
      descTextarea.value = currentDescription;
      editDescBtn.hidden = true;
      saveDescBtn.hidden = false;
      descError.hidden = true;
      descTextarea.focus();
    }

    function cancelDescEdit() {
      descTextarea.hidden = true;
      descText.hidden = false;
      editDescBtn.hidden = false;
      saveDescBtn.hidden = true;
      descError.hidden = true;
    }

    editDescBtn.addEventListener('click', startDescEdit);

    saveDescBtn.addEventListener('click', async () => {
      const newDesc = descTextarea.value;
      saveDescBtn.disabled = true;
      descError.hidden = true;
      try {
        const result = await updateMedia(mediaId, { description: newDesc });
        currentDescription = result.media?.description ?? newDesc;
        descText.textContent = currentDescription || 'Нет описания.';
        cancelDescEdit();
      } catch (err) {
        descError.textContent = err instanceof Error ? err.message : 'Не удалось сохранить.';
        descError.hidden = false;
        saveDescBtn.disabled = false;
      }
    });

    descTextarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancelDescEdit();
    });

    descBlock.append(descHeader, descText, descTextarea, descError);
  } else {
    descBlock.append(descHeader, descText);
  }

  // Кнопки действий
  const actionsBlock = el('div', { className: 'media-detail__actions' });

  if (canReplace) {
    const fileInput = /** @type {HTMLInputElement} */ (el('input', {
      type: 'file',
      className: 'visually-hidden',
      'aria-hidden': 'true',
      tabindex: '-1',
    }));
    const replaceBtn = el(
      'button',
      { type: 'button', className: 'button button-ghost button--label-icon' },
      toolbarIconImg(ICON_UPDATE),
      ' Обновить',
    );
    const replaceStatus = el('p', {
      className: 'message',
      role: 'status',
      'aria-live': 'polite',
      hidden: true,
    });

    replaceBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      replaceBtn.disabled = true;
      replaceStatus.className = 'message';
      replaceStatus.textContent = 'Загрузка…';
      replaceStatus.hidden = false;
      try {
        const result = await replaceMedia(mediaId, file);
        const newId = result.media?.id;
        if (newId) {
          location.hash = `#/media/${encodeURIComponent(String(newId))}`;
        }
      } catch (err) {
        replaceStatus.className = 'message message_error';
        replaceStatus.textContent =
          err instanceof Error ? err.message : 'Не удалось заменить файл.';
        replaceBtn.disabled = false;
        fileInput.value = '';
      }
    });

    actionsBlock.append(fileInput, replaceBtn, replaceStatus);
  }

  if (canDelete) {
    const deleteBtn = el('button', {
      type: 'button',
      className: 'button button-ghost media-detail__delete-btn',
      textContent: 'Удалить',
    });
    const deleteError = el('p', { className: 'message message_error', hidden: true });

    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Удалить это медиа? Действие нельзя отменить.')) return;
      deleteBtn.disabled = true;
      deleteError.hidden = true;
      try {
        await deleteMedia(mediaId);
        location.hash = '#/media';
      } catch (err) {
        deleteError.textContent = err instanceof Error ? err.message : 'Не удалось удалить медиа.';
        deleteError.hidden = false;
        deleteBtn.disabled = false;
      }
    });

    actionsBlock.append(deleteBtn, deleteError);
  }

  sidebarCol.append(metaBlock, linksBlock, descBlock, actionsBlock);
  layout.append(sidebarCol);
  main.append(layout);

  // --- Комментарии ---
  const commentsSection = el('section', {
    className: 'comments-section',
    'aria-label': 'Комментарии',
  });
  const commentsTitle = el('h2', {
    className: 'comments-section__title',
    textContent: 'Комментарии',
  });
  const commentsStatus = el('div', {
    className: 'dashboard__status',
    role: 'status',
    'aria-live': 'polite',
  });
  const commentsList = el('ul', { className: 'comments-list' });

  commentsSection.append(commentsTitle, commentsStatus, commentsList);

  if (canComment) {
    const commentForm = el('form', { className: 'comment-form', novalidate: true });
    const textarea = /** @type {HTMLTextAreaElement} */ (el('textarea', {
      className: 'comment-form__textarea',
      placeholder: 'Написать комментарий…',
      rows: 3,
      required: true,
      'aria-label': 'Текст комментария',
    }));
    const submitBtn = el('button', {
      type: 'submit',
      className: 'button primary comment-form__submit',
      textContent: 'Отправить',
    });
    const formError = el('p', { className: 'message message_error', hidden: true });

    commentForm.append(textarea, formError, submitBtn);

    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textarea.value.trim();
      if (!text) {
        formError.textContent = 'Введите текст комментария.';
        formError.hidden = false;
        return;
      }
      submitBtn.disabled = true;
      formError.hidden = true;
      try {
        const result = await addComment(mediaId, text);
        textarea.value = '';
        const newComment = result.comment;
        if (newComment) {
          const emptyMsg = commentsList.querySelector('.comments-list__empty');
          if (emptyMsg) emptyMsg.remove();
          commentsList.append(buildCommentItem(newComment));
        }
      } catch (err) {
        formError.textContent =
          err instanceof Error ? err.message : 'Не удалось отправить комментарий.';
        formError.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });

    commentsSection.append(commentForm);
  }

  main.append(commentsSection);

  // --- Загрузка комментариев ---
  function buildCommentItem(comment) {
    const item = el('li', { className: 'comments-list__item' });
    const meta = el(
      'div',
      { className: 'comments-list__meta' },
      el('span', { className: 'comments-list__author', textContent: comment.userName ?? '' }),
      el('span', {
        className: 'comments-list__date',
        textContent: formatDateTimeRu(comment.createdAt),
      }),
    );
    const textEl = el('p', {
      className: 'comments-list__text',
      textContent: comment.text ?? '',
    });
    item.append(meta, textEl);
    return item;
  }

  async function loadComments() {
    commentsList.innerHTML = '';
    try {
      const commentsData = await fetchComments(mediaId);
      const comments = Array.isArray(commentsData.comments) ? commentsData.comments : [];
      if (comments.length === 0) {
        commentsList.append(
          el('li', { className: 'comments-list__empty', textContent: 'Нет комментариев.' }),
        );
      } else {
        comments.forEach((c) => commentsList.append(buildCommentItem(c)));
      }
    } catch {
      commentsStatus.append(
        el('p', {
          className: 'message message_error',
          textContent: 'Не удалось загрузить комментарии.',
        }),
      );
    }
  }

  await loadComments();
}
