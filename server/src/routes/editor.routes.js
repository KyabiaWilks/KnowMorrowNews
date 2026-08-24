import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { audit } from '../services.js';
import { bad, now, uid, wrap } from '../util.js';
import { normalizeNewsTags } from '../newsTags.js';
import { theGunRatOpeningParagraphCount } from '../articleLayout.js';

export const editorRouter = Router();
editorRouter.use(requireAuth);

const editorialRoles = ['journalist', 'admin', 'read_only_admin'];
const isTheGunRat = (user) => String(user?.username || '').toLowerCase() === 'thegunrat';
const canTestTheGunRatDesk = (user) => user?.siteRole === 'admin';
const usesTheGunRatDesk = (req) => isTheGunRat(req.user) || (canTestTheGunRatDesk(req.user) && req.query.scope === 'thegunrat-quotes');
const requireEditorial = (req, _res, next) => {
  if (!editorialRoles.includes(req.user.siteRole) && !isTheGunRat(req.user)) return next(bad('Editorial access required.'));
  next();
};

editorRouter.use(requireEditorial);

const uploadedImageUrl = /^\/api\/upload\/media\/\d+-[a-f0-9]{12}\.(?:jpe?g|png|webp|gif|avif)$/i;

function normalizeArticleMedia(value, paragraphCount) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((item) => {
    const src = String(item?.src || '').trim();
    if (!uploadedImageUrl.test(src)) throw bad('Article images must be uploaded through the image uploader.');
    const afterParagraph = Math.floor(Number(item?.afterParagraph));
    if (!Number.isFinite(afterParagraph) || afterParagraph < 0 || afterParagraph >= paragraphCount) throw bad('Choose a valid paragraph for every article image.');
    return {
      src,
      alt: String(item?.alt || '').trim().slice(0, 240),
      caption: String(item?.caption || '').trim().slice(0, 300),
      afterParagraph,
    };
  });
}

editorRouter.get('/news', wrap((req, res) => {
  const journalist = db.journalists.find((item) => item.userId === req.user.id);
  const restrictedColumn = usesTheGunRatDesk(req);
  const items = restrictedColumn
    ? db.news.filter((item) => item.series === 'thegunrat-quotes' && (item.authorIds || []).includes('jnl_thegunrat'))
    : req.user.siteRole === 'journalist'
    ? db.news.filter((item) => journalist && (item.authorIds || []).includes(journalist.id))
    : db.news;
  res.json({
    items: items.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    journalists: db.journalists.filter((item) => !item.hidden).map(({ id, name }) => ({ id, name })),
    ownJournalistId: journalist?.id || null,
    editorialScope: restrictedColumn ? 'thegunrat-quotes' : 'news',
    canTestTheGunRatDesk: canTestTheGunRatDesk(req.user),
  });
}));

editorRouter.post('/news', wrap((req, res) => {
  if (req.user.siteRole === 'read_only_admin') throw bad('Read-only administrators cannot publish news.');
  const ownJournalist = db.journalists.find((item) => item.userId === req.user.id);
  const restrictedColumn = usesTheGunRatDesk(req);
  if ((req.user.siteRole === 'journalist' || restrictedColumn) && !ownJournalist) throw bad('Create your journalist profile before publishing news.');
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (!title || !body) throw bad('A headline and article body are required.');
  const cover = req.body.cover ? String(req.body.cover).trim() : null;
  if (cover && !uploadedImageUrl.test(cover)) throw bad('The cover image must be uploaded through the image uploader.');
  const paragraphCount = body.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
  const authorIds = restrictedColumn
    ? ['jnl_thegunrat']
    : req.user.siteRole === 'journalist'
    ? [ownJournalist.id]
    : (Array.isArray(req.body.authorIds) ? req.body.authorIds.filter((id) => db.journalists.some((item) => item.id === id)) : []);
  const article = {
    id: uid('news'),
    slug: title.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || uid('post'),
    title: title.slice(0, 120),
    summary: String(req.body.summary || '').trim().slice(0, 300),
    body,
    section: restrictedColumn ? 'TheGunRat Quotes' : String(req.body.section || 'News').trim().slice(0, 60),
    tags: restrictedColumn ? [] : normalizeNewsTags(req.body.tags),
    series: restrictedColumn ? 'thegunrat-quotes' : null,
    cover,
    media: normalizeArticleMedia(req.body.media, paragraphCount),
    dateline: restrictedColumn ? 'TheGunRat Quotes' : String(req.body.dateline || 'Know Morrow News Desk').trim().slice(0, 120),
    authorIds,
    illustratorIds: Array.isArray(req.body.illustratorIds) ? req.body.illustratorIds.filter((id) => db.journalists.some((item) => item.id === id)) : [],
    proofreaderIds: Array.isArray(req.body.proofreaderIds) ? req.body.proofreaderIds.filter((id) => db.journalists.some((item) => item.id === id)) : [],
    visualCredit: String(req.body.visualCredit || '').trim().slice(0, 160) || null,
    status: req.body.status === 'draft' ? 'draft' : 'published',
    featured: false,
    readingMinutes: Math.max(1, Math.round(body.length / 400)),
    views: 0,
    publishedAt: now(),
  };
  if (restrictedColumn) article.openingParagraphCount = theGunRatOpeningParagraphCount(article);
  db.news.unshift(article);
  audit(req.user, 'news.create', `Created news article "${article.title}"`);
  save();
  res.json({ article });
}));

