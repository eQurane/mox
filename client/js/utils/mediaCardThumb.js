const ICON_NO_IMAGE = '/icons/no-image-24.svg';

/** Совпадает с `FILE_KIND_ICONS` в `pages/mediaNew.js`. */
const FILE_KIND_ICONS = {
  video: '/icons/video-24.svg',
  audio: '/icons/music-24.svg',
  table: '/icons/table-24.svg',
  docs: '/icons/docs-24.svg',
};

/** @param {string} raw */
function normalizeExt(raw) {
  return String(raw || '')
    .replace(/^\./, '')
    .toLowerCase();
}

/** Расширение из имени файла или URL-пути (без query). */
function extFromBasename(pathOrName) {
  const s = String(pathOrName || '');
  const base = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
  const q = base.indexOf('?');
  const clean = q >= 0 ? base.slice(0, q) : base;
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

/**
 * Те же группы расширений, что в `fileKind()` (`mediaNew.js`), без MIME.
 * @param {string} ext — без точки
 * @returns {'video' | 'audio' | 'table' | 'docs'}
 */
export function mediaKindFromExtension(ext) {
  const e = normalizeExt(ext);
  if (!e) return 'docs';
  if (['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv'].includes(e)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'opus'].includes(e)) {
    return 'audio';
  }
  if (['csv', 'xls', 'xlsx', 'ods', 'tsv'].includes(e)) {
    return 'table';
  }
  if (['pdf', 'doc', 'docx', 'odt', 'txt', 'md', 'rtf'].includes(e)) {
    return 'docs';
  }
  return 'docs';
}

/** @param {{ format?: string, name?: string, path?: string }} item */
function mediaKindFromStoredMedia(item) {
  let ext = normalizeExt(item.format);
  if (!ext) ext = extFromBasename(item.name);
  if (!ext) ext = extFromBasename(item.path);
  return mediaKindFromExtension(ext);
}

export function isProbablyImage(format, path) {
  const ext = normalizeExt(format);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return true;
  const p = String(path || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(p);
}

/** @param {HTMLElement} mediaTop @param {{ format?: string, name?: string, path?: string }} item */
function renderKindIcon(mediaTop, item) {
  mediaTop.innerHTML = '';
  const kind = mediaKindFromStoredMedia(item);
  mediaTop.className = 'project-card__media project-card__media--kind-icon';
  const img = document.createElement('img');
  img.className = 'project-card__kind-icon';
  img.src = FILE_KIND_ICONS[kind];
  img.alt = '';
  img.decoding = 'async';
  mediaTop.append(img);
}

/**
 * @param {HTMLElement} mediaTop — контейнер `.project-card__media`
 * @param {{ format?: string, name?: string, path?: string }} item Медиа с полями API.
 */
export function attachMediaCardThumb(mediaTop, item) {
  mediaTop.innerHTML = '';
  if (isProbablyImage(item.format, item.path)) {
    mediaTop.className = 'project-card__media project-card__media--placeholder';
    const img = document.createElement('img');
    img.className = 'project-card__img';
    img.alt = '';
    img.src = item.path;
    img.loading = 'lazy';
    img.addEventListener('load', () => {
      mediaTop.classList.remove('project-card__media--placeholder');
    });
    img.addEventListener('error', () => {
      renderKindIcon(mediaTop, item);
    });
    mediaTop.append(img);
  } else {
    renderKindIcon(mediaTop, item);
  }
}

/**
 * Устанавливает превью обложки для карточки проекта / задание / коллекции.
 * Если `coverPath` отсутствует — показывает иконку «нет изображения».
 * Если `coverPath` есть — делегирует `attachMediaCardThumb` (изображение
 * или иконка типа по расширению, с запасным вариантом при ошибке загрузки).
 *
 * @param {HTMLElement} mediaTop — контейнер `.project-card__media`
 * @param {string | null | undefined} coverPath
 */
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
