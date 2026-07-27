import { Router } from 'express';
import { db } from '../db.js';
import { matchText, missing, wrap } from '../util.js';

export const journalistsRouter = Router();

const JOURNALISTS_EN = {
  jnl_lyra: { name: 'Lyra Shen', title: 'Chief Conflict Correspondent', tagline: 'If the moon is awake, so am I.', bio: 'Lyra has reported from three border conflicts and specializes in source networks inside communications blackouts.', beats: ['Conflict', 'Border', 'Humanitarian'], awards: [{ name: 'Know Morrow Story of the Year', year: 2025, work: 'Forty-Seven Days South of the Snow Line' }], milestones: [{ year: 2021, text: 'Joined Know Morrow as a freelance correspondent' }, { year: 2025, text: 'Named Chief Conflict Correspondent' }], signatureWorks: [{ newsId: 'news_border', note: 'Forty-seven days reporting from the blockade line' }] },
  jnl_kai: { name: 'Kai Lu', title: 'Investigations Editor', tagline: 'Data does not lie. People delete it.', bio: 'A former auditor turned investigative journalist specializing in satellite imagery, port records and financial filings.', beats: ['Investigations', 'Energy', 'Data'], awards: [{ name: 'Gold Award for Investigative Reporting', year: 2025, work: 'The Shadow Ledger of Pipeline Three' }], milestones: [{ year: 2019, text: 'Joined the investigations desk' }, { year: 2024, text: 'Founded the data journalism unit' }], signatureWorks: [{ newsId: 'news_pipeline', note: 'Reconstructed erased shipping records from satellite data' }] },
  jnl_mira: { name: 'Mira Vance', title: 'Diplomacy Correspondent', tagline: 'The real agenda lives between the lines of a communiqué.', bio: 'Mira has covered seven consecutive Circumlunar Summits and is known for forecasting final treaty language.', beats: ['Diplomacy', 'Summits', 'Treaties'], awards: [{ name: 'Best International Reporting', year: 2023, work: 'The Ellipsis in the Communiqué' }], milestones: [{ year: 2020, text: 'Covered the Circumlunar Summit independently' }, { year: 2026, text: 'Launched the Treaty Season column' }], signatureWorks: [{ newsId: 'news_summit', note: 'Identified the declaration’s central dispute forty hours early' }] },
  jnl_ash: { name: 'Ash Cole', title: 'Director of Visual Journalism', tagline: 'The right photograph outweighs three thousand words of denial.', bio: 'Ash leads visual storytelling and designed Know Morrow’s image authenticity workflow.', beats: ['Photography', 'Image Verification'], awards: [{ name: 'News Photograph of the Year', year: 2024, work: 'The Harbor’s Last Ship' }], milestones: [{ year: 2022, text: 'Established the image provenance laboratory' }], signatureWorks: [] },
  jnl_wen: { name: 'Wen Zihan', title: 'Markets Correspondent', tagline: 'Price is the most honest rumor.', bio: 'Wen covers commodities and emerging token markets and documented tomato coin’s use in informal markets.', beats: ['Economy', 'Markets', 'Tokens'], awards: [], milestones: [{ year: 2026, text: 'Launched the Daily Tomato Market column' }], signatureWorks: [{ newsId: 'news_tomato', note: 'The first systematic account of TMT circulation' }] },
};
const englishJournalist = (journalist) => ({ ...journalist, ...(JOURNALISTS_EN[journalist.id] || {}) });
const STORY_EN = {
  news_border: ['Forty-Seven Days South of the Snow Line', 'A temporary hospital became the only remaining civic order during a communications blackout.', 'Features'],
  news_pipeline: ['The Shadow Ledger of Pipeline Three', 'Satellite imagery reveals twelve overnight shipments missing from the official log.', 'Investigations'],
  news_summit: ['Day Three of the Circumlunar Summit', 'A single word shaped three nations’ energy quotas.', 'Diplomacy'],
  news_tomato: ['The Two Faces of Tomato Coin', 'TMT began as a reader tip and now appears in secretive ledgers.', 'Markets'],
};

const card = (j) => {
  j = englishJournalist(j);
  return ({
  id: j.id,
  name: j.name,
  title: j.title,
  avatar: j.avatar,
  portraitTone: j.portraitTone,
  beats: j.beats,
  tagline: j.tagline,
  joinedAt: j.joinedAt,
  awards: (j.awards || []).length,
  storyCount: db.news.filter((a) => a.status === 'published' && (a.authorIds || []).includes(j.id)).length,
  featured: !!j.featured,
  });
};

journalistsRouter.get(
  '/',
  wrap((req, res) => {
    const { q, beat } = req.query;
    let items = db.journalists.filter((j) => !j.hidden);
    if (q) items = items.filter((j) => {
      const item = englishJournalist(j);
      return matchText(q, item.name, item.title, item.tagline, item.bio, ...(item.beats || []), ...(item.awards || []).map((a) => a.name));
    });
    if (beat && beat !== 'all') items = items.filter((j) => (englishJournalist(j).beats || []).includes(String(beat)));
    const beats = [...new Set(db.journalists.flatMap((j) => englishJournalist(j).beats || []))];
    res.json({
      items: items.sort((a, b) => Number(!!b.featured) - Number(!!a.featured) || a.name.localeCompare(b.name)).map(card),
      beats,
    });
  })
);

journalistsRouter.get(
  '/:id',
  wrap((req, res) => {
    let j = db.journalists.find((x) => x.id === req.params.id);
    if (!j || j.hidden) throw missing('没有这位记者');
    j = englishJournalist(j);
    const stories = db.news
      .filter((a) => a.status === 'published' && (a.authorIds || []).includes(j.id))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((a) => ({ id: a.id, title: STORY_EN[a.id]?.[0] || a.title, summary: STORY_EN[a.id]?.[1] || a.summary, publishedAt: a.publishedAt, views: a.views ?? 0, section: STORY_EN[a.id]?.[2] || a.section }));

    res.json({
      journalist: {
        ...card(j),
        bio: j.bio,
        awards: j.awards || [],
        milestones: j.milestones || [],
        signatureWorks: (j.signatureWorks || []).map((w) => ({
          ...w,
          article: db.news.find((a) => a.id === w.newsId) ? { id: w.newsId, title: STORY_EN[w.newsId]?.[0] || db.news.find((a) => a.id === w.newsId).title } : null,
        })),
        contact: j.contact || null,
        stats: {
          stories: stories.length,
          totalViews: stories.reduce((s, a) => s + a.views, 0),
          awards: (j.awards || []).length,
        },
      },
      stories,
    });
  })
);
