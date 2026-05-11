import { getToken } from '../auth/session.js';

const apiBase = '/api';

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Возвращает { notifications: [...] }. Для не-Менеджеров/Админов возвращает пустой список без ошибки. */
export async function fetchNotifications() {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const res = await fetch(`${apiBase}/notifications`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    if (res.status === 403) return { notifications: [] };
    throw new Error(data.error || 'Не удалось загрузить уведомления.');
  }
  return data;
}
