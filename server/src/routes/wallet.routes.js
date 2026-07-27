import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { credit, walletOf, publicUser } from '../services.js';
import { bad, wrap } from '../util.js';

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
  wrap((req, res) => {
    const amount = Math.min(500, Math.max(1, Number(req.body.amount) || 0));
    if (!amount) throw bad('充值数量不合法');
    credit(req.user, amount, 'topup', '番茄田收成（演示水龙头）');
    res.json({ user: publicUser(req.user) });
  })
);
