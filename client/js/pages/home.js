import { fetchMe } from '../api/auth.js';
import { clearSession, getToken, setSession } from '../auth/session.js';

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

export async function renderHomePage(container) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page' });
  const card = el('div', { className: 'register-card' });
  card.append(el('p', { className: 'register-muted', textContent: 'Загрузка…' }));
  main.append(card);
  container.append(main);

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

  container.innerHTML = '';
  const main2 = el('main', { className: 'page register-page' });
  const card2 = el('div', { className: 'register-card' });
  const title = el('h1', { className: 'register-title', textContent: 'Вы в системе' });
  const subtitle = el('p', { className: 'register-muted', textContent: `${user.name} · ${user.email}` });
  const logoutBtn = el('button', { type: 'button', className: 'button primary', textContent: 'Выйти' });

  logoutBtn.addEventListener('click', () => {
    clearSession();
    location.hash = '#/login';
  });

  card2.append(title, subtitle, logoutBtn);
  main2.append(card2);
  container.append(main2);
}
