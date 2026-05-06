import { isLoggedIn } from './auth/session.js';
import { renderHomePage } from './pages/home.js';
import { renderLoginPage } from './pages/login.js';
import { renderRegisterPage } from './pages/register.js';

const appRoot = document.getElementById('app');

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const normalized = raw || 'login';

  if (!raw) {
    history.replaceState(null, '', '#/login');
  }

  if (normalized === 'home' && !isLoggedIn()) {
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
  if (normalized === 'home') {
    renderHomePage(appRoot);
    return;
  }

  appRoot.innerHTML = '<main class="page"><p class="message message_error">Страница не найдена.</p></main>';
}

window.addEventListener('hashchange', route);
route();
