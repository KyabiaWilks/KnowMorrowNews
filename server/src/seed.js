import { fileURLToPath } from 'node:url';
import { db, replaceAll, isEmpty } from './db.js';
import { hashPassword } from './auth.js';

const now = () => new Date().toISOString();

const SYSTEM_EVIDENCE_TAGS = [
  {
    id: 'tag_evidence_detailed',
    label: 'Detailed evidence',
    kind: 'system',
    color: '#b56a3c',
    description: 'The listing includes detailed supporting evidence.',
    createdBy: null,
    archived: false,
    createdAt: now(),
  },
  {
    id: 'tag_evidence_none',
    label: 'No detailed evidence',
    kind: 'system',
    color: '#8a7568',
    description: 'The listing does not include detailed supporting evidence.',
    createdBy: null,
    archived: false,
    createdAt: now(),
  },
];

const TEST_ACCOUNTS = [
  {
    id: 'tavern_user',
    username: 'tavern_user',
    displayName: 'Tavern User',
    password: 'MorrowUser!2026',
    siteRole: 'user',
  },
  {
    id: 'tavern_reporter',
    username: 'tavern_reporter',
    displayName: 'Tavern Reporter',
    password: 'MorrowReporter!2026',
    siteRole: 'journalist',
  },
  {
    id: 'tavern_admin',
    username: 'tavern_admin',
    displayName: 'Tavern Administrator',
    password: 'MorrowAdmin!2026',
    siteRole: 'admin',
  },
  {
    id: 'tavern_readonly',
    username: 'tavern_readonly',
    displayName: 'Tavern Read-only Administrator',
    password: 'MorrowReadOnly!2026',
    siteRole: 'read_only_admin',
  },
];

function makeUser(account) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    password: hashPassword(account.password),
    role: account.siteRole === 'admin' ? 'admin' : 'user',
    siteRole: account.siteRole,
    coins: 1000,
    escrow: 0,
    frozenFunds: 0,
    banned: false,
    banReason: null,
    noticeAckedAt: null,
    minecraftId: null,
    minecraftUuid: null,
    discordId: null,
    discordUsername: null,
    discordAvatar: null,
    createdAt: now(),
  };
}

export async function seedDatabase() {
  const users = TEST_ACCOUNTS.map(makeUser);
  const news = [{
    id: 'news_placeholder',
    slug: 'placeholder',
    title: 'Example Story Placeholder',
    summary: 'This placeholder demonstrates how a published Know Morrow story appears in the archive.',
    body: 'This is example article content. Editors can replace it with a complete report from the Editor’s Desk.',
    section: 'Example',
    tags: ['Placeholder'],
    cover: null,
    dateline: 'Know Morrow Editorial Desk',
    authorIds: [],
    status: 'published',
    featured: true,
    readingMinutes: 1,
    views: 0,
    tomatoTips: 0,
    publishedAt: now(),
  }];
  const transactions = users.map((user) => ({
    id: `tx_opening_${user.id}`,
    userId: user.id,
    profileId: null,
    delta: user.coins,
    kind: 'grant',
    memo: 'Opening Tavern allocation',
    refType: null,
    refId: null,
    createdAt: now(),
  }));
  const journalists = [{
    id: 'jnl_tavern_reporter',
    userId: 'tavern_reporter',
    name: 'Tavern Reporter',
    title: 'Staff Reporter',
    avatar: null,
    portraitTone: '#9e532d',
    tagline: 'Every whisper has a witness.',
    bio: 'A test reporter profile for validating Know Morrow publishing tools.',
    beats: ['General Assignment'],
    awards: [],
    milestones: [{ year: new Date().getFullYear(), text: 'Joined the Know Morrow press corps' }],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }];

  await replaceAll({
    meta: { version: 2, seededAt: now() },
    users,
    profiles: [],
    news,
    journalists,
    tags: structuredClone(SYSTEM_EVIDENCE_TAGS),
    offers: [],
    requests: [],
    purchases: [],
    submissions: [],
    evidence: [],
    reports: [],
    arbitrations: [],
    tomatoes: [],
    transactions,
    auditLog: [],
    notifications: [],
  });

  console.log(`[Know Morrow] Reset complete: ${users.length} test accounts, ${news.length} example story, empty Tavern.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  if (!isEmpty() && !force) {
    console.log('[Know Morrow] Database contains data. Add --force to replace it.');
  } else {
    await seedDatabase();
  }
}
