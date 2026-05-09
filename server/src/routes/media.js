import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function fetchRoleNameByUserId(db, userId) {
  const roleResult = await db.query(
    `SELECT r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [userId],
  );
  return roleResult.rows[0]?.role_name ?? null;
}

function escapeIlikePattern(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

router.get('/media', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const projectIdRaw = req.query.projectId;
    const taskIdRaw = req.query.taskId;
    const collectionIdRaw = req.query.collectionId;
    const statusIdRaw = req.query.statusId;
    const uploadFromRaw = typeof req.query.uploadFrom === 'string' ? req.query.uploadFrom.trim() : '';
    const uploadToRaw = typeof req.query.uploadTo === 'string' ? req.query.uploadTo.trim() : '';

    let projectId = null;
    if (projectIdRaw !== undefined && projectIdRaw !== '') {
      const n = Number(projectIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор проекта.' });
      }
      projectId = n;
    }

    let taskId = null;
    if (taskIdRaw !== undefined && taskIdRaw !== '') {
      const n = Number(taskIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор технического задания.' });
      }
      taskId = n;
    }

    let collectionId = null;
    if (collectionIdRaw !== undefined && collectionIdRaw !== '') {
      const n = Number(collectionIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор коллекции.' });
      }
      collectionId = n;
    }

    let statusId = null;
    if (statusIdRaw !== undefined && statusIdRaw !== '') {
      const n = Number(statusIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор статуса медиа.' });
      }
      const chk = await pool.query(`SELECT 1 FROM statuses_media WHERE id = $1`, [n]);
      if (chk.rows.length === 0) {
        return res.status(400).json({ error: 'Укажите корректный статус медиа.' });
      }
      statusId = n;
    }

    let uploadFrom = null;
    let uploadTo = null;
    if (uploadFromRaw) {
      if (!DATE_RE.test(uploadFromRaw)) {
        return res.status(400).json({ error: 'Параметр uploadFrom должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      uploadFrom = uploadFromRaw;
    }
    if (uploadToRaw) {
      if (!DATE_RE.test(uploadToRaw)) {
        return res.status(400).json({ error: 'Параметр uploadTo должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      uploadTo = uploadToRaw;
    }
    if (uploadFrom && uploadTo && uploadFrom > uploadTo) {
      return res.status(400).json({ error: 'Дата начала диапазона загрузки не может быть позже даты окончания.' });
    }

    const conditions = [];
    const params = [];
    let p = 1;

    conditions.push(`
      (${seeAll ? 'TRUE' : `EXISTS (
        SELECT 1 FROM user_project up
        WHERE up.project_id = t.project_id
          AND up.user_id = $${p}
          AND up.excluded_at IS NULL
      )`})
    `);
    if (!seeAll) {
      params.push(req.userId);
      p++;
    }

    if (projectId !== null) {
      conditions.push(`t.project_id = $${p}`);
      params.push(projectId);
      p++;
    }

    if (taskId !== null) {
      conditions.push(`c.task_id = $${p}`);
      params.push(taskId);
      p++;
    }

    if (collectionId !== null) {
      conditions.push(`m.collection_id = $${p}`);
      params.push(collectionId);
      p++;
    }

    if (statusId !== null) {
      conditions.push(`m.status_id = $${p}`);
      params.push(statusId);
      p++;
    }

    if (uploadFrom) {
      conditions.push(`m.upload_at::date >= $${p}::date`);
      params.push(uploadFrom);
      p++;
    }
    if (uploadTo) {
      conditions.push(`m.upload_at::date <= $${p}::date`);
      params.push(uploadTo);
      p++;
    }

    if (qRaw) {
      const pattern = `%${escapeIlikePattern(qRaw)}%`;
      conditions.push(`m.name ILIKE $${p} ESCAPE '\\'`);
      params.push(pattern);
      p++;
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT m.id,
             m.collection_id,
             m.path,
             m.name,
             m.format,
             m.description,
             m.upload_at,
             m.status_id,
             sm.name AS status_name,
             c.name AS collection_name,
             c.task_id,
             t.name AS task_name,
             t.project_id,
             p.name AS project_name
        FROM media m
        JOIN collections c ON c.id = m.collection_id
        JOIN tasks t ON t.id = c.task_id
        JOIN projects p ON p.id = t.project_id
        JOIN statuses_media sm ON sm.id = m.status_id
        ${whereSql}
        ORDER BY m.upload_at DESC NULLS LAST, m.id DESC
    `;

    const [result, statusesResult] = await Promise.all([
      pool.query(sql, params),
      pool.query(`SELECT id, name FROM statuses_media ORDER BY id`),
    ]);

    const media = result.rows.map((row) => ({
      id: row.id,
      collectionId: row.collection_id,
      path: row.path,
      name: row.name,
      format: row.format,
      description: row.description ?? '',
      uploadAt: row.upload_at,
      statusId: row.status_id,
      statusName: row.status_name,
      collectionName: row.collection_name,
      taskId: row.task_id,
      taskName: row.task_name,
      projectId: row.project_id,
      projectName: row.project_name,
    }));

    const statuses = statusesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));

    res.json({ media, statuses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить медиа.' });
  }
});

export default router;
