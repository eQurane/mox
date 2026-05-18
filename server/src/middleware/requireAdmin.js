import pool from '../db.js';

/**
 * После requireAuth. Доступ только роли «Админ» (актуальное имя из БД).
 */
export async function requireAdmin(req, res, next) {
  try {
    const r = await pool.query(
      `SELECT r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [req.userId],
    );
    const roleName = r.rows[0]?.role_name;
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    if (roleName !== 'Админ') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Не удалось проверить права.' });
  }
}
