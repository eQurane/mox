import { isLoggedIn, getUserSnapshot } from './auth/session.js';
import { renderHomePage } from './pages/home.js';
import { renderLoginPage } from './pages/login.js';
import { renderRegisterPage } from './pages/register.js';
import { renderAdminPage } from './pages/admin.js';
import { renderProjectNewPage } from './pages/projectNew.js';
import { renderProjectDetailPage } from './pages/projectDetail.js';

const appRoot = document.getElementById('app');

function segmentsFromNormalized(normalized) {
  return normalized.split('/').filter(Boolean);
}

function isProtectedRoute(normalized) {
  const segs = segmentsFromNormalized(normalized);
  if (segs[0] === 'home') return true;
  if (segs[0] === 'project' && segs[1]) return true;
  if (segs[0] === 'projects' && segs[1] === 'new') return true;
  if (segs[0] === 'admin' && segs.length === 1) return true;
  return false;
}

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const normalized = raw || 'login';

  if (!raw) {
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

  if (segs[0] === 'project' && segs[1]) {
    const id = segs[1];
    if (!/^\d+$/.test(id)) {
      appRoot.innerHTML = '<main class="page"><p class="message message_error">Страница не найдена.</p></main>';
      return;
    }
    renderProjectDetailPage(appRoot, id);
    return;
  }

  if (normalized === 'home') {
    renderHomePage(appRoot);
    return;
  }

  appRoot.innerHTML = '<main class="page"><p class="message message_error">Страница не найдена.</p></main>';
}

window.addEventListener('hashchange', route);
route();
