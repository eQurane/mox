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

export async function fetchProjectById(id) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const encoded = encodeURIComponent(String(id));
  const res = await fetch(`${apiBase}/projects/${encoded}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить проект.');
  }
  return data;
}

export async function fetchProjectCreateOptions() {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/projects/create-options`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить данные формы.');
  }
  return data;
}

export async function createProject(payload) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось создать проект.');
  }
  return data;
}

export async function updateProject(id, payload) {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const encoded = encodeURIComponent(String(id));
  const res = await fetch(`${apiBase}/projects/${encoded}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось сохранить проект.');
  }
  return data;
}
