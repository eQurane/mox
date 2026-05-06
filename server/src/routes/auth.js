import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

/**
 * Dev-only policy: any client may pick any role from DB (including "Админ").
 * Restrict to a whitelist or a fixed role before production.
 */

const REGISTER_USER_STATUS = process.env.REGISTER_USER_STATUS || 'Активный';
const ACTIVE_USER_STATUS = 'Активный';
const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_COST = 10;

const isProd = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET;
if (isProd && !JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required in production.');
  process.exit(1);
}
const jwtSecret = JWT_SECRET || 'dev-local-only-insecure-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(res, message) {
  res.status(400).json({ error: message });
}

function unauthorized(res) {
  res.status(401).json({ error: 'Неверный email или пароль.' });
}

function bearerToken(req) {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

router.get('/auth/register-options', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM roles ORDER BY id');
    res.json({ roles: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить роли.' });
  }
});

router.post('/auth/register', async (req, res) => {
  const { name, email, password, roleId: rawRoleId } = req.body ?? {};

  if (typeof name !== 'string' || !name.trim()) {
    return badRequest(res, 'Укажите имя.');
  }
  if (typeof email !== 'string' || !email.trim()) {
    return badRequest(res, 'Укажите email.');
  }
  if (!emailPattern.test(email.trim())) {
    return badRequest(res, 'Некорректный email.');
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return badRequest(res, `Пароль не короче ${PASSWORD_MIN_LENGTH} символов.`);
  }

  const roleId = Number(rawRoleId);
  if (!Number.isInteger(roleId) || roleId < 1) {
    return badRequest(res, 'Укажите корректную роль.');
  }

  try {
    const roleCheck = await pool.query('SELECT 1 FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rowCount === 0) {
      return badRequest(res, 'Выбранная роль недоступна.');
    }

    const statusResult = await pool.query(
      'SELECT id FROM statuses_users WHERE name = $1 LIMIT 1',
      [REGISTER_USER_STATUS],
    );
    if (statusResult.rowCount === 0) {
      console.error(`Unknown statuses_users.name: "${REGISTER_USER_STATUS}"`);
      return res.status(500).json({ error: 'Ошибка конфигурации статуса.' });
    }
    const statusId = statusResult.rows[0].id;

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const insert = await pool.query(
      `INSERT INTO users (name, email, password, registered_at, status_id, role_id)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING id, name, email, role_id`,
      [trimmedName, normalizedEmail, passwordHash, statusId, roleId],
    );

    const row = insert.rows[0];
    return res.status(201).json({
      id: row.id,
      name: row.name,
      email: row.email,
      roleId: row.role_id,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Этот email уже зарегистрирован.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Не удалось зарегистрироваться.' });
  }
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || !email.trim()) {
    return badRequest(res, 'Укажите email.');
  }
  if (!emailPattern.test(email.trim())) {
    return badRequest(res, 'Некорректный email.');
  }
  if (typeof password !== 'string' || !password.length) {
    return badRequest(res, 'Укажите пароль.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  let row;
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.password, u.role_id, su.name AS status_name
       FROM users u
       JOIN statuses_users su ON su.id = u.status_id
       WHERE u.email = $1`,
      [normalizedEmail],
    );
    row = result.rows[0];
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Не удалось выполнить вход.' });
  }

  if (!row || !row.password) {
    return unauthorized(res);
  }

  const match = await bcrypt.compare(password, row.password);
  if (!match) {
    return unauthorized(res);
  }

  if (row.status_name === 'Отключён') {
    return res.status(403).json({ error: 'Доступ запрещён.' });
  }
  if (row.status_name === 'На подтверждении') {
    return res.status(403).json({ error: 'Учётная запись ещё не активирована.' });
  }
  if (row.status_name !== ACTIVE_USER_STATUS) {
    return res.status(403).json({ error: 'Вход с этим статусом учётной записи невозможен.' });
  }

  const token = jwt.sign({ sub: String(row.id), roleId: row.role_id }, jwtSecret, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return res.json({
    token,
    user: {
      id: row.id,
      name: row.name,
      email: row.email,
      roleId: row.role_id,
    },
  });
});

router.get('/auth/me', async (req, res) => {
  const raw = bearerToken(req);
  if (!raw) {
    return res.status(401).json({ error: 'Требуется авторизация.' });
  }

  let payload;
  try {
    payload = jwt.verify(raw, jwtSecret);
  } catch {
    return res.status(401).json({ error: 'Сессия недействительна.' });
  }

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(401).json({ error: 'Сессия недействительна.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, role_id FROM users WHERE id = $1',
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    return res.json({
      id: row.id,
      name: row.name,
      email: row.email,
      roleId: row.role_id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Не удалось загрузить профиль.' });
  }
});

export default router;
