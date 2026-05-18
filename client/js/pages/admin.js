import { fetchMe } from '../api/auth.js';
import {
  approveAdminUser,
  deleteAdminUser,
  fetchAdminIssues,
  fetchAdminLargeStorageFiles,
  fetchAdminOverview,
  fetchAdminUser,
  fetchAdminUsers,
  hardDeleteAdminMedia,
  patchAdminUser,
} from '../api/admin.js';
import { appendDashboardSectionTabs } from '../nav/dashboardTabs.js';
import { clearSession, getToken, setSession } from '../auth/session.js';
import { renderNotificationBell } from '../utils/notificationBell.js';

const ICON_ACCOUNT = '/icons/account-24.svg';
const ICON_UPDATE = '/icons/update-24.svg';

const PENDING_STATUS = 'На подтверждении';

let adminAbort;
/** @type {(() => void) | null} */
let adminPageHashCleanup = null;

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

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  const u = ['Б', 'КБ', 'МБ', 'ГБ'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function formatDateRu(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}

/** @param {URLSearchParams} searchParams */
function tabFromParams(searchParams) {
  const t = searchParams.get('tab');
  const allowed = ['users', 'registrations', 'overview', 'issues', 'media'];
  if (t && allowed.includes(t)) return t;
  return 'users';
}

function setAdminTab(tab) {
  const base = tab === 'users' ? '#/admin' : `#/admin?tab=${encodeURIComponent(tab)}`;
  if (location.hash !== base) {
    history.replaceState(null, '', base);
  }
}

function buildSubTabs(active, onSelect) {
  const wrap = el('div', { className: 'admin-subtabs', role: 'tablist', 'aria-label': 'Разделы администрирования' });
  const tabs = [
    ['users', 'Пользователи'],
    ['registrations', 'Регистрации'],
    ['overview', 'Обзор'],
    ['issues', 'Проблемы'],
    ['media', 'Медиа'],
  ];
  for (const [id, label] of tabs) {
    const btn = el('button', {
      type: 'button',
      className: `admin-subtabs__btn${active === id ? ' admin-subtabs__btn--current' : ''}`,
      role: 'tab',
      'aria-selected': active === id ? 'true' : 'false',
      textContent: label,
    });
    btn.addEventListener('click', () => onSelect(id));
    wrap.append(btn);
  }
  return wrap;
}

/**
 * @param {HTMLElement} container
 * @param {URLSearchParams} [searchParams]
 */
export function renderAdminPage(container, searchParams = new URLSearchParams()) {
  if (adminPageHashCleanup) {
    adminPageHashCleanup();
    adminPageHashCleanup = null;
  }
  if (adminAbort) adminAbort.abort();
  adminAbort = new AbortController();
  const { signal } = adminAbort;

  container.innerHTML = '';
  const main = el('main', { className: 'page page--wide admin-page' });
  const loadingP = el('p', { className: 'register-muted', textContent: 'Загрузка…' });
  main.append(loadingP);
  container.append(main);

  const run = async () => {
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
    if (signal.aborted) return;

    main.innerHTML = '';

    const header = el('header', { className: 'app-header admin-page__header' });
    const brand = el('div', { className: 'app-header__brand' });
    const nav = el('nav', { className: 'app-header__nav', 'aria-label': 'Разделы' });
    appendDashboardSectionTabs(nav, {
      active: 'admin',
      roleName: user.roleName,
      isAdmin: true,
    });
    brand.append(nav);

    const actions = el('div', { className: 'app-header__actions' });
    const refreshBtn = el('button', {
      type: 'button',
      className: 'button button-ghost button-icon',
      title: 'Обновить страницу',
      'aria-label': 'Обновить',
    });
    refreshBtn.append(toolbarIconImg(ICON_UPDATE));
    refreshBtn.addEventListener('click', () => renderAdminPage(container, new URLSearchParams(location.hash.split('?')[1] || '')));

    const userWrap = el('div', { className: 'user-menu' });
    const userBtn = el('button', {
      type: 'button',
      className: 'button button-ghost button-icon user-menu__toggle',
      title: 'Учётная запись',
      'aria-label': 'Меню учётной записи',
      'aria-expanded': 'false',
    });
    userBtn.append(toolbarIconImg(ICON_ACCOUNT));
    const panel = el('div', { className: 'user-menu__panel', hidden: true, role: 'menu' });
    panel.append(
      el(
        'div',
        { className: 'user-menu__who' },
        el('div', { className: 'user-menu__name', textContent: user.name }),
        el('div', { className: 'user-menu__email', textContent: user.email }),
      ),
      el('button', { type: 'button', className: 'user-menu__logout', role: 'menuitem', textContent: 'Выйти' }),
    );
    userWrap.append(userBtn, panel);
    panel.querySelector('.user-menu__logout')?.addEventListener('click', () => {
      clearSession();
      location.hash = '#/login';
    });
    let menuOpen = false;
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      userBtn.setAttribute('aria-expanded', menuOpen ? 'true' : 'false');
      panel.hidden = !menuOpen;
    });
    document.addEventListener('click', () => {
      menuOpen = false;
      userBtn.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    });

    actions.append(refreshBtn);
    const bellCleanup = renderNotificationBell(actions);
    window.addEventListener(
      'hashchange',
      () => {
        bellCleanup();
      },
      { once: true },
    );
    actions.append(userWrap);
    header.append(brand, actions);
    main.append(header);

    const body = el('div', { className: 'admin-page__body' });
    const statusEl = el('div', { className: 'message', role: 'status', 'aria-live': 'polite', hidden: true });
    const jwtHint = el('p', {
      className: 'register-muted admin-page__jwt-hint',
      hidden: true,
      textContent:
        'Если вы меняли роль или статус другому пользователю, ему может понадобиться выйти и войти снова — JWT не обновляется автоматически.',
    });

    let activeTab = tabFromParams(searchParams);

    const content = el('div', { className: 'admin-page__content' });

    const showMsg = (text, isError = false) => {
      statusEl.hidden = false;
      statusEl.textContent = text;
      statusEl.className = isError ? 'message message_error' : 'message message_ok';
    };
    const hideMsg = () => {
      statusEl.hidden = true;
      statusEl.textContent = '';
    };

    async function loadUsersSection(registrationsOnly) {
      hideMsg();
      const wrap = el('div', { className: 'admin-section' });
      const filters = el('div', { className: 'admin-fields' });

      let listData = { users: [], roles: [], userStatuses: [], total: 0 };
      try {
        listData = await fetchAdminUsers({ limit: 50, offset: 0 });
      } catch (e) {
        showMsg(e.message, true);
      }

      const pendingId = listData.userStatuses?.find((s) => s.name === PENDING_STATUS)?.id ?? '';

      const idPrefix = registrationsOnly ? 'admin-reg' : 'admin-users';
      const qId = `${idPrefix}-search`;
      const roleFieldId = `${idPrefix}-role`;
      const statusFieldId = `${idPrefix}-status`;

      const qInp = el('input', {
        type: 'search',
        id: qId,
        name: `${idPrefix}-q`,
        placeholder: 'Часть email или имени',
        autocomplete: 'off',
      });
      const roleSel = el('select', { id: roleFieldId, name: `${idPrefix}-role` });
      roleSel.append(el('option', { value: '', textContent: 'Все роли' }));
      for (const r of listData.roles || []) {
        roleSel.append(el('option', { value: String(r.id), textContent: r.name }));
      }
      const statusSel = el('select', { id: statusFieldId, name: `${idPrefix}-status` });
      statusSel.append(el('option', { value: '', textContent: 'Все статусы' }));
      for (const s of listData.userStatuses || []) {
        statusSel.append(el('option', { value: String(s.id), textContent: s.name }));
      }

      if (registrationsOnly && pendingId !== '') {
        statusSel.value = String(pendingId);
        statusSel.disabled = true;
      }

      const searchBtn = el('button', { type: 'button', className: 'button primary', textContent: 'Найти' });

      const wrapSearch = el(
        'div',
        { className: 'field admin-fields__q' },
        el('label', { htmlFor: qId, textContent: 'Поиск по email или имени' }),
        qInp,
      );
      const wrapRole = el(
        'div',
        { className: 'field' },
        el('label', { htmlFor: roleFieldId, textContent: 'Роль' }),
        roleSel,
      );
      const wrapStatus = el(
        'div',
        { className: 'field' },
        el('label', { htmlFor: statusFieldId, textContent: 'Статус' }),
        statusSel,
      );
      const wrapSearchBtn = el(
        'div',
        { className: 'field admin-filter__actions' },
        el('span', { className: 'field__legend', 'aria-hidden': 'true' }, '\u00a0'),
        searchBtn,
      );

      const filterRow = el('div', { className: 'admin-fields__row' }, wrapSearch, wrapRole, wrapStatus, wrapSearchBtn);
      const filterForm = el('div', { className: 'register-form admin-filters' }, filterRow);
      filters.append(filterForm);

      const tableWrap = el('div', { className: 'admin-table-wrap' });
      const detailCard = el('div', { className: 'register-card admin-detail', hidden: true });

      let selectedId = null;

      async function reloadList() {
        try {
          const data = await fetchAdminUsers({
            q: qInp.value.trim(),
            roleId: roleSel.value || undefined,
            statusId: statusSel.value || undefined,
            limit: 50,
            offset: 0,
          });
          renderTable(data.users || []);
          if (!listData.roles?.length) {
            listData.roles = data.roles;
            listData.userStatuses = data.userStatuses;
          }
        } catch (e) {
          showMsg(e.message, true);
        }
      }

      function renderTable(users) {
        tableWrap.innerHTML = '';
        const t = el('table', { className: 'admin-table' });
        t.append(
          el(
            'thead',
            {},
            el('tr', {}, el('th', { textContent: 'Email' }), el('th', { textContent: 'Имя' }), el('th', { textContent: 'Роль' }), el('th', { textContent: 'Статус' }), el('th', { textContent: 'Регистрация' })),
          ),
        );
        const tb = el('tbody');
        for (const u of users) {
          const tr = el('tr', { className: 'admin-table__row' });
          if (selectedId === u.id) tr.classList.add('admin-table__row--selected');
          tr.addEventListener('click', () => openUser(u.id));
          tr.append(
            el('td', { textContent: u.email }),
            el('td', { textContent: u.name }),
            el('td', { textContent: u.roleName }),
            el('td', { textContent: u.statusName }),
            el('td', { textContent: formatDateRu(u.registeredAt) }),
          );
          tb.append(tr);
        }
        t.append(tb);
        tableWrap.append(t);
      }

      async function openUser(id) {
        selectedId = id;
        detailCard.hidden = false;
        detailCard.innerHTML = '';
        detailCard.append(el('p', { className: 'register-muted', textContent: 'Загрузка…' }));
        await reloadList();
        try {
          const data = await fetchAdminUser(id);
          const u = data.user;
          const projects = data.projects || [];
          detailCard.innerHTML = '';

          const roleSelectId = `admin-detail-role-${id}`;
          const statusSelectId = `admin-detail-status-${id}`;
          const roleSelect = el('select', { id: roleSelectId, name: 'roleId' });
          for (const r of listData.roles || []) {
            roleSelect.append(el('option', { value: String(r.id), textContent: r.name }));
          }
          roleSelect.value = String(u.roleId);

          const statusSelect = el('select', { id: statusSelectId, name: 'statusId' });
          for (const s of listData.userStatuses || []) {
            statusSelect.append(el('option', { value: String(s.id), textContent: s.name }));
          }
          statusSelect.value = String(u.statusId);

          const wrapRoleSel = el(
            'div',
            { className: 'field' },
            el('label', { htmlFor: roleSelectId, textContent: 'Роль' }),
            roleSelect,
          );
          const wrapStatusSel = el(
            'div',
            { className: 'field' },
            el('label', { htmlFor: statusSelectId, textContent: 'Статус' }),
            statusSelect,
          );

          const projBlock = el('div', { className: 'admin-detail__projects' });
          if (projects.length === 0) {
            projBlock.append(el('p', { className: 'register-muted', textContent: 'Нет активного участия в проектах.' }));
          } else {
            projBlock.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'Участие в проектах' }));
            const plist = el('div', { className: 'admin-plain-list' });
            for (const p of projects) {
              plist.append(
                el(
                  'div',
                  { className: 'admin-plain-list__row' },
                  el('a', { href: `#/project/${p.id}`, textContent: p.name }),
                  el('span', { className: 'register-muted', textContent: ` с ${formatDateRu(p.includedAt)}` }),
                ),
              );
            }
            projBlock.append(plist);
          }

          const saveBtn = el('button', { type: 'button', className: 'button primary', textContent: 'Сохранить роль и статус' });
          saveBtn.addEventListener('click', async () => {
            try {
              await patchAdminUser(id, {
                roleId: Number(roleSelect.value),
                statusId: Number(statusSelect.value),
              });
              showMsg('Сохранено.');
              jwtHint.hidden = false;
              await reloadList();
              await openUser(id);
            } catch (e) {
              showMsg(e.message, true);
            }
          });

          const approveBtn = el('button', { type: 'button', className: 'button', textContent: 'Подтвердить регистрацию' });
          approveBtn.hidden = u.statusName !== PENDING_STATUS;
          approveBtn.addEventListener('click', async () => {
            try {
              await approveAdminUser(id);
              showMsg('Пользователь активирован.');
              await reloadList();
              await openUser(id);
            } catch (e) {
              showMsg(e.message, true);
            }
          });

          const delBtn = el('button', { type: 'button', className: 'button button-danger', textContent: 'Удалить учётную запись' });
          delBtn.hidden = u.statusName !== PENDING_STATUS;
          delBtn.addEventListener('click', async () => {
            if (!window.confirm('Удалить учётную запись без подтверждения? Действие необратимо.')) return;
            try {
              await deleteAdminUser(id);
              showMsg('Удалено.');
              detailCard.hidden = true;
              selectedId = null;
              await reloadList();
            } catch (e) {
              showMsg(e.message, true);
            }
          });

          const disableNote = el('p', {
            className: 'register-muted',
            textContent: 'Чтобы отключить активного пользователя, выберите статус «Отключён» и нажмите «Сохранить».',
          });
          disableNote.hidden = u.statusName === PENDING_STATUS;

          detailCard.append(
            el('h2', { className: 'register-title', textContent: u.email }),
            el('p', { textContent: `${u.name}, id ${u.id}` }),
            el('div', { className: 'register-form admin-detail__role-status' },
              el('div', { className: 'admin-fields__row' }, wrapRoleSel, wrapStatusSel),
            ),
            projBlock,
            el('div', { className: 'admin-detail__actions' }, saveBtn, approveBtn, delBtn),
            disableNote,
          );
        } catch (e) {
          detailCard.innerHTML = '';
          detailCard.append(el('p', { className: 'message message_error', textContent: e.message }));
        }
      }

      searchBtn.addEventListener('click', () => reloadList());
      let deb;
      qInp.addEventListener('input', () => {
        clearTimeout(deb);
        deb = setTimeout(() => reloadList(), 400);
      });
      roleSel.addEventListener('change', () => reloadList());
      if (!registrationsOnly) {
        statusSel.addEventListener('change', () => reloadList());
      }

      wrap.append(filters, tableWrap, detailCard);
      await reloadList();
      content.append(wrap);
    }

    async function loadOverview() {
      hideMsg();
      const wrap = el('div', { className: 'admin-section' });
      try {
        const o = await fetchAdminOverview();
        const grid = el('div', { className: 'admin-overview-grid' });
        grid.append(
          cardNum('Проекты', o.projectCount),
          cardNum('Технические задания', o.taskCount),
          cardNum('Коллекции', o.collectionCount),
        );
        wrap.append(grid);
        wrap.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'Пользователи по статусам' }));
        wrap.append(listKv(o.usersByStatus || [], 'statusName', 'count'));
        wrap.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'Медиа по статусам' }));
        wrap.append(listKv(o.mediaByStatus || [], 'statusName', 'count'));
        content.append(wrap);
      } catch (e) {
        showMsg(e.message, true);
        content.append(wrap);
      }
    }

    function cardNum(label, val) {
      return el(
        'div',
        { className: 'admin-stat-card' },
        el('div', { className: 'admin-stat-card__value', textContent: String(val ?? '—') }),
        el('div', { className: 'admin-stat-card__label', textContent: label }),
      );
    }

    function listKv(rows, k, v) {
      const ul = el('ul', { className: 'admin-kv' });
      for (const r of rows) {
        ul.append(el('li', { textContent: `${r[k]}: ${r[v]}` }));
      }
      return ul;
    }

    async function loadIssues() {
      hideMsg();
      const wrap = el('div', { className: 'admin-section' });
      try {
        const i = await fetchAdminIssues();

        wrap.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'Проекты без активных участников' }));
        if (!i.projectsWithoutMembers?.length) wrap.append(el('p', { className: 'register-muted', textContent: 'Нет.' }));
        else {
          const plist = el('div', { className: 'admin-plain-list' });
          for (const p of i.projectsWithoutMembers) {
            plist.append(
              el(
                'div',
                { className: 'admin-plain-list__row' },
                el('a', { href: `#/project/${p.id}`, textContent: `${p.name} (#${p.id})` }),
              ),
            );
          }
          wrap.append(plist);
        }

        wrap.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'На подтверждении' }));
        if (!i.pendingUsers?.length) wrap.append(el('p', { className: 'register-muted', textContent: 'Нет.' }));
        else {
          const plist = el('div', { className: 'admin-plain-list' });
          for (const u of i.pendingUsers) {
            plist.append(el('div', { className: 'admin-plain-list__row', textContent: `${u.email} — ${u.name} (${u.roleName})` }));
          }
          wrap.append(plist);
        }

        wrap.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'ТЗ без коллекций' }));
        if (!i.tasksWithoutCollections?.length) wrap.append(el('p', { className: 'register-muted', textContent: 'Нет.' }));
        else {
          const plist = el('div', { className: 'admin-plain-list' });
          for (const t of i.tasksWithoutCollections) {
            plist.append(
              el(
                'div',
                { className: 'admin-plain-list__row' },
                el('a', { href: `#/project/${t.projectId}/tasks/${t.id}`, textContent: t.name }),
                el('span', { className: 'register-muted', textContent: ` — ${t.projectName}` }),
              ),
            );
          }
          wrap.append(plist);
        }

        wrap.append(el('h3', { className: 'admin-detail__subtitle', textContent: 'Коллекции без медиа' }));
        if (!i.collectionsWithoutMedia?.length) wrap.append(el('p', { className: 'register-muted', textContent: 'Нет.' }));
        else {
          const plist = el('div', { className: 'admin-plain-list' });
          for (const c of i.collectionsWithoutMedia) {
            plist.append(
              el(
                'div',
                { className: 'admin-plain-list__row' },
                el('a', { href: `#/project/${c.projectId}/collections/${c.id}`, textContent: c.name }),
                el('span', { className: 'register-muted', textContent: ` — ${c.projectName} / ${c.taskName}` }),
              ),
            );
          }
          wrap.append(plist);
        }

        content.append(wrap);
      } catch (e) {
        showMsg(e.message, true);
        content.append(wrap);
      }
    }

    async function loadMediaMaintenance() {
      hideMsg();
      const wrap = el('div', { className: 'admin-section' });
      wrap.append(
        el(
          'p',
          { className: 'register-muted' },
          'Файлы в каталоге storage больше 50 МБ. Строки без привязки к БД помечены как «Нет в БД».',
        ),
      );
      const btn = el('button', { type: 'button', className: 'button', textContent: 'Обновить список' });
      const tableWrap = el('div', { className: 'admin-table-wrap' });
      wrap.append(btn, tableWrap);

      async function load() {
        tableWrap.innerHTML = '';
        try {
          const data = await fetchAdminLargeStorageFiles(100);
          const t = el('table', { className: 'admin-table' });
          t.append(
            el(
              'thead',
              {},
              el(
                'tr',
                {},
                el('th', { textContent: 'Размер' }),
                el('th', { textContent: 'Файл' }),
                el('th', { textContent: 'Медиа / контекст' }),
                el('th', { textContent: 'Действия' }),
              ),
            ),
          );
          const tb = el('tbody');
          for (const f of data.files || []) {
            const tr = el('tr');
            const actionCell = el('td');
            if (f.media) {
              const del = el('button', { type: 'button', className: 'button button-danger', textContent: 'Удалить навсегда' });
              del.addEventListener('click', async () => {
                if (!window.confirm('Удалить медиа и файл с диска? Комментарии к этому медиа будут удалены.')) return;
                try {
                  await hardDeleteAdminMedia(f.media.id);
                  showMsg('Медиа удалено.');
                  await load();
                } catch (e) {
                  showMsg(e.message, true);
                }
              });
              actionCell.append(del);
            } else {
              actionCell.append(el('span', { className: 'register-muted', textContent: '—' }));
            }
            const ctx = f.media
              ? el(
                  'span',
                  {},
                  el('a', { href: `#/media/${f.media.id}`, textContent: f.media.name }),
                  el('span', { className: 'register-muted', textContent: ` · ${f.media.projectName}` }),
                )
              : el('span', { className: 'message message_error', textContent: 'Нет в БД' });

            tr.append(
              el('td', { textContent: formatBytes(f.sizeBytes) }),
              el('td', {}, el('code', { className: 'admin-code', textContent: f.fileName })),
              el('td', {}, ctx),
              actionCell,
            );
            tb.append(tr);
          }
          t.append(tb);
          tableWrap.append(t);
        } catch (e) {
          showMsg(e.message, true);
        }
      }

      btn.addEventListener('click', load);
      await load();
      content.append(wrap);
    }

    function mountSubtabsAndContent() {
      body.innerHTML = '';
      const sub = buildSubTabs(activeTab, (id) => {
        activeTab = id;
        setAdminTab(id);
        mountSubtabsAndContent();
      });
      body.append(sub, statusEl, jwtHint, content);
      content.innerHTML = '';

      if (activeTab === 'users') loadUsersSection(false);
      else if (activeTab === 'registrations') loadUsersSection(true);
      else if (activeTab === 'overview') loadOverview();
      else if (activeTab === 'issues') loadIssues();
      else loadMediaMaintenance();
    }

    main.append(body);
    mountSubtabsAndContent();

    const onHash = () => {
      if (!/^#\/?admin(\?|$)/.test(location.hash)) return;
      const { searchParams: sp } = parseAdminHash();
      const next = tabFromParams(sp);
      if (next !== activeTab) {
        activeTab = next;
        mountSubtabsAndContent();
      }
    };
    window.addEventListener('hashchange', onHash);
    adminPageHashCleanup = () => window.removeEventListener('hashchange', onHash);
  };

  function parseAdminHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const qIdx = raw.indexOf('?');
    const queryStr = qIdx >= 0 ? raw.slice(qIdx + 1) : '';
    return { searchParams: new URLSearchParams(queryStr) };
  }

  run();
}
