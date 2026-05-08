import { createProject, fetchProjectCreateOptions } from '../api/projects.js';
import { getUserSnapshot } from '../auth/session.js';

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Согласовано с серверным `routes/projects.js` (`initDateFloor`). */
const INIT_DATE = '2026-05-01';

function addCalendarDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const shifted = new Date(utc + deltaDays * 86400000);
  return shifted.toISOString().slice(0, 10);
}

function syncDateInputs(startInput, endInput) {
  const startVal = startInput.value;
  const endVal = endInput.value;

  startInput.min = INIT_DATE;

  const endParsed = DATE_RE.test(endVal) ? endVal : null;
  if (endParsed) {
    const maxStart = addCalendarDaysIso(endParsed, -1);
    if (maxStart >= INIT_DATE) startInput.max = maxStart;
    else startInput.removeAttribute('max');
  } else {
    startInput.removeAttribute('max');
  }

  const startParsed = DATE_RE.test(startVal) ? startVal : null;
  if (startParsed) endInput.min = addCalendarDaysIso(startParsed, 1);
  else endInput.min = addCalendarDaysIso(INIT_DATE, 1);

  if (
    startParsed &&
    endParsed &&
    endParsed <= startParsed
  ) {
    endInput.value = addCalendarDaysIso(startParsed, 1);
  }

  if (
    startParsed &&
    endParsed &&
    startParsed > addCalendarDaysIso(endParsed, -1)
  ) {
    startInput.value = addCalendarDaysIso(endParsed, -1);
  }
}

function clearFieldErrors(wrappers) {
  wrappers.forEach((w) => w.classList.remove('field--error'));
}

function setFieldErrors(wrappers) {
  wrappers.forEach((w) => w.classList.add('field--error'));
}

function attachClearError(wrapper, controls) {
  const clear = () => wrapper.classList.remove('field--error');
  controls.forEach((c) => {
    c.addEventListener('input', clear);
    c.addEventListener('change', clear);
  });
}

function fieldsForApiError(message, { nameOk, goalOk }) {
  if (!message) return [];
  if (message.includes('название и цель')) {
    const out = [];
    if (!nameOk) out.push('name');
    if (!goalOk) out.push('goal');
    return out;
  }
  if (message.includes('формат дат')) return ['startDate', 'endDate'];
  if (message.includes('позже даты начала')) return ['endDate'];
  if (message.includes('Дата начала не может быть раньше')) return ['startDate'];
  if (
    message.includes('Укажите статус') ||
    message.includes('корректный статус')
  ) {
    return ['statusId'];
  }
  if (
    message.includes('идентификатор участника') ||
    message.includes('Список участников должен быть') ||
    message.includes('выбранных пользователей недоступен') ||
    message.includes('пользователя с этой ролью') ||
    message.includes('участника с этой ролью')
  ) {
    return ['participants'];
  }
  return [];
}

