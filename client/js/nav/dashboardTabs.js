/** @param {'home' | 'tasks'} active */
export function appendDashboardSectionTabs(nav, { active, isAdmin }) {
  nav.append(
    elTab('Проекты', '#/home', active === 'home'),
    elTab('ТЗ', '#/tasks', active === 'tasks'),
    elTab('Коллекции', '#/collections', active === 'collections'),
    elTab('Медиа', '#/media', active === 'media'),
  );
  if (isAdmin) {
    nav.append(elTab('Администрирование', '#/admin', active === 'admin'));
  }
}

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

function elTab(label, href, isCurrent) {
  return el('a', {
    className: `app-header__tab${isCurrent ? ' app-header__tab--current' : ''}`,
    href,
    textContent: label,
    'aria-current': isCurrent ? 'page' : undefined,
  });
}