editorRouter.patch('/news/:id', wrap((req, res) => {
  if (req.user.siteRole === 'read_only_admin') throw bad('Read-only administrators cannot edit news.');
  const article = db.news.find((item) => item.id === req.params.id);
  if (!article) throw bad('News article not found.');
  const ownJournalist = db.journalists.find((item) => item.userId === req.user.id);
  const restrictedColumn = usesTheGunRatDesk(req);
  if (restrictedColumn && (article.series !== 'thegunrat-quotes' || !(article.authorIds || []).includes('jnl_thegunrat'))) throw bad('TheGunRat may edit only TheGunRat Quotes articles.');
  if (req.user.siteRole === 'journalist' && (!ownJournalist || !(article.authorIds || []).includes(ownJournalist.id))) throw bad('You can edit only your own news articles.');
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  if (!title || !body) throw bad('A headline and article body are required.');
  const cover = req.body.cover ? String(req.body.cover).trim() : null;
  if (cover && !uploadedImageUrl.test(cover)) throw bad('The cover image must be uploaded through the image uploader.');
  const paragraphCount = body.split(/\n\s*\n/).filter((paragraph) => paragraph.trim()).length;
  article.title = title.slice(0, 120);
  article.summary = String(req.body.summary || '').trim().slice(0, 300);
  article.body = body;
  article.section = restrictedColumn ? 'TheGunRat Quotes' : String(req.body.section || 'News').trim().slice(0, 60);
  article.tags = restrictedColumn ? [] : normalizeNewsTags(req.body.tags, article.id);
  if (restrictedColumn) article.series = 'thegunrat-quotes';
  article.cover = cover;
  article.media = normalizeArticleMedia(req.body.media, paragraphCount);
  article.dateline = restrictedColumn ? 'TheGunRat Quotes' : String(req.body.dateline || 'Know Morrow News Desk').trim().slice(0, 120);
  article.authorIds = restrictedColumn
    ? ['jnl_thegunrat']
    : req.user.siteRole === 'journalist'
    ? [ownJournalist.id]
    : (Array.isArray(req.body.authorIds) ? req.body.authorIds.filter((id) => db.journalists.some((item) => item.id === id)) : []);
  article.illustratorIds = Array.isArray(req.body.illustratorIds) ? req.body.illustratorIds.filter((id) => db.journalists.some((item) => item.id === id)) : [];
  article.proofreaderIds = Array.isArray(req.body.proofreaderIds) ? req.body.proofreaderIds.filter((id) => db.journalists.some((item) => item.id === id)) : [];
  article.visualCredit = String(req.body.visualCredit || '').trim().slice(0, 160) || null;
  article.status = req.body.status === 'draft' ? 'draft' : 'published';
  article.readingMinutes = Math.max(1, Math.round(body.length / 400));
  if (restrictedColumn) article.openingParagraphCount = theGunRatOpeningParagraphCount(article);
  audit(req.user, 'news.update', `Updated news article "${article.title}"`);
  save();
  res.json({ article });
}));
