/**
 * Связать текст ошибки API с ключами полей формы ТЗ.
 * @param {string | undefined} message
 * @returns {string[]}
 */
export function fieldsForTaskApiError(message) {
  if (!message) return [];
  const m = message.toLowerCase();
  if (m.includes('название')) return ['name'];
  if (m.includes('дедлайн')) return ['deadline'];
  if (m.includes('статус')) return ['statusId'];
  if (m.includes('роль')) return ['roleId'];
  return [];
}

/** Значение даты/времени из API для `input[type="datetime-local"]`. */
export function toDatetimeLocalInputValue(value) {
  if (value == null || value === '') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${mo}-${day}T${h}:${min}`;
}
