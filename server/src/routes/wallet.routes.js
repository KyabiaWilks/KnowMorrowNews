import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { credit, debit, walletOf, publicUser, record } from '../services.js';
import { notify } from '../notifications.js';
import { bad, now, uid, wrap } from '../util.js';

export const walletRouter = Router();

walletRouter.get('/recipients', requireAuth, wrap((req, res) => {
  const query = String(req.query.q || '').trim().toLowerCase();
  const separateIdentities = req.query.separate === '1';
  if (query.length < 1) return res.json({ items: [] });
  const items = db.users
    .filter((user) => user.id !== req.user.id && !user.banned)
    .flatMap((user) => {
      const fields = [
        ['User ID', user.username],
        ['Nickname', user.displayName],
        ['MC ID', user.minecraftId],
        ['Internal ID', user.id],
      ];
      const matchedField = fields.find(([, value]) => String(value || '').toLowerCase().includes(query));
      const masks = db.profiles.filter((profile) => profile.userId === user.id && !profile.retired);
      if (!separateIdentities) {
        const matchedMask = masks.find((profile) => profile.alias.toLowerCase().includes(query));
        if (!matchedField && !matchedMask) return [];
        return [{
          id: user.id,
          identityType: 'account',
          username: user.username,
          displayName: user.displayName,
          minecraftId: user.minecraftId || null,
          minecraftUuid: user.minecraftUuid || null,
          avatar: user.discordAvatar || (user.minecraftUuid ? `/api/auth/minecraft-avatar/${user.minecraftUuid}` : null),
          matchedBy: matchedMask ? `Mask · ${matchedMask.alias}` : matchedField[0],
          mask: matchedMask ? { alias: matchedMask.alias, sigil: matchedMask.sigil } : null,
        }];
      }
      const accountResult = matchedField ? [{
        id: user.id,
        identityType: 'account',
        username: user.username,
        displayName: user.displayName,
        minecraftId: user.minecraftId || null,
        minecraftUuid: user.minecraftUuid || null,
        avatar: user.discordAvatar || (user.minecraftUuid ? `/api/auth/minecraft-avatar/${user.minecraftUuid}` : null),
        matchedBy: matchedField[0],
        mask: null,
      }] : [];
      const maskResults = masks
        .filter((profile) => profile.alias.toLowerCase().includes(query))
        .map((profile) => ({
          id: profile.id,
          identityType: 'mask',
          username: null,
          displayName: profile.alias,
          minecraftId: null,
          minecraftUuid: null,
          avatar: null,
          matchedBy: 'Mask alias',
          mask: { alias: profile.alias, sigil: profile.sigil },
        }));
      return [...accountResult, ...maskResults];
    })
    .sort((a, b) => {
      const score = (item) => {
        const values = [item.username, item.displayName, item.minecraftId, item.id]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());
        if (values.some((value) => value === query)) return 0;
        if (values.some((value) => value.startsWith(query))) return 1;
        return 2;
      };
      return score(a) - score(b) || a.displayName.localeCompare(b.displayName);
    })
    .slice(0, 12);
  res.json({ items });
}));

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
    if (!amount) throw bad('Top-up amount is invalid.');
    credit(req.user, amount, 'topup', 'Tomato harvest (demo faucet)');
    res.json({ user: publicUser(req.user) });
  })
);

walletRouter.post('/transfer', requireAuth, wrap((req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const amount = Math.floor(Number(req.body.amount));
  const recipientProfile = req.body.recipientType === 'mask'
    ? db.profiles.find((item) => item.id === req.body.recipientId && !item.retired)
    : null;
  const recipient = recipientProfile
    ? db.users.find((item) => item.id === recipientProfile.userId)
    : req.body.recipientId
      ? db.users.find((item) => item.id === req.body.recipientId)
    : db.users.find((item) => item.username.toLowerCase() === username);
  if (!recipient) throw bad('Recipient not found.');
  if (recipient.id === req.user.id) throw bad('You cannot transfer funds to yourself.');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000) throw bad('Transfer amount must be between 1 and 100,000 TMT.');
  if (recipient.banned) throw bad('This recipient cannot receive transfers.');
  const transferId = uid('xfr');
  const recipientLabel = recipientProfile ? `mask “${recipientProfile.alias}”` : recipient.username;
  debit(req.user, amount, 'user_transfer_out', `Transfer to ${recipientLabel}`, { type: 'transfer', id: transferId });
  credit(recipient, amount, 'user_transfer_in', recipientProfile ? `Transfer received through mask “${recipientProfile.alias}”` : `Transfer from ${req.user.username}`, { type: 'transfer', id: transferId });
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
  const recipientProfile = req.body.recipientType === 'mask'
    ? db.profiles.find((item) => item.id === req.body.recipientId && !item.retired)
    : null;
  const recipient = recipientProfile
    ? db.users.find((item) => item.id === recipientProfile.userId)
    : req.body.recipientId
      ? db.users.find((item) => item.id === req.body.recipientId)
    : db.users.find((item) => item.username.toLowerCase() === username);
  if (!recipient) throw bad('Recipient not found.');
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) throw bad('Official transfer must be between 1 and 1,000,000 TMT.');
  const memo = String(req.body.memo || 'Official Tavern allocation').trim().slice(0, 160);
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
  res.json({ ok: true, amount });
}));
