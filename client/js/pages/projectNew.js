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

export function renderProjectNewPage(container) {
  container.innerHTML = '';
  const main = el('main', { className: 'page page--wide stub-page' });
  const card = el('div', { className: 'register-card' });
  card.append(
    el('h1', { className: 'register-title', textContent: 'Новый проект' }),
    el('p', { className: 'register-muted', textContent: 'Создание проекта будет доступно в следующей версии.' }),
    el('a', { className: 'button primary', href: '#/home', textContent: 'К проектам' }),
  );
  main.append(card);
  container.append(main);
}
