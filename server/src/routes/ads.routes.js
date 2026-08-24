import { Router } from 'express';
import { db } from '../db.js';
import { adVisibleToUser } from '../audience.js';
import { wrap } from '../util.js';

export const adsRouter = Router();

adsRouter.get('/', wrap((req, res) => {
  const placement = String(req.query.placement || 'all');
  const items = (db.advertisements || [])
    .filter((ad) => ad.kind !== 'opening_alert' && (ad.placement === 'all' || ad.placement === placement) && adVisibleToUser(db, ad, req.user))
    .map(({ id, title, body, imageUrl, href, placement }) => ({ id, title, body, imageUrl, href, placement }));
  res.json({ items });
}));

adsRouter.get('/opening-alert', wrap((req, res) => {
  const advertisement = (db.advertisements || []).find((ad) => ad.kind === 'opening_alert' && adVisibleToUser(db, ad, req.user));
  if (!advertisement) return res.json({ advertisement: null });
  const { id, title, body, href } = advertisement;
  res.json({ advertisement: { id, title, body, href } });
}));
