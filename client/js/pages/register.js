import { fetchRegisterOptions, register as registerApi } from '../api/auth.js';

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

export async function renderRegisterPage(container) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page' });
  const card = el('div', { className: 'register-card' });
  const title = el('h1', { className: 'register-title', textContent: 'Регистрация' });
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

  main.append(card);
  card.append(title);

  const loading = el('p', { className: 'register-muted', textContent: 'Загрузка…' });
  card.append(loading);

  let rolesData;
  try {
    rolesData = await fetchRegisterOptions();
  } catch (err) {
    loading.remove();
    card.append(statusMsg);
    showMessage(err.message || 'Не удалось загрузить данные.', true);
    container.append(main);
    return;
  }

  loading.remove();
  card.append(statusMsg);

  const roleSelect = el('select', { id: 'reg-role', name: 'roleId', required: true });
  for (const role of rolesData.roles ?? []) {
    roleSelect.append(el('option', { value: String(role.id), textContent: role.name }));
  }

  const form = el(
    'form',
    { className: 'register-form', novalidate: true },
    el('div', { className: 'field' }, el('label', { htmlFor: 'reg-name', textContent: 'Имя' }), el('input', { id: 'reg-name', name: 'name', type: 'text', autocomplete: 'name', required: true })),
    el('div', { className: 'field' }, el('label', { htmlFor: 'reg-email', textContent: 'Email' }), el('input', { id: 'reg-email', name: 'email', type: 'email', autocomplete: 'email', required: true })),
    el('div', { className: 'field' }, el('label', { htmlFor: 'reg-role', textContent: 'Роль' }), roleSelect),
    el('div', { className: 'field' }, el('label', { htmlFor: 'reg-password', textContent: 'Пароль' }), el('input', { id: 'reg-password', name: 'password', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })),
    el('div', { className: 'field' }, el('label', { htmlFor: 'reg-password2', textContent: 'Повторите пароль' }), el('input', { id: 'reg-password2', name: 'password2', type: 'password', autocomplete: 'new-password', minlength: '8', required: true })),
    el('button', { type: 'submit', className: 'button primary', textContent: 'Зарегистрироваться' }),
  );

  const footer = el('p', { className: 'register-footer' }, 'Уже есть аккаунт? ', el('a', { href: '#/login', textContent: 'Войти' }));

  card.append(form, footer);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    showMessage('', false);

    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const password2 = form.elements.password2.value;
    const roleId = Number(roleSelect.value);

    if (!name) return showMessage('Введите имя.', true);
    if (!email) return showMessage('Введите email.', true);
    if (!password || password.length < 8) return showMessage('Пароль не короче 8 символов.', true);
    if (password !== password2) return showMessage('Пароли не совпадают.', true);
    if (!Number.isInteger(roleId)) return showMessage('Выберите роль.', true);

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const user = await registerApi({ name, email, password, roleId });
      showMessage(
        `Регистрация успешна (id ${user.id}). Учётная запись: ${user.email}.`,
        false,
      );
      form.reset();
    } catch (err) {
      showMessage(err.message || 'Ошибка регистрации.', true);
    } finally {
      submitBtn.disabled = false;
    }
  });

  container.append(main);
}
