import { fetchCollectionById, updateCollection } from '../api/collections.js';
import {
  attachClearError,
  clearFieldErrors,
  el,
  setFieldErrors,
} from './projectFormShared.js';

/**
 * @param {HTMLElement} container
 * @param {string} projectId
 * @param {string} collectionId
 */
export async function renderCollectionEditPage(container, projectId, collectionId) {
  container.innerHTML = '';

  const main = el('main', { className: 'page register-page project-new-page collection-edit-page' });
  const card = el('div', { className: 'register-card' });

  const title = el('h1', { className: 'register-title', textContent: 'Редактирование коллекции' });
  const backBtn = el(
    'button',
    {
      type: 'button',
      className: 'button button-ghost button-icon',
      'aria-label': 'Назад к коллекции',
      title: 'Назад к коллекции',
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
    location.hash = `#/project/${projectId}/collections/${collectionId}`;
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

  let payload;
  try {
    payload = await fetchCollectionById(collectionId);
  } catch (err) {
    loading.remove();
    showMessage(err instanceof Error ? err.message : 'Не удалось загрузить коллекцию.', true);
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

  const collection = payload.collection ?? {};
  if (collection.projectId != null && Number(collection.projectId) !== Number(projectId)) {
    loading.remove();
    showMessage('Эта коллекция относится к другому проекту.', true);
    card.append(el(
      'a',
      {
        className: 'button primary',
        href: `#/project/${encodeURIComponent(String(collection.projectId))}/collections/${encodeURIComponent(String(collectionId))}/edit`,
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
    value: collection.name ?? '',
  });
  const descInput = el('textarea', {
    id: 'collection-desc',
    name: 'description',
    rows: 4,
  });
  descInput.value = collection.description ?? '';

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

  attachClearError(nameField, [nameInput]);
  attachClearError(descField, [descInput]);

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
    { className: 'register-form' },
    nameField,
    descField,
    saveBtn,
  );

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    clearFieldErrors([nameField, descField]);
    showMessage('', false);
    saveBtn.disabled = true;
    try {
      await updateCollection(collectionId, {
        name: nameInput.value,
        description: descInput.value,
      });
      location.hash = `#/project/${projectId}/collections/${collectionId}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось сохранить коллекцию.';
      showMessage(msg, true);
      if (msg.includes('название')) {
        setFieldErrors([nameField]);
      }
      saveBtn.disabled = false;
    }
  });

  card.append(form);
}
