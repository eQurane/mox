import { isLoggedIn, getUserSnapshot } from './auth/session.js';
import { renderHomePage } from './pages/home.js';
import { renderLoginPage } from './pages/login.js';
import { renderRegisterPage } from './pages/register.js';
import { renderAdminPage } from './pages/admin.js';
import { renderProjectNewPage } from './pages/projectNew.js';
import { renderProjectDetailPage } from './pages/projectDetail.js';
import { renderProjectEditPage } from './pages/projectEdit.js';
import { renderCollectionDetailPage } from './pages/collectionDetail.js';
import { renderCollectionEditPage } from './pages/collectionEdit.js';
import { renderCollectionNewPage } from './pages/collectionNew.js';
import { renderMediaNewPage } from './pages/mediaNew.js';
import { renderMediaDetailPage } from './pages/mediaDetail.js';
import { renderTaskDetailPage } from './pages/taskDetail.js';
import { renderTaskEditPage } from './pages/taskEdit.js';
import { renderTaskNewPage } from './pages/taskNew.js';
import { renderTasksListPage } from './pages/tasksList.js';
import { renderCollectionsListPage } from './pages/collectionsList.js';
import { renderMediaListPage } from './pages/mediaList.js';

const appRoot = document.getElementById('app');

function parseHashParts() {
  const rawFull = location.hash.replace(/^#\/?/, '');
  const qIdx = rawFull.indexOf('?');
  const normalized = (qIdx >= 0 ? rawFull.slice(0, qIdx) : rawFull) || 'login';
  const queryStr = qIdx >= 0 ? rawFull.slice(qIdx + 1) : '';
  return { rawFull, normalized, searchParams: new URLSearchParams(queryStr) };
}

function segmentsFromNormalized(normalized) {
  return normalized.split('/').filter(Boolean);
}

function isProtectedRoute(normalized) {
  const segs = segmentsFromNormalized(normalized);
  if (segs[0] === 'home') return true;
  if (segs[0] === 'project' && segs[1]) return true;
  if (segs[0] === 'projects' && segs[1] === 'new') return true;
  if (segs[0] === 'admin' && segs.length === 1) return true;
  if (segs[0] === 'tasks' && segs.length === 1) return true;
  if (segs[0] === 'collections' && segs.length === 1) return true;
  if (segs[0] === 'media' && segs.length === 1) return true;
  if (segs[0] === 'media' && segs.length === 2 && /^\d+$/.test(segs[1])) return true;
  return false;
}

function route() {
  const { rawFull, normalized, searchParams } = parseHashParts();

  if (!rawFull) {
    history.replaceState(null, '', '#/login');
  }

  if (isProtectedRoute(normalized) && !isLoggedIn()) {
    history.replaceState(null, '', '#/login');
    renderLoginPage(appRoot);
    return;
  }

  if (normalized === 'login' && isLoggedIn()) {
    history.replaceState(null, '', '#/home');
    renderHomePage(appRoot);
    return;
  }

  if (normalized === 'login') {
    renderLoginPage(appRoot);
    return;
  }
  if (normalized === 'register') {
    renderRegisterPage(appRoot);
    return;
  }

  const segs = segmentsFromNormalized(normalized);

  if (segs[0] === 'admin' && segs.length === 1) {
    if (getUserSnapshot()?.roleName !== 'Админ') {
      history.replaceState(null, '', '#/home');
      renderHomePage(appRoot);
      return;
    }
    renderAdminPage(appRoot, searchParams);
    return;
  }

  if (segs[0] === 'projects' && segs[1] === 'new') {
    const role = getUserSnapshot()?.roleName;
    if (role !== 'Админ' && role !== 'Менеджер') {
      history.replaceState(null, '', '#/home');
      renderHomePage(appRoot);
      return;
    }
    renderProjectNewPage(appRoot);
    return;
  }

  if (segs[0] === 'project' && segs[1] && /^\d+$/.test(segs[1])) {
    const id = segs[1];

    if (segs[2] === 'edit' && segs.length === 3) {
      const role = getUserSnapshot()?.roleName;
      if (role !== 'Админ' && role !== 'Менеджер') {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderProjectEditPage(appRoot, id);
      return;
    }
    if (segs[2] === 'tasks' && segs[3] === 'new' && segs.length === 4) {
      const taskNewRole = getUserSnapshot()?.roleName;
      if (taskNewRole !== 'Админ' && taskNewRole !== 'Менеджер') {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderTaskNewPage(appRoot, id);
      return;
    }
    if (
      segs[2] === 'tasks'
      && segs.length === 5
      && /^\d+$/.test(segs[3])
      && segs[4] === 'edit'
    ) {
      const taskEditRole = getUserSnapshot()?.roleName;
      if (taskEditRole !== 'Админ' && taskEditRole !== 'Менеджер') {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderTaskEditPage(appRoot, id, segs[3]);
      return;
    }
    if (
      segs[2] === 'tasks'
      && segs.length === 6
      && /^\d+$/.test(segs[3])
      && segs[4] === 'collections'
      && segs[5] === 'new'
    ) {
      const colNewRole = getUserSnapshot()?.roleName;
      if (colNewRole !== 'Админ' && colNewRole !== 'Менеджер') {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderCollectionNewPage(appRoot, id, segs[3]);
      return;
    }
    if (segs[2] === 'tasks' && segs.length === 4 && /^\d+$/.test(segs[3])) {
      renderTaskDetailPage(appRoot, id, segs[3]);
      return;
    }
    if (segs[2] === 'collections' && segs[3] === 'new' && segs.length === 4) {
      const colNewRole = getUserSnapshot()?.roleName;
      if (colNewRole !== 'Админ' && colNewRole !== 'Менеджер') {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderCollectionNewPage(appRoot, id);
      return;
    }
    if (
      segs[2] === 'collections'
      && segs.length === 5
      && /^\d+$/.test(segs[3])
      && segs[4] === 'edit'
    ) {
      const colEditRole = getUserSnapshot()?.roleName;
      if (colEditRole !== 'Админ' && colEditRole !== 'Менеджер') {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderCollectionEditPage(appRoot, id, segs[3]);
      return;
    }
    if (segs[2] === 'collections' && segs.length === 4 && /^\d+$/.test(segs[3])) {
      renderCollectionDetailPage(appRoot, id, segs[3]);
      return;
    }
    if (segs[2] === 'media' && segs[3] === 'new' && segs.length === 4) {
      const mediaNewRole = getUserSnapshot()?.roleName;
      if (
        mediaNewRole !== 'Админ'
        && mediaNewRole !== 'Менеджер'
        && mediaNewRole !== 'Внешний подрядчик'
      ) {
        history.replaceState(null, '', '#/home');
        renderHomePage(appRoot);
        return;
      }
      renderMediaNewPage(appRoot, id, searchParams);
      return;
    }

    if (segs.length === 2) {
      renderProjectDetailPage(appRoot, id);
      return;
    }

    appRoot.innerHTML = '<main class="page"><p class="message message_error">Страница не найдена.</p></main>';
    return;
  }

  if (normalized === 'home') {
    renderHomePage(appRoot);
    return;
  }

  if (segs[0] === 'tasks' && segs.length === 1) {
    const roleName = getUserSnapshot()?.roleName;
    if (roleName === 'Клиент' || roleName === 'Внешний подрядчик') {
      history.replaceState(null, '', '#/home');
      renderHomePage(appRoot);
      return;
    }
    renderTasksListPage(appRoot, searchParams);
    return;
  }

  if (segs[0] === 'collections' && segs.length === 1) {
    const roleName = getUserSnapshot()?.roleName;
    if (roleName === 'Клиент' || roleName === 'Внешний подрядчик') {
      history.replaceState(null, '', '#/home');
      renderHomePage(appRoot);
      return;
    }
    renderCollectionsListPage(appRoot, searchParams);
    return;
  }

  if (segs[0] === 'media' && segs.length === 2 && /^\d+$/.test(segs[1])) {
    const roleName = getUserSnapshot()?.roleName;
    if (roleName === 'Клиент') {
      history.replaceState(null, '', '#/home');
      renderHomePage(appRoot);
      return;
    }
    renderMediaDetailPage(appRoot, segs[1]);
    return;
  }

  if (segs[0] === 'media' && segs.length === 1) {
    const roleName = getUserSnapshot()?.roleName;
    if (roleName === 'Клиент' || roleName === 'Внешний подрядчик') {
      history.replaceState(null, '', '#/home');
      renderHomePage(appRoot);
      return;
    }
    renderMediaListPage(appRoot, searchParams);
    return;
  }

  appRoot.innerHTML = '<main class="page"><p class="message message_error">Страница не найдена.</p></main>';
}

window.addEventListener('hashchange', route);
route();
