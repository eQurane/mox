import { fetchProjectById } from '../api/projects.js';
import { fetchTaskById, fetchTasks } from '../api/tasks.js';
import { createCollection } from '../api/collections.js';
import { getUserSnapshot } from '../auth/session.js';
import {
  attachClearError,
  clearFieldErrors,
  el,
  setFieldErrors,
} from './projectFormShared.js';

/**
 * @param {HTMLElement} container
 * @param {string} projectId
 * @param {string} [taskId] если из диплинка с экрана ТЗ
 */
export async function renderCollectionNewPage(container, projectId, taskId) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page project-new-page' });
  const card = el('div', { className: 'register-card' });

  const title = el('h1', { className: 'register-title', textContent: 'Новая коллекция' });
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
    if (taskId) {
      location.hash = `#/project/${projectId}/tasks/${taskId}`;
    } else {
      location.hash = `#/project/${projectId}`;
    }
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

  const fixedTaskId = taskId != null && taskId !== '' ? String(taskId) : null;

  if (fixedTaskId) {
    let taskPayload;
    try {
      taskPayload = await fetchTaskById(fixedTaskId);
    } catch (err) {
      loading.remove();
      if (err instanceof Error) {
        showMessage(err.message, true);
      }
      card.append(el(
        'a',
        {
          className: 'button button-ghost',
          href: `#/project/${projectId}`,
          textContent: 'К проекту',
        },
      ));
      return;
    }

    const task = taskPayload.task ?? {};
    if (task.projectId != null && Number(task.projectId) !== Number(projectId)) {
      loading.remove();
      showMessage('Это техническое задание относится к другому проекту.', true);
      card.append(el(
        'a',
        {
          className: 'button primary',
          href: `#/project/${encodeURIComponent(String(task.projectId))}/tasks/${encodeURIComponent(String(fixedTaskId))}/collections/new`,
          textContent: 'Открыть в правильном проекте',
        },
      ));
      return;
    }

    loading.remove();

    const nameInput = el('input', {
      id: 'collection-name',
      name: 'name',
      type: 'text',
      autocomplete: 'off',
      required: true,
    });
    const descInput = el('textarea', {
      id: 'collection-desc',
      name: 'description',
      rows: 4,
    });

    const nameField = el('div', { className: 'field' },
      el('label', { className: 'field__label', htmlFor: 'collection-name', textContent: 'Название' }),
      nameInput,
      el('p', { className: 'field__hint field__hint--error', hidden: true }),
    );
    const descField = el('div', { className: 'field' },
      el('label', { className: 'field__label', htmlFor: 'collection-desc', textContent: 'Описание' }),
      descInput,
      el('p', { className: 'field__hint field__hint--error', hidden: true }),
    );

    const taskNote = el('p', {
      className: 'register-muted',
      textContent: `Техническое задание: ${task.name ?? '—'}`,
    });

    attachClearError(nameField, [nameInput]);
    attachClearError(descField, [descInput]);

    const submitBtn = el('button', {
      type: 'submit',
      className: 'button primary',
      textContent: 'Создать',
    });

    const form = el(
      'form',
      { className: 'register-form' },
      taskNote,
      nameField,
      descField,
      submitBtn,
    );

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      clearFieldErrors([nameField, descField]);
      showMessage('', false);
      submitBtn.disabled = true;
      try {
        const res = await createCollection({
          taskId: Number(fixedTaskId),
          name: nameInput.value,
          description: descInput.value,
        });
        const newId = res.collection?.id;
        if (newId == null) throw new Error('Сервер не вернул идентификатор коллекции.');
        location.hash = `#/project/${projectId}/collections/${newId}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Не удалось создать коллекцию.';
        showMessage(msg, true);
        if (msg.includes('название')) {
          setFieldErrors([nameField]);
        }
        submitBtn.disabled = false;
      }
    });

    card.append(form);
    return;
  }

  let tasksPayload;
  try {
    await fetchProjectById(projectId);
    tasksPayload = await fetchTasks({ projectId });
  } catch (err) {
    loading.remove();
    showMessage(err instanceof Error ? err.message : 'Не удалось загрузить данные.', true);
    card.append(el(
      'a',
      { className: 'button button-ghost', href: `#/project/${projectId}`, textContent: 'К проекту' },
    ));
    return;
  }

  const tasks = tasksPayload.tasks ?? [];
  loading.remove();

  if (tasks.length === 0) {
    const isContractor = getUserSnapshot()?.roleName === 'Внешний подрядчик';
    showMessage(
      isContractor
        ? 'Нет доступных технических заданий с типом исполнителя «Внешний подрядчик». Обратитесь к менеджеру проекта.'
        : 'В проекте пока нет технических заданий. Сначала создайте ТЗ.',
      true,
    );
    if (!isContractor) {
      card.append(el(
        'a',
        { className: 'button primary', href: `#/project/${projectId}/tasks/new`, textContent: 'Добавить ТЗ' },
      ));
    } else {
      card.append(el(
        'a',
        { className: 'button button-ghost', href: `#/project/${projectId}`, textContent: 'К проекту' },
      ));
    }
    return;
  }

  const taskSelect = el('select', { id: 'collection-task', name: 'taskId', required: true });
  taskSelect.append(el('option', { value: '', textContent: 'Выберите ТЗ' }));
  for (const t of tasks) {
    taskSelect.append(el('option', { value: String(t.id), textContent: t.name ?? `ТЗ ${t.id}` }));
  }

  const nameInput = el('input', {
    id: 'collection-name',
    name: 'name',
    type: 'text',
    autocomplete: 'off',
    required: true,
  });
  const descInput = el('textarea', {
    id: 'collection-desc',
    name: 'description',
    rows: 4,
  });

  const taskField = el('div', { className: 'field' },
    el('label', { className: 'field__label', htmlFor: 'collection-task', textContent: 'Техническое задание' }),
    taskSelect,
    el('p', { className: 'field__hint field__hint--error', hidden: true }),
  );
  const nameField = el('div', { className: 'field' },
    el('label', { className: 'field__label', htmlFor: 'collection-name', textContent: 'Название' }),
    nameInput,
    el('p', { className: 'field__hint field__hint--error', hidden: true }),
  );
  const descField = el('div', { className: 'field' },
    el('label', { className: 'field__label', htmlFor: 'collection-desc', textContent: 'Описание' }),
    descInput,
    el('p', { className: 'field__hint field__hint--error', hidden: true }),
  );

  attachClearError(taskField, [taskSelect]);
  attachClearError(nameField, [nameInput]);
  attachClearError(descField, [descInput]);

  const submitBtn = el('button', {
    type: 'submit',
    className: 'button primary',
    textContent: 'Создать',
  });

  const form = el(
    'form',
    { className: 'register-form' },
    taskField,
    nameField,
    descField,
    submitBtn,
  );

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearFieldErrors([taskField, nameField, descField]);
    showMessage('', false);
    const tid = Number(taskSelect.value);
    if (!Number.isInteger(tid) || tid < 1) {
      setFieldErrors([taskField]);
      return;
    }
    submitBtn.disabled = true;
    try {
      const res = await createCollection({
        taskId: tid,
        name: nameInput.value,
        description: descInput.value,
      });
      const newId = res.collection?.id;
      if (newId == null) throw new Error('Сервер не вернул идентификатор коллекции.');
      location.hash = `#/project/${projectId}/collections/${newId}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось создать коллекцию.';
      showMessage(msg, true);
      if (msg.includes('ТЗ') || msg.includes('техническое задание')) {
        setFieldErrors([taskField]);
      } else if (msg.includes('название')) {
        setFieldErrors([nameField]);
      }
      submitBtn.disabled = false;
    }
  });

  card.append(form);
}
