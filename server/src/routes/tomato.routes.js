import { Router } from 'express';
import { config } from '../config.js';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { debit, profileById } from '../services.js';
import { bad, missing, now, uid, wrap, HttpError } from '../util.js';

export const tomatoRouter = Router();
const SPLATS = ['splat-a', 'splat-b', 'splat-c', 'splat-d'];
const shape = (tomato) => ({
  id: tomato.id, page: tomato.page, x: tomato.x, y: tomato.y, rot: tomato.rot,
  scale: tomato.scale, splat: tomato.splat, note: tomato.note, alias: tomato.alias,
  createdAt: tomato.createdAt, mine: false,
});

tomatoRouter.get('/', wrap((req, res) => {
  const page = String(req.query.page || '/');
  const items = db.tomatoes.filter((tomato) => !tomato.hidden && (page === '*' || tomato.page === page))
    .slice(0, 400)
    .map((tomato) => ({ ...shape(tomato), mine: !!req.user && tomato.userId === req.user.id }));
  res.json({ items, price: config.tomatoPrice });
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
  debit(req.user, config.tomatoPrice, 'tomato_throw', `Threw a tomato on ${page}`, { type: 'page', id: page });
  const tomato = {
    id: uid('tmt'), page, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100,
    rot: Math.round(Math.random() * 360), scale: .8 + Math.random() * .6,
    splat: SPLATS[Math.floor(Math.random() * SPLATS.length)], note, alias,
    userId: req.user.id, profileId: req.body.profileId || null, hidden: false, createdAt: now(),
  };
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
