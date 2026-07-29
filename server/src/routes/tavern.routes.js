import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  credit,
  debit,
  lockEscrow,
  releaseEscrow,
  payFromEscrow,
  ownProfile,
  profileById,
  publicOffer,
  publicProfile,
  publicRequest,
  userOfProfile,
  hasUnlocked,
  evidenceById,
} from '../services.js';
import { bad, matchText, missing, now, paginate, uid, wrap, HttpError } from '../util.js';
import { notify } from '../notifications.js';

export const tavernRouter = Router();

/** 每条情报必须声明证据等级，这两个标签由系统锁定 */
export const EVIDENCE_TAGS = ['Detailed evidence', 'No detailed evidence'];
const RESERVED_EVIDENCE_LABELS = [...EVIDENCE_TAGS, 'Detailed Evidenc'];
const MAX_PROFILES = 6;
const TAG_EN = { '有详细证据': 'Detailed evidence', '没有详细证据': 'No detailed evidence', '军事': 'Military', '外交': 'Diplomacy', '能源': 'Energy', '内部人事': 'Internal affairs', '卫星影像': 'Satellite imagery', '时效性强': 'Time-sensitive', '高风险': 'High risk', '经济': 'Economy', '基础设施情报': 'Infrastructure' };
const TAG_SOURCE = {};

const isAdminUser = (user) => ['admin', 'read_only_admin', 'event_staff', 'superadmin'].includes(user?.siteRole) || user?.role === 'admin';
const isBlocked = (listing, user) => !!user && !isAdminUser(user) && (listing.blockedUserIds || []).includes(user.id);
const normalizeBlockedUsers = (owner, input) => [...new Set(Array.isArray(input) ? input.map(String) : [])]
  .filter((id) => id !== owner.id && db.users.some((user) => user.id === id && !user.banned))
  .slice(0, 30);

const words = (value) => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter((word) => word.length > 1);
function contentSimilarity(left, right) {
  const a = words(left);
  const b = words(right);
  if (!a.length || !b.length) return 0;
  const compactA = a.join(' ');
  const compactB = b.join(' ');
  if (Math.min(compactA.length, compactB.length) >= 40 && (compactA.includes(compactB) || compactB.includes(compactA))) return 1;
  const shingles = (items) => new Set(items.length < 3 ? items : items.slice(0, -2).map((_, index) => items.slice(index, index + 3).join(' ')));
  const setA = shingles(a);
  const setB = shingles(b);
  let shared = 0;
  for (const item of setA) if (setB.has(item)) shared += 1;
  return shared / Math.max(1, Math.min(setA.size, setB.size));
}

function reviewPossibleResale(user, offer) {
  const sources = db.purchases.filter((purchase) => purchase.buyerUserId === user.id).flatMap((purchase) => {
    const source = db.offers.find((item) => item.id === purchase.offerId);
    if (!source || source.id === offer.id) return [];
    return source.tiers.filter((tier) => purchase.tierId === '*' || tier.id === purchase.tierId).map((tier) => ({ source, tier }));
  });
  let strongest = null;
  for (const offeredTier of offer.tiers) for (const purchased of sources) {
    const score = contentSimilarity(offeredTier.content, purchased.tier.content);
    if (!strongest || score > strongest.score) strongest = { score, ...purchased };
  }
  if (!strongest || strongest.score < 0.72) return;
  db.auditLog.unshift({
    id: uid('rsa'), action: 'possible_information_resale', actorUserId: user.id,
    targetId: offer.id, sourceOfferId: strongest.source.id,
    similarity: Number(strongest.score.toFixed(3)), createdAt: now(),
  });
  notify(user.id, {
    type: 'resale_review',
    title: 'Your listing entered resale review',
    message: 'This listing substantially overlaps information previously purchased by this account. Administrators have been alerted; no automatic penalty was applied.',
    href: `/tavern/offers/${offer.id}`,
  });
  for (const admin of db.users.filter(isAdminUser)) {
    if (admin.id === user.id) continue;
    notify(admin.id, {
      type: 'resale_review',
      title: 'Possible information resale detected',
      message: `${user.displayName || user.username} posted content that substantially overlaps a purchase made by one of the account’s masks (${Math.round(strongest.score * 100)}% similarity).`,
      href: `/tavern/offers/${offer.id}`,
    });
  }
}

