import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);
const ROLES_CAN_COMMENT = new Set(['Админ', 'Менеджер', 'Исполнитель']);

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

async function canSeeMedia(mediaId, userId, roleName) {
  const seeAll = ROLES_ALL_PROJECTS.has(roleName);
  const r = await pool.query(
    `SELECT 1
       FROM media m
       JOIN collections c ON c.id = m.collection_id
       JOIN tasks t ON t.id = c.task_id
      WHERE m.id = $1
        AND (${
          seeAll
            ? 'TRUE'
            : `EXISTS (
            SELECT 1 FROM user_project up
            WHERE up.project_id = t.project_id
              AND up.user_id = $2
              AND up.excluded_at IS NULL
          )`
        })
      LIMIT 1`,
    seeAll ? [mediaId] : [mediaId, userId],
  );
  return r.rows.length > 0;
}

// GET /api/media/:mediaId/comments
router.get('/media/:mediaId/comments', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(req.userId);
    if (!roleName) return res.status(401).json({ error: 'Пользователь не найден.' });
    if (roleName === 'Клиент' || roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const mediaId = Number(req.params.mediaId);
    if (!Number.isInteger(mediaId) || mediaId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
    }

    const visible = await canSeeMedia(mediaId, req.userId, roleName);
    if (!visible) return res.status(404).json({ error: 'Медиа не найдено.' });

    const r = await pool.query(
      `SELECT c.id, c.text, c.created_at, u.name AS user_name
         FROM comments c
         JOIN users u ON u.id = c.user_id
        WHERE c.media_id = $1
        ORDER BY c.created_at ASC`,
      [mediaId],
    );

    const comments = r.rows.map((row) => ({
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      userName: row.user_name,
    }));

    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить комментарии.' });
  }
});

// POST /api/media/:mediaId/comments
router.post('/media/:mediaId/comments', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(req.userId);
    if (!roleName) return res.status(401).json({ error: 'Пользователь не найден.' });
    if (!ROLES_CAN_COMMENT.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const mediaId = Number(req.params.mediaId);
    if (!Number.isInteger(mediaId) || mediaId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
    }

    const visible = await canSeeMedia(mediaId, req.userId, roleName);
    if (!visible) return res.status(404).json({ error: 'Медиа не найдено.' });

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ error: 'Текст комментария не может быть пустым.' });

    const ins = await pool.query(
      `INSERT INTO comments (text, created_at, user_id, media_id)
       VALUES ($1, NOW(), $2, $3)
       RETURNING id, text, created_at`,
      [text, req.userId, mediaId],
    );
    const row = ins.rows[0];

    const userRes = await pool.query(`SELECT name FROM users WHERE id = $1`, [req.userId]);
    const userName = userRes.rows[0]?.name ?? '';

    res.status(201).json({
      comment: {
        id: row.id,
        text: row.text,
        createdAt: row.created_at,
        userName,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось сохранить комментарий.' });
  }
});

export default router;
