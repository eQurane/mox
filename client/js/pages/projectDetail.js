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

export function renderProjectDetailPage(container, projectId) {
  container.innerHTML = '';
  const main = el('main', { className: 'page page--wide stub-page' });
  const card = el('div', { className: 'register-card' });
  card.append(
    el('p', { className: 'register-muted', textContent: `Проект №${projectId}` }),
    el('h1', { className: 'register-title', textContent: 'Раздел в разработке' }),
    el('p', { className: 'register-muted', textContent: 'Карточка проекта, задачи и медиа появятся здесь позже.' }),
    el('a', { className: 'button primary', href: '#/home', textContent: 'К проектам' }),
  );
  main.append(card);
  container.append(main);
}
