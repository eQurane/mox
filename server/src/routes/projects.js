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

/** Id активных участников проекта (включая любую роль), для формы и PATCH. */
async function fetchActiveMemberUserIds(db, projectId) {
  const r = await db.query(
    `SELECT user_id FROM user_project
     WHERE project_id = $1 AND excluded_at IS NULL
     ORDER BY user_id`,
    [projectId],
  );
  return r.rows.map((row) => row.user_id);
}

/** Id пользователей, которые могут отображаться в чекбоксах формы (как в create-options). */
async function fetchAssignableUserIdsForEditor(db, editorUserId, roleName) {
  const assignableRoles =
    roleName === 'Админ'
      ? ASSIGNABLE_ROLE_NAMES.Админ
      : ASSIGNABLE_ROLE_NAMES.Менеджер;
  const roleNamesArr = [...assignableRoles];
  const usersResult = await db.query(
    `SELECT u.id
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN statuses_users su ON su.id = u.status_id
      WHERE su.name = $1 AND r.name = ANY($2::text[]) AND u.id <> $3`,
    [ACTIVE_USER_STATUS, roleNamesArr, editorUserId],
  );
  return new Set(usersResult.rows.map((row) => row.id));
}

/**
 * Общая валидация тела создания/обновления проекта.
 * @returns {{ ok: true, name, goal, startDate, endDate, statusId, participantIdsUnique, resolvedStatusName, assignableRoles } | { ok: false, status: number, error: string }}
 */
async function validateProjectWritePayload(pool, body, editorRoleName, reqUserId) {
  const assignableRoles =
    editorRoleName === 'Админ'
      ? ASSIGNABLE_ROLE_NAMES.Админ
      : ASSIGNABLE_ROLE_NAMES.Менеджер;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
  const startDate = typeof body.startDate === 'string' ? body.startDate.trim() : '';
  const endDate = typeof body.endDate === 'string' ? body.endDate.trim() : '';
  const statusId = Number(body.statusId);
  let rawParticipantIds = body.participantIds;
  if (rawParticipantIds == null) rawParticipantIds = [];
  if (!Array.isArray(rawParticipantIds)) {
    return { ok: false, status: 400, error: 'Список участников должен быть массивом идентификаторов.' };
  }

  if (!name || !goal) {
    return { ok: false, status: 400, error: 'Укажите название и цель проекта.' };
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { ok: false, status: 400, error: 'Даты должны быть в формате ГГГГ-ММ-ДД.' };
  }
  if (endDate <= startDate) {
    return { ok: false, status: 400, error: 'Дата окончания должна быть позже даты начала.' };
  }

  const floor = initDateFloor();
  if (startDate < floor) {
    return { ok: false, status: 400, error: `Дата начала не может быть раньше ${floor}.` };
  }

  if (!Number.isInteger(statusId) || statusId < 1) {
    return { ok: false, status: 400, error: 'Укажите статус проекта из списка.' };
  }

  const statusRow = await pool.query(`SELECT id, name FROM statuses_projects WHERE id = $1`, [statusId]);
  const resolvedStatusName = statusRow.rows[0]?.name;
  if (!resolvedStatusName) {
    return { ok: false, status: 400, error: 'Выберите корректный статус проекта.' };
  }

  const numericParticipantIds = [];
  for (const raw of rawParticipantIds) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, status: 400, error: 'Некорректный идентификатор участника.' };
    }
    numericParticipantIds.push(n);
  }

  const participantIdsUnique = [...new Set(numericParticipantIds)].filter((id) => id !== reqUserId);

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
      return { ok: false, status: 400, error: 'Один из выбранных пользователей недоступен или не найден.' };
    }

    for (const row of pv.rows) {
      if (!assignableRoles.has(row.role_name)) {
        return {
          ok: false,
          status: 403,
          error: 'Вы не можете добавить в проект пользователя с этой ролью.',
        };
      }
    }
  }

  return {
    ok: true,
    name,
    goal,
    startDate,
    endDate,
    statusId,
    participantIdsUnique,
    resolvedStatusName,
    assignableRoles,
  };
}

