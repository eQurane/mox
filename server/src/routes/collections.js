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

router.get('/collections', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const projectIdRaw = req.query.projectId;
    const taskIdRaw = req.query.taskId;
    const taskStatusIdRaw = req.query.taskStatusId;
    const projectStatusIdRaw = req.query.projectStatusId;
    const createdFromRaw = typeof req.query.createdFrom === 'string' ? req.query.createdFrom.trim() : '';
    const createdToRaw = typeof req.query.createdTo === 'string' ? req.query.createdTo.trim() : '';
    const lastEditedFromRaw = typeof req.query.lastEditedFrom === 'string' ? req.query.lastEditedFrom.trim() : '';
    const lastEditedToRaw = typeof req.query.lastEditedTo === 'string' ? req.query.lastEditedTo.trim() : '';

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

    let taskStatusId = null;
    if (taskStatusIdRaw !== undefined && taskStatusIdRaw !== '') {
      const n = Number(taskStatusIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор статуса технического задания.' });
      }
      const chk = await pool.query(`SELECT 1 FROM statuses_tasks WHERE id = $1`, [n]);
      if (chk.rows.length === 0) {
        return res.status(400).json({ error: 'Укажите корректный статус технического задания.' });
      }
      taskStatusId = n;
    }

    let projectStatusId = null;
    if (projectStatusIdRaw !== undefined && projectStatusIdRaw !== '') {
      const n = Number(projectStatusIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор статуса проекта.' });
      }
      const chk = await pool.query(`SELECT 1 FROM statuses_projects WHERE id = $1`, [n]);
      if (chk.rows.length === 0) {
        return res.status(400).json({ error: 'Укажите корректный статус проекта.' });
      }
      projectStatusId = n;
    }

    let createdFrom = null;
    let createdTo = null;
    if (createdFromRaw) {
      if (!DATE_RE.test(createdFromRaw)) {
        return res.status(400).json({ error: 'Параметр createdFrom должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      createdFrom = createdFromRaw;
    }
    if (createdToRaw) {
      if (!DATE_RE.test(createdToRaw)) {
        return res.status(400).json({ error: 'Параметр createdTo должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      createdTo = createdToRaw;
    }
    if (createdFrom && createdTo && createdFrom > createdTo) {
      return res.status(400).json({ error: 'Дата начала диапазона создания не может быть позже даты окончания.' });
    }

    let lastEditedFrom = null;
    let lastEditedTo = null;
    if (lastEditedFromRaw) {
      if (!DATE_RE.test(lastEditedFromRaw)) {
        return res.status(400).json({ error: 'Параметр lastEditedFrom должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      lastEditedFrom = lastEditedFromRaw;
    }
    if (lastEditedToRaw) {
      if (!DATE_RE.test(lastEditedToRaw)) {
        return res.status(400).json({ error: 'Параметр lastEditedTo должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      lastEditedTo = lastEditedToRaw;
    }
    if (lastEditedFrom && lastEditedTo && lastEditedFrom > lastEditedTo) {
      return res.status(400).json({ error: 'Дата начала диапазона изменения не может быть позже даты окончания.' });
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

    if (qRaw) {
      const pattern = `%${escapeIlikePattern(qRaw)}%`;
      conditions.push(`c.name ILIKE $${p} ESCAPE '\\'`);
      params.push(pattern);
      p++;
    }

    if (taskStatusId !== null) {
      conditions.push(`t.status_id = $${p}`);
      params.push(taskStatusId);
      p++;
    }

    if (projectStatusId !== null) {
      conditions.push(`p.status_id = $${p}`);
      params.push(projectStatusId);
      p++;
    }

    if (createdFrom) {
      conditions.push(`c.created_at::date >= $${p}::date`);
      params.push(createdFrom);
      p++;
    }
    if (createdTo) {
      conditions.push(`c.created_at::date <= $${p}::date`);
      params.push(createdTo);
      p++;
    }

    if (lastEditedFrom) {
      conditions.push(`c.last_edited_at::date >= $${p}::date`);
      params.push(lastEditedFrom);
      p++;
    }
    if (lastEditedTo) {
      conditions.push(`c.last_edited_at::date <= $${p}::date`);
      params.push(lastEditedTo);
      p++;
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT c.id,
             c.task_id,
             c.name,
             c.description,
             c.created_at,
             c.last_edited_at,
             t.project_id,
             p.name AS project_name,
             t.name AS task_name
        FROM collections c
        JOIN tasks t ON t.id = c.task_id
        JOIN projects p ON p.id = t.project_id
        ${whereSql}
        ORDER BY c.last_edited_at DESC NULLS LAST, c.id DESC
    `;

    const [result, taskStatusesResult, projectStatusesResult] = await Promise.all([
      pool.query(sql, params),
      pool.query(`SELECT id, name FROM statuses_tasks ORDER BY id`),
      pool.query(`SELECT id, name FROM statuses_projects ORDER BY id`),
    ]);

    const collections = result.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      name: row.name,
      description: row.description ?? '',
      createdAt: row.created_at,
      lastEditedAt: row.last_edited_at,
      projectId: row.project_id,
      projectName: row.project_name,
      taskName: row.task_name,
    }));

    const taskStatuses = taskStatusesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));
    const projectStatuses = projectStatusesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));

    res.json({ collections, taskStatuses, projectStatuses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить коллекции.' });
  }
});

export default router;