export async function renderProjectNewPage(container) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page project-new-page' });
  const card = el('div', { className: 'register-card' });

  const title = el('h1', { className: 'register-title', textContent: 'Новый проект' });
  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Назад к проектам',
      title: 'Назад к проектам',
    },
    el('img', {
      className: 'header-toolbar__icon',
      src: '/icons/back-24.svg',
      alt: '',
      width: 24,
      height: 24,
      decoding: 'async',
    }),
  );
  backBtn.addEventListener('click', () => {
    location.hash = '#/home';
  });

  const header = el('div', { className: 'register-card__header' }, title, backBtn);

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

  const loading = el('p', { className: 'register-muted', textContent: 'Загрузка…' });
  card.append(header, statusMsg, loading);
  main.append(card);
  container.append(main);

  let options;
  try {
    options = await fetchProjectCreateOptions();
  } catch (err) {
    loading.remove();
    showMessage(err.message || 'Не удалось загрузить данные.', true);
    return;
  }

  loading.remove();

  const statuses = options.statuses ?? [];
  const assignableUsers = options.assignableUsers ?? [];
  const me = getUserSnapshot();

  const statusSelect = el('select', { id: 'proj-status', name: 'statusId', required: true });
  for (const s of statuses) {
    statusSelect.append(el('option', { value: String(s.id), textContent: s.name }));
  }

  const defaultStatus = statuses.find((s) => s.name === 'Запланированный');
  if (defaultStatus) statusSelect.value = String(defaultStatus.id);
  else if (statuses.length) statusSelect.selectedIndex = 0;

  const participantListRoot = el('div', { className: 'participant-picker__list' });
  if (assignableUsers.length === 0) {
    participantListRoot.append(
      el('p', {
        className: 'participant-picker__empty',
        textContent:
          'Нет пользователей с подходящей ролью для добавления. Другие участники появятся после регистрации.',
      }),
    );
  } else {
    for (const u of assignableUsers) {
      const row = el(
        'label',
        { className: 'participant-picker__row' },
        el('input', { type: 'checkbox', name: 'participantIds', value: String(u.id) }),
        el(
          'span',
          { className: 'participant-picker__meta' },
          el('span', { className: 'participant-picker__name', textContent: u.name }),
          el('span', { className: 'participant-picker__email', textContent: u.email }),
          el('span', {
            className: 'participant-picker__role',
            textContent: u.roleName,
          }),
        ),
      );
      participantListRoot.append(row);
    }
  }

  const nameInput = el('input', { id: 'proj-name', name: 'name', type: 'text', autocomplete: 'off', required: true });
  const goalInput = el('textarea', {
    id: 'proj-goal',
    name: 'goal',
    rows: '5',
    autocomplete: 'off',
    required: true,
  });
  const startInput = el('input', { id: 'proj-start', name: 'startDate', type: 'date', required: true });
  const endInput = el('input', { id: 'proj-end', name: 'endDate', type: 'date', required: true });

  const wrapName = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-name', textContent: 'Название' }),
    nameInput,
  );
  const wrapGoal = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-goal', textContent: 'Цель' }),
    goalInput,
  );
  const wrapStart = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-start', textContent: 'Дата начала' }),
    startInput,
  );
  const wrapEnd = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-end', textContent: 'Дата окончания' }),
    endInput,
  );
  const wrapStatus = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-status', textContent: 'Статус проекта' }),
    statusSelect,
  );

  const roleHint =
    me?.roleName === 'Админ'
      ? 'Можно отметить исполнителей, клиентов и менеджеров (со статусом «Активный» в системе).'
      : 'Можно отметить исполнителей и клиентов (со статусом «Активный» в системе).';

  const wrapParticipants = el(
    'div',
    { className: 'field' },
    el('span', { className: 'field__legend', textContent: 'Участники' }),
    el('p', { className: 'participant-picker__note', textContent: roleHint }),
    el(
      'div',
      {
        className: 'participant-picker__creator',
        textContent:
          'Вы будете включены в список участников этого проекта автоматически.',
      },
    ),
    participantListRoot,
  );

  const fieldByKey = {
    name: wrapName,
    goal: wrapGoal,
    startDate: wrapStart,
    endDate: wrapEnd,
    statusId: wrapStatus,
    participants: wrapParticipants,
  };
  const allWrappers = [wrapName, wrapGoal, wrapStatus, wrapStart, wrapEnd, wrapParticipants];

  const participantCheckboxes = () => [...participantListRoot.querySelectorAll('input[name="participantIds"]')];

  const focusFirstInvalidKey = (keys) => {
    const ord = ['name', 'goal', 'statusId', 'startDate', 'endDate', 'participants'];
    const wanted = new Set(keys);
    for (const k of ord) {
      if (!wanted.has(k)) continue;
      if (k === 'name') nameInput.focus();
      else if (k === 'goal') goalInput.focus();
      else if (k === 'startDate') startInput.focus();
      else if (k === 'endDate') endInput.focus();
      else if (k === 'statusId') statusSelect.focus();
      else if (k === 'participants') participantCheckboxes()[0]?.focus();
      return;
    }
  };

  attachClearError(wrapName, [nameInput]);
  attachClearError(wrapGoal, [goalInput]);
  attachClearError(wrapStart, [startInput]);
  attachClearError(wrapEnd, [endInput]);
  attachClearError(wrapStatus, [statusSelect]);
  attachClearError(wrapParticipants, participantCheckboxes());

  const form = el(
    'form',
    { className: 'register-form', novalidate: true },
    wrapName,
    wrapGoal,
    wrapStatus,
    wrapStart,
    wrapEnd,
    wrapParticipants,
    el('button', { type: 'submit', className: 'button primary', textContent: 'Создать проект' }),
  );

  card.append(form);

  syncDateInputs(startInput, endInput);
  const onDatesChange = () => syncDateInputs(startInput, endInput);
  startInput.addEventListener('change', onDatesChange);
  startInput.addEventListener('input', onDatesChange);
  endInput.addEventListener('change', onDatesChange);
  endInput.addEventListener('input', onDatesChange);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearFieldErrors(allWrappers);
    showMessage('', false);

    const name = form.elements.name.value.trim();
    const goal = form.elements.goal.value.trim();
    const startDate = form.elements.startDate.value;
    const endDate = form.elements.endDate.value;
    const statusIdVal = Number(statusSelect.value);

    const participantIds = participantCheckboxes()
      .filter((cb) => cb.checked)
      .map((cb) => Number(cb.value));

    const invalid = [];
    if (!name) invalid.push('name');
    if (!goal) invalid.push('goal');

    let dateFormatBad = false;
    let dateOrderBad = false;
    let startBeforeFloor = false;

    if (!startDate || !endDate) {
      if (!startDate) invalid.push('startDate');
      if (!endDate) invalid.push('endDate');
    } else if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      dateFormatBad = true;
      invalid.push('startDate', 'endDate');
    } else {
      if (startDate < INIT_DATE) {
        startBeforeFloor = true;
        invalid.push('startDate');
      }
      if (endDate <= startDate) {
        dateOrderBad = true;
        invalid.push('endDate');
      }
    }

    if (!Number.isInteger(statusIdVal) || statusIdVal < 1 || !statuses.some((s) => s.id === statusIdVal)) {
      invalid.push('statusId');
    }

    if (invalid.length) {
      setFieldErrors([...new Set(invalid)].map((k) => fieldByKey[k]));
      let alertText = 'Проверьте поля формы.';
      if (!name && !goal) alertText = 'Введите название и цель проекта.';
      else if (!name) alertText = 'Введите название проекта.';
      else if (!goal) alertText = 'Введите цель проекта.';
      else if (!startDate || !endDate) alertText = 'Укажите даты начала и окончания.';
      else if (dateFormatBad) alertText = 'Укажите даты в формате календаря.';
      else if (startBeforeFloor) alertText = `Дата начала не может быть раньше ${INIT_DATE}.`;
      else if (dateOrderBad) alertText = 'Дата окончания должна быть позже даты начала.';
      else if (invalid.includes('statusId')) alertText = 'Выберите статус проекта.';

      showMessage(alertText, true);

      focusFirstInvalidKey([...new Set(invalid)]);

      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const { project } = await createProject({
        name,
        goal,
        startDate,
        endDate,
        statusId: statusIdVal,
        participantIds,
      });
      if (project?.id != null) {
        location.hash = `#/project/${project.id}`;
        return;
      }
      showMessage('Проект создан, но не удалось открыть карточку.', true);
    } catch (err) {
      const msg = err.message || 'Не удалось создать проект.';
      showMessage(msg, true);
      const mapped = fieldsForApiError(msg, {
        nameOk: Boolean(name),
        goalOk: Boolean(goal),
      });
      mapped.forEach((k) => fieldByKey[k]?.classList.add('field--error'));
      focusFirstInvalidKey(mapped);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
