import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../services.js';
import { bad, now, uid, wrap } from '../util.js';

export const editorRouter = Router();
editorRouter.use(requireAuth);

const editorialRoles = ['journalist', 'admin', 'read_only_admin'];
const requireEditorial = (req, _res, next) => {
  if (!editorialRoles.includes(req.user.siteRole)) return next(bad('Editorial access required.'));
  next();
};

editorRouter.use(requireEditorial);

editorRouter.get('/news', wrap((req, res) => {
  const journalist = db.journalists.find((item) => item.userId === req.user.id);
  const items = req.user.siteRole === 'journalist'
    ? db.news.filter((item) => journalist && (item.authorIds || []).includes(journalist.id))
    : db.news;
  res.json({
    items: items.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    journalists: db.journalists.filter((item) => !item.hidden).map(({ id, name }) => ({ id, name })),
    ownJournalistId: journalist?.id || null,
  });
}));

editorRouter.post('/news', wrap((req, res) => {
  if (req.user.siteRole === 'read_only_admin') throw bad('Read-only administrators cannot publish news.');
  const ownJournalist = db.journalists.find((item) => item.userId === req.user.id);
  if (req.user.siteRole === 'journalist' && !ownJournalist) throw bad('Create your journalist profile before publishing news.');
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (!title || !body) throw bad('A headline and article body are required.');
  const authorIds = req.user.siteRole === 'journalist'
    ? [ownJournalist.id]
    : (Array.isArray(req.body.authorIds) ? req.body.authorIds.filter((id) => db.journalists.some((item) => item.id === id)) : []);
  const article = {
    id: uid('news'),
    slug: title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || uid('post'),
    title: title.slice(0, 120),
    summary: String(req.body.summary || '').trim().slice(0, 300),
    body,
    section: String(req.body.section || 'News').trim().slice(0, 60),
    tags: Array.isArray(req.body.tags) ? req.body.tags.slice(0, 8) : [],
    cover: req.body.cover || null,
    dateline: String(req.body.dateline || 'Know Morrow News Desk').trim().slice(0, 120),
    authorIds,
    status: req.body.status === 'draft' ? 'draft' : 'published',
    featured: false,
    readingMinutes: Math.max(1, Math.round(body.length / 400)),
    views: 0,
    publishedAt: now(),
  };
  db.news.unshift(article);
  audit(req.user, 'news.create', `Created news article "${article.title}"`);
  save();
  res.json({ article });
}));