/* -------------------------------- 标签 -------------------------------- */

tavernRouter.get(
  '/tags',
  wrap((_req, res) => {
    const usage = {};
    for (const o of db.offers) for (const t of o.tags || []) usage[t] = (usage[t] || 0) + 1;
    for (const r of db.requests) for (const t of r.tags || []) usage[t] = (usage[t] || 0) + 1;
    res.json({
      tags: db.tags
        .filter((t) => !t.archived && t.kind !== 'system')
        .map((t) => ({ ...t, label: TAG_EN[t.label] || t.label, description: TAG_EN[t.label] ? '' : t.description, usage: usage[t.label] || 0 }))
        .sort((a, b) => Number(b.kind === 'system') - Number(a.kind === 'system') || (b.usage || 0) - (a.usage || 0)),
      evidenceTags: EVIDENCE_TAGS.map((tag) => TAG_EN[tag] || tag),
    });
  })
);

/** 任何登录用户都可以新增标签，管理员可在后台合并 / 归档 */
tavernRouter.post(
  '/tags',
  requireAuth,
  wrap((req, res) => {
    const requestedLabel = String(req.body.label || '').trim();
    if (requestedLabel.length < 1) throw bad('Tag name cannot be empty.');
    if (RESERVED_EVIDENCE_LABELS.some((tag) => tag.toLowerCase() === requestedLabel.toLowerCase())) {
      throw bad('Evidence declarations are protected system tags and cannot be added as additional tags.');
    }
    const label = requestedLabel.slice(0, 16);
    const exists = db.tags.find((t) => t.label.toLowerCase() === label.toLowerCase());
    if (exists) {
      if (exists.archived) throw bad('This tag has been archived by an administrator.');
      return res.json({ tag: exists, existed: true });
    }
    const tag = {
      id: uid('tag'),
      label,
      kind: 'custom',
      color: String(req.body.color || '#3f7bff'),
      description: String(req.body.description || '').slice(0, 80),
      createdBy: req.user.id,
      archived: false,
      createdAt: now(),
    };
    db.tags.push(tag);
    save();
    res.json({ tag, existed: false });
  })
);

function normalizeTags(input, requireEvidence = true) {
  const list = [...new Set((Array.isArray(input) ? input : []).map((t) => TAG_SOURCE[String(t).trim()] || String(t).trim()).filter(Boolean))];
  const evidence = list.filter((t) => EVIDENCE_TAGS.includes(t));
  if (requireEvidence && evidence.length !== 1) throw bad('Choose exactly one evidence declaration: Detailed evidence or No detailed evidence.');
  if (!requireEvidence && evidence.length > 1) throw bad('Choose no more than one evidence declaration.');
  const unknown = list.filter((t) => !db.tags.some((x) => x.label === t && !x.archived));
  if (unknown.length) throw bad(`Unrecognized tags: ${unknown.map((tag) => TAG_EN[tag] || tag).join(', ')}`);
  if (list.length > 8) throw bad('A post may have no more than 8 tags.');
  return list;
}

/* -------------------------------- 马甲 -------------------------------- */

const SIGILS = ['🜂', '🜁', '🜃', '🜄', '☾', '✶', '⚑', '⌁', '❖', '⟁'];

