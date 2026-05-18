import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { storageDir } from '../paths.js';

const router = express.Router();

const LARGE_FILE_MIN_BYTES = 50 * 1024 * 1024;
const PENDING_STATUS = 'На подтверждении';
const ACTIVE_STATUS = 'Активный';
const DISABLED_STATUS = 'Отключён';
const ADMIN_ROLE = 'Админ';

function escapeIlikePattern(value) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function storageAbsoluteFromPublicPath(publicPath) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/storage/')) {
    return null;
  }
  const base = path.basename(publicPath);
  if (!base || base === '.' || base === '..') return null;
  return path.join(storageDir, base);
}

// --- Users ---

router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const qRaw = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const statusId = Number(req.query.statusId);
    const roleId = Number(req.query.roleId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const conditions = [];
    const params = [];
    let p = 1;

    if (qRaw) {
      const esc = escapeIlikePattern(qRaw);
      conditions.push(
        `(u.email ILIKE $${p} ESCAPE '\\' OR u.name ILIKE $${p} ESCAPE '\\')`,
      );
      params.push(`%${esc}%`);
      p += 1;
    }
    if (Number.isInteger(statusId) && statusId >= 1) {
      conditions.push(`u.status_id = $${p}`);
      params.push(statusId);
      p += 1;
    }
    if (Number.isInteger(roleId) && roleId >= 1) {
      conditions.push(`u.role_id = $${p}`);
      params.push(roleId);
      p += 1;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rolesRes, statusesRes, countRes, listRes] = await Promise.all([
      pool.query(`SELECT id, name FROM roles ORDER BY id`),
      pool.query(`SELECT id, name FROM statuses_users ORDER BY id`),
      pool.query(`SELECT COUNT(*)::int AS c FROM users u ${where}`, params),
      pool.query(
        `SELECT u.id, u.name, u.email, u.registered_at,
                u.role_id, r.name AS role_name,
                u.status_id, su.name AS status_name
           FROM users u
           JOIN roles r ON r.id = u.role_id
           JOIN statuses_users su ON su.id = u.status_id
           ${where}
           ORDER BY u.id DESC
           LIMIT $${p} OFFSET $${p + 1}`,
        [...params, limit, offset],
      ),
    ]);

    res.json({
      users: listRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        registeredAt: row.registered_at,
        roleId: row.role_id,
        roleName: row.role_name,
        statusId: row.status_id,
        statusName: row.status_name,
      })),
      total: countRes.rows[0]?.c ?? 0,
      roles: rolesRes.rows,
      userStatuses: statusesRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить пользователей.' });
  }
});

