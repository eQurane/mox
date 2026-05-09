import express from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const initDateFloor = () => process.env.INIT_DATE || '2026-05-01';
const ACTIVE_USER_STATUS = 'Активный';

/** Роли пользователей, доступные для добавления в проект создателем с данной ролью. */
const ASSIGNABLE_ROLE_NAMES = {
  Админ: new Set(['Исполнитель', 'Клиент', 'Менеджер']),
  Менеджер: new Set(['Исполнитель', 'Клиент']),
};

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

router.get('/projects/create-options', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    if (!ROLES_ALL_PROJECTS.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const allowedRoles =
      roleName === 'Админ'
        ? ASSIGNABLE_ROLE_NAMES.Админ
        : ASSIGNABLE_ROLE_NAMES.Менеджер;
    const roleNamesArr = [...allowedRoles];

    const statusesResult = await pool.query(
      `SELECT id, name FROM statuses_projects ORDER BY id`,
    );

    const usersResult = await pool.query(
      `SELECT u.id, u.name, u.email, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN statuses_users su ON su.id = u.status_id
       WHERE su.name = $1 AND r.name = ANY($2::text[]) AND u.id <> $3
       ORDER BY r.name, u.name`,
      [ACTIVE_USER_STATUS, roleNamesArr, req.userId],
    );

    res.json({
      statuses: statusesResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
      })),
      assignableUsers: usersResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        roleName: row.role_name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить данные формы.' });
  }
});

router.get('/projects', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
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

router.get('/projects/:id', requireAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    const projectId = Number(rawId);
    if (!Number.isInteger(projectId) || projectId < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор проекта.' });
    }

    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const projectSql = `
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
      WHERE p.id = $1
        AND (
          $2 IS TRUE
          OR EXISTS (
            SELECT 1
              FROM user_project up
             WHERE up.project_id = p.id
               AND up.user_id = $3
               AND up.excluded_at IS NULL
          )
        )
    `;

    const projectResult = await pool.query(projectSql, [projectId, seeAll, req.userId]);
    const prow = projectResult.rows[0];
    if (!prow) {
      return res.status(404).json({ error: 'Проект не найден.' });
    }

    const project = {
      id: prow.id,
      name: prow.name,
      goal: prow.goal,
      startDate: prow.start_date,
      endDate: prow.end_date,
      statusName: prow.status_name,
      coverPath: prow.cover_path,
    };

    const tasksResult = await pool.query(
      `SELECT t.id,
              t.name,
              t.description,
              t.deadline,
              r.name AS role_name,
              st.name AS status_name
         FROM tasks t
         JOIN roles r ON r.id = t.role_id
         JOIN statuses_tasks st ON st.id = t.status_id
        WHERE t.project_id = $1
        ORDER BY t.id ASC`,
      [projectId],
    );

    const tasks = tasksResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      deadline: row.deadline,
      roleName: row.role_name,
      statusName: row.status_name,
    }));

    const collectionsResult = await pool.query(
      `SELECT c.id,
              c.task_id,
              c.name,
              c.description,
              c.created_at,
              c.last_edited_at
         FROM collections c
         JOIN tasks t ON t.id = c.task_id
        WHERE t.project_id = $1
        ORDER BY c.id ASC`,
      [projectId],
    );

    const collections = collectionsResult.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      name: row.name,
      description: row.description ?? '',
      createdAt: row.created_at,
      lastEditedAt: row.last_edited_at,
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
         JOIN tasks t ON t.id = c.task_id
        WHERE t.project_id = $1
        ORDER BY m.upload_at DESC`,
      [projectId],
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

    res.json({ project, tasks, collections, media });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить проект.' });
  }
});

router.post('/projects', requireAuth, async (req, res) => {
  let client;
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    if (!ROLES_ALL_PROJECTS.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав для создания проекта.' });
    }

    const assignableRoles =
      roleName === 'Админ'
        ? ASSIGNABLE_ROLE_NAMES.Админ
        : ASSIGNABLE_ROLE_NAMES.Менеджер;

    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
    const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
    const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : '';
    const statusId = Number(body.statusId);
    let rawParticipantIds = body.participantIds;
    if (rawParticipantIds == null) rawParticipantIds = [];
    if (!Array.isArray(rawParticipantIds)) {
      return res.status(400).json({ error: 'Список участников должен быть массивом идентификаторов.' });
    }

    if (!name || !goal) {
      return res.status(400).json({ error: 'Укажите название и цель проекта.' });
    }
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return res.status(400).json({ error: 'Даты должны быть в формате ГГГГ-ММ-ДД.' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'Дата окончания должна быть позже даты начала.' });
    }

    const floor = initDateFloor();
    if (startDate < floor) {
      return res.status(400).json({ error: `Дата начала не может быть раньше ${floor}.` });
    }

    if (!Number.isInteger(statusId) || statusId < 1) {
      return res.status(400).json({ error: 'Укажите статус проекта из списка.' });
    }

    const statusRow = await pool.query(`SELECT id, name FROM statuses_projects WHERE id = $1`, [statusId]);
    const resolvedStatusName = statusRow.rows[0]?.name;
    if (!resolvedStatusName) {
      return res.status(400).json({ error: 'Выберите корректный статус проекта.' });
    }

    const numericParticipantIds = [];
    for (const raw of rawParticipantIds) {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'Некорректный идентификатор участника.' });
      }
      numericParticipantIds.push(n);
    }

    const participantIdsUnique = [...new Set(numericParticipantIds)].filter((id) => id !== req.userId);

    if (participantIdsUnique.length > 0) {
      const pv = await pool.query(
        `SELECT u.id, r.name AS role_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN statuses_users su ON su.id = u.status_id
         WHERE u.id = ANY($1::int[])
           AND su.name = $2`,
        [participantIdsUnique, ACTIVE_USER_STATUS],
      );

      if (pv.rows.length !== participantIdsUnique.length) {
        return res.status(400).json({ error: 'Один из выбранных пользователей недоступен или не найден.' });
      }

      for (const row of pv.rows) {
        if (!assignableRoles.has(row.role_name)) {
          return res.status(403).json({
            error: 'Вы не можете добавить в проект пользователя с этой ролью.',
          });
        }
      }
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const insert = await client.query(
      `INSERT INTO projects (name, goal, start_date, end_date, status_id)
       VALUES ($1, $2, $3::date, $4::date, $5)
       RETURNING id, name, goal, start_date, end_date`,
      [name, goal, startDate, endDate, statusId],
    );

    const row = insert.rows[0];

    const memberIds = [...new Set([req.userId, ...participantIdsUnique])];

    for (const uid of memberIds) {
      await client.query(
        `INSERT INTO user_project (user_id, project_id, included_at, excluded_at)
         VALUES ($1, $2, NOW(), NULL)`,
        [uid, row.id],
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      project: {
        id: row.id,
        name: row.name,
        goal: row.goal,
        startDate: row.start_date,
        endDate: row.end_date,
        statusName: resolvedStatusName,
      },
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* noop */
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Не удалось создать проект.' });
  } finally {
    if (client) client.release();
  }
});

export default router;
