import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);

router.get('/projects', requireAuth, async (req, res) => {
  try {
    const roleResult = await pool.query(
      `SELECT r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [req.userId],
    );
    const roleName = roleResult.rows[0]?.role_name;
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const baseSelect = `
      SELECT p.id,
             p.name,
             p.goal,
             p.start_date,
             p.end_date,
             sp.name AS status_name,
             (
               SELECT m.path
               FROM media m
               JOIN collections c ON c.id = m.collection_id
               JOIN tasks t ON t.id = c.task_id
               WHERE t.project_id = p.id
               ORDER BY m.upload_at DESC
               LIMIT 1
             ) AS cover_path
      FROM projects p
      JOIN statuses_projects sp ON sp.id = p.status_id
    `;

    const query = seeAll
      ? `${baseSelect} ORDER BY p.start_date DESC, p.id DESC`
      : `${baseSelect}
       INNER JOIN user_project up
         ON up.project_id = p.id
        AND up.user_id = $1
        AND up.excluded_at IS NULL
       ORDER BY p.start_date DESC, p.id DESC`;

    const params = seeAll ? [] : [req.userId];
    const result = await pool.query(query, params);

    const projects = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      goal: row.goal,
      startDate: row.start_date,
      endDate: row.end_date,
      statusName: row.status_name,
      coverPath: row.cover_path,
    }));

    res.json({ projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить проекты.' });
  }
});

export default router;
