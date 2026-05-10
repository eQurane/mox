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
export async function fetchCollections(filters = {}) {
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
  const url = suffix ? `${apiBase}/collections?${suffix}` : `${apiBase}/collections`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить коллекции.');
  }
  return data;
}

/** @param {string | number} id */
export async function fetchCollectionById(id) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/collections/${encodeURIComponent(String(id))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить коллекцию.');
  }
  return data;
}

/**
 * @param {{ taskId: number, name: string, description: string }} payload
 */
export async function createCollection(payload) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/collections`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось создать коллекцию.');
  }
  return data;
}

/**
 * @param {string | number} id
 * @param {{ name: string, description: string }} payload
 */
export async function updateCollection(id, payload) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/collections/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось сохранить коллекцию.');
  }
  return data;
}
