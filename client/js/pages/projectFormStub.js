const ICON_STUB = '/icons/not-found-24.svg';

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
    if (key === 'htmlFor') {
      node.htmlFor = value;
      return;
    }
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

const COPY = {
  'tasks-new': {
    title: 'Новое техническое задание',
    lead: 'Форма появится в следующей версии.',
  },
  'collections-new': {
    title: 'Новая коллекция',
    lead: 'Форма появится в следующей версии.',
  },
  'media-new': {
    title: 'Добавление мультимедиа',
    lead: 'Форма появится в следующей версии.',
  },
  'task-detail': {
    title: 'Техническое задание',
    lead: 'Карточка ТЗ будет доступна позже.',
  },
};

/**
 * Заглушка будущих форм (ТЗ, коллекции, медиа).
 * @param {HTMLElement} container
 * @param {{ projectId: string, variant: keyof COPY }} options
 */
export function renderProjectFormStub(container, options) {
  const { projectId, variant } = options;
  const copy = COPY[variant] ?? {
    title: 'Раздел в разработке',
    lead: 'Форма появится в следующей версии.',
  };

  container.innerHTML = '';
  const main = el('main', { className: 'page register-page project-stub-page' });
  const card = el('div', { className: 'register-card project-stub-card' });

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

  const header = el('div', { className: 'register-card__header' },
    el('h1', { className: 'register-title', textContent: copy.title }),
    backBtn,
  );

  const figure = el('div', { className: 'project-stub-card__figure' },
    el('img', {
      className: 'project-stub-card__not-found-icon',
      src: ICON_STUB,
      alt: '',
      width: 96,
      height: 96,
      decoding: 'async',
    }),
  );

  card.append(
    header,
    figure,
    el('p', { className: 'register-muted project-stub-card__lead', textContent: copy.lead }),
    el(
      'a',
      {
        className: 'button primary',
        href: `#/project/${projectId}`,
        textContent: 'К проекту',
      },
    ),
  );
  main.append(card);
  container.append(main);
}
