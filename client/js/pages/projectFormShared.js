export function el(tag, attrs = {}, ...children) {
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

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Согласовано с серверным `routes/projects.js` (`initDateFloor`). */
export const INIT_DATE = '2026-05-01';

export function addCalendarDaysIso(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d);
  const shifted = new Date(utc + deltaDays * 86400000);
  return shifted.toISOString().slice(0, 10);
}

export function syncDateInputs(startInput, endInput) {
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

export function clearFieldErrors(wrappers) {
  wrappers.forEach((w) => w.classList.remove('field--error'));
}

export function setFieldErrors(wrappers) {
  wrappers.forEach((w) => w.classList.add('field--error'));
}

export function attachClearError(wrapper, controls) {
  const clear = () => wrapper.classList.remove('field--error');
  controls.forEach((c) => {
    c.addEventListener('input', clear);
    c.addEventListener('change', clear);
  });
}

export function fieldsForApiError(message, { nameOk, goalOk }) {
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

/** Значение даты из API (`Date`, ISO-строка и т.д.) в `YYYY-MM-DD` для input[type=date]. */
export function toDateInputValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && DATE_RE.test(value.trim())) return value.trim();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** Границы для input[type=datetime-local] — локальное начало/конец календарного дня. */
export function toDatetimeLocalMin(value) {
  const d = toDateInputValue(value);
  return d ? `${d}T00:00` : '';
}

export function toDatetimeLocalMax(value) {
  const d = toDateInputValue(value);
  return d ? `${d}T23:59` : '';
}