router.get('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор.' });
  }
  try {
    const userRes = await pool.query(
      `SELECT u.id, u.name, u.email, u.registered_at,
              u.role_id, r.name AS role_name,
              u.status_id, su.name AS status_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN statuses_users su ON su.id = u.status_id
        WHERE u.id = $1`,
      [id],
    );
    const u = userRes.rows[0];
    if (!u) {
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }

    const projRes = await pool.query(
      `SELECT p.id, p.name, up.included_at
         FROM user_project up
         JOIN projects p ON p.id = up.project_id
        WHERE up.user_id = $1 AND up.excluded_at IS NULL
        ORDER BY p.name`,
      [id],
    );

    res.json({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        registeredAt: u.registered_at,
        roleId: u.role_id,
        roleName: u.role_name,
        statusId: u.status_id,
        statusName: u.status_name,
      },
      projects: projRes.rows.map((row) => ({
        id: row.id,
        name: row.name,
        includedAt: row.included_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить пользователя.' });
  }
});

router.patch('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор.' });
  }

  const body = req.body ?? {};
  const nextRoleId = body.roleId !== undefined ? Number(body.roleId) : null;
  const nextStatusId = body.statusId !== undefined ? Number(body.statusId) : null;

  if (nextRoleId === null && nextStatusId === null) {
    return res.status(400).json({ error: 'Укажите roleId и/или statusId.' });
  }
  if (nextRoleId !== null && (!Number.isInteger(nextRoleId) || nextRoleId < 1)) {
    return res.status(400).json({ error: 'Некорректный roleId.' });
  }
  if (nextStatusId !== null && (!Number.isInteger(nextStatusId) || nextStatusId < 1)) {
    return res.status(400).json({ error: 'Некорректный statusId.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cur = await client.query(
      `SELECT u.id, u.role_id, u.status_id, r.name AS role_name, su.name AS status_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN statuses_users su ON su.id = u.status_id
        WHERE u.id = $1
        FOR UPDATE`,
      [id],
    );
    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }
    const row = cur.rows[0];

    if (row.id === req.userId) {
      if (nextStatusId !== null) {
        const st = await client.query(`SELECT name FROM statuses_users WHERE id = $1`, [
          nextStatusId,
        ]);
        const sn = st.rows[0]?.name;
        if (sn === DISABLED_STATUS || sn === PENDING_STATUS) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Нельзя установить себе этот статус.' });
        }
      }
      if (nextRoleId !== null) {
        const rr = await client.query(`SELECT name FROM roles WHERE id = $1`, [nextRoleId]);
        const rn = rr.rows[0]?.name;
        if (rn !== ADMIN_ROLE && row.role_name === ADMIN_ROLE) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Нельзя снять с себя роль администратора.' });
        }
      }
    }

    let newRoleName = row.role_name;
    let newStatusName = row.status_name;
    let finalRoleId = row.role_id;
    let finalStatusId = row.status_id;

    if (nextRoleId !== null) {
      const rr = await client.query(`SELECT name FROM roles WHERE id = $1`, [nextRoleId]);
      if (rr.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Роль не найдена.' });
      }
      newRoleName = rr.rows[0].name;
      finalRoleId = nextRoleId;

      if (row.role_name === ADMIN_ROLE && newRoleName !== ADMIN_ROLE) {
        const ac = await client.query(
          `SELECT COUNT(*)::int AS c
             FROM users u
             JOIN roles r ON r.id = u.role_id
             JOIN statuses_users su ON su.id = u.status_id
            WHERE r.name = $1 AND su.name = $2 AND u.id <> $3`,
          [ADMIN_ROLE, ACTIVE_STATUS, id],
        );
        if ((ac.rows[0]?.c ?? 0) < 1) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Невозможно снять роль администратора: должен остаться хотя бы один активный администратор.',
          });
        }
      }
    }

    if (nextStatusId !== null) {
      const sr = await client.query(`SELECT name FROM statuses_users WHERE id = $1`, [
        nextStatusId,
      ]);
      if (sr.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Статус не найден.' });
      }
      newStatusName = sr.rows[0].name;
      finalStatusId = nextStatusId;
    }

    if (
      row.role_name === ADMIN_ROLE &&
      newRoleName === ADMIN_ROLE &&
      newStatusName !== ACTIVE_STATUS
    ) {
      const ac = await client.query(
        `SELECT COUNT(*)::int AS c
           FROM users u
           JOIN roles r ON r.id = u.role_id
           JOIN statuses_users su ON su.id = u.status_id
          WHERE r.name = $1 AND su.name = $2 AND u.id <> $3`,
        [ADMIN_ROLE, ACTIVE_STATUS, id],
      );
      if ((ac.rows[0]?.c ?? 0) < 1) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Должен остаться хотя бы один активный администратор.',
        });
      }
    }

    await client.query(
      `UPDATE users SET role_id = $1, status_id = $2 WHERE id = $3`,
      [finalRoleId, finalStatusId, id],
    );
    await client.query('COMMIT');

    res.json({
      user: {
        id,
        roleId: finalRoleId,
        roleName: newRoleName,
        statusId: finalStatusId,
        statusName: newStatusName,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Не удалось обновить пользователя.' });
  } finally {
    client.release();
  }
});