tavernRouter.get(
  '/profiles',
  requireAuth,
  wrap((req, res) => {
    const mine = db.profiles.filter((p) => p.userId === req.user.id);
    res.json({
      profiles: mine.map((p) => ({
        ...publicProfile(p.id),
        retired: !!p.retired,
        offers: db.offers.filter((o) => o.profileId === p.id).length,
        requests: db.requests.filter((r) => r.profileId === p.id).length,
        earnings: db.transactions.filter((t) => t.profileId === p.id).reduce((s, t) => s + Math.max(0, t.delta), 0),
      })),
      max: MAX_PROFILES,
      sigils: SIGILS,
    });
  })
);

tavernRouter.post(
  '/profiles',
  requireAuth,
  wrap((req, res) => {
    const alias = String(req.body.alias || '').trim().slice(0, 20);
    if (alias.length < 2) throw bad('Mask alias must be at least 2 characters.');
    if (db.profiles.some((p) => p.alias === alias)) throw bad('That mask alias is already in use.');
    const active = db.profiles.filter((p) => p.userId === req.user.id && !p.retired).length;
    if (active >= MAX_PROFILES) throw bad(`An account may have no more than ${MAX_PROFILES} active masks.`);

    const profile = {
      id: uid('prf'),
      userId: req.user.id,
      alias,
      sigil: SIGILS.includes(req.body.sigil) ? req.body.sigil : SIGILS[Math.floor(Math.random() * SIGILS.length)],
      bio: String(req.body.bio || '').slice(0, 120),
      reputation: 0,
      dealsClosed: 0,
      retired: false,
      createdAt: now(),
    };
    db.profiles.push(profile);
    save();
    res.json({ profile: publicProfile(profile.id) });
  })
);

tavernRouter.patch(
  '/profiles/:id',
  requireAuth,
  wrap((req, res) => {
    const p = ownProfile(req.user, req.params.id);
    if (req.body.bio !== undefined) p.bio = String(req.body.bio).slice(0, 120);
    if (req.body.sigil && SIGILS.includes(req.body.sigil)) p.sigil = req.body.sigil;
    save();
    res.json({ profile: publicProfile(p.id) });
  })
);

/** 停用马甲：历史交易保留，但不能再发布 */
tavernRouter.post(
  '/profiles/:id/retire',
  requireAuth,
  wrap((req, res) => {
    const p = ownProfile(req.user, req.params.id);
    p.retired = true;
    for (const o of db.offers) if (o.profileId === p.id && o.status === 'open') o.status = 'withdrawn';
    save();
    res.json({ ok: true });
  })
);

/* ------------------------------ 情报（卖） ------------------------------ */

tavernRouter.get(
  '/offers',
  wrap((req, res) => {
    const { q, tag, evidence, sort = 'new' } = req.query;
    let items = db.offers.filter((o) => !o.hiddenByAdmin && o.status === 'open' && !isBlocked(o, req.user));
    if (q) items = items.filter((o) => {
      const item = publicOffer(o, req.user);
      return matchText(q, item.title, item.summary, ...(item.tags || []), item.seller.alias);
    });
    if (tag) items = items.filter((o) => (o.tags || []).includes(TAG_SOURCE[String(tag)] || String(tag)));
    if (evidence === 'yes') items = items.filter((o) => (o.tags || []).includes(EVIDENCE_TAGS[0]));
    if (evidence === 'no') items = items.filter((o) => (o.tags || []).includes(EVIDENCE_TAGS[1]));

    items = items.slice().sort((a, b) => {
      if (sort === 'cheap') return Math.min(...a.tiers.map((t) => t.price)) - Math.min(...b.tiers.map((t) => t.price));
      if (sort === 'hot') return (b.views ?? 0) - (a.views ?? 0);
      return b.createdAt.localeCompare(a.createdAt);
    });

    const page = paginate(items, { page: req.query.page, pageSize: req.query.pageSize || 12 });
    res.json({ ...page, items: page.items.map((o) => publicOffer(o, req.user)) });
  })
);

