import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ROLES_WITH_NOTIFICATIONS = new Set(['Админ', 'Менеджер']);

async function fetchRoleNameByUserId(userId) {
  const r = await pool.query(
    `SELECT r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [userId],
  );
  return r.rows[0]?.role_name ?? null;
}

// GET /api/notifications
// Для Менеджера/Админа: последний комментарий на каждое медиа в их проектах, сортировка по дате DESC.
router.get('/notifications', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(req.userId);
    if (!roleName) return res.status(401).json({ error: 'Пользователь не найден.' });
    if (!ROLES_WITH_NOTIFICATIONS.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const r = await pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (c.media_id)
           c.media_id,
           m.name   AS media_name,
           c.text,
           c.created_at,
           u.name   AS commenter_name,
           p.id     AS project_id,
           t.id     AS task_id,
           col.id   AS collection_id
         FROM comments c
         JOIN media m        ON m.id   = c.media_id
         JOIN collections col ON col.id = m.collection_id
         JOIN tasks t         ON t.id   = col.task_id
         JOIN projects p      ON p.id   = t.project_id
         JOIN user_project up ON up.project_id = p.id
           AND up.user_id = $1 AND up.excluded_at IS NULL
         JOIN users u         ON u.id   = c.user_id
         ORDER BY c.media_id, c.created_at DESC
       ) sub
       ORDER BY sub.created_at DESC
       LIMIT 50`,
      [req.userId],
    );

    const notifications = r.rows.map((row) => ({
      mediaId: row.media_id,
      mediaName: row.media_name,
      text: row.text,
      createdAt: row.created_at,
      commenterName: row.commenter_name,
      projectId: row.project_id,
      taskId: row.task_id,
      collectionId: row.collection_id,
    }));

    res.json({ notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить уведомления.' });
  }
});

export default router;
