import { getToken } from '../auth/session.js';

const apiBase = '/api';

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function authHeader() {
  const token = getToken();
  if (!token) throw new Error('Сессия отсутствует.');
  return { Authorization: `Bearer ${token}` };
}

/** @param {{ q?: string, statusId?: string|number, roleId?: string|number, limit?: number, offset?: number }} filters */
export async function fetchAdminUsers(filters = {}) {
  const qs = new URLSearchParams();
  if (filters.q) qs.set('q', filters.q);
  if (filters.statusId != null && filters.statusId !== '') qs.set('statusId', String(filters.statusId));
  if (filters.roleId != null && filters.roleId !== '') qs.set('roleId', String(filters.roleId));
  if (filters.limit != null) qs.set('limit', String(filters.limit));
  if (filters.offset != null) qs.set('offset', String(filters.offset));
  const tail = qs.toString();
  const url = `${apiBase}/admin/users${tail ? `?${tail}` : ''}`;
  const res = await fetch(url, { headers: authHeader() });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить пользователей.');
  return data;
}

export async function fetchAdminUser(id) {
  const res = await fetch(`${apiBase}/admin/users/${encodeURIComponent(String(id))}`, {
    headers: authHeader(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить пользователя.');
  return data;
}

export async function patchAdminUser(id, payload) {
  const res = await fetch(`${apiBase}/admin/users/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось обновить пользователя.');
  return data;
}

export async function approveAdminUser(id) {
  const res = await fetch(`${apiBase}/admin/users/${encodeURIComponent(String(id))}/approve`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось подтвердить пользователя.');
  return data;
}

export async function deleteAdminUser(id) {
  const res = await fetch(`${apiBase}/admin/users/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось удалить пользователя.');
  return data;
}

export async function fetchAdminOverview() {
  const res = await fetch(`${apiBase}/admin/overview`, { headers: authHeader() });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить обзор.');
  return data;
}

export async function fetchAdminIssues() {
  const res = await fetch(`${apiBase}/admin/issues`, { headers: authHeader() });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить отчёт.');
  return data;
}

export async function fetchAdminLargeStorageFiles(limit = 100) {
  const qs = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${apiBase}/admin/storage/large-files?${qs}`, { headers: authHeader() });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось загрузить список файлов.');
  return data;
}

export async function hardDeleteAdminMedia(id) {
  const res = await fetch(`${apiBase}/admin/media/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    headers: authHeader(),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) throw new Error(data.error || 'Не удалось удалить медиа.');
  return data;
}
