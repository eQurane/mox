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
export async function fetchMedia(filters = {}) {
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
  const url = suffix ? `${apiBase}/media?${suffix}` : `${apiBase}/media`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить медиа.');
  }
  return data;
}

/** @param {string | number} id */
export async function fetchMediaById(id) {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const res = await fetch(`${apiBase}/media/${encodeURIComponent(String(id))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить медиа.');
  return data;
}

/**
 * @param {string | number} id
 * @param {{ description: string }} payload
 */
export async function updateMedia(id, payload) {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const res = await fetch(`${apiBase}/media/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось обновить медиа.');
  return data;
}

/** @param {string | number} id */
export async function deleteMedia(id) {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const res = await fetch(`${apiBase}/media/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось удалить медиа.');
  return data;
}

/**
 * @param {string | number} id
 * @param {File} file
 */
export async function replaceMedia(id, file) {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${apiBase}/media/${encodeURIComponent(String(id))}/replace`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось заменить файл.');
  return data;
}

/**
 * @param {{ file: File, collectionId: number, description?: string }} payload
 */
export async function uploadMedia(payload) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }

  const body = new FormData();
  body.append('file', payload.file);
  body.append('collectionId', String(payload.collectionId));
  body.append('description', payload.description ?? '');

  const res = await fetch(`${apiBase}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить файл.');
  }
  return data;
}
