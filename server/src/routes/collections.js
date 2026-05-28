import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isExternalContractorAccountRole, sqlTaskHasContractorType } from '../access/contractorTaskScope.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);
/** Создание коллекции: менеджер/админ, исполнитель или внешний подрядчик (членство и тип задания — ниже). */
const ROLES_CAN_POST_COLLECTION = new Set(['Админ', 'Менеджер', 'Исполнитель', 'Внешний подрядчик']);
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

/**
 * @param {import('express').Response} res
 * @returns {Promise<string | null>}
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

/**
 * @param {import('express').Response} res
 * @returns {Promise<string | null>}
 */
async function requireRoleForNewCollection(res, userId) {
  const roleName = await fetchRoleNameByUserId(pool, userId);
  if (!roleName) {
    res.status(401).json({ error: 'Пользователь не найден.' });
    return null;
  }
  if (!ROLES_CAN_POST_COLLECTION.has(roleName)) {
    res.status(403).json({ error: 'Недостаточно прав.' });
    return null;
  }
  return roleName;
}

/** Проект доступен редактору (как при PATCH/POST задачи). */
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

router.get('/collections', requireAuth, async (req, res) => {
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
        return res.status(400).json({ error: 'Некорректный идентификатор задания.' });
      }
      taskId = n;
    }

    let taskStatusId = null;
    if (taskStatusIdRaw !== undefined && taskStatusIdRaw !== '') {
      const n = Number(taskStatusIdRaw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор статуса задания.' });
      }
      const chk = await pool.query(`SELECT 1 FROM statuses_tasks WHERE id = $1`, [n]);
      if (chk.rows.length === 0) {
        return res.status(400).json({ error: 'Укажите корректный статус задания.' });
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

    if (contractorRestricted) {
      conditions.push(sqlTaskHasContractorType('t'));
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
             t.name AS task_name,
             (
               SELECT m.path
                 FROM media m
                WHERE m.collection_id = c.id
                ORDER BY m.upload_at DESC
                LIMIT 1
             ) AS cover_path
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
      coverPath: row.cover_path ?? null,
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

router.get('/collections/:id', requireAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    const collectionId = Number(rawId);
    if (!Number.isInteger(collectionId) || collectionId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор коллекции.' });
    }

    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    const seeAll = ROLES_ALL_PROJECTS.has(roleName);
    const contractorRestricted = isExternalContractorAccountRole(roleName);
    const collTaskRestrict = contractorRestricted ? ` AND ${sqlTaskHasContractorType('t')}` : '';

    const collSql = `
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
       WHERE c.id = $1
         AND (
           $2::boolean IS TRUE
           OR EXISTS (
             SELECT 1 FROM user_project up
             WHERE up.project_id = t.project_id
               AND up.user_id = $3
               AND up.excluded_at IS NULL
           )
         )${collTaskRestrict}
    `;

    const collResult = await pool.query(collSql, [collectionId, seeAll, req.userId]);
    const crow = collResult.rows[0];
    if (!crow) {
      return res.status(404).json({ error: 'Коллекция не найдена.' });
    }

    const collection = {
      id: crow.id,
      taskId: crow.task_id,
      projectId: crow.project_id,
      projectName: crow.project_name,
      taskName: crow.task_name,
      name: crow.name,
      description: crow.description ?? '',
      createdAt: crow.created_at,
      lastEditedAt: crow.last_edited_at,
    };

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
        WHERE m.collection_id = $1
        ORDER BY m.upload_at DESC NULLS LAST, m.id DESC`,
      [collectionId],
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

    res.json({ collection, media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить коллекцию.' });
  }
});

router.post('/collections', requireAuth, async (req, res) => {
  try {
    const roleName = await requireRoleForNewCollection(res, req.userId);
    if (!roleName) return;

    const taskId = Number(req.body?.taskId);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description : '';

    if (!Number.isInteger(taskId) || taskId < 1) {
      return res.status(400).json({ error: 'Укажите корректное задание.' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Укажите название коллекции.' });
    }

    const taskRow = await pool.query(`SELECT project_id FROM tasks WHERE id = $1`, [taskId]);
    const projectId = taskRow.rows[0]?.project_id;
    if (projectId == null) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    const project = await fetchProjectDatesIfVisible(projectId, req.userId, roleName);
    if (!project) {
      return res.status(404).json({ error: 'Задание не найдено.' });
    }

    if (isExternalContractorAccountRole(roleName)) {
      const scopeCheck = await pool.query(
        `SELECT 1 FROM tasks t WHERE t.id = $1 AND ${sqlTaskHasContractorType('t')}`,
        [taskId],
      );
      if (scopeCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Задание не найдено.' });
      }
    }

    const ins = await pool.query(
      `INSERT INTO collections (name, description, created_at, last_edited_at, task_id)
       VALUES ($1, $2, NOW(), NOW(), $3)
       RETURNING id, task_id, name, description, created_at, last_edited_at`,
      [name, description, taskId],
    );

    const row = ins.rows[0];
    res.status(201).json({
      collection: {
        id: row.id,
        taskId: row.task_id,
        projectId,
        name: row.name,
        description: row.description ?? '',
        createdAt: row.created_at,
        lastEditedAt: row.last_edited_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать коллекцию.' });
  }
});

router.patch('/collections/:id', requireAuth, async (req, res) => {
  try {
    const roleName = await requireManagerOrAdmin(res, req.userId);
    if (!roleName) return;

    const rawId = req.params.id;
    const collectionId = Number(rawId);
    if (!Number.isInteger(collectionId) || collectionId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор коллекции.' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description : '';

    if (!name) {
      return res.status(400).json({ error: 'Укажите название коллекции.' });
    }

    const existing = await pool.query(
      `SELECT t.project_id
         FROM collections c
         JOIN tasks t ON t.id = c.task_id
        WHERE c.id = $1`,
      [collectionId],
    );
    const projectId = existing.rows[0]?.project_id;
    if (projectId == null) {
      return res.status(404).json({ error: 'Коллекция не найдена.' });
    }

    const project = await fetchProjectDatesIfVisible(projectId, req.userId, roleName);
    if (!project) {
      return res.status(404).json({ error: 'Коллекция не найдена.' });
    }

    const upd = await pool.query(
      `UPDATE collections
          SET name = $1,
              description = $2,
              last_edited_at = NOW()
        WHERE id = $3
       RETURNING id, task_id, name, description, created_at, last_edited_at`,
      [name, description, collectionId],
    );

    const row = upd.rows[0];
    res.json({
      collection: {
        id: row.id,
        taskId: row.task_id,
        projectId,
        name: row.name,
        description: row.description ?? '',
        createdAt: row.created_at,
        lastEditedAt: row.last_edited_at,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось обновить коллекцию.' });
  }
});

export default router;
