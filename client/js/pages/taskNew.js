import { fetchProjectById } from '../api/projects.js';
import { createTask, fetchTaskCreateOptions } from '../api/tasks.js';
import {
  attachClearError,
  clearFieldErrors,
  el,
  setFieldErrors,
  toDatetimeLocalMax,
  toDatetimeLocalMin,
  toDateInputValue,
} from './projectFormShared.js';
import { fieldsForTaskApiError } from './taskFormShared.js';

/**
 * @param {HTMLElement} container
 * @param {string} projectId
 */
export async function renderTaskNewPage(container, projectId) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page project-new-page' });
  const card = el('div', { className: 'register-card' });

  const title = el('h1', { className: 'register-title', textContent: 'Новое задание' });
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

  let project;
  let options;
  try {
    [project, options] = await Promise.all([fetchProjectById(projectId), fetchTaskCreateOptions()]);
  } catch (err) {
    loading.remove();
    showMessage(err.message || 'Не удалось загрузить данные.', true);
    const back = el(
      'a',
      { className: 'button button-ghost', href: `#/project/${projectId}`, textContent: 'К проекту' },
    );
    card.append(back);
    return;
  }

  const projectData = project.project ?? project;
  const startIso = toDateInputValue(projectData.startDate);
  const endIso = toDateInputValue(projectData.endDate);
  const deadlineMin = toDatetimeLocalMin(projectData.startDate);
  const deadlineMax = toDatetimeLocalMax(projectData.endDate);

  loading.remove();

  const statuses = options.statuses ?? [];
  const taskRoles = options.taskRoles ?? [];

  const nameInput = el('input', { id: 'task-name', name: 'name', type: 'text', autocomplete: 'off', required: true });
  const descInput = el('textarea', {
    id: 'task-desc',
    name: 'description',
    rows: '5',
    autocomplete: 'off',
  });
  const deadlineInput = el('input', {
    id: 'task-deadline',
    name: 'deadline',
    type: 'datetime-local',
    required: true,
  });
  if (deadlineMin) deadlineInput.min = deadlineMin;
  if (deadlineMax) deadlineInput.max = deadlineMax;

  const roleSelect = el('select', { id: 'task-role', name: 'roleId', required: true });
  for (const r of taskRoles) {
    roleSelect.append(el('option', { value: String(r.id), textContent: r.name }));
  }
  if (taskRoles.length) roleSelect.selectedIndex = 0;

  const statusSelect = el('select', { id: 'task-status', name: 'statusId', required: true });
  for (const s of statuses) {
    statusSelect.append(el('option', { value: String(s.id), textContent: s.name }));
  }
  const defaultStatus = statuses.find((s) => s.name === 'К выполнению');
  if (defaultStatus) statusSelect.value = String(defaultStatus.id);
  else if (statuses.length) statusSelect.selectedIndex = 0;

  const wrapName = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'task-name', textContent: 'Название' }),
    nameInput,
  );
  const wrapDesc = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'task-desc', textContent: 'Описание' }),
    descInput,
  );
  const wrapDeadline = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'task-deadline', textContent: 'Дедлайн (дата и время)' }),
    el('p', {
      className: 'register-muted',
      textContent: `В пределах сроков проекта, местное время: ${startIso} 00:00 — ${endIso} 23:59`,
    }),
    deadlineInput,
  );
  const wrapRole = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'task-role', textContent: 'Роль исполнителя задания' }),
    roleSelect,
  );
  const wrapStatus = el(
    'div',
    { className: 'field' },
    el('label', { htmlFor: 'task-status', textContent: 'Статус' }),
    statusSelect,
  );

  const fieldByKey = {
    name: wrapName,
    deadline: wrapDeadline,
    statusId: wrapStatus,
    roleId: wrapRole,
  };
  const allWrappers = [wrapName, wrapDesc, wrapDeadline, wrapRole, wrapStatus];

  const focusFirstInvalidKey = (keys) => {
    const ord = ['name', 'deadline', 'roleId', 'statusId'];
    const wanted = new Set(keys);
    for (const k of ord) {
      if (!wanted.has(k)) continue;
      if (k === 'name') nameInput.focus();
      else if (k === 'deadline') deadlineInput.focus();
      else if (k === 'roleId') roleSelect.focus();
      else if (k === 'statusId') statusSelect.focus();
      return;
    }
  };

  attachClearError(wrapName, [nameInput]);
  attachClearError(wrapDesc, [descInput]);
  attachClearError(wrapDeadline, [deadlineInput]);
  attachClearError(wrapRole, [roleSelect]);
  attachClearError(wrapStatus, [statusSelect]);

  const form = el(
    'form',
    { className: 'register-form', novalidate: true },
    wrapName,
    wrapDesc,
    wrapDeadline,
    wrapRole,
    wrapStatus,
    el('button', { type: 'submit', className: 'button primary', textContent: 'Создать задание' }),
  );

  card.append(form);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearFieldErrors(allWrappers);
    showMessage('', false);

    const name = nameInput.value.trim();
    const description = descInput.value;
    const deadlineLocal = deadlineInput.value;
    const roleIdVal = Number(roleSelect.value);
    const statusIdVal = Number(statusSelect.value);

    const invalid = [];
    if (!name) invalid.push('name');
    let deadlineBad = false;
    let deadlineRangeBad = false;

    let deadlineInstant;
    if (!deadlineLocal) {
      invalid.push('deadline');
    } else {
      deadlineInstant = new Date(deadlineLocal);
      if (Number.isNaN(deadlineInstant.getTime())) {
        deadlineBad = true;
        invalid.push('deadline');
      } else if (startIso && endIso) {
        const minT = new Date(`${startIso}T00:00:00`);
        const maxT = new Date(`${endIso}T23:59:59.999`);
        if (deadlineInstant < minT || deadlineInstant > maxT) {
          deadlineRangeBad = true;
          invalid.push('deadline');
        }
      }
    }

    if (!Number.isInteger(roleIdVal) || roleIdVal < 1 || !taskRoles.some((r) => r.id === roleIdVal)) {
      invalid.push('roleId');
    }
    if (!Number.isInteger(statusIdVal) || statusIdVal < 1 || !statuses.some((s) => s.id === statusIdVal)) {
      invalid.push('statusId');
    }

    if (invalid.length) {
      setFieldErrors([...new Set(invalid)].map((k) => fieldByKey[k]).filter(Boolean));
      let alertText = 'Проверьте поля формы.';
      if (!name) alertText = 'Введите название задания.';
      else if (!deadlineLocal) alertText = 'Укажите дедлайн.';
      else if (deadlineBad) alertText = 'Укажите корректные дату и время дедлайна.';
      else if (deadlineRangeBad) {
        alertText = 'Дедлайн должен быть в пределах дат начала и окончания проекта.';
      } else if (invalid.includes('roleId')) alertText = 'Выберите роль исполнителя задания.';
      else if (invalid.includes('statusId')) alertText = 'Выберите статус.';
      showMessage(alertText, true);
      focusFirstInvalidKey([...new Set(invalid)]);
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const numericProjectId = Number(projectId);
    try {
      await createTask({
        projectId: numericProjectId,
        name,
        description,
        deadline: deadlineInstant.toISOString(),
        roleId: roleIdVal,
        statusId: statusIdVal,
      });
      location.hash = `#/project/${projectId}`;
    } catch (err) {
      const msg = err.message || 'Не удалось создать задание.';
      showMessage(msg, true);
      const mapped = fieldsForTaskApiError(msg);
      mapped.forEach((k) => fieldByKey[k]?.classList.add('field--error'));
      focusFirstInvalidKey(mapped);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