router.post('/admin/users/:id/approve', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор.' });
  }
  try {
    const activeIdRes = await pool.query(
      `SELECT id FROM statuses_users WHERE name = $1 LIMIT 1`,
      [ACTIVE_STATUS],
    );
    if (activeIdRes.rowCount === 0) {
      return res.status(500).json({ error: 'Справочник статусов повреждён.' });
    }
    const activeId = activeIdRes.rows[0].id;

    const r = await pool.query(
      `UPDATE users u
          SET status_id = $1
        FROM statuses_users su
       WHERE u.id = $2 AND u.status_id = su.id AND su.name = $3
       RETURNING u.id`,
      [activeId, id, PENDING_STATUS],
    );
    if (r.rowCount === 0) {
      const ex = await pool.query(`SELECT 1 FROM users WHERE id =  $1`, [id]);
      if (ex.rowCount === 0) {
        return res.status(404).json({ error: 'Пользователь не найден.' });
      }
      return res.status(400).json({ error: 'Пользователь не на подтверждении.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось активировать пользователя.' });
  }
});

router.delete('/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор.' });
  }
  if (id === req.userId) {
    return res.status(400).json({ error: 'Нельзя удалить свою учётную запись.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `SELECT u.id, su.name AS status_name
         FROM users u
         JOIN statuses_users su ON su.id = u.status_id
        WHERE u.id = $1
        FOR UPDATE`,
      [id],
    );
    if (u.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Пользователь не найден.' });
    }
    if (u.rows[0].status_name !== PENDING_STATUS) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Удаление допустимо только для учётных записей на подтверждении.' });
    }

    const up = await client.query(`SELECT 1 FROM user_project WHERE user_id = $1 LIMIT 1`, [id]);
    if (up.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'У пользователя есть участие в проектах; удаление невозможно.' });
    }
    const cm = await client.query(`SELECT 1 FROM comments WHERE user_id = $1 LIMIT 1`, [id]);
    if (cm.rowCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'У пользователя есть комментарии; удаление невозможно.' });
    }

    await client.query(`DELETE FROM users WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить пользователя.' });
  } finally {
    client.release();
  }
});

// --- Overview ---

router.get('/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [
      userByStatus,
      projectCount,
      taskCount,
      collectionCount,
      mediaByStatus,
    ] = await Promise.all([
      pool.query(
        `SELECT su.name, COUNT(u.id)::int AS count
           FROM statuses_users su
           LEFT JOIN users u ON u.status_id = su.id
          GROUP BY su.id, su.name
          ORDER BY su.id`,
      ),
      pool.query(`SELECT COUNT(*)::int AS c FROM projects`),
      pool.query(`SELECT COUNT(*)::int AS c FROM tasks`),
      pool.query(`SELECT COUNT(*)::int AS c FROM collections`),
      pool.query(
        `SELECT sm.name, COUNT(m.id)::int AS count
           FROM statuses_media sm
           LEFT JOIN media m ON m.status_id = sm.id
          GROUP BY sm.id, sm.name
          ORDER BY sm.id`,
      ),
    ]);

    res.json({
      usersByStatus: userByStatus.rows.map((r) => ({ statusName: r.name, count: r.count })),
      projectCount: projectCount.rows[0]?.c ?? 0,
      taskCount: taskCount.rows[0]?.c ?? 0,
      collectionCount: collectionCount.rows[0]?.c ?? 0,
      mediaByStatus: mediaByStatus.rows.map((r) => ({ statusName: r.name, count: r.count })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить обзор.' });
  }
});

// --- Issues ---

