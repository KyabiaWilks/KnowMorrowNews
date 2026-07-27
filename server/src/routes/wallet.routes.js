import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { credit, debit, walletOf, publicUser, record } from '../services.js';
import { notify } from '../notifications.js';
import { bad, now, uid, wrap } from '../util.js';

export const walletRouter = Router();

walletRouter.get(
  '/',
  requireAuth,
  wrap((req, res) => {
    const txs = db.transactions.filter((t) => t.userId === req.user.id).slice(0, 80);
    res.json({
      wallet: walletOf(req.user),
      transactions: txs.map((t) => ({
        id: t.id,
        delta: t.delta,
        kind: t.kind,
        memo: t.memo,
        createdAt: t.createdAt,
      })),
    });
  })
);

/** 演示用水龙头：正式环境应接入真实的 tomato coin 结算 */
walletRouter.post(
  '/topup',
  requireAuth,
  requireAdmin,
  wrap((req, res) => {
    const amount = Math.min(500, Math.max(1, Number(req.body.amount) || 0));
    if (!amount) throw bad('充值数量不合法');
    credit(req.user, amount, 'topup', '番茄田收成（演示水龙头）');
    res.json({ user: publicUser(req.user) });
  })
);

walletRouter.post('/transfer', requireAuth, wrap((req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const amount = Math.floor(Number(req.body.amount));
  const recipient = db.users.find((item) => item.username.toLowerCase() === username);
  if (!recipient) throw bad('Recipient not found.');
  if (recipient.id === req.user.id) throw bad('You cannot transfer funds to yourself.');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw bad('Transfer amount must be between 1 and 100,000 TMT.');
  if (recipient.banned) throw bad('This recipient cannot receive transfers.');
  const transferId = uid('xfr');
  debit(req.user, amount, 'user_transfer_out', `Transfer to ${recipient.username}`, { type: 'transfer', id: transferId });
  credit(recipient, amount, 'user_transfer_in', `Transfer from ${req.user.username}`, { type: 'transfer', id: transferId });
  db.auditLog.unshift({ id: uid('aud'), action: 'user_transfer', actorUserId: req.user.id, targetUserId: recipient.id, amount, createdAt: now() });
  notify(recipient.id, {
    type: 'transfer',
    title: 'Tomato Coin received',
    message: `${req.user.displayName || req.user.username} sent you ${amount} TMT.`,
    href: '/wallet',
  });
  save();
  res.json({ user: publicUser(req.user) });
}));

walletRouter.post('/official-transfer', requireAuth, requireAdmin, wrap((req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const amount = Math.floor(Number(req.body.amount));
  const recipient = db.users.find((item) => item.username.toLowerCase() === username);
  if (!recipient) throw bad('Recipient not found.');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) throw bad('Official transfer must be between 1 and 1,000,000 TMT.');
  const memo = String(req.body.memo || 'Official newsroom allocation').trim().slice(0, 160);
  const transferId = uid('off');
  recipient.coins = (recipient.coins ?? 0) + amount;
  record(recipient.id, amount, 'official_transfer', memo, { type: 'official_transfer', id: transferId });
  db.auditLog.unshift({ id: uid('aud'), action: 'official_transfer', actorUserId: req.user.id, targetUserId: recipient.id, amount, memo, createdAt: now() });
  notify(recipient.id, {
    type: 'official_transfer',
    title: 'Official Tomato Coin transfer',
    message: `The Know Morrow administration sent you ${amount} TMT. ${memo}`,
    href: '/wallet',
  });
  save();
  res.json({ ok: true, recipient: { username: recipient.username, displayName: recipient.displayName }, amount });
}));