tavernRouter.get(
  '/offers/:id',
  wrap((req, res) => {
    const o = db.offers.find((x) => x.id === req.params.id);
    if (!o || o.hiddenByAdmin || isBlocked(o, req.user)) throw missing('This information is not available.');
    o.views = (o.views ?? 0) + 1;
    save();
    res.json({ offer: publicOffer(o, req.user) });
  })
);

tavernRouter.post(
  '/offers',
  requireAuth,
  wrap((req, res) => {
    const profile = ownProfile(req.user, req.body.profileId);
    const title = String(req.body.title || '').trim().slice(0, 80);
    if (title.length < 4) throw bad('The public title must be at least 4 characters.');
    const tags = normalizeTags(req.body.tags);

    const tiers = (Array.isArray(req.body.tiers) ? req.body.tiers : []).map((t, i) => {
      const price = Math.round(Number(t.price));
      if (!Number.isFinite(price) || price < 0) throw bad(`Tier ${i + 1} must have a valid non-negative price.`);
      const content = String(t.content || '').trim();
      if (content.length < 10) throw bad(`Protected content in tier ${i + 1} must be at least 10 characters.`);
      const evidenceIds = (Array.isArray(t.evidenceIds) ? t.evidenceIds : []).filter((id) =>
        db.evidence.some((e) => e.id === id && e.uploaderId === req.user.id)
      );
      return {
        id: uid('tier'),
        name: String(t.name || `Tier ${i + 1}`).slice(0, 24),
        detail: String(t.detail || '').slice(0, 120),
        price,
        content,
        evidenceIds,
      };
    });
    if (!tiers.length) throw bad('Add at least one access tier.');
    if (tiers.length > 4) throw bad('An information listing may have no more than 4 tiers.');
    if (tags.includes(EVIDENCE_TAGS[0]) && !tiers.some((t) => t.evidenceIds.length)) {
      throw bad('A listing marked “Detailed evidence” must attach at least one evidence file to a tier.');
    }

    const offer = {
      id: uid('ofr'),
      profileId: profile.id,
      title,
      summary: String(req.body.summary || '').slice(0, 200),
      tags,
      tiers: tiers.sort((a, b) => a.price - b.price),
      blockedUserIds: normalizeBlockedUsers(req.user, req.body.blockedUserIds),
      exclusive: !!req.body.exclusive,
      exclusivePrice: null,
      status: 'open',
      views: 0,
      hiddenByAdmin: false,
      createdAt: now(),
    };
    if (offer.exclusive) {
      const price = Math.round(Number(req.body.exclusivePrice));
      if (!Number.isFinite(price) || price < 1) throw bad('Exclusive buyout price must be at least 1 TMT.');
      offer.exclusivePrice = price;
    }
    db.offers.unshift(offer);
    reviewPossibleResale(req.user, offer);
    save();
    res.json({ offer: publicOffer(offer, req.user) });
  })
);

