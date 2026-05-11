import { fetchNotifications } from '../api/notifications.js';
import { getUserSnapshot } from '../auth/session.js';

const LAST_SEEN_KEY = 'mox_notifications_last_seen';
const POLL_INTERVAL_MS = 30_000;

function getLastSeen() {
  const v = localStorage.getItem(LAST_SEEN_KEY);
  return v ? new Date(v) : null;
}

function setLastSeen() {
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
}

function countUnread(notifications) {
  const lastSeen = getLastSeen();
  if (!lastSeen) return notifications.length;
  return notifications.filter((n) => new Date(n.createdAt) > lastSeen).length;
}

function formatDateTimeRu(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Добавляет кнопку уведомлений в `container`.
 * Показывается только для Менеджера и Админа.
 * Возвращает функцию-cleanup для остановки опроса.
 *
 * @param {HTMLElement} container
 * @returns {() => void}
 */
export function renderNotificationBell(container) {
  const user = getUserSnapshot();
  if (!user || (user.roleName !== 'Менеджер' && user.roleName !== 'Админ')) {
    return () => {};
  }

  /** @type {Array<{mediaId:number, mediaName:string, text:string, createdAt:string, commenterName:string}>} */
  let notifications = [];
  let dropdownOpen = false;

  const wrap = document.createElement('div');
  wrap.className = 'notification-bell';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button button-ghost button-icon notification-bell__btn';
  btn.title = 'Уведомления';
  btn.setAttribute('aria-label', 'Уведомления');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-haspopup', 'true');

  const iconImg = document.createElement('img');
  iconImg.src = '/icons/notifications-24.svg';
  iconImg.alt = '';
  iconImg.width = 24;
  iconImg.height = 24;
  iconImg.decoding = 'async';
  iconImg.className = 'header-toolbar__icon';

  const badge = document.createElement('span');
  badge.className = 'notification-bell__badge';
  badge.hidden = true;
  badge.setAttribute('aria-hidden', 'true');

  btn.append(iconImg, badge);

  const dropdown = document.createElement('div');
  dropdown.className = 'notification-bell__dropdown';
  dropdown.hidden = true;
  dropdown.setAttribute('role', 'menu');

  wrap.append(btn, dropdown);
  container.append(wrap);

  function updateBadge() {
    const count = countUnread(notifications);
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function renderDropdown() {
    dropdown.innerHTML = '';

    if (notifications.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'notification-bell__empty';
      empty.textContent = 'Нет уведомлений.';
      dropdown.append(empty);
      return;
    }

    const list = document.createElement('ul');
    list.className = 'notification-bell__list';

    for (const n of notifications) {
      const item = document.createElement('li');
      item.className = 'notification-bell__item';

      const link = document.createElement('a');
      link.className = 'notification-bell__link';
      link.href = `#/media/${encodeURIComponent(String(n.mediaId))}`;

      const titleEl = document.createElement('span');
      titleEl.className = 'notification-bell__item-title';
      titleEl.textContent = n.mediaName ?? '—';

      const textEl = document.createElement('span');
      textEl.className = 'notification-bell__item-text';
      textEl.textContent = n.text;

      const metaEl = document.createElement('span');
      metaEl.className = 'notification-bell__item-meta';
      metaEl.textContent = `${n.commenterName ?? ''} · ${formatDateTimeRu(n.createdAt)}`;

      link.append(titleEl, textEl, metaEl);
      link.addEventListener('click', () => setMenuOpen(false));
      item.append(link);
      list.append(item);
    }

    dropdown.append(list);
  }

  function setMenuOpen(open) {
    dropdownOpen = open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    dropdown.hidden = !open;
    if (open) {
      setLastSeen();
      badge.hidden = true;
      renderDropdown();
    }
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMenuOpen(!dropdownOpen);
  });

  document.addEventListener('click', () => {
    if (dropdownOpen) setMenuOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdownOpen) {
      setMenuOpen(false);
      btn.focus();
    }
  });

  async function refresh() {
    try {
      const data = await fetchNotifications();
      notifications = Array.isArray(data.notifications) ? data.notifications : [];
      if (!dropdownOpen) updateBadge();
    } catch {
      // silently ignore polling errors
    }
  }

  refresh();
  const intervalId = setInterval(refresh, POLL_INTERVAL_MS);

  return () => clearInterval(intervalId);
}