router.get('/projects/create-options', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    if (roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
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
    if (roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
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
    if (roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const projectSql = `
      SELECT p.id,
             p.name,
             p.goal,
             p.start_date,
             p.end_date,
             p.status_id,
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

    const memberUserIds = await fetchActiveMemberUserIds(pool, projectId);

    const project = {
      id: prow.id,
      name: prow.name,
      goal: prow.goal,
      startDate: prow.start_date,
      endDate: prow.end_date,
      statusId: prow.status_id,
      statusName: prow.status_name,
      coverPath: prow.cover_path,
      memberUserIds,
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
    if (roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }
    if (!ROLES_ALL_PROJECTS.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав для создания проекта.' });
    }

    const validated = await validateProjectWritePayload(pool, req.body ?? {}, roleName, req.userId);
    if (!validated.ok) {
      return res.status(validated.status).json({ error: validated.error });
    }

    const {
      name,
      goal,
      startDate,
      endDate,
      statusId,
      participantIdsUnique,
      resolvedStatusName,
    } = validated;

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

router.patch('/projects/:id', requireAuth, async (req, res) => {
  let client;
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
    if (!ROLES_ALL_PROJECTS.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const seeAll = ROLES_ALL_PROJECTS.has(roleName);

    const access = await pool.query(
      `SELECT p.id
         FROM projects p
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
          )`,
      [projectId, seeAll, req.userId],
    );
    if (!access.rows[0]) {
      return res.status(404).json({ error: 'Проект не найден.' });
    }

    const validated = await validateProjectWritePayload(pool, req.body ?? {}, roleName, req.userId);
    if (!validated.ok) {
      return res.status(validated.status).json({ error: validated.error });
    }

    const {
      name,
      goal,
      startDate,
      endDate,
      statusId,
      participantIdsUnique,
      resolvedStatusName,
    } = validated;

    const assignableSelectableIds = await fetchAssignableUserIdsForEditor(pool, req.userId, roleName);

    client = await pool.connect();
    await client.query('BEGIN');

    const currentActive = await fetchActiveMemberUserIds(client, projectId);
    const currentActiveSet = new Set(currentActive);

    const finalMemberIds = new Set([req.userId, ...participantIdsUnique]);
    for (const uid of currentActive) {
      if (!assignableSelectableIds.has(uid)) {
        finalMemberIds.add(uid);
      }
    }

    const toRemove = currentActive.filter((uid) => !finalMemberIds.has(uid));
    const toAdd = [...finalMemberIds].filter((uid) => !currentActiveSet.has(uid));

    const updProject = await client.query(
      `UPDATE projects
         SET name = $1,
             goal = $2,
             start_date = $3::date,
             end_date = $4::date,
             status_id = $5
       WHERE id = $6
       RETURNING id, name, goal, start_date, end_date`,
      [name, goal, startDate, endDate, statusId, projectId],
    );
    const projRow = updProject.rows[0];

    for (const uid of toRemove) {
      await client.query(
        `UPDATE user_project
            SET excluded_at = NOW()
          WHERE project_id = $1
            AND user_id = $2
            AND excluded_at IS NULL`,
        [projectId, uid],
      );
    }

    for (const uid of toAdd) {
      const reactivate = await client.query(
        `UPDATE user_project
            SET excluded_at = NULL
          WHERE id = (
                  SELECT id
                    FROM user_project
                   WHERE project_id = $1
                     AND user_id = $2
                     AND excluded_at IS NOT NULL
                   ORDER BY id DESC
                   LIMIT 1
                )
          RETURNING id`,
        [projectId, uid],
      );
      if (reactivate.rowCount === 0) {
        await client.query(
          `INSERT INTO user_project (user_id, project_id, included_at, excluded_at)
           VALUES ($1, $2, NOW(), NULL)`,
          [uid, projectId],
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      project: {
        id: projRow.id,
        name: projRow.name,
        goal: projRow.goal,
        startDate: projRow.start_date,
        endDate: projRow.end_date,
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
    res.status(500).json({ error: 'Не удалось сохранить проект.' });
  } finally {
    if (client) client.release();
  }
});

export default router;
