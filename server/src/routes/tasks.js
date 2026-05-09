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

router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const projectIdRaw = req.query.projectId;
    const statusIdRaw = req.query.statusId;
    const deadlineFromRaw = typeof req.query.deadlineFrom === 'string' ? req.query.deadlineFrom.trim() : '';
    const deadlineToRaw = typeof req.query.deadlineTo === 'string' ? req.query.deadlineTo.trim() : '';

    let projectId = null;
    if (projectIdRaw !== undefined && projectIdRaw !== '') {
      const n = Number(projectIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор проекта.' });
      }
      projectId = n;
    }

    let statusId = null;
    if (statusIdRaw !== undefined && statusIdRaw !== '') {
      const n = Number(statusIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор статуса.' });
      }
      const chk = await pool.query(`SELECT 1 FROM statuses_tasks WHERE id = $1`, [n]);
      if (chk.rows.length === 0) {
        return res.status(400).json({ error: 'Укажите корректный статус задачи.' });
      }
      statusId = n;
    }

    let deadlineFrom = null;
    let deadlineTo = null;
    if (deadlineFromRaw) {
      if (!DATE_RE.test(deadlineFromRaw)) {
        return res.status(400).json({ error: 'Параметр deadlineFrom должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      deadlineFrom = deadlineFromRaw;
    }
    if (deadlineToRaw) {
      if (!DATE_RE.test(deadlineToRaw)) {
        return res.status(400).json({ error: 'Параметр deadlineTo должен быть датой в формате ГГГГ-ММ-ДД.' });
      }
      deadlineTo = deadlineToRaw;
    }
    if (deadlineFrom && deadlineTo && deadlineFrom > deadlineTo) {
      return res.status(400).json({ error: 'Дата начала диапазона дедлайна не может быть позже даты окончания.' });
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

    if (statusId !== null) {
      conditions.push(`t.status_id = $${p}`);
      params.push(statusId);
      p++;
    }

    if (deadlineFrom) {
      conditions.push(`t.deadline::date >= $${p}::date`);
      params.push(deadlineFrom);
      p++;
    }
    if (deadlineTo) {
      conditions.push(`t.deadline::date <= $${p}::date`);
      params.push(deadlineTo);
      p++;
    }

    if (qRaw) {
      const pattern = `%${escapeIlikePattern(qRaw)}%`;
      conditions.push(`t.name ILIKE $${p} ESCAPE '\\'`);
      params.push(pattern);
      p++;
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const tasksSql = `
      SELECT t.id,
             t.project_id,
             p.name AS project_name,
             t.name,
             t.description,
             t.deadline,
             r.name AS role_name,
             t.status_id,
             st.name AS status_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        JOIN roles r ON r.id = t.role_id
        JOIN statuses_tasks st ON st.id = t.status_id
        ${whereSql}
        ORDER BY t.deadline ASC NULLS LAST, t.id DESC
    `;

    const [tasksResult, statusesResult] = await Promise.all([
      pool.query(tasksSql, params),
      pool.query(`SELECT id, name FROM statuses_tasks ORDER BY id`),
    ]);

    const tasks = tasksResult.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      name: row.name,
      description: row.description,
      deadline: row.deadline,
      roleName: row.role_name,
      statusId: row.status_id,
      statusName: row.status_name,
    }));

    const statuses = statusesResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
    }));

    res.json({ tasks, statuses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить задачи.' });
  }
});

export default router;