tavernRouter.post(
  '/offers/:id/purchase',
  requireAuth,
  wrap((req, res) => {
    const offer = db.offers.find((x) => x.id === req.params.id);
    if (!offer || offer.hiddenByAdmin || offer.status !== 'open') throw missing('This information is not currently available for purchase.');
    if (isBlocked(offer, req.user)) throw new HttpError(403, 'The seller has excluded this account from the listing.');
    const buyout = !!req.body.buyout;
    if (!!offer.exclusive !== buyout) throw bad(offer.exclusive ? 'This listing is available only as an exclusive buyout.' : 'This listing does not offer an exclusive buyout.');
    const tier = buyout ? null : offer.tiers.find((t) => t.id === req.body.tierId);
    if (!buyout && !tier) throw missing('This access tier does not exist.');

    const seller = userOfProfile(offer.profileId);
    if (!seller) throw bad('The seller account is no longer available.');
    if (seller.id === req.user.id) throw bad('You cannot purchase your own information.');
    if (!buyout && hasUnlocked(req.user.id, offer.id, tier.id)) throw bad('You have already unlocked this tier.');

    // 买家也用马甲露面，保证卖家看不到真实身份
    const buyerProfile = req.body.buyerProfileId ? ownProfile(req.user, req.body.buyerProfileId) : null;
    const price = buyout ? offer.exclusivePrice : tier.price;
    const tierId = buyout ? '*' : tier.id;
    const tierName = buyout ? 'Exclusive buyout' : tier.name;

    debit(req.user, price, 'offer_purchase', `Purchased “${offer.title}” — ${tierName}`, {
      type: 'offer',
      id: offer.id,
      profileId: buyerProfile?.id,
    });
    credit(seller, price, 'offer_income', `Sold “${offer.title}” — ${tierName}`, {
      type: 'offer',
      id: offer.id,
      profileId: offer.profileId,
    });

    db.purchases.unshift({
      id: uid('buy'),
      offerId: offer.id,
      tierId,
      buyerUserId: req.user.id,
      buyerProfileId: buyerProfile?.id || null,
      sellerProfileId: offer.profileId,
      amount: price,
      createdAt: now(),
    });
    if (buyout) {
      offer.status = 'sold';
      offer.soldToUserId = req.user.id;
      offer.soldAt = now();
    }
    const sellerProfile = profileById(offer.profileId);
    if (sellerProfile) sellerProfile.dealsClosed = (sellerProfile.dealsClosed ?? 0) + 1;
    notify(seller.id, {
      type: 'offer_purchase',
      title: buyout ? 'Exclusive buyout completed' : 'Information purchased',
      message: buyout ? `Your listing “${offer.title}” was bought out for ${price} TMT and is now closed.` : `A buyer unlocked “${offer.title}” for ${price} TMT.`,
      href: `/tavern/offers/${offer.id}`,
    });
    save();

    res.json({ offer: publicOffer(offer, req.user) });
  })
);

tavernRouter.post(
  '/offers/:id/withdraw',
  requireAuth,
  wrap((req, res) => {
    const offer = db.offers.find((x) => x.id === req.params.id);
    if (!offer) throw missing('Information listing not found.');
    if (userOfProfile(offer.profileId)?.id !== req.user.id) throw new HttpError(403, 'You can withdraw only your own information listing.');
    if (offer.status !== 'open') throw bad('Only an active listing can be withdrawn.');
    offer.status = 'withdrawn';
    save();
    res.json({ ok: true });
  })
);

/* ------------------------------ 悬赏（买） ------------------------------ */

tavernRouter.get(
  '/requests',
  wrap((req, res) => {
    const { q, tag, status } = req.query;
    let items = db.requests.filter((r) => !r.hiddenByAdmin && !isBlocked(r, req.user));
    if (q) items = items.filter((r) => {
      const item = publicRequest(r, req.user);
      return matchText(q, item.title, item.brief, ...(item.tags || []), item.buyer.alias);
    });
    if (tag) items = items.filter((r) => (r.tags || []).includes(TAG_SOURCE[String(tag)] || String(tag)));
    if (status && status !== 'all') items = items.filter((r) => r.status === status);
    items = items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const page = paginate(items, { page: req.query.page, pageSize: req.query.pageSize || 12 });
    res.json({ ...page, items: page.items.map((r) => publicRequest(r, req.user)) });
  })
);

tavernRouter.get(
  '/requests/:id',
  wrap((req, res) => {
    const r = db.requests.find((x) => x.id === req.params.id);
    if (!r || r.hiddenByAdmin || isBlocked(r, req.user)) throw missing('This request is not available.');
    res.json({ request: publicRequest(r, req.user) });
  })
);

