import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import { missing, now, wrap } from '../util.js';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, wrap((req, res) => {
  const items = db.notifications
    .filter((item) => item.userId === req.user.id)
    .slice(0, 80);
  res.json({ items, unread: items.filter((item) => !item.readAt).length });
}));

notificationsRouter.post('/read-all', requireAuth, wrap((req, res) => {
  for (const item of db.notifications) {
    if (item.userId === req.user.id && !item.readAt) item.readAt = now();
  }
  save();
  res.json({ ok: true });
}));

notificationsRouter.post('/:id/read', requireAuth, wrap((req, res) => {
  const item = db.notifications.find((entry) => entry.id === req.params.id && entry.userId === req.user.id);
  if (!item) throw missing('Notification not found.');
  item.readAt = item.readAt || now();
  save();
  res.json({ item });
}));
