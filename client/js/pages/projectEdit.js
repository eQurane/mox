import {
  fetchProjectById,
  fetchProjectCreateOptions,
  updateProject,
} from '../api/projects.js';
import { getUserSnapshot } from '../auth/session.js';
import {
  DATE_RE,
  INIT_DATE,
  attachClearError,
  clearFieldErrors,
  el,
  fieldsForApiError,
  setFieldErrors,
  syncDateInputs,
  toDateInputValue,
} from './projectFormShared.js';

export async function renderProjectEditPage(container, projectId) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page project-new-page project-edit-page' });
  const card = el('div', { className: 'register-card' });

  const title = el('h1', { className: 'register-title', textContent: 'Редактирование проекта' });
  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Назад к проекту',
      title: 'Назад к проекту',
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
    location.hash = `#/project/${projectId}`;
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

  let projectPayload;
  let options;
  try {
    [projectPayload, options] = await Promise.all([
      fetchProjectById(projectId),
      fetchProjectCreateOptions(),
    ]);
  } catch (err) {
    loading.remove();
    showMessage(err.message || 'Не удалось загрузить данные.', true);
    return;
  }

  loading.remove();

  const project = projectPayload.project ?? {};
  const statuses = options.statuses ?? [];
  const assignableUsers = options.assignableUsers ?? [];
  const me = getUserSnapshot();
  const memberSet = new Set(project.memberUserIds ?? []);

  const statusSelect = el('select', { id: 'proj-status-edit', name: 'statusId', required: true });
  for (const s of statuses) {
    statusSelect.append(el('option', { value: String(s.id), textContent: s.name }));
  }
  const sid = project.statusId;
  if (sid != null && statuses.some((s) => s.id === sid)) {
    statusSelect.value = String(sid);
  } else {
    const fallback = statuses.find((s) => s.name === 'Запланированный');
    if (fallback) statusSelect.value = String(fallback.id);
    else if (statuses.length) statusSelect.selectedIndex = 0;
  }

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
      const checked = memberSet.has(u.id);
      const row = el(
        'label',
        { className: 'participant-picker__row' },
        el('input', {
          type: 'checkbox',
          name: 'participantIds',
          value: String(u.id),
          ...(checked ? { checked: true } : {}),
        }),
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

  const nameInput = el('input', {
    id: 'proj-name-edit',
    name: 'name',
    type: 'text',
    autocomplete: 'off',
    required: true,
    value: project.name ?? '',
  });
  const goalInput = el('textarea', {
    id: 'proj-goal-edit',
    name: 'goal',
    rows: '5',
    autocomplete: 'off',
    required: true,
  });
  goalInput.value = project.goal ?? '';

  const startVal = toDateInputValue(project.startDate);
  const endVal = toDateInputValue(project.endDate);
  const startInput = el('input', {
    id: 'proj-start-edit',
    name: 'startDate',
    type: 'date',
    required: true,
    value: startVal,
  });
  const endInput = el('input', {
    id: 'proj-end-edit',
    name: 'endDate',
    type: 'date',
    required: true,
    value: endVal,
  });

  const wrapName = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-name-edit', textContent: 'Название' }),
    nameInput,
  );
  const wrapGoal = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-goal-edit', textContent: 'Цель' }),
    goalInput,
  );
  const wrapStart = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-start-edit', textContent: 'Дата начала' }),
    startInput,
  );
  const wrapEnd = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-end-edit', textContent: 'Дата окончания' }),
    endInput,
  );
  const wrapStatus = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'proj-status-edit', textContent: 'Статус проекта' }),
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

  const saveBtn = el(
    'button',
    { type: 'submit', className: 'button primary button--label-icon' },
    el('img', {
      className: 'header-toolbar__icon',
      src: '/icons/save-24.svg',
      alt: '',
      width: 24,
      height: 24,
      decoding: 'async',
    }),
    el('span', { textContent: 'Сохранить' }),
  );

  const form = el(
    'form',
    { className: 'register-form', novalidate: true },
    wrapName,
    wrapGoal,
    wrapStatus,
    wrapStart,
    wrapEnd,
    wrapParticipants,
    saveBtn,
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

    saveBtn.disabled = true;

    try {
      await updateProject(projectId, {
        name,
        goal,
        startDate,
        endDate,
        statusId: statusIdVal,
        participantIds,
      });
      location.hash = `#/project/${projectId}`;
    } catch (err) {
      const msg = err.message || 'Не удалось сохранить проект.';
      showMessage(msg, true);
      const mapped = fieldsForApiError(msg, {
        nameOk: Boolean(name),
        goalOk: Boolean(goal),
      });
      mapped.forEach((k) => fieldByKey[k]?.classList.add('field--error'));
      focusFirstInvalidKey(mapped);
    } finally {
      saveBtn.disabled = false;
    }
  });
}
