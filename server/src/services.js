import { db, save } from './db.js';
import { HttpError, bad, missing, now, uid, fingerprint } from './util.js';

/* ------------------------------ 钱包 / 账本 ------------------------------ */

const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export function walletOf(user) {
  return {
    coins: money(user.coins ?? 0),
    escrow: money(user.escrow ?? 0),
    frozen: money(user.frozenFunds ?? 0),
    available: money(Math.max(0, (user.coins ?? 0) - (user.frozenFunds ?? 0))),
  };
}

export function record(userId, delta, kind, memo, ref = {}) {
  const tx = {
    id: uid('tx'),
    userId,
    profileId: ref.profileId || null,
    delta,
    kind,
    memo,
    refType: ref.type || null,
    refId: ref.id || null,
    createdAt: now(),
  };
  db.transactions.unshift(tx);
  return tx;
}

export function debit(user, amount, kind, memo, ref) {
  amount = money(amount);
  const w = walletOf(user);
  if (amount <= 0) throw bad('Amount must be greater than 0.');
  if (w.available < amount) throw bad(`Insufficient TMT balance. Available: ${w.available}; required: ${amount}.`);
  user.coins = money(user.coins - amount);
  record(user.id, -amount, kind, memo, ref);
  save();
}

export function credit(user, amount, kind, memo, ref) {
  amount = money(amount);
  if (amount <= 0) throw bad('Amount must be greater than 0.');
  user.coins = money((user.coins ?? 0) + amount);
  record(user.id, amount, kind, memo, ref);
  save();
}

/** 委托保证金：从可用余额移入托管，钱还在自己名下但不可动用 */
export function lockEscrow(user, amount, ref) {
  const w = walletOf(user);
  if (w.available < amount) throw bad(`Insufficient balance for escrow. Available: ${w.available}; required: ${amount}.`);
  user.coins -= amount;
  user.escrow = (user.escrow ?? 0) + amount;
  record(user.id, -amount, 'escrow_lock', '委托保证金托管', ref);
  save();
}

export function releaseEscrow(user, amount, ref, memo = '保证金解冻') {
  const take = Math.min(amount, user.escrow ?? 0);
  user.escrow -= take;
  user.coins += take;
  record(user.id, take, 'escrow_release', memo, ref);
  save();
  return take;
}

export function payFromEscrow(payer, payee, amount, ref, memo = '委托结算') {
  if ((payer.escrow ?? 0) < amount) throw bad('Escrow does not contain enough funds to settle this reward tier.');
  payer.escrow -= amount;
  record(payer.id, -amount, 'escrow_settle', memo, ref);
  payee.coins = (payee.coins ?? 0) + amount;
  record(payee.id, amount, 'escrow_income', memo, ref);
  save();
}

/* ------------------------------ 用户 ------------------------------ */

export function publicUser(user) {
  if (!user) return null;
  const siteRole = user.siteRole === 'superadmin'
    ? 'admin'
    : user.siteRole === 'event_staff'
      ? 'read_only_admin'
      : user.siteRole || (user.role === 'admin' ? 'admin' : 'user');
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    banned: !!user.banned,
    noticeAckedAt: user.noticeAckedAt || null,
    createdAt: user.createdAt,
    wallet: walletOf(user),
    profileCount: db.profiles.filter((p) => p.userId === user.id && !p.retired).length,
    minecraftId: user.minecraftId || null,
    minecraftUuid: user.minecraftUuid || null,
    avatar: user.discordAvatar || (user.minecraftUuid ? `/api/auth/minecraft-avatar/${user.minecraftUuid}` : null),
    discordId: user.discordId || null,
    siteRole,
    readOnly: siteRole === 'read_only_admin' || siteRole === 'read_only_user',
  };
}

/* ------------------------------ 马甲 / 身份 ------------------------------ */

export function profileById(id) {
  return db.profiles.find((p) => p.id === id) || null;
}

export function ownProfile(user, profileId) {
  const p = profileById(profileId);
  if (!p) throw missing('Mask not found.');
  if (p.userId !== user.id) throw new HttpError(403, 'This mask does not belong to your account.');
  if (p.retired) throw bad('This mask has been retired.');
  return p;
}

export function userOfProfile(profileId) {
  const p = profileById(profileId);
  return p ? db.users.find((u) => u.id === p.userId) || null : null;
}

