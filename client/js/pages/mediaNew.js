import { fetchCollections } from '../api/collections.js';
import { fetchProjectById } from '../api/projects.js';
import { uploadMedia } from '../api/media.js';
import { getUserSnapshot } from '../auth/session.js';
import { el } from './projectFormShared.js';

/** Снимает подсветку drop безопасно при уходе со страницы (один слушатель на приложение). */
let mediaDragEndCleanupInstalled = false;

function ensureMediaPageDragCleanup() {
  if (mediaDragEndCleanupInstalled) return;
  mediaDragEndCleanupInstalled = true;
  document.addEventListener('dragend', () => {
    for (const node of document.querySelectorAll('.media-new-page.media-new-page--drag')) {
      node.classList.remove('media-new-page--drag');
    }
  });
}

/** @param {File} file */
function filePreviewUrl(file) {
  return file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
}

function isFileDragEvent(ev) {
  return Boolean(ev.dataTransfer?.types?.includes('Files'));
}

function clearDragHighlight(mainEl) {
  mainEl.classList.remove('media-new-page--drag');
}

const FILE_KIND_ICONS = {
  video: '/icons/video-24.svg',
  audio: '/icons/music-24.svg',
  table: '/icons/table-24.svg',
  docs: '/icons/docs-24.svg',
};

/** @param {File} file @returns {'video' | 'audio' | 'table' | 'docs'} */
function fileKind(file) {
  const mime = (file.type || '').toLowerCase();
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';

  if (mime.startsWith('video/') || ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv'].includes(ext)) {
    return 'video';
  }
  if (
    mime.startsWith('audio/')
    || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'].includes(ext)
  ) {
    return 'audio';
  }
  if (
    mime.includes('spreadsheet')
    || mime === 'text/csv'
    || ['csv', 'xls', 'xlsx', 'ods', 'tsv'].includes(ext)
  ) {
    return 'table';
  }
  if (
    mime === 'application/pdf'
    || mime.startsWith('text/')
    || ['pdf', 'doc', 'docx', 'odt', 'txt', 'md', 'rtf'].includes(ext)
  ) {
    return 'docs';
  }
  return 'docs';
}

/**
 * @param {HTMLElement} container
 * @param {string} projectId
 * @param {URLSearchParams} searchParams
 */
