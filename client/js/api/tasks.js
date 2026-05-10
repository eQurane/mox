import { getToken } from '../auth/session.js';

const apiBase = '/api';

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, string | number | undefined | null>} filters
 */
export async function fetchTasks(filters = {}) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    qs.set(key, String(value));
  }

  const suffix = qs.toString();
  const url = suffix ? `${apiBase}/tasks?${suffix}` : `${apiBase}/tasks`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить задачи.');
  }
  return data;
}

export async function fetchTaskCreateOptions() {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/tasks/create-options`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить параметры формы.');
  }
  return data;
}

/**
 * @param {{ projectId: number, name: string, description: string, deadline: string, roleId: number, statusId: number }} payload
 */
export async function createTask(payload) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось создать техническое задание.');
  }
  return data;
}
