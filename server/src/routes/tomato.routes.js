import { Router } from 'express';
import { config } from '../config.js';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { debit, profileById } from '../services.js';
import { bad, missing, now, uid, wrap, HttpError } from '../util.js';

export const tomatoRouter = Router();
const DISPLAY_LIMIT = 72;
const pickTomatoVariant = () => {
  const roll = Math.random();
  if (roll < 0.005) return 'tmt5';
  if (roll < 0.02) return 'tmt4';
  if (roll < 0.12) return 'tmt3';
  return 'tmt1';
};
const PRIVATE_PAGES = ['/desk', '/profile', '/masks', '/wallet', '/notifications', '/admin', '/tavern/desk'];
const isPrivatePage = (page) => PRIVATE_PAGES.some((prefix) => page === prefix || page.startsWith(`${prefix}/`));
const shape = (tomato) => ({
  id: tomato.id, page: tomato.page, x: tomato.x, y: tomato.y, rot: tomato.rot,
  scale: tomato.scale, splat: tomato.splat, note: tomato.note, alias: tomato.alias,
  createdAt: tomato.createdAt, mine: false,
  contributor: !tomato.profileId && (db.contributors || []).some((item) => {
    const user = db.users.find((candidate) => candidate.id === tomato.userId);
    return item.username?.toLowerCase() === user?.username?.toLowerCase();
  }),
});

tomatoRouter.get('/', wrap((req, res) => {
  const page = String(req.query.page || '/');
  const privatePage = isPrivatePage(page);
  const eligible = db.tomatoes.filter((tomato) =>
    !tomato.hidden
    && (page === '*' || tomato.page === page)
    && (!privatePage || (!!req.user && tomato.userId === req.user.id))
  );
  const withNotes = eligible
    .filter((tomato) => String(tomato.note || '').trim())
    .sort((a, b) => b.note.trim().length - a.note.trim().length || b.createdAt.localeCompare(a.createdAt));
  const withoutNotes = eligible
    .filter((tomato) => !String(tomato.note || '').trim())
    .map((tomato) => ({ tomato, random: Math.random() }))
    .sort((a, b) => a.random - b.random)
    .map((item) => item.tomato);
  const items = [...withNotes.slice(0, DISPLAY_LIMIT), ...withoutNotes.slice(0, Math.max(0, DISPLAY_LIMIT - withNotes.length))]
    .map((tomato) => ({ ...shape(tomato), mine: !!req.user && tomato.userId === req.user.id }));
  res.json({ items, total: eligible.length, displayLimit: DISPLAY_LIMIT, price: config.tomatoPrice });
}));

tomatoRouter.post('/', requireAuth, wrap((req, res) => {
  const page = String(req.body.page || '/').slice(0, 120);
  const x = Number(req.body.x);
  const y = Number(req.body.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) throw bad('The tomato landing point must be within the page.');
  const note = String(req.body.note || '').trim();
  if (note.length > 60) throw bad('A tomato message cannot exceed 60 characters.');
  let alias = req.user.displayName || 'Anonymous reader';
  if (req.body.profileId) {
    const profile = profileById(req.body.profileId);
    if (!profile || profile.userId !== req.user.id) throw new HttpError(403, 'That identity does not belong to you.');
    alias = `${profile.sigil} ${profile.alias}`;
  }
  if (config.tomatoPrice > 0) {
    debit(req.user, config.tomatoPrice, 'tomato_throw', `Threw a tomato on ${page}`, { type: 'page', id: page });
  }
  const tomato = {
    id: uid('tmt'), page, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100,
    rot: Math.round(Math.random() * 360), scale: .8 + Math.random() * .6,
    splat: pickTomatoVariant(), note, alias,
    userId: req.user.id, profileId: req.body.profileId || null, hidden: false, createdAt: now(),
  };
  const eventMatch = /^\/events\/([^/]+)$/.exec(page);
  if (eventMatch && ['leadership-2026'].includes(eventMatch[1])) {
    tomato.voteEventId = eventMatch[1];
    tomato.voteCandidateId = x < 50 ? 'left' : 'right';
  }
  db.tomatoes.unshift(tomato);
  save();
  res.json({ tomato: { ...shape(tomato), mine: true }, wallet: { coins: req.user.coins } });
}));

tomatoRouter.delete('/:id', requireAuth, wrap((req, res) => {
  const index = db.tomatoes.findIndex((tomato) => tomato.id === req.params.id);
  if (index < 0) throw missing('That tomato no longer exists.');
  const tomato = db.tomatoes[index];
  if (tomato.userId !== req.user.id && req.user.siteRole !== 'admin' && req.user.role !== 'admin') throw new HttpError(403, 'You can only remove your own tomatoes.');
  db.tomatoes.splice(index, 1);
  save();
  res.json({ ok: true });
}));
