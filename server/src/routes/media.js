import crypto from 'crypto';
import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { storageDir } from '../paths.js';

const router = express.Router();

const ROLES_ALL_PROJECTS = new Set(['Админ', 'Менеджер']);
const ROLES_CAN_MODIFY = new Set(['Админ', 'Менеджер', 'Исполнитель']);
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

function safeExtension(originalName) {
  const base = path.basename(originalName || '');
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot >= base.length - 1) return '';
  return base
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storageDir),
    filename: (_req, file, cb) => {
      const ext = safeExtension(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`);
    },
  }),
});

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

/** Возвращает строку медиа с контекстом (проект / задача / коллекция) или null при отсутствии доступа. */
async function fetchMediaRowById(id, userId, roleName) {
  const seeAll = ROLES_ALL_PROJECTS.has(roleName);
  const r = await pool.query(
    `SELECT m.id, m.collection_id, m.path, m.name, m.format, m.description,
            m.upload_at, m.status_id,
            sm.name AS status_name, c.name AS collection_name, c.task_id,
            t.name AS task_name, t.project_id, p.name AS project_name
       FROM media m
       JOIN collections c ON c.id = m.collection_id
       JOIN tasks t ON t.id = c.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN statuses_media sm ON sm.id = m.status_id
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
        })`,
    seeAll ? [id] : [id, userId],
  );
  return r.rows[0] ?? null;
}

function mapMediaRow(row) {
  return {
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
  };
}

/** Проект доступен редактору (как при POST коллекции). */
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

router.get('/media', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) {
      return res.status(401).json({ error: 'Пользователь не найден.' });
    }
    if (roleName === 'Клиент' || roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
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
        ORDER BY
          CASE sm.name
            WHEN 'Активный' THEN 1
            WHEN 'Архивный' THEN 2
            WHEN 'Удалённый' THEN 3
            ELSE 4
          END,
          m.upload_at DESC NULLS LAST, m.id DESC
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

router.post('/media', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error(err);
      return res.status(400).json({ error: 'Не удалось загрузить файл.' });
    }
    next();
  });
}, async (req, res) => {
  const savedPath = req.file?.path;

  async function removeSavedFile() {
    if (savedPath) await fs.unlink(savedPath).catch(() => {});
  }

  try {
    const roleName = await requireManagerOrAdmin(res, req.userId);
    if (!roleName) {
      await removeSavedFile();
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл для загрузки.' });
    }

    const collectionId = Number(req.body?.collectionId);
    const description =
      typeof req.body?.description === 'string' ? req.body.description : '';

    if (!Number.isInteger(collectionId) || collectionId < 1) {
      await removeSavedFile();
      return res.status(400).json({ error: 'Укажите корректную коллекцию.' });
    }

    const colRes = await pool.query(
      `SELECT c.id, t.project_id
         FROM collections c
         JOIN tasks t ON t.id = c.task_id
        WHERE c.id = $1`,
      [collectionId],
    );
    const colRow = colRes.rows[0];
    if (!colRow) {
      await removeSavedFile();
      return res.status(404).json({ error: 'Коллекция не найдена.' });
    }

    const projectVisible = await fetchProjectDatesIfVisible(
      colRow.project_id,
      req.userId,
      roleName,
    );
    if (!projectVisible) {
      await removeSavedFile();
      return res.status(404).json({ error: 'Коллекция не найдена.' });
    }

    const statusRes = await pool.query(`SELECT id FROM statuses_media WHERE name = $1 LIMIT 1`, [
      'Активный',
    ]);
    const statusId = statusRes.rows[0]?.id;
    if (statusId == null) {
      await removeSavedFile();
      return res.status(500).json({ error: 'Не удалось создать медиа.' });
    }

    const ext = safeExtension(req.file.originalname);
    const formatStr = ext || 'file';
    const displayName = path.basename(req.file.originalname || '').trim() || 'file';
    const publicPath = `/storage/${req.file.filename}`;

    let insertedId;
    try {
      const ins = await pool.query(
        `INSERT INTO media (path, name, format, description, upload_at, status_id, collection_id)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)
         RETURNING id`,
        [publicPath, displayName, formatStr, description, statusId, collectionId],
      );
      insertedId = ins.rows[0].id;
    } catch (insertErr) {
      console.error(insertErr);
      await removeSavedFile();
      return res.status(500).json({ error: 'Не удалось сохранить медиа.' });
    }

    const detail = await pool.query(
      `SELECT m.id,
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
        WHERE m.id = $1`,
      [insertedId],
    );

    const row = detail.rows[0];
    if (!row) {
      return res.status(500).json({ error: 'Не удалось сохранить медиа.' });
    }

    res.status(201).json({
      media: {
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
      },
    });
  } catch (err) {
    console.error(err);
    await removeSavedFile();
    res.status(500).json({ error: 'Не удалось сохранить медиа.' });
  }
});

// GET /api/media/:id
router.get('/media/:id', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) return res.status(401).json({ error: 'Пользователь не найден.' });
    if (roleName === 'Клиент' || roleName === 'Внешний подрядчик') {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
    }

    const row = await fetchMediaRowById(id, req.userId, roleName);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено.' });

    res.json({ media: mapMediaRow(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось загрузить медиа.' });
  }
});

// PATCH /api/media/:id — обновить описание (Менеджер, Админ, Исполнитель)
router.patch('/media/:id', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) return res.status(401).json({ error: 'Пользователь не найден.' });
    if (!ROLES_CAN_MODIFY.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
    }

    const row = await fetchMediaRowById(id, req.userId, roleName);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено.' });

    const description =
      typeof req.body?.description === 'string' ? req.body.description : row.description ?? '';

    await pool.query(`UPDATE media SET description = $1 WHERE id = $2`, [description, id]);

    const updated = await fetchMediaRowById(id, req.userId, roleName);
    res.json({ media: mapMediaRow(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось обновить медиа.' });
  }
});

// DELETE /api/media/:id — soft-delete (Менеджер, Админ, Исполнитель)
router.delete('/media/:id', requireAuth, async (req, res) => {
  try {
    const roleName = await fetchRoleNameByUserId(pool, req.userId);
    if (!roleName) return res.status(401).json({ error: 'Пользователь не найден.' });
    if (!ROLES_CAN_MODIFY.has(roleName)) {
      return res.status(403).json({ error: 'Недостаточно прав.' });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
    }

    const row = await fetchMediaRowById(id, req.userId, roleName);
    if (!row) return res.status(404).json({ error: 'Медиа не найдено.' });

    await pool.query(
      `UPDATE media
          SET status_id = (SELECT id FROM statuses_media WHERE name = 'Удалённый' LIMIT 1)
        WHERE id = $1`,
      [id],
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Не удалось удалить медиа.' });
  }
});

// POST /api/media/:id/replace — заменить файл (Менеджер, Админ)
router.post('/media/:id/replace', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error(err);
      return res.status(400).json({ error: 'Не удалось загрузить файл.' });
    }
    next();
  });
}, async (req, res) => {
  const savedPath = req.file?.path;

  async function removeSavedFile() {
    if (savedPath) await fs.unlink(savedPath).catch(() => {});
  }

  try {
    const roleName = await requireManagerOrAdmin(res, req.userId);
    if (!roleName) {
      await removeSavedFile();
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Выберите файл для загрузки.' });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      await removeSavedFile();
      return res.status(400).json({ error: 'Некорректный идентификатор медиа.' });
    }

    const oldRow = await fetchMediaRowById(id, req.userId, roleName);
    if (!oldRow) {
      await removeSavedFile();
      return res.status(404).json({ error: 'Медиа не найдено.' });
    }

    const [activeRes, archivedRes] = await Promise.all([
      pool.query(`SELECT id FROM statuses_media WHERE name = 'Активный' LIMIT 1`),
      pool.query(`SELECT id FROM statuses_media WHERE name = 'Архивный' LIMIT 1`),
    ]);
    const activeStatusId = activeRes.rows[0]?.id;
    const archivedStatusId = archivedRes.rows[0]?.id;
    if (!activeStatusId || !archivedStatusId) {
      await removeSavedFile();
      return res.status(500).json({ error: 'Не удалось заменить медиа.' });
    }

    const ext = safeExtension(req.file.originalname);
    const formatStr = ext || 'file';
    const displayName = path.basename(req.file.originalname || '').trim() || 'file';
    const publicPath = `/storage/${req.file.filename}`;

    const client = await pool.connect();
    let newId;
    try {
      await client.query('BEGIN');
      const ins = await client.query(
        `INSERT INTO media (path, name, format, description, upload_at, status_id, collection_id)
         VALUES ($1, $2, $3, $4, NOW(), $5, $6)
         RETURNING id`,
        [publicPath, displayName, formatStr, oldRow.description ?? '', activeStatusId, oldRow.collection_id],
      );
      newId = ins.rows[0].id;
      await client.query(`UPDATE media SET status_id = $1 WHERE id = $2`, [archivedStatusId, id]);
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      client.release();
      console.error(txErr);
      await removeSavedFile();
      return res.status(500).json({ error: 'Не удалось заменить медиа.' });
    }
    client.release();

    const newRow = await fetchMediaRowById(newId, req.userId, roleName);
    if (!newRow) return res.status(500).json({ error: 'Не удалось заменить медиа.' });

    res.status(201).json({ media: mapMediaRow(newRow) });
  } catch (err) {
    console.error(err);
    await removeSavedFile();
    res.status(500).json({ error: 'Не удалось заменить медиа.' });
  }
});

export default router;