router.get('/admin/issues', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [
      emptyProjects,
      pendingUsers,
      tasksNoCollections,
      collectionsNoMedia,
    ] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name
           FROM projects p
          WHERE NOT EXISTS (
            SELECT 1 FROM user_project up
             WHERE up.project_id = p.id AND up.excluded_at IS NULL
          )
          ORDER BY p.id
          LIMIT 50`,
      ),
      pool.query(
        `SELECT u.id, u.email, u.name, r.name AS role_name
           FROM users u
           JOIN roles r ON r.id = u.role_id
           JOIN statuses_users su ON su.id = u.status_id
          WHERE su.name = $1
          ORDER BY u.id
          LIMIT 100`,
        [PENDING_STATUS],
      ),
      pool.query(
        `SELECT t.id, t.name, p.id AS project_id, p.name AS project_name
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
          WHERE NOT EXISTS (SELECT 1 FROM collections c WHERE c.task_id = t.id)
          ORDER BY t.id
          LIMIT 50`,
      ),
      pool.query(
        `SELECT c.id, c.name, t.id AS task_id, t.name AS task_name, p.id AS project_id, p.name AS project_name
           FROM collections c
           JOIN tasks t ON t.id = c.task_id
           JOIN projects p ON p.id = t.project_id
          WHERE NOT EXISTS (SELECT 1 FROM media m WHERE m.collection_id = c.id)
          ORDER BY c.id
          LIMIT 50`,
      ),
    ]);

    res.json({
      projectsWithoutMembers: emptyProjects.rows.map((r) => ({
        id: r.id,
        name: r.name,
      })),
      pendingUsers: pendingUsers.rows.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        roleName: r.role_name,
      })),
      tasksWithoutCollections: tasksNoCollections.rows.map((r) => ({
        id: r.id,
        name: r.name,
        projectId: r.project_id,
        projectName: r.project_name,
      })),
      collectionsWithoutMedia: collectionsNoMedia.rows.map((r) => ({
        id: r.id,
        name: r.name,
        taskId: r.task_id,
        taskName: r.task_name,
        projectId: r.project_id,
        projectName: r.project_name,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить проблемные места.' });
  }
});

// --- Large files in storage ---

router.get('/admin/storage/large-files', requireAuth, requireAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  try {
    const entries = await fs.readdir(storageDir, { withFileTypes: true });
    const statd = [];
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      const full = path.join(storageDir, ent.name);
      const st = await fs.stat(full);
      if (st.size > LARGE_FILE_MIN_BYTES) {
        statd.push({
          fileName: ent.name,
          sizeBytes: st.size,
          publicPath: `/storage/${ent.name}`,
        });
      }
    }
    statd.sort((a, b) => b.sizeBytes - a.sizeBytes);
    const sliced = statd.slice(0, limit);

    const files = [];
    for (const item of sliced) {
      const mRes = await pool.query(
        `SELECT m.id, m.path, m.name, m.format,
                sm.name AS status_name,
                p.id AS project_id, p.name AS project_name,
                t.id AS task_id, t.name AS task_name,
                c.id AS collection_id, c.name AS collection_name
           FROM media m
           JOIN statuses_media sm ON sm.id = m.status_id
           JOIN collections c ON c.id = m.collection_id
           JOIN tasks t ON t.id = c.task_id
           JOIN projects p ON p.id = t.project_id
          WHERE m.path = $1
          LIMIT 1`,
        [item.publicPath],
      );
      const m = mRes.rows[0];
      files.push({
        ...item,
        orphan: !m,
        media: m
          ? {
              id: m.id,
              path: m.path,
              name: m.name,
              format: m.format,
              statusName: m.status_name,
              projectId: m.project_id,
              projectName: m.project_name,
              taskId: m.task_id,
              taskName: m.task_name,
              collectionId: m.collection_id,
              collectionName: m.collection_name,
            }
          : null,
      });
    }

    res.json({
      minSizeBytes: LARGE_FILE_MIN_BYTES,
      files,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({ minSizeBytes: LARGE_FILE_MIN_BYTES, files: [] });
    }
    console.error(err);
    res.status(500).json({ error: 'Не удалось просканировать хранилище.' });
  }
});

router.delete('/admin/media/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query(`SELECT id, path FROM media WHERE id = $1 FOR UPDATE`, [id]);
    if (mRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Медиа не найдено.' });
    }
    const publicPath = mRes.rows[0].path;
    const abs = storageAbsoluteFromPublicPath(publicPath);

    await client.query(`DELETE FROM comments WHERE media_id = $1`, [id]);
    await client.query(`DELETE FROM media WHERE id = $1`, [id]);
    await client.query('COMMIT');

    if (abs) {
      await fs.unlink(abs).catch((e) => {
        console.warn('admin hard-delete: file missing or unlink failed', publicPath, e?.message);
      });
    }

    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить медиа.' });
  } finally {
    client.release();
  }
});

export default router;