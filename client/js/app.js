import { isLoggedIn, getUserSnapshot } from './auth/session.js';
import { renderHomePage } from './pages/home.js';
import { renderLoginPage } from './pages/login.js';
import { renderRegisterPage } from './pages/register.js';
import { renderAdminPage } from './pages/admin.js';
import { renderProjectNewPage } from './pages/projectNew.js';
import { renderProjectDetailPage } from './pages/projectDetail.js';
import { renderProjectFormStub } from './pages/projectFormStub.js';
import { renderTasksListPage } from './pages/tasksList.js';
import { renderCollectionsListPage } from './pages/collectionsList.js';

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
    renderAdminPage(appRoot);
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
      renderProjectFormStub(appRoot, { projectId: id, variant: 'edit' });
      return;
    }
    if (segs[2] === 'tasks' && segs[3] === 'new' && segs.length === 4) {
      renderProjectFormStub(appRoot, { projectId: id, variant: 'tasks-new' });
      return;
    }
    if (segs[2] === 'collections' && segs[3] === 'new' && segs.length === 4) {
      renderProjectFormStub(appRoot, { projectId: id, variant: 'collections-new' });
      return;
    }
    if (segs[2] === 'media' && segs[3] === 'new' && segs.length === 4) {
      renderProjectFormStub(appRoot, { projectId: id, variant: 'media-new' });
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
    renderTasksListPage(appRoot, searchParams);
    return;
  }

  if (segs[0] === 'collections' && segs.length === 1) {
    renderCollectionsListPage(appRoot, searchParams);
    return;
  }

  appRoot.innerHTML = '<main class="page"><p class="message message_error">Страница не найдена.</p></main>';
}

window.addEventListener('hashchange', route);
route();
