import { getToken } from '../auth/session.js';

const apiBase = '/api';

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** @param {string | number} mediaId */
export async function fetchComments(mediaId) {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const res = await fetch(`${apiBase}/media/${encodeURIComponent(String(mediaId))}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить комментарии.');
  return data;
}

/**
 * @param {string | number} mediaId
 * @param {string} text
 */
export async function addComment(mediaId, text) {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const res = await fetch(`${apiBase}/media/${encodeURIComponent(String(mediaId))}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось сохранить комментарий.');
  return data;
}
