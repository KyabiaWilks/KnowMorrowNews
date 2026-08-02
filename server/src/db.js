import fs from 'node:fs';
import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

const SYSTEM_EVIDENCE_TAGS = [
  {
    id: 'tag_evidence_detailed',
    label: 'Detailed evidence',
    color: '#b56a3c',
    description: 'The listing includes detailed supporting evidence.',
  },
  {
    id: 'tag_evidence_none',
    label: 'No detailed evidence',
    color: '#8a7568',
    description: 'The listing does not include detailed supporting evidence.',
  },
];

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
  eventVotes: [],
  transactions: [],
  auditLog: [],
  notifications: [],
};

function ensureSystemEvidenceTags(state) {
  const aliases = new Map([
    ['有详细证据', 'Detailed evidence'],
    ['没有详细证据', 'No detailed evidence'],
    ['Detailed evidence', 'Detailed evidence'],
    ['Detailed Evidenc', 'Detailed evidence'],
    ['No detailed evidence', 'No detailed evidence'],
  ]);
  let changed = false;

  for (const collection of [state.offers, state.requests]) {
    for (const item of collection) {
      if (!Array.isArray(item.tags)) continue;
      const migrated = [...new Set(item.tags.map((tag) => aliases.get(tag) || tag))];
      if (JSON.stringify(migrated) !== JSON.stringify(item.tags)) {
        item.tags = migrated;
        changed = true;
      }
    }
  }

  const existingTags = Array.isArray(state.tags) ? state.tags : [];
  const regularTags = existingTags.filter((tag) => !aliases.has(tag.label));
  const canonicalTags = SYSTEM_EVIDENCE_TAGS.map((definition) => {
    const previous = existingTags.find((tag) => aliases.get(tag.label) === definition.label);
    return {
      ...previous,
      ...definition,
      kind: 'system',
      createdBy: null,
      archived: false,
      createdAt: previous?.createdAt || new Date().toISOString(),
    };
  });
  const nextTags = [...canonicalTags, ...regularTags];
  if (JSON.stringify(nextTags) !== JSON.stringify(existingTags)) {
    state.tags = nextTags;
    changed = true;
  }
  return changed;
}

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
    if (ensureSystemEvidenceTags(loaded)) migrated = true;
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

  ensureSystemEvidenceTags(initial);
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