tavernRouter.post(
  '/requests',
  requireAuth,
  wrap((req, res) => {
    const profile = ownProfile(req.user, req.body.profileId);
    const title = String(req.body.title || '').trim().slice(0, 80);
    if (title.length < 4) throw bad('The public title must be at least 4 characters.');
    const tags = normalizeTags(req.body.tags, false);

    const tiers = (Array.isArray(req.body.tiers) ? req.body.tiers : []).map((t, i) => {
      const price = Math.round(Number(t.price));
      if (!Number.isFinite(price) || price <= 0) throw bad(`Reward tier ${i + 1} must be greater than 0 TMT.`);
      return {
        id: uid('rt'),
        name: String(t.name || `Tier ${i + 1}`).slice(0, 24),
        detail: String(t.detail || '').slice(0, 160),
        price,
      };
    });
    if (!tiers.length) throw bad('Add at least one reward tier.');
    if (tiers.length > 5) throw bad('A request may have no more than 5 reward tiers.');
    tiers.sort((a, b) => a.price - b.price);

    const maxPrice = tiers[tiers.length - 1].price;
    const deposit = Math.round(Number(req.body.deposit));
    if (!Number.isFinite(deposit) || deposit < maxPrice) {
      throw bad(`Escrow must cover the highest reward tier (${maxPrice} TMT).`);
    }

    lockEscrow(req.user, deposit, { type: 'request', id: 'pending', profileId: profile.id });

    const request = {
      id: uid('req'),
      profileId: profile.id,
      title,
      brief: String(req.body.brief || '').slice(0, 600),
      tags,
      blockedUserIds: normalizeBlockedUsers(req.user, req.body.blockedUserIds),
      tiers,
      deposit,
      depositRemaining: deposit,
      deadline: req.body.deadline || null,
      status: 'open',
      hiddenByAdmin: false,
      createdAt: now(),
    };
    db.requests.unshift(request);
    save();
    res.json({ request: publicRequest(request, req.user) });
  })
);

/** 间谍应征：提交内容只有委托方（和仲裁）能看到 */
tavernRouter.post(
  '/requests/:id/submit',
  requireAuth,
  wrap((req, res) => {
    const request = db.requests.find((x) => x.id === req.params.id);
    if (!request || request.hiddenByAdmin) throw missing('Request not found.');
    if (isBlocked(request, req.user)) throw new HttpError(403, 'The requester has excluded this account from the request.');
    if (request.status !== 'open') throw bad('This request is closed.');
    const profile = ownProfile(req.user, req.body.profileId);
    if (userOfProfile(request.profileId)?.id === req.user.id) throw bad('You cannot submit to your own request.');

    const tier = request.tiers.find((t) => t.id === req.body.tierId);
    if (!tier) throw missing('Reward tier not found.');
    const content = String(req.body.content || '').trim();
    if (content.length < 10) throw bad('Submission content must be at least 10 characters.');

    const submission = {
      id: uid('sub'),
      requestId: request.id,
      profileId: profile.id,
      tierId: tier.id,
      content,
      evidenceIds: (Array.isArray(req.body.evidenceIds) ? req.body.evidenceIds : []).filter((id) =>
        db.evidence.some((e) => e.id === id && e.uploaderId === req.user.id)
      ),
      status: 'pending',
      createdAt: now(),
    };
    db.submissions.unshift(submission);
    const requestOwner = userOfProfile(request.profileId);
    if (requestOwner) {
      notify(requestOwner.id, {
        type: 'tavern_reply',
        title: 'New reply to your reporting request',
        message: `A contributor replied to “${request.title}” under the ${tier.name} reward tier.`,
        href: `/tavern/requests/${request.id}`,
      });
    }
    save();
    res.json({ request: publicRequest(request, req.user) });
  })
);