/** 对外暴露的马甲信息：只有面具，没有脸 */
export function publicProfile(profileId) {
  const p = profileById(profileId);
  const legacyProfile = p ? {
    prf_owl: ['Night Vessel', 'Replies only after midnight.'],
    prf_ash: ['Ash Ledger', 'Makes the numbers reconcile.'],
    prf_lyra: ['South of the Snow Line', 'Guess where I am.'],
    prf_chan: ['Seventh Adviser', 'Representing an office that prefers not to be named.'],
    prf_chan2: ['Empty Chair', ''],
  }[p.id] : null;
  if (!p) return { id: null, alias: '已注销的面具', sigil: '👤', mark: '--------' };
  return {
    id: p.id,
    alias: legacyProfile?.[0] || p.alias,
    sigil: p.sigil,
    bio: legacyProfile?.[1] || p.bio,
    mark: fingerprint(p.id, 'public'),
    reputation: p.reputation ?? 0,
    dealsClosed: p.dealsClosed ?? 0,
    createdAt: p.createdAt,
  };
}

/* --------------------------------- 情报 --------------------------------- */

export function hasUnlocked(userId, offerId, tierId) {
  return db.purchases.some((x) => x.buyerUserId === userId && x.offerId === offerId && (x.tierId === tierId || x.tierId === '*'));
}

const TAG_EN = { '有详细证据': 'Detailed evidence', '没有详细证据': 'No detailed evidence', '能源': 'Energy', '卫星影像': 'Satellite imagery', '外交': 'Diplomacy', '时效性强': 'Time-sensitive', '基础设施情报': 'Infrastructure', '高风险': 'High risk', '内部人事': 'Internal affairs', '经济': 'Economy' };
const OFFER_EN = {
  ofr_pipeline: { title: 'Pipeline Three overnight dispatch sheet', summary: 'Twelve undisclosed shifts with dates, vessel names and receiver codes.', tiers: { tier_p1: ['Summary', 'Dates and vessel count', 'Twelve overnight shifts took place between March 4 and April 19, concentrated on Tuesdays and Fridays from 01:00 to 04:00 and involving five vessels.'], tier_p2: ['Full list', 'Vessels, tonnage and receiver codes', 'Vessels: MV Kestrel, MV Ondine, MV Bright Fen, MV Sable and MV Ninth Hour. Receiver K-7 appears at two ports during four of the same shipments—a direct sign of falsification.'], tier_p3: ['Original scans', 'Dispatch photographs and metadata', 'Six photographed pages from the operations center. A handwritten note on page four reads: “Do not enter this page into the system.”'] } },
  ofr_summit: { title: 'Three drafts from the closed summit session', summary: 'Why the final declaration says “should” instead of “must.”', tiers: { tier_s1: ['Witness account', 'No files; account from a person in the room', 'The second draft used “must” four times. The third replaced every instance with “should” after a 01:40 proposal citing domestic legislative conflict.'], tier_s2: ['Proponent and exchange', 'Who proposed it and what they received', 'The delegation receiving the smallest energy quota proposed the change in exchange for a two-year transition clause in an unpublished annex.'] } },
  ofr_blackout: { title: 'Internal work-order numbers from the East Coast outage', summary: 'All three orders used one template and were created within ninety seconds.', tiers: { tier_b1: ['Order numbers and timestamps', 'Suitable for independent internal verification', 'Orders EM-33481, EM-33482 and EM-33489 were created at 02:58:11, 02:58:44 and 02:59:41 by the same service account.'], tier_b2: ['Upstream instruction screenshot', 'High-risk material', 'The regional dispatch platform marked the instruction as an exercise, but no exercise was scheduled that day.'] } },
  ofr_fake: { title: 'Defense minister expected to resign this week (reported)', summary: 'Single source and not independently verified.', tiers: { tier_f1: ['Full account', 'One second-hand statement', 'The source claims a resignation letter was submitted for a Friday announcement but did not see the document directly.'] } },
};
const REQUEST_EN = {
  req_pipeline: { title: 'Wanted: financial records linking Pipeline Three and the port authority', brief: 'Seeking dated transfers or statements that connect overnight shipping activity to the money trail.', tiers: { rt_1: ['Lead', 'A verifiable direction or source'], rt_2: ['Evidence', 'At least one verifiable statement'], rt_3: ['Complete chain', 'Payments matched to individual shipments'] } },
  req_blackout: { title: 'Wanted: regional dispatch logs from the East Coast outage', brief: 'Only 03:00–09:30 is needed. Redaction is acceptable if account identifiers and timestamps remain.', tiers: { rt_4: ['Excerpt', 'Any continuous thirty-minute segment'], rt_5: ['Full period', 'The complete six-and-a-half hours'] } },
};

