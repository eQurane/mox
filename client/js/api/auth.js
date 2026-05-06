import { getToken } from '../auth/session.js';

const apiBase = '/api';

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export async function fetchRegisterOptions() {
  const res = await fetch(`${apiBase}/auth/register-options`);
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить список ролей.');
  }
  return data;
}

export async function register(payload) {
  const res = await fetch(`${apiBase}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Ошибка регистрации.');
  }
  return data;
}

export async function login(payload) {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось войти.');
  }
  return data;
}

export async function fetchMe() {
  const token = getToken();
  if (!token) {
    throw new Error('Сессия отсутствует.');
  }
  const res = await fetch(`${apiBase}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new Error(data.error || 'Не удалось загрузить профиль.');
  }
  return data;
}