/** 委托方结算：接受则从保证金里付款，拒绝则留痕供仲裁参考 */
tavernRouter.post(
  '/requests/:id/settle',
  requireAuth,
  wrap((req, res) => {
    const request = db.requests.find((x) => x.id === req.params.id);
    if (!request) throw missing('Request not found.');
    if (userOfProfile(request.profileId)?.id !== req.user.id) throw new HttpError(403, 'Only the requester can settle submissions.');
    const submission = db.submissions.find((s) => s.id === req.body.submissionId && s.requestId === request.id);
    if (!submission) throw missing('Submission not found.');
    if (submission.status !== 'pending') throw bad('This submission has already been processed.');

    const action = req.body.action === 'accept' ? 'accept' : 'reject';
    if (action === 'reject') {
      submission.status = 'rejected';
      submission.rejectReason = String(req.body.reason || '').slice(0, 200);
      const supplier = userOfProfile(submission.profileId);
      if (supplier) notify(supplier.id, {
        type: 'submission_update',
        title: 'Tavern submission updated',
        message: `Your reply to “${request.title}” was not accepted.`,
        href: `/tavern/requests/${request.id}`,
      });
      save();
      return res.json({ request: publicRequest(request, req.user) });
    }

    const tier = request.tiers.find((t) => t.id === submission.tierId);
    const supplier = userOfProfile(submission.profileId);
    if (!supplier) throw bad('The supplier account is no longer available.');
    payFromEscrow(req.user, supplier, tier.price, { type: 'request', id: request.id }, `Request “${request.title}” — ${tier.name}`);
    request.depositRemaining -= tier.price;
    submission.status = 'accepted';
    submission.paid = tier.price;
    notify(supplier.id, {
      type: 'submission_update',
      title: 'Tavern submission accepted',
      message: `Your reply to “${request.title}” was accepted. ${tier.price} TMT has been released to your wallet.`,
      href: `/tavern/requests/${request.id}`,
    });

    const sp = profileById(submission.profileId);
    if (sp) {
      sp.dealsClosed = (sp.dealsClosed ?? 0) + 1;
      sp.reputation = (sp.reputation ?? 0) + 2;
    }
    save();
    res.json({ request: publicRequest(request, req.user) });
  })
);

/** 关闭委托并退回剩余保证金 */
tavernRouter.post(
  '/requests/:id/close',
  requireAuth,
  wrap((req, res) => {
    const request = db.requests.find((x) => x.id === req.params.id);
    if (!request) throw missing('Request not found.');
    if (userOfProfile(request.profileId)?.id !== req.user.id) throw new HttpError(403, 'Only the requester can close this request.');
    if (request.status === 'closed') throw bad('This request is already closed.');
    const pending = db.submissions.filter((s) => s.requestId === request.id && s.status === 'pending');
    if (pending.length) throw bad(`${pending.length} submissions are still pending. Process them before closing the request.`);

    releaseEscrow(req.user, request.depositRemaining, { type: 'request', id: request.id }, `Escrow returned for request “${request.title}”`);
    request.depositRemaining = 0;
    request.status = 'closed';
    save();
    res.json({ request: publicRequest(request, req.user) });
  })
);

/* -------------------------------- 举报 -------------------------------- */

export const REPORT_REASONS = [
  { id: 'fake', label: 'Deliberately false information' },
  { id: 'deadbeat', label: 'Deliberate non-payment' },
  { id: 'doxx', label: 'Harassment or identity exposure' },
  { id: 'reupload', label: 'Reselling another source’s material' },
  { id: 'illegal', label: 'Illegal or dangerous content' },
  { id: 'other', label: 'Other' },
];

tavernRouter.get(
  '/report-reasons',
  wrap((_req, res) => res.json({ reasons: REPORT_REASONS }))
);