/**
 * @param {object} offer
 * @param {object|null} viewer  当前登录用户
 * @param {boolean} reveal      true = bypass the paywall for an authorized view
 */
export function publicOffer(offer, viewer, reveal = false) {
  reveal = reveal || ['admin', 'read_only_admin', 'event_staff', 'superadmin'].includes(viewer?.siteRole);
  const isOwner = viewer && userOfProfile(offer.profileId)?.id === viewer.id;
  const tiers = offer.tiers.map((t) => {
    const unlocked = reveal || isOwner || (viewer ? hasUnlocked(viewer.id, offer.id, t.id) : false);
    return {
      id: t.id,
      name: OFFER_EN[offer.id]?.tiers?.[t.id]?.[0] || t.name,
      detail: OFFER_EN[offer.id]?.tiers?.[t.id]?.[1] || t.detail,
      price: t.price,
      evidenceCount: (t.evidenceIds || []).length,
      unlocked,
      content: unlocked ? (OFFER_EN[offer.id]?.tiers?.[t.id]?.[2] || t.content) : null,
      evidence: unlocked ? (t.evidenceIds || []).map(evidenceById).filter(Boolean) : [],
      buyers: db.purchases.filter((p) => p.offerId === offer.id && p.tierId === t.id).length,
    };
  });
  return {
    id: offer.id,
    title: OFFER_EN[offer.id]?.title || offer.title,
    summary: OFFER_EN[offer.id]?.summary || offer.summary,
    tags: offer.tags.map((tag) => TAG_EN[tag] || tag),
    seller: publicProfile(offer.profileId),
    tiers,
    status: offer.status,
    exclusive: !!offer.exclusive,
    exclusivePrice: offer.exclusive ? offer.exclusivePrice : null,
    views: offer.views ?? 0,
    createdAt: offer.createdAt,
    isOwner: !!isOwner,
    minPrice: Math.min(...offer.tiers.map((t) => t.price)),
    reportCount: db.reports.filter((r) => r.targetType === 'offer' && r.targetId === offer.id).length,
  };
}

export function publicRequest(request, viewer, reveal = false) {
  reveal = reveal || ['admin', 'read_only_admin', 'event_staff', 'superadmin'].includes(viewer?.siteRole);
  const isOwner = viewer && userOfProfile(request.profileId)?.id === viewer.id;
  const subs = db.submissions.filter((s) => s.requestId === request.id);
  return {
    id: request.id,
    title: REQUEST_EN[request.id]?.title || request.title,
    brief: REQUEST_EN[request.id]?.brief || request.brief,
    tags: request.tags.map((tag) => TAG_EN[tag] || tag),
    buyer: publicProfile(request.profileId),
    deposit: request.deposit,
    tiers: request.tiers.map((tier) => ({ ...tier, name: REQUEST_EN[request.id]?.tiers?.[tier.id]?.[0] || tier.name, detail: REQUEST_EN[request.id]?.tiers?.[tier.id]?.[1] || tier.detail })),
    deadline: request.deadline,
    status: request.status,
    createdAt: request.createdAt,
    isOwner: !!isOwner,
    submissionCount: subs.length,
    maxPrice: request.tiers.length ? Math.max(...request.tiers.map((t) => t.price)) : 0,
    submissions: subs.map((s) => {
      const visible = reveal || isOwner || (viewer && userOfProfile(s.profileId)?.id === viewer.id);
      return {
        id: s.id,
        tierId: s.tierId,
        supplier: publicProfile(s.profileId),
        status: s.status,
        createdAt: s.createdAt,
        content: visible ? s.content : null,
        evidence: visible ? (s.evidenceIds || []).map(evidenceById).filter(Boolean) : [],
        evidenceCount: (s.evidenceIds || []).length,
      };
    }),
  };
}

export function evidenceById(id) {
  const e = db.evidence.find((x) => x.id === id);
  if (!e) return null;
  return { id: e.id, name: e.name, url: e.url, mime: e.mime, size: e.size };
}

/* --------------------------------- 审计 --------------------------------- */
/** Records audited administrative actions. */
export function audit(actor, action, detail) {
  db.auditLog.unshift({
    id: uid('log'),
    actorId: actor?.id || null,
    actorName: actor?.username || 'system',
    action,
    detail,
    createdAt: now(),
  });
  db.auditLog.length = Math.min(db.auditLog.length, 500);
  save();
}
