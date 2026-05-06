import { login as loginApi } from '../api/auth.js';
import { setSession } from '../auth/session.js';

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

export function renderLoginPage(container) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page' });
  const card = el('div', { className: 'register-card' });
  const title = el('h1', { className: 'register-title', textContent: 'Вход' });
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

  card.append(title, statusMsg);

  const form = el(
    'form',
    { className: 'register-form', novalidate: true },
    el(
      'div',
      { className: 'field' },
      el('label', { htmlFor: 'login-email', textContent: 'Email' }),
      el('input', { id: 'login-email', name: 'email', type: 'email', autocomplete: 'email', required: true }),
    ),
    el(
      'div',
      { className: 'field' },
      el('label', { htmlFor: 'login-password', textContent: 'Пароль' }),
      el('input', {
        id: 'login-password',
        name: 'password',
        type: 'password',
        autocomplete: 'current-password',
        required: true,
      }),
    ),
    el('button', { type: 'submit', className: 'button primary', textContent: 'Войти' }),
  );

  const footer = el('p', { className: 'register-footer' }, 'Нет аккаунта? ', el('a', { href: '#/register', textContent: 'Зарегистрироваться' }));

  card.append(form, footer);
  main.append(card);
  container.append(main);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    showMessage('', false);

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;

    if (!email) return showMessage('Введите email.', true);
    if (!password) return showMessage('Введите пароль.', true);

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const result = await loginApi({ email, password });
      setSession(result.token, result.user);
      location.hash = '#/home';
    } catch (err) {
      showMessage(err.message || 'Не удалось войти.', true);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