tavernRouter.post(
  '/reports',
  requireAuth,
  wrap((req, res) => {
    const targetType = ['offer', 'request', 'submission', 'profile'].includes(req.body.targetType) ? req.body.targetType : null;
    if (!targetType) throw bad('Invalid report target type.');
    const pool = { offer: db.offers, request: db.requests, submission: db.submissions, profile: db.profiles }[targetType];
    const target = pool.find((x) => x.id === req.body.targetId);
    if (!target) throw missing('Report target not found.');
    if (!REPORT_REASONS.some((r) => r.id === req.body.reason)) throw bad('Choose a reason for the report.');

    const report = {
      id: uid('rpt'),
      reporterUserId: req.user.id,
      reporterProfileId: req.body.profileId || null,
      targetType,
      targetId: req.body.targetId,
      reason: req.body.reason,
      detail: String(req.body.detail || '').slice(0, 600),
      evidenceIds: (Array.isArray(req.body.evidenceIds) ? req.body.evidenceIds : []).filter((id) =>
        db.evidence.some((e) => e.id === id && e.uploaderId === req.user.id)
      ),
      status: 'pending',
      createdAt: now(),
    };
    db.reports.unshift(report);
    save();
    res.json({ report: { id: report.id, status: report.status, createdAt: report.createdAt } });
  })
);

/** 我提交过的举报进度 */
tavernRouter.get(
  '/reports/mine',
  requireAuth,
  wrap((req, res) => {
    const items = db.reports
      .filter((r) => r.reporterUserId === req.user.id)
      .map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: REPORT_REASONS.find((x) => x.id === r.reason)?.label || r.reason,
        status: r.status,
        createdAt: r.createdAt,
        verdict: db.arbitrations.find((a) => a.reportId === r.id)?.summary || null,
      }));
    res.json({ items });
  })
);

/** 公开处罚公告栏：仲裁认定情节过于严重时才会出现在这里 */
tavernRouter.get(
  '/disclosures',
  wrap((_req, res) => {
    res.json({
      items: db.arbitrations
        .filter((a) => a.disclosure)
        .map((a) => ({
          id: a.id,
          subject: a.disclosure.subject,
          aliases: a.disclosure.aliases,
          statement: a.disclosure.statement,
          severity: a.severity,
          publishedAt: a.disclosure.publishedAt,
        })),
    });
  })
);

/* ------------------------------ 我的交易 ------------------------------ */

tavernRouter.get(
  '/me/desk',
  requireAuth,
  wrap((req, res) => {
    const myProfileIds = db.profiles.filter((p) => p.userId === req.user.id).map((p) => p.id);
    res.json({
      offers: db.offers.filter((o) => myProfileIds.includes(o.profileId)).map((o) => publicOffer(o, req.user)),
      requests: db.requests.filter((r) => myProfileIds.includes(r.profileId)).map((r) => publicRequest(r, req.user)),
      purchases: db.purchases
        .filter((p) => p.buyerUserId === req.user.id)
        .map((p) => {
          const offer = db.offers.find((o) => o.id === p.offerId);
          return {
            id: p.id,
            amount: p.amount,
            createdAt: p.createdAt,
            offerId: p.offerId,
            offerTitle: offer?.title || '(withdrawn)',
            tierName: offer?.tiers.find((t) => t.id === p.tierId)?.name || '-',
          };
        }),
      submissions: db.submissions
        .filter((s) => myProfileIds.includes(s.profileId))
        .map((s) => ({
          id: s.id,
          requestId: s.requestId,
          requestTitle: db.requests.find((r) => r.id === s.requestId)?.title || '(withdrawn)',
          status: s.status,
          paid: s.paid || 0,
          createdAt: s.createdAt,
        })),
      received: db.submissions
        .filter((s) => s.status === 'accepted')
        .flatMap((s) => {
          const request = db.requests.find((r) => r.id === s.requestId);
          if (!request || userOfProfile(request.profileId)?.id !== req.user.id) return [];
          const tier = request.tiers.find((item) => item.id === s.tierId);
          return [{
            id: s.id,
            requestId: request.id,
            requestTitle: request.title,
            tierName: tier?.name || 'Accepted submission',
            content: s.content,
            evidence: (s.evidenceIds || []).map(evidenceById).filter(Boolean),
            paid: s.paid || 0,
            createdAt: s.createdAt,
          }];
        }),
    });
  })
);
