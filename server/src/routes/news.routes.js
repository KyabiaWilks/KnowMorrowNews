import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { debit } from '../services.js';
import { bad, matchText, missing, paginate, wrap } from '../util.js';

export const newsRouter = Router();

const NEWS_SECTIONS = [
  'Scandals, gossip & drama',
  'Weddings & memorials',
  'Festivals & advertisements',
  'Missing & mysteriously found',
  'Receipts & reenactments',
  'Oddities',
  'Satire & commentary',
  'Bee gifs',
];

const NEWS_EN = {
  news_border: { title: 'Forty-Seven Days South of the Snow Line', summary: 'During a communications blackout, a temporary hospital run by three doctors became the only remaining civic order south of the snow line.', section: 'Features', tags: ['Border', 'Humanitarian', 'Exclusive'], dateline: 'Southern Snow Line · Special Correspondent', body: 'The blockade closed completely on its eleventh day.\n\nWhen Lyra Shen arrived, the temporary hospital had one oxygen concentrator powered by a diesel generator and a casualty ledger written in pencil. The 214th name had been crossed out and entered again—a teenager brought in twice in three days.\n\n“We do not lack courage. We lack diesel,” the doctor coordinating supplies said.\n\nKnow Morrow verified 31 of the 47 legible names and confirmed through two independent sources that supply deliveries stopped on day nineteen.' },
  news_pipeline: { title: 'The Shadow Ledger of Pipeline Three', summary: 'Satellite imagery and port records reveal at least twelve overnight shipments missing from the official log.', section: 'Investigations', tags: ['Energy', 'Investigation', 'Data', 'Exclusive'], dateline: 'Know Morrow Investigations', body: 'We obtained two independent datasets: public port-arrival logs and commercial infrared satellite imagery from the same nights.\n\nPlaced side by side, they reveal twelve “ghost shifts”—ships appear in the images but not in the logs.\n\nThree maritime analysts independently reviewed the imagery and reached the same conclusion. The operator blamed “different reporting standards” but declined to provide its original methodology.' },
  news_summit: { title: 'Day Three of the Circumlunar Summit', summary: 'The fate of a single verb shaped three nations’ energy quotas for the next two years.', section: 'Diplomacy', tags: ['Summit', 'Diplomacy', 'Treaty'], dateline: 'Circumlunar Conference Center', body: 'At two in the morning, negotiations stalled over one choice: “should” or “must.”\n\nThree people close to the table described the same scene. The draft was projected on a wall while delegates read it word by word, as though delivering a verdict.\n\nThe final version used “should.” Enforcement weakened, but the agreement survived.' },
  news_tomato: { title: 'The Two Faces of Tomato Coin', summary: 'TMT began as a small reader tip. Now it appears in far more secretive ledgers.', section: 'Markets', tags: ['Token', 'Economy', 'Markets'], dateline: 'Know Morrow Markets Desk', body: 'The price of a tomato is changing from applause into the cost of information.\n\nOur review of ninety days of observable TMT activity found that small, frequent reader tips are declining while transfers above 200 TMT have tripled.\n\n“Anything that settles anonymously eventually becomes a way to buy secrets,” one market analyst said.' },
  news_harbor: { title: 'The Harbor’s Last Ship', summary: 'The visual desk reconstructs the three-month verification trail behind an award-winning photograph.', section: 'Visuals', tags: ['Photography', 'Image Verification'], dateline: 'Know Morrow Visual Lab', body: 'The photograph existed in four versions. Only one met our publication standard.\n\nVerification included preserving the original file hash, comparing camera metadata and confirming the scene through a second independent source. Without all three, the image stayed unpublished.' },
  news_arbitration: { title: 'Know Morrow Establishes Tavern Arbitration', summary: 'Fraud, fabricated information and deliberate non-payment now enter a formal review process.', section: 'Notices', tags: ['Notice', 'Tavern'], dateline: 'Editorial Desk', body: 'Anonymity does not mean immunity.\n\nTavern transaction disputes are reviewed by the Know Morrow arbitration team. Sanctions may suspend every mask attached to an account and freeze site funds to compensate harmed participants.\n\nOnly the most serious, substantiated cases may result in a public disclosure.' },
  news_blackout: { title: 'Three East Coast Cities Lose Service at Once', summary: 'Backbone networks failed in the same minute; operators described the event as planned maintenance.', section: 'Breaking', tags: ['Infrastructure', 'Unconfirmed'], dateline: 'East Coast Desk', body: 'The outage began at 03:14 local time and ended at 09:20.\n\nThree operators issued almost identical notices. Know Morrow is checking two contradictory leads and will not assign a cause until the evidence supports one.' },
  news_moon: { title: 'Editorial: Why Our Moon Is Also an Eye', summary: 'A note about the Know Morrow emblem and what it means to keep watching.', section: 'Editorial', tags: ['Editorial'], dateline: 'Editorial Desk', body: 'The moon does not make light; it returns light to you.\n\nWe placed it on the horizon so that it also resembles an eye about to open—a reminder that journalism is not obliged to illuminate everything, but it must refuse to close its eyes.' },
};
const englishArticle = (article) => ({ ...article, ...(NEWS_EN[article.id] || {}) });
const AUTHOR_EN = { jnl_lyra: 'Lyra Shen', jnl_kai: 'Kai Lu', jnl_mira: 'Mira Vance', jnl_ash: 'Ash Cole', jnl_wen: 'Wen Zihan' };
const AUTHOR_BEATS_EN = { jnl_lyra: ['Conflict', 'Border', 'Humanitarian'], jnl_kai: ['Investigations', 'Energy', 'Data'], jnl_mira: ['Diplomacy', 'Summits', 'Treaties'], jnl_ash: ['Photography', 'Image Verification'], jnl_wen: ['Economy', 'Markets', 'Tokens'] };

