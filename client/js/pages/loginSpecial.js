import { login as loginApi } from '../api/auth.js';
import { setSession } from '../auth/session.js';

const DEMO_ACCOUNTS = [
  { role: 'Администратор', email: 'admin@admin.com', password: 'X9*q!VY-xqy972P' },
  { role: 'Внешний подрядчик', email: 'andrey@sokolov.ru', password: 'RWKa7h@TEADp!R6' },
  { role: 'Менеджер', email: 'anna@ya.ru', password: 'N5#kc@!ZNxw4W36' },
  { role: 'Исполнитель', email: 'axle@ax.us', password: 'iVEFgw!!rge2b4$' },
  { role: 'Клиент', email: 'coffehouse@ch.ch', password: 'ra!2528_-mkVHj.' },
  { role: 'Исполнитель', email: 'diana@protonmail.com', password: 'gwkrwA7W#n!cYy3' },
  { role: 'Клиент', email: 'green.coast@gc.com', password: '#c-HntivX87@pdb' },
  { role: 'Исполнитель', email: 'lilith@li.hk', password: 'FG$WuQ-tx9CfPzU' },
  { role: 'Исполнитель', email: 'ser.gamer@gmail.com', password: 'bseTCp#Q-7C-fri' },
];

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

function renderDemoAccountsSection(emailInput, passwordInput) {
  const section = el('section', { className: 'login-special-accounts', 'aria-labelledby': 'login-special-accounts-title' });
  section.append(
    el('h2', { id: 'login-special-accounts-title', className: 'login-special-accounts__title', textContent: 'Демо-аккаунты' }),
    el('p', { className: 'register-muted login-special-accounts__hint', textContent: 'Только для демонстрации. Нажмите «Подставить», чтобы заполнить форму.' }),
  );

  const list = el('ul', { className: 'login-special-accounts__list' });

  DEMO_ACCOUNTS.forEach((account) => {
    const item = el('li', { className: 'login-special-accounts__item' });
    const meta = el('div', { className: 'login-special-accounts__meta' });
    meta.append(
      el('span', { className: 'login-special-accounts__role', textContent: account.role }),
      el('span', { className: 'login-special-accounts__email', textContent: account.email }),
      el('code', { className: 'login-special-accounts__password', textContent: account.password }),
    );
    const fillBtn = el('button', {
      type: 'button',
      className: 'button login-special-accounts__fill',
      textContent: 'Подставить',
    });
    fillBtn.addEventListener('click', () => {
      emailInput.value = account.email;
      passwordInput.value = account.password;
      emailInput.focus();
    });
    item.append(meta, fillBtn);
    list.append(item);
  });

  section.append(list);
  return section;
}

export function renderLoginSpecialPage(container) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page login-special-page' });
  const card = el('div', { className: 'register-card login-special-card' });
  const header = el('div', { className: 'register-card__header' });
  header.append(
    el('h1', { className: 'register-title', textContent: 'Вход (демо)' }),
    el('a', { href: '#/login', className: 'button', textContent: 'Обычный вход' }),
  );

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

  const emailInput = el('input', {
    id: 'login-special-email',
    name: 'email',
    type: 'email',
    autocomplete: 'email',
    required: true,
  });
  const passwordInput = el('input', {
    id: 'login-special-password',
    name: 'password',
    type: 'password',
    autocomplete: 'current-password',
    required: true,
  });

  const form = el(
    'form',
    { className: 'register-form', novalidate: true },
    el(
      'div',
      { className: 'field' },
      el('label', { htmlFor: 'login-special-email', textContent: 'Email' }),
      emailInput,
    ),
    el(
      'div',
      { className: 'field' },
      el('label', { htmlFor: 'login-special-password', textContent: 'Пароль' }),
      passwordInput,
    ),
    el('button', { type: 'submit', className: 'button primary', textContent: 'Войти' }),
  );

  const footer = el(
    'p',
    { className: 'register-footer' },
    'Нет аккаунта? ',
    el('a', { href: '#/register', textContent: 'Зарегистрироваться' }),
  );

  card.append(header, statusMsg, form, renderDemoAccountsSection(emailInput, passwordInput), footer);
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
