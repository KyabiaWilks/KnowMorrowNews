import fs from 'node:fs';
import pg from 'pg';
import { config } from './config.js';
import { syncContributorCatalog } from './contributors.js';
import { normalizeReporterBeats } from './reporterBeats.js';
import { normalizeNewsTags } from './newsTags.js';
import { KMN_WEBSITE_ARTICLE } from './kmnWebsiteArticle.js';
import { COLD_ISLAND_HEIST_ARTICLE } from './coldIslandHeistArticle.js';
import { LUCENTINE_WATCHING_ARTICLE } from './lucentineWatchingArticle.js';
import { HOMELAND_STORY_ARTICLE } from './homelandStoryArticle.js';
import { ENLIGHTENED_AGE_ARTICLE } from './enlightenedAgeArticle.js';
import { THEGUNRAT_CAFE_ARTICLE, THEGUNRAT_KITTEN_BUNKER_ARTICLE } from './thegunratQuotes.js';
import { theGunRatOpeningParagraphCount } from './articleLayout.js';
import { PLAYERTAGGER_CLARIFICATION_ARTICLE } from './playerTaggerClarificationArticle.js';
import { SNEEEPER_INTERVIEW_ARTICLE } from './sneeeperInterviewArticle.js';
import { WAKE_OF_WAR_ARTICLE } from './wakeOfWarArticle.js';
import { syncJournalistProfiles } from './journalistProfiles.js';
import { ensureMajorConflictAdvertisement, syncAudienceDataset } from './audience.js';

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
  contributors: [],
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
  audienceMembers: [],
  advertisements: [],
};

const capitalizeTag = (value) => {
  const label = String(value || '').trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
};

function capitalizeCustomTags(state) {
  const aliases = new Map();
  let changed = false;

  for (const tag of state.tags || []) {
    if (tag.kind === 'system') continue;
    const next = capitalizeTag(tag.label);
    if (next && next !== tag.label) {
      aliases.set(tag.label, next);
      tag.label = next;
      changed = true;
    }
  }

  if (!aliases.size) return changed;
  for (const collection of [state.offers || [], state.requests || []]) {
    for (const item of collection) {
      if (!Array.isArray(item.tags)) continue;
      const next = [...new Set(item.tags.map((tag) => aliases.get(tag) || tag))];
      if (JSON.stringify(next) !== JSON.stringify(item.tags)) {
        item.tags = next;
        changed = true;
      }
    }
  }
  return changed;
}

function normalizeJournalistBeats(state) {
  let changed = false;
  for (const journalist of state.journalists || []) {
    const next = normalizeReporterBeats(journalist.beats, journalist.id);
    if (JSON.stringify(next) !== JSON.stringify(journalist.beats || [])) {
      journalist.beats = next;
      changed = true;
    }
  }
  return changed;
}

function normalizeArticleTags(state) {
  let changed = false;
  for (const article of state.news || []) {
    if (article.id === KMN_WEBSITE_ARTICLE.id && article.publishedAt !== KMN_WEBSITE_ARTICLE.publishedAt) {
      article.publishedAt = KMN_WEBSITE_ARTICLE.publishedAt;
      changed = true;
    }
    if (article.id === 'news_placeholder' && article.publishedAt !== '2026-08-07T12:00:00.000Z') {
      article.publishedAt = '2026-08-07T12:00:00.000Z';
      changed = true;
    }
    if (article.id === COLD_ISLAND_HEIST_ARTICLE.id && article.publishedAt !== COLD_ISLAND_HEIST_ARTICLE.publishedAt) {
      article.publishedAt = COLD_ISLAND_HEIST_ARTICLE.publishedAt;
      changed = true;
    }
    if (article.id === HOMELAND_STORY_ARTICLE.id && article.openingParagraphCount !== HOMELAND_STORY_ARTICLE.openingParagraphCount) {
      article.openingParagraphCount = HOMELAND_STORY_ARTICLE.openingParagraphCount;
      changed = true;
    }
    if (article.id === THEGUNRAT_KITTEN_BUNKER_ARTICLE.id) {
      for (const key of ['body', 'openingParagraphCount', 'readingMinutes']) {
        if (article[key] === THEGUNRAT_KITTEN_BUNKER_ARTICLE[key]) continue;
        article[key] = THEGUNRAT_KITTEN_BUNKER_ARTICLE[key];
        changed = true;
      }
    }
    if (article.id === THEGUNRAT_CAFE_ARTICLE.id && article.openingParagraphCount !== THEGUNRAT_CAFE_ARTICLE.openingParagraphCount) {
      article.openingParagraphCount = THEGUNRAT_CAFE_ARTICLE.openingParagraphCount;
      changed = true;
    }
    // Run the column layout pass after legacy seeded-article migrations so the
    // calibrated series value remains authoritative.
    if (article.series === 'thegunrat-quotes') {
      const balancedCount = theGunRatOpeningParagraphCount(article);
      if (article.openingParagraphCount !== balancedCount) {
        article.openingParagraphCount = balancedCount;
        changed = true;
      }
    }
    const next = normalizeNewsTags(article.tags, article.id);
    if (JSON.stringify(next) !== JSON.stringify(article.tags || [])) {
      article.tags = next;
      changed = true;
    }
  }
  return changed;
}

