import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isExternalContractorAccountRole, sqlTaskHasContractorType } from '../access/contractorTaskScope.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Роли, допустимые в `tasks.role_id` при создании задания (тип исполнителя). */
const TASK_ROLE_NAMES = ['Исполнитель', 'Внешний подрядчик'];

const initDateFloor = () => process.env.INIT_DATE || '2026-05-01';

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

/**
 * @param {import('express').Response} res
 * @returns {Promise<string | null>} roleName или null после отправки ошибки
 */
async function requireManagerOrAdmin(res, userId) {
  const roleName = await fetchRoleNameByUserId(pool, userId);
  if (!roleName) {
    res.status(401).json({ error: 'Пользователь не найден.' });
    return null;
  }
  if (!ROLES_ALL_PROJECTS.has(roleName)) {
    res.status(403).json({ error: 'Недостаточно прав.' });
    return null;
  }
  return roleName;
}

/** Проект, если он существует и доступен пользователю с ролью admin/manager (см. GET /projects/:id). */
async function fetchProjectDatesIfVisible(projectId, userId, roleName) {
  const seeAll = ROLES_ALL_PROJECTS.has(roleName);
  const r = await pool.query(
    `SELECT p.start_date::text AS start_date, p.end_date::text AS end_date
       FROM projects p
      WHERE p.id = $1
        AND (
          $2::boolean IS TRUE
          OR EXISTS (
            SELECT 1 FROM user_project up
            WHERE up.project_id = p.id
              AND up.user_id = $3
              AND up.excluded_at IS NULL
          )
        )`,
    [projectId, seeAll, userId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return { startDate: row.start_date, endDate: row.end_date };
}

/**
 * Парсинг и валидация полей задания для POST и PATCH.
 * @returns {Promise<{ ok: true, name: string, description: string, deadlineForDb: Date, statusId: number, taskRoleId: number, taskRoleRow: { name: string }, statusRow: { name: string } } | { ok: false, status: number, error: string }>}
 */
async function validateTaskWriteFields(body, projectStartDate, projectEndDate) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const description = typeof body.description === 'string' ? body.description : '';
  const deadlineRaw = typeof body.deadline === 'string' ? body.deadline.trim() : '';
  const statusId = Number(body.statusId);
  const taskRoleId = Number(body.roleId);

  if (!name) {
    return { ok: false, status: 400, error: 'Укажите название задания.' };
  }

  if (!deadlineRaw) {
    return { ok: false, status: 400, error: 'Укажите дату и время дедлайна.' };
  }

  let deadlineForDb;
  if (DATE_RE.test(deadlineRaw)) {
    deadlineForDb = new Date(`${deadlineRaw}T12:00:00.000Z`);
  } else {
    const parsed = Date.parse(deadlineRaw);
    if (Number.isNaN(parsed)) {
      return {
        ok: false,
        status: 400,
        error: 'Дедлайн должен быть датой ГГГГ-ММ-ДД или датой и временем в формате ISO 8601.',
      };
    }
    deadlineForDb = new Date(parsed);
  }

  if (!Number.isInteger(statusId) || statusId < 1) {
    return { ok: false, status: 400, error: 'Укажите статус задания из списка.' };
  }

  if (!Number.isInteger(taskRoleId) || taskRoleId < 1) {
    return { ok: false, status: 400, error: 'Укажите роль исполнителя задания из списка.' };
  }

  const deadlineDayUtc = deadlineForDb.toISOString().slice(0, 10);
  if (deadlineDayUtc < projectStartDate || deadlineDayUtc > projectEndDate) {
    return {
      ok: false,
      status: 400,
      error: 'Дедлайн должен быть не раньше даты начала проекта и не позже даты окончания проекта.',
    };
  }

  const floor = initDateFloor();
  if (deadlineDayUtc < floor) {
    return { ok: false, status: 400, error: `Дедлайн не может быть раньше ${floor}.` };
  }

  const roleCheck = await pool.query(
    `SELECT id, name FROM roles WHERE id = $1 AND name = ANY($2::text[])`,
    [taskRoleId, TASK_ROLE_NAMES],
  );
  const taskRoleRow = roleCheck.rows[0];
  if (!taskRoleRow) {
    return { ok: false, status: 400, error: 'Выберите корректную роль исполнителя задания.' };
  }

  const stCheck = await pool.query(`SELECT id, name FROM statuses_tasks WHERE id = $1`, [statusId]);
  const statusRow = stCheck.rows[0];
  if (!statusRow) {
    return { ok: false, status: 400, error: 'Выберите корректный статус задания.' };
  }

  return {
    ok: true,
    name,
    description,
    deadlineForDb,
    statusId,
    taskRoleId,
    taskRoleRow,
    statusRow,
  };
}

router.get('/tasks/create-options', requireAuth, async (req, res) => {
  try {
    const roleName = await requireManagerOrAdmin(res, req.userId);
    if (!roleName) return;

    const [statusesResult, rolesResult] = await Promise.all([
      pool.query(`SELECT id, name FROM statuses_tasks ORDER BY id`),
      pool.query(
        `SELECT id, name FROM roles
          WHERE name = ANY($1::text[])
          ORDER BY CASE name WHEN 'Исполнитель' THEN 1 WHEN 'Внешний подрядчик' THEN 2 ELSE 3 END`,
        [TASK_ROLE_NAMES],
      ),
    ]);

    if (rolesResult.rows.length !== TASK_ROLE_NAMES.length) {
      console.error('tasks/create-options: ожидались роли Исполнитель и Внешний подрядчик.');
      return res.status(500).json({ error: 'Не удалось загрузить параметры формы.' });
    }

    res.json({
      statuses: statusesResult.rows.map((row) => ({ id: row.id, name: row.name })),
      taskRoles: rolesResult.rows.map((row) => ({ id: row.id, name: row.name })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить параметры формы.' });
  }
});

router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const roleName = await requireManagerOrAdmin(res, req.userId);
    if (!roleName) return;

    const body = req.body ?? {};
    const projectId = Number(body.projectId);
    if (!Number.isInteger(projectId) || projectId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор проекта.' });
    }

    const project = await fetchProjectDatesIfVisible(projectId, req.userId, roleName);
    if (!project) {
      return res.status(404).json({ error: 'Проект не найден.' });
    }

    const validated = await validateTaskWriteFields(body, project.startDate, project.endDate);
    if (!validated.ok) {
      return res.status(validated.status).json({ error: validated.error });
    }

    const {
      name,
      description,
      deadlineForDb,
      statusId,
      taskRoleId,
      taskRoleRow,
      statusRow,
    } = validated;

    const ins = await pool.query(
      `INSERT INTO tasks (name, description, deadline, role_id, project_id, status_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, deadline`,
      [name, description, deadlineForDb, taskRoleId, projectId, statusId],
    );

    const row = ins.rows[0];
    res.status(201).json({
      task: {
        id: row.id,
        projectId,
        name,
        description,
        deadline: row.deadline,
        roleId: taskRoleId,
        roleName: taskRoleRow.name,
        statusId,
        statusName: statusRow.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать задание.' });
  }
});

router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    if (roleName === 'Клиент') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);
    const contractorRestricted = isExternalContractorAccountRole(roleName);

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

    if (contractorRestricted) {
      conditions.push(sqlTaskHasContractorType('t'));
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
             st.name AS status_name,
             (
               SELECT m.path
                 FROM media m
                 JOIN collections c ON c.id = m.collection_id
                WHERE c.task_id = t.id
                ORDER BY m.upload_at DESC
                LIMIT 1
             ) AS cover_path
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
      coverPath: row.cover_path ?? null,
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

router.get('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    const taskId = Number(rawId);
    if (!Number.isInteger(taskId) || taskId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор задания.' });
    }

    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    const seeAll = ROLES_ALL_PROJECTS.has(roleName);
    const contractorRestricted = isExternalContractorAccountRole(roleName);
    const taskContractorSql = contractorRestricted ? ` AND ${sqlTaskHasContractorType('t')}` : '';

    const taskSql = `
      SELECT t.id,
             t.project_id,
             p.name AS project_name,
             t.name,
             t.description,
             t.deadline,
             t.role_id,
             r.name AS role_name,
             t.status_id,
             st.name AS status_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        JOIN roles r ON r.id = t.role_id
        JOIN statuses_tasks st ON st.id = t.status_id
       WHERE t.id = $1
         AND (
           $2::boolean IS TRUE
           OR EXISTS (
             SELECT 1 FROM user_project up
             WHERE up.project_id = t.project_id
               AND up.user_id = $3
               AND up.excluded_at IS NULL
           )
         )${taskContractorSql}
    `;

    const taskResult = await pool.query(taskSql, [taskId, seeAll, req.userId]);
    const trow = taskResult.rows[0];
    if (!trow) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    const task = {
      id: trow.id,
      projectId: trow.project_id,
      projectName: trow.project_name,
      name: trow.name,
      description: trow.description ?? '',
      deadline: trow.deadline,
      roleId: trow.role_id,
      roleName: trow.role_name,
      statusId: trow.status_id,
      statusName: trow.status_name,
    };

    const collectionsResult = await pool.query(
      `SELECT c.id,
              c.task_id,
              c.name,
              c.description,
              c.created_at,
              c.last_edited_at,
              (
                SELECT m.path
                  FROM media m
                 WHERE m.collection_id = c.id
                 ORDER BY m.upload_at DESC
                 LIMIT 1
              ) AS cover_path
         FROM collections c
        WHERE c.task_id = $1
        ORDER BY c.id ASC`,
      [taskId],
    );

    const collections = collectionsResult.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      name: row.name,
      description: row.description ?? '',
      createdAt: row.created_at,
      lastEditedAt: row.last_edited_at,
      coverPath: row.cover_path ?? null,
    }));

    const mediaResult = await pool.query(
      `SELECT m.id,
              m.collection_id,
              m.path,
              m.name,
              m.format,
              m.description,
              m.upload_at,
              sm.name AS status_name
         FROM media m
         JOIN statuses_media sm ON sm.id = m.status_id
         JOIN collections c ON c.id = m.collection_id
        WHERE c.task_id = $1
        ORDER BY m.upload_at DESC`,
      [taskId],
    );

    const media = mediaResult.rows.map((row) => ({
      id: row.id,
      collectionId: row.collection_id,
      path: row.path,
      name: row.name,
      format: row.format,
      description: row.description ?? '',
      uploadAt: row.upload_at,
      statusName: row.status_name,
    }));

    res.json({ task, collections, media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить задание.' });
  }
});

router.patch('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const roleName = await requireManagerOrAdmin(res, req.userId);
    if (!roleName) return;

    const rawId = req.params.id;
    const taskId = Number(rawId);
    if (!Number.isInteger(taskId) || taskId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор задания.' });
    }

    const existing = await pool.query(`SELECT project_id FROM tasks WHERE id = $1`, [taskId]);
    const projectId = existing.rows[0]?.project_id;
    if (projectId == null) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    const project = await fetchProjectDatesIfVisible(projectId, req.userId, roleName);
    if (!project) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    const validated = await validateTaskWriteFields(req.body ?? {}, project.startDate, project.endDate);
    if (!validated.ok) {
      return res.status(validated.status).json({ error: validated.error });
    }

    const {
      name,
      description,
      deadlineForDb,
      statusId,
      taskRoleId,
      taskRoleRow,
      statusRow,
    } = validated;

    const upd = await pool.query(
      `UPDATE tasks
          SET name = $1,
              description = $2,
              deadline = $3,
              role_id = $4,
              status_id = $5
        WHERE id = $6
      RETURNING id, deadline`,
      [name, description, deadlineForDb, taskRoleId, statusId, taskId],
    );

    const row = upd.rows[0];
    res.json({
      task: {
        id: row.id,
        projectId,
        name,
        description,
        deadline: row.deadline,
        roleId: taskRoleId,
        roleName: taskRoleRow.name,
        statusId,
        statusName: statusRow.name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось сохранить задание.' });
  }
});

export default router;