export async function renderMediaNewPage(container, projectId, searchParams) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page project-new-page media-new-page' });
  const card = el('div', { className: 'register-card' });

  const queryCollectionRaw = searchParams.get('collectionId');
  const queryCollectionTrim =
    typeof queryCollectionRaw === 'string' ? queryCollectionRaw.trim() : '';

  const title = el('h1', { className: 'register-title', textContent: 'Добавление мультимедиа' });
  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label':
        queryCollectionTrim && /^\d+$/.test(queryCollectionTrim)
          ? 'Назад к коллекции'
          : 'Назад к проекту',
      title:
        queryCollectionTrim && /^\d+$/.test(queryCollectionTrim)
          ? 'Назад к коллекции'
          : 'Назад к проекту',
    },
    el('img', {
      className: 'header-toolbar__icon',
      src: '/icons/back-24.svg',
      alt: '',
      width: 24,
      height: 24,
      decoding: 'async',
    }),
  );
  backBtn.addEventListener('click', () => {
    if (queryCollectionTrim && /^\d+$/.test(queryCollectionTrim)) {
      location.hash = `#/project/${projectId}/collections/${queryCollectionTrim}`;
    } else {
      location.hash = `#/project/${projectId}`;
    }
  });

  const header = el('div', { className: 'register-card__header' }, title, backBtn);

  const statusMsg = el('p', {
    className: 'message',
    hidden: true,
    role: 'status',
    'aria-live': 'polite',
  });

  const showMessage = (text, isError) => {
    statusMsg.textContent = text;
    if (!text) {
      statusMsg.hidden = true;
      statusMsg.className = 'message';
      return;
    }
    statusMsg.hidden = false;
    statusMsg.className = `message ${isError ? 'message_error' : 'message_ok'}`;
  };

  const loading = el('p', { className: 'register-muted', textContent: 'Загрузка…' });
  card.append(header, statusMsg, loading);
  main.append(card);
  container.append(main);

  let collections = [];
  try {
    await fetchProjectById(projectId);
    const colPayload = await fetchCollections({ projectId });
    collections = Array.isArray(colPayload.collections) ? colPayload.collections : [];
  } catch (err) {
    loading.remove();
    showMessage(err instanceof Error ? err.message : 'Не удалось загрузить данные.', true);
    card.append(
      el('a', {
        className: 'button button-ghost',
        href: `#/project/${projectId}`,
        textContent: 'К проекту',
      }),
    );
    return;
  }

  loading.remove();

  if (collections.length === 0) {
    const isContractor = getUserSnapshot()?.roleName === 'Внешний подрядчик';
    showMessage(
      isContractor
        ? 'В проекте нет доступных коллекций. Обратитесь к менеджеру проекта.'
        : 'В проекте нет коллекций. Сначала создайте коллекцию.',
      true,
    );
    if (!isContractor) {
      card.append(
        el('a', {
          className: 'button primary',
          href: `#/project/${projectId}/collections/new`,
          textContent: 'Новая коллекция',
        }),
      );
    } else {
      card.append(
        el('a', {
          className: 'button button-ghost',
          href: `#/project/${projectId}`,
          textContent: 'К проекту',
        }),
      );
    }
    return;
  }

  const collectionIds = new Set(collections.map((c) => String(c.id)));
  let defaultCollectionId = '';
  if (queryCollectionTrim && collectionIds.has(queryCollectionTrim)) {
    defaultCollectionId = queryCollectionTrim;
  } else if (collections[0]?.id != null) {
    defaultCollectionId = String(collections[0].id);
  }

  /** @type {{ id: string, file: File, description: string, collectionId: string, previewUrl: string | null }[]} */
  let queue = [];

  /** id строк очереди с незаполненной коллекцией после попытки «Загрузить» */
  const invalidCollectionIds = new Set();

  function collectionSelectValue() {
    const first = collections[0];
    return first?.id != null ? String(first.id) : '';
  }

  function buildCollectionSelect(selectedValue) {
    const sel = el('select', {
      className: 'media-new-queue__collection-select',
      'aria-label': 'Коллекция',
    });
    sel.append(el('option', { value: '', textContent: 'Выберите коллекцию' }));
    for (const c of collections) {
      const labelParts = [c.name ?? `Коллекция ${c.id}`];
      if (c.taskName) labelParts.push(`ТЗ: ${c.taskName}`);
      sel.append(
        el('option', {
          value: String(c.id),
          textContent: labelParts.join(' · '),
        }),
      );
    }
    if (selectedValue && collectionIds.has(selectedValue)) {
      sel.value = selectedValue;
    }
    return sel;
  }

  const queueRoot = el('div', { className: 'media-new-queue' });

  function renderQueue() {
    queueRoot.innerHTML = '';
    if (queue.length === 0) {
      queueRoot.append(
        el('p', {
          className: 'register-muted media-new-queue__empty',
          textContent: 'Файлы пока не добавлены.',
        }),
      );
      return;
    }

    for (const item of queue) {
      const row = el('div', { className: 'media-new-queue__item' });
      const inner = el('div', { className: 'media-new-queue__row' });

      const previewWrap = el('div', {
        className: 'media-new-queue__thumb',
        title: item.file.name || 'Файл',
      });
      if (item.previewUrl) {
        previewWrap.append(
          el('img', {
            className: 'media-new-queue__thumb-img',
            src: item.previewUrl,
            alt: '',
          }),
        );
      } else {
        const kind = fileKind(item.file);
        previewWrap.append(
          el('img', {
            className: 'media-new-queue__thumb-icon',
            src: FILE_KIND_ICONS[kind],
            alt: '',
            width: 24,
            height: 24,
            decoding: 'async',
          }),
        );
      }

      const descId = `media-desc-${item.id}`;
      const collId = `media-coll-${item.id}`;

      const descInput = el('textarea', {
        id: descId,
        className: 'media-new-queue__desc',
        rows: 2,
        placeholder: 'Описание',
        'aria-label': 'Описание',
      });
      descInput.value = item.description;
      descInput.addEventListener('input', () => {
        item.description = descInput.value;
      });

      const collSelect = buildCollectionSelect(item.collectionId);
      collSelect.id = collId;
      if (invalidCollectionIds.has(item.id)) {
        collSelect.classList.add('media-new-queue__collection-select--error');
        collSelect.setAttribute('aria-invalid', 'true');
      } else {
        collSelect.setAttribute('aria-invalid', 'false');
      }
      collSelect.addEventListener('change', () => {
        item.collectionId = collSelect.value;
        invalidCollectionIds.delete(item.id);
        collSelect.classList.remove('media-new-queue__collection-select--error');
        collSelect.setAttribute('aria-invalid', 'false');
      });

      const removeBtn = el(
        'button',
        {
          type: 'button',
          className: 'button button-ghost button-icon media-new-queue__remove',
          'aria-label': 'Убрать из списка',
          title: 'Убрать из списка',
        },
        el('img', {
          src: '/icons/close-24.svg',
          alt: '',
          width: 24,
          height: 24,
          decoding: 'async',
        }),
      );
      removeBtn.addEventListener('click', () => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        invalidCollectionIds.delete(item.id);
        queue = queue.filter((q) => q.id !== item.id);
        renderQueue();
        syncSubmitDisabled();
      });

      inner.append(previewWrap, descInput, collSelect, removeBtn);
      row.append(inner);
      queueRoot.append(row);
    }
  }

  const fileInput = el('input', {
    type: 'file',
    multiple: true,
    className: 'media-new-file-input',
    hidden: true,
  });

  const chooseBtn = el('button', {
    type: 'button',
    className: 'button button-ghost',
    textContent: 'Выбрать файлы',
  });
  chooseBtn.addEventListener('click', () => fileInput.click());

  const toolbar = el(
    'div',
    { className: 'media-new-toolbar' },
    el('p', {
      className: 'media-new-toolbar__hint register-muted',
      textContent:
        'Перетащите файлы в любое место страницы или нажмите «Выбрать файлы».',
    }),
    chooseBtn,
    fileInput,
  );

  function uploadLocked() {
    return chooseBtn.disabled;
  }

  function addFiles(fileList) {
    invalidCollectionIds.clear();
    const next = [...queue];
    for (const file of fileList) {
      const previewUrl = filePreviewUrl(file);
      next.push({
        id: crypto.randomUUID(),
        file,
        description: '',
        collectionId: defaultCollectionId || collectionSelectValue(),
        previewUrl,
      });
    }
    queue = next;
    renderQueue();
    syncSubmitDisabled();
  }

  function onMainDragOver(ev) {
    if (uploadLocked() || !isFileDragEvent(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'copy';
    main.classList.add('media-new-page--drag');
  }

  function onMainDrop(ev) {
    if (uploadLocked() || !isFileDragEvent(ev)) return;
    ev.preventDefault();
    clearDragHighlight(main);
    const dt = ev.dataTransfer?.files;
    if (dt?.length) addFiles(dt);
  }

  ensureMediaPageDragCleanup();

  main.addEventListener('dragover', onMainDragOver);
  main.addEventListener('drop', onMainDrop);

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) addFiles(fileInput.files);
    fileInput.value = '';
  });

  const submitBtn = el('button', {
    type: 'button',
    className: 'button primary media-new-submit',
    textContent: 'Загрузить',
    disabled: true,
  });

  function syncSubmitDisabled() {
    submitBtn.disabled = queue.length === 0;
  }

  submitBtn.addEventListener('click', async () => {
    if (queue.length === 0) return;
    showMessage('', false);
    const missingColl = queue.some(
      (q) => !q.collectionId || !collectionIds.has(String(q.collectionId)),
    );
    if (missingColl) {
      invalidCollectionIds.clear();
      for (const q of queue) {
        if (!q.collectionId || !collectionIds.has(String(q.collectionId))) {
          invalidCollectionIds.add(q.id);
        }
      }
      showMessage('Укажите коллекцию для каждого файла.', true);
      renderQueue();
      return;
    }

    invalidCollectionIds.clear();

    submitBtn.disabled = true;
    chooseBtn.disabled = true;
    clearDragHighlight(main);

    const uploadedCollections = new Set();
    try {
      for (const item of queue) {
        const cid = Number(item.collectionId);
        await uploadMedia({
          file: item.file,
          collectionId: cid,
          description: item.description,
        });
        uploadedCollections.add(cid);
      }

      if (uploadedCollections.size === 1) {
        const only = [...uploadedCollections][0];
        location.hash = `#/project/${projectId}/collections/${only}`;
      } else {
        location.hash = `#/media?projectId=${encodeURIComponent(String(projectId))}`;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить файлы.';
      showMessage(msg, true);
      submitBtn.disabled = false;
      chooseBtn.disabled = false;
    }
  });

  renderQueue();
  syncSubmitDisabled();

  card.append(toolbar, queueRoot, submitBtn);
}
