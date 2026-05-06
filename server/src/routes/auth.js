import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db.js';

/**
 * Dev-only policy: any client may pick any role from DB (including "Админ").
 * Restrict to a whitelist or a fixed role before production.
 */

const REGISTER_USER_STATUS = process.env.REGISTER_USER_STATUS || 'Активный';
const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_COST = 10;

const router = express.Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(res, message) {
  res.status(400).json({ error: message });
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

export default router;
