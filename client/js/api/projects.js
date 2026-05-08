import { getToken } from '../auth/session.js';

const apiBase = '/api';

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchProjects() {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить проекты.');
  }
  return data;
}
