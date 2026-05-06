import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5432,
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
};

const targetDb = 'mox';
const initDate = process.env.INIT_DATE || '2026-05-01';

const ROLE_SEEDS = [
  ['Админ', 'подтверждение учётных записей, администрирование'],
  ['Менеджер', 'создание проектов, назначение исполнителей, клиентов'],
  ['Исполнитель', 'работа в определенных проектах'],
  ['Внешний подрядчик', 'исключительно загрузка'],
  ['Клиент', 'просмотр определенных проектов, комментирование'],
];

const STATUSES_USERS = ['На подтверждении', 'Активный', 'Отключён'];

const STATUSES_PROJECTS = [
  'Запланированный',
  'Активный',
  'Приостановленный',
  'Завершенный',
];

const STATUSES_TASKS = [
  'К выполнению',
  'В работе',
  'На проверке',
  'Выполнено',
  'Отменено',
];

const STATUSES_MEDIA = ['Активный', 'Удалённый', 'Архивный'];

async function seedReferenceData(client) {
  for (const [name, description] of ROLE_SEEDS) {
    await client.query(
      `INSERT INTO roles (name, description)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = $1)`,
      [name, description],
    );
  }

  const seedUniqueNames = async (table, names) => {
    for (const name of names) {
      await client.query(`INSERT INTO ${table} (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [
        name,
      ]);
    }
  };

  await seedUniqueNames('statuses_users', STATUSES_USERS);
  await seedUniqueNames('statuses_projects', STATUSES_PROJECTS);
  await seedUniqueNames('statuses_tasks', STATUSES_TASKS);
  await seedUniqueNames('statuses_media', STATUSES_MEDIA);
}

async function initDb() {
  const client = new Client({ ...dbConfig, database: 'postgres' });

  try {
    await client.connect();

    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);

    if (res.rowCount === 0) {
      console.log(`Database "${targetDb}" does not exist. Creating...`);
      await client.query(`CREATE DATABASE ${targetDb}`);
      console.log(`Database "${targetDb}" created.`);
    } else {
      console.log(`Database "${targetDb}" already exists.`);
    }
  } catch (err) {
    console.error('Error checking/creating database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }

  const moxClient = new Client({ ...dbConfig, database: targetDb });

  try {
    await moxClient.connect();
    console.log(`Connected to "${targetDb}" database. Creating tables...`);

    const queries = [
      `CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS statuses_users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )`,

      `CREATE TABLE IF NOT EXISTS statuses_projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )`,

      `CREATE TABLE IF NOT EXISTS statuses_tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )`,

      `CREATE TABLE IF NOT EXISTS statuses_media (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )`,

      `CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        registered_at TIMESTAMPTZ NOT NULL CHECK (registered_at >= '${initDate}'),
        status_id INTEGER NOT NULL REFERENCES statuses_users(id),
        role_id INTEGER NOT NULL REFERENCES roles(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_status_id ON users(status_id)`,
      `CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id)`,

      `CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        goal TEXT NOT NULL,
        start_date DATE NOT NULL CHECK (start_date >= '${initDate}'),
        end_date DATE NOT NULL CHECK (end_date > start_date),
        status_id INTEGER NOT NULL REFERENCES statuses_projects(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_projects_status_id ON projects(status_id)`,

      `CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline TIMESTAMPTZ NOT NULL CHECK (deadline >= '${initDate}'),
        role_id INTEGER NOT NULL REFERENCES roles(id),
        project_id INTEGER NOT NULL REFERENCES projects(id),
        status_id INTEGER NOT NULL REFERENCES statuses_tasks(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_role_id ON tasks(role_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON tasks(status_id)`,

      `CREATE TABLE IF NOT EXISTS collections (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL CHECK (created_at >= '${initDate}'),
        last_edited_at TIMESTAMPTZ NOT NULL CHECK (last_edited_at >= created_at),
        task_id INTEGER NOT NULL REFERENCES tasks(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_collections_task_id ON collections(task_id)`,

      `CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        format VARCHAR(10) NOT NULL,
        description TEXT,
        upload_at TIMESTAMPTZ NOT NULL CHECK (upload_at >= '${initDate}'),
        status_id INTEGER NOT NULL REFERENCES statuses_media(id),
        collection_id INTEGER NOT NULL REFERENCES collections(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_media_status_id ON media(status_id)`,
      `CREATE INDEX IF NOT EXISTS idx_media_collection_id ON media(collection_id)`,

      `CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL CHECK (created_at >= '${initDate}'),
        user_id INTEGER NOT NULL REFERENCES users(id),
        media_id INTEGER NOT NULL REFERENCES media(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_media_id ON comments(media_id)`,

      `CREATE TABLE IF NOT EXISTS user_project (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        project_id INTEGER NOT NULL REFERENCES projects(id),
        included_at TIMESTAMPTZ NOT NULL CHECK (included_at >= '${initDate}'),
        excluded_at TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS idx_user_project_user_id ON user_project(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_project_project_id ON user_project(project_id)`,
    ];

    for (const query of queries) {
      await moxClient.query(query);
    }

    console.log('Seeding roles and statuses...');
    await seedReferenceData(moxClient);

    console.log('All tables, indexes, and seed data applied successfully.');
  } catch (err) {
    console.error('Error creating tables or seeding:', err);
    process.exit(1);
  } finally {
    await moxClient.end();
  }
}

initDb();