const listItem = (a) => ({
  ...(() => { a = englishArticle(a); return {}; })(),
  id: a.id,
  slug: a.slug,
  title: a.title,
  summary: a.summary,
  section: a.section,
  tags: a.tags,
  cover: a.cover,
  authorIds: a.authorIds,
  authors: a.authorIds.map((id) => AUTHOR_EN[id] || db.journalists.find((j) => j.id === id)?.name).filter(Boolean),
  publishedAt: a.publishedAt,
  readingMinutes: a.readingMinutes,
  views: a.views ?? 0,
  tomatoTips: a.tomatoTips ?? 0,
  featured: !!a.featured,
});

newsRouter.get(
  '/',
  wrap((req, res) => {
    const { q, section, tag, author, sort = 'new' } = req.query;
    let items = db.news.filter((a) => a.status === 'published');

    if (q) {
      items = items.filter((a) => {
        const item = englishArticle(a);
        return matchText(q, item.title, item.summary, item.body, item.section, ...(item.tags || []), ...listItem(a).authors);
      });
    }
    if (section && section !== 'all') items = items.filter((a) => englishArticle(a).section === section);
    if (tag) items = items.filter((a) => (englishArticle(a).tags || []).includes(String(tag)));
    if (author) items = items.filter((a) => (a.authorIds || []).includes(String(author)));

    items = items.slice().sort((a, b) => {
      if (sort === 'tomatoes') return (b.tomatoTips ?? 0) - (a.tomatoTips ?? 0);
      if (sort === 'hot') return (b.views ?? 0) - (a.views ?? 0);
      if (sort === 'old') return a.publishedAt.localeCompare(b.publishedAt);
      return b.publishedAt.localeCompare(a.publishedAt);
    });

    const page = paginate(items, req.query);
    res.json({ ...page, items: page.items.map(listItem) });
  })
);

newsRouter.get(
  '/facets',
  wrap((_req, res) => {
    const published = db.news.filter((a) => a.status === 'published');
    const sections = [...new Set([...NEWS_SECTIONS, ...published.map((a) => englishArticle(a).section)])];
    const counts = {};
    for (const a of published) for (const t of englishArticle(a).tags || []) counts[t] = (counts[t] || 0) + 1;
    res.json({
      sections,
      tags: Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([label, count]) => ({ label, count })),
      total: published.length,
    });
  })
);

newsRouter.post(
  '/:id/tip',
  requireAuth,
  wrap((req, res) => {
    const article = db.news.find((item) => item.id === req.params.id || item.slug === req.params.id);
    if (!article || article.status !== 'published') throw missing('This story is not available.');
    const amount = Math.round(Number(req.body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      throw bad('A story tip must be between 1 and 100,000 TMT.');
    }
    debit(req.user, amount, 'news_tip', `Tipped “${article.title}”`, { type: 'news', id: article.id });
    article.tomatoTips = Math.round(((article.tomatoTips ?? 0) + amount) * 100) / 100;
    save();
    res.json({ tomatoTips: article.tomatoTips, wallet: { coins: req.user.coins } });
  })
);

newsRouter.get(
  '/:id',
  wrap((req, res) => {
    const a = db.news.find((x) => x.id === req.params.id || x.slug === req.params.id);
    if (!a || a.status !== 'published') throw missing('This story does not exist or has not been published.');
    a.views = (a.views ?? 0) + 1;
    save();

    const related = db.news
      .filter((x) => x.id !== a.id && x.status === 'published')
      .map((x) => ({ x, score: (x.tags || []).filter((t) => (a.tags || []).includes(t)).length + (x.section === a.section ? 1 : 0) }))
      .filter((r) => r.score > 0)
      .sort((r1, r2) => r2.score - r1.score)
      .slice(0, 3)
      .map((r) => listItem(r.x));

    res.json({
      article: {
        ...listItem(a),
        body: englishArticle(a).body,
        dateline: englishArticle(a).dateline,
        authorCards: a.authorIds
          .map((id) => db.journalists.find((j) => j.id === id))
          .filter(Boolean)
          .map((j) => ({ id: j.id, name: AUTHOR_EN[j.id] || j.name, title: { jnl_lyra: 'Chief Conflict Correspondent', jnl_kai: 'Investigations Editor', jnl_mira: 'Diplomacy Correspondent', jnl_ash: 'Director of Visual Journalism', jnl_wen: 'Markets Correspondent' }[j.id] || j.title, avatar: j.avatar, beats: AUTHOR_BEATS_EN[j.id] || j.beats })),
      },
      related,
    });
  })
);
