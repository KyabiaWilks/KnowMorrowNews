import fs from 'node:fs';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

const EMPTY = {
  meta: { version: 1, seededAt: null },
  users: [],
  profiles: [],
  news: [],
  journalists: [],
  tags: [],
  offers: [],
  requests: [],
  purchases: [],
  submissions: [],
  evidence: [],
  reports: [],
  arbitrations: [],
  arbitrationJudgments: [],
  tomatoes: [],
  transactions: [],
  auditLog: [],
  notifications: [],
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting the API.');
}

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

async function initialize() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id smallint PRIMARY KEY CHECK (id = 1),
      payload jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const result = await pool.query('SELECT payload FROM app_state WHERE id = 1');
  if (result.rows[0]) {
    const loaded = { ...structuredClone(EMPTY), ...result.rows[0].payload };
    let migrated = false;
    for (const user of loaded.users) {
      if (user.discordId && user.discordUsername && user.username !== user.discordUsername) {
        user.username = user.discordUsername;
        migrated = true;
      }
    }
    if (migrated) {
      await pool.query('UPDATE app_state SET payload = $1::jsonb, updated_at = now() WHERE id = 1', [JSON.stringify(loaded)]);
      console.log('[db] Migrated Discord user IDs to full Discord usernames.');
    }
    return loaded;
  }

  let initial = structuredClone(EMPTY);
  if (fs.existsSync(config.dataFile)) {
    try {
      initial = { ...initial, ...JSON.parse(fs.readFileSync(config.dataFile, 'utf8')) };
      console.log('[db] Imported legacy data/db.json into PostgreSQL.');
    } catch (error) {
      console.error('[db] Could not import legacy data/db.json:', error.message);
    }
  }

  await pool.query(
    `INSERT INTO app_state (id, payload)
     VALUES (1, $1::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [JSON.stringify(initial)],
  );
  return initial;
}

export const db = await initialize();

let pending = null;
let writeQueue = Promise.resolve();

function enqueueWrite() {
  const snapshot = JSON.stringify(db);
  writeQueue = writeQueue
    .then(() => pool.query(
      `INSERT INTO app_state (id, payload, updated_at)
       VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE
       SET payload = EXCLUDED.payload, updated_at = now()`,
      [snapshot],
    ))
    .catch((error) => {
      console.error('[db] PostgreSQL write failed:', error);
    });
  return writeQueue;
}

export function save(immediate = false) {
  if (immediate) {
    if (pending) clearTimeout(pending);
    pending = null;
    return enqueueWrite();
  }

  if (!pending) {
    pending = setTimeout(() => {
      pending = null;
      enqueueWrite();
    }, 120);
  }
  return writeQueue;
}

export function replaceAll(next) {
  for (const key of Object.keys(db)) delete db[key];
  Object.assign(db, next);
  return save(true);
}

export function isEmpty() {
  return db.users.length === 0 && db.news.length === 0;
}

export async function closeDatabase() {
  if (pending) {
    clearTimeout(pending);
    pending = null;
    await enqueueWrite();
  }
  await writeQueue;
  await pool.end();
}