function ensureArticleContributors(state) {
  let changed = false;
  if (!(state.news || []).some((article) => article.id === KMN_WEBSITE_ARTICLE.id)) {
    state.news.push(structuredClone(KMN_WEBSITE_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === COLD_ISLAND_HEIST_ARTICLE.id)) {
    state.news.push(structuredClone(COLD_ISLAND_HEIST_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === LUCENTINE_WATCHING_ARTICLE.id)) {
    state.news.push(structuredClone(LUCENTINE_WATCHING_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === HOMELAND_STORY_ARTICLE.id)) {
    state.news.push(structuredClone(HOMELAND_STORY_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === ENLIGHTENED_AGE_ARTICLE.id)) {
    state.news.push(structuredClone(ENLIGHTENED_AGE_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === THEGUNRAT_CAFE_ARTICLE.id)) {
    state.news.push(structuredClone(THEGUNRAT_CAFE_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === THEGUNRAT_KITTEN_BUNKER_ARTICLE.id)) {
    state.news.push(structuredClone(THEGUNRAT_KITTEN_BUNKER_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === PLAYERTAGGER_CLARIFICATION_ARTICLE.id)) {
    state.news.push(structuredClone(PLAYERTAGGER_CLARIFICATION_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === SNEEEPER_INTERVIEW_ARTICLE.id)) {
    state.news.push(structuredClone(SNEEEPER_INTERVIEW_ARTICLE));
    changed = true;
  }
  if (!(state.news || []).some((article) => article.id === WAKE_OF_WAR_ARTICLE.id)) {
    state.news.push(structuredClone(WAKE_OF_WAR_ARTICLE));
    changed = true;
  }
  for (const article of state.news || []) {
    if (article.id === ENLIGHTENED_AGE_ARTICLE.id) {
      if (article.important !== false) {
        article.important = false;
        changed = true;
      }
      if (article.pinned !== false) {
        article.pinned = false;
        changed = true;
      }
      if (JSON.stringify(article.media || []) !== JSON.stringify(ENLIGHTENED_AGE_ARTICLE.media)) {
        article.media = structuredClone(ENLIGHTENED_AGE_ARTICLE.media);
        changed = true;
      }
    }
    if (article.id === LUCENTINE_WATCHING_ARTICLE.id) {
      if (article.important !== false) {
        article.important = false;
        changed = true;
      }
      if (article.pinned !== false) {
        article.pinned = false;
        changed = true;
      }
    }
    if (article.id === 'news_ministry_of_truth_logo' && article.cover !== '/news/ministry-truth-cover.webp') {
      article.cover = '/news/ministry-truth-cover.webp';
      changed = true;
    }
    if (article.id === 'news_ministry_of_truth_logo' && article.visualCredit !== 'Cover image by chocolate uvu.') {
      article.visualCredit = 'Cover image by chocolate uvu.';
      changed = true;
    }
    if (article.id === 'news_placeholder' && article.visualCredit !== 'Cover image by lunarian.') {
      article.visualCredit = 'Cover image by lunarian.';
      changed = true;
    }
    if (article.id === 'news_jon_vs_top_ad' && article.visualCredit !== 'Image provided by the commissioning group.') {
      article.visualCredit = 'Image provided by the commissioning group.';
      changed = true;
    }
    const creditedIllustrators = article.id === 'news_ministry_of_truth_logo'
      ? ['jnl_dd3182', 'jnl_chocolate_uvu']
      : article.id === 'news_placeholder'
        ? ['jnl_lunarian']
        : [];
    const next = creditedIllustrators.length
      ? [...new Set([...(article.illustratorIds || []), ...creditedIllustrators])]
      : (article.illustratorIds || []);
    if (!Array.isArray(article.illustratorIds) || JSON.stringify(next) !== JSON.stringify(article.illustratorIds)) {
      article.illustratorIds = next;
      changed = true;
    }
  }
  return changed;
}

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

// Narrow database access for read-only operational views whose data lives in
// dedicated relational tables instead of the JSON application state.
export function queryDatabase(text, params = []) {
  return pool.query(text, params);
}

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
    if (capitalizeCustomTags(loaded)) migrated = true;
    if (normalizeJournalistBeats(loaded)) migrated = true;
    if (normalizeArticleTags(loaded)) migrated = true;
    if (ensureArticleContributors(loaded)) migrated = true;
    if (syncContributorCatalog(loaded)) migrated = true;
    if (syncJournalistProfiles(loaded)) migrated = true;
    const audienceBefore = JSON.stringify(loaded.audienceMembers || []);
    syncAudienceDataset(loaded);
    if (JSON.stringify(loaded.audienceMembers) !== audienceBefore) migrated = true;
    if (ensureMajorConflictAdvertisement(loaded)) migrated = true;
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
  capitalizeCustomTags(initial);
  normalizeJournalistBeats(initial);
  normalizeArticleTags(initial);
  ensureArticleContributors(initial);
  syncContributorCatalog(initial);
  syncJournalistProfiles(initial);
  syncAudienceDataset(initial);
  ensureMajorConflictAdvertisement(initial);
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
