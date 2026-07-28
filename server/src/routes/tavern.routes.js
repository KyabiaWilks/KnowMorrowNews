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
} from '../services.js';
import { bad, matchText, missing, now, paginate, uid, wrap, HttpError } from '../util.js';
import { notify } from '../notifications.js';

export const tavernRouter = Router();

/** 每条情报必须声明证据等级，这两个标签由系统锁定 */
export const EVIDENCE_TAGS = ['有详细证据', '没有详细证据'];
const MAX_PROFILES = 6;
const TAG_EN = { '有详细证据': 'Detailed evidence', '没有详细证据': 'No detailed evidence', '军事': 'Military', '外交': 'Diplomacy', '能源': 'Energy', '内部人事': 'Internal affairs', '卫星影像': 'Satellite imagery', '时效性强': 'Time-sensitive', '高风险': 'High risk', '经济': 'Economy', '基础设施情报': 'Infrastructure' };
const TAG_SOURCE = Object.fromEntries(Object.entries(TAG_EN).map(([source, english]) => [english, source]));

/* -------------------------------- 标签 -------------------------------- */

tavernRouter.get(
  '/tags',
  wrap((_req, res) => {
    const usage = {};
    for (const o of db.offers) for (const t of o.tags || []) usage[t] = (usage[t] || 0) + 1;
    for (const r of db.requests) for (const t of r.tags || []) usage[t] = (usage[t] || 0) + 1;
    res.json({
      tags: db.tags
        .filter((t) => !t.archived)
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
    const label = String(req.body.label || '').trim().slice(0, 16);
    if (label.length < 1) throw bad('标签不能为空');
    const exists = db.tags.find((t) => t.label === label);
    if (exists) {
      if (exists.archived) throw bad('该标签已被管理员归档');
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

function normalizeTags(input) {
  const list = [...new Set((Array.isArray(input) ? input : []).map((t) => TAG_SOURCE[String(t).trim()] || String(t).trim()).filter(Boolean))];
  const evidence = list.filter((t) => EVIDENCE_TAGS.includes(t));
  if (evidence.length !== 1) throw bad(`必须且只能选择一个证据标签：${EVIDENCE_TAGS.join(' / ')}`);
  const unknown = list.filter((t) => !db.tags.some((x) => x.label === t && !x.archived));
  if (unknown.length) throw bad(`存在未登记的标签：${unknown.join('、')}`);
  if (list.length > 8) throw bad('每条最多 8 个标签');
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
    if (alias.length < 2) throw bad('代号至少 2 个字');
    if (db.profiles.some((p) => p.alias === alias)) throw bad('这个代号已经有人用了，换一个吧');
    const active = db.profiles.filter((p) => p.userId === req.user.id && !p.retired).length;
    if (active >= MAX_PROFILES) throw bad(`最多同时持有 ${MAX_PROFILES} 个马甲`);

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
    let items = db.offers.filter((o) => !o.hiddenByAdmin && o.status !== 'withdrawn');
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
    if (!o || o.hiddenByAdmin) throw missing('这条情报已经从墙上撕走了');
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
    if (title.length < 4) throw bad('标题至少 4 个字（标题对所有人公开）');
    const tags = normalizeTags(req.body.tags);

    const tiers = (Array.isArray(req.body.tiers) ? req.body.tiers : []).map((t, i) => {
      const price = Math.round(Number(t.price));
      if (!Number.isFinite(price) || price < 0) throw bad(`第 ${i + 1} 档价格不合法`);
      const content = String(t.content || '').trim();
      if (content.length < 10) throw bad(`第 ${i + 1} 档的情报正文至少 10 个字`);
      const evidenceIds = (Array.isArray(t.evidenceIds) ? t.evidenceIds : []).filter((id) =>
        db.evidence.some((e) => e.id === id && e.uploaderId === req.user.id)
      );
      return {
        id: uid('tier'),
        name: String(t.name || `第 ${i + 1} 档`).slice(0, 24),
        detail: String(t.detail || '').slice(0, 120),
        price,
        content,
        evidenceIds,
      };
    });
    if (!tiers.length) throw bad('至少需要一个价格档位');
    if (tiers.length > 4) throw bad('最多 4 个价格档位');
    if (tags.includes(EVIDENCE_TAGS[0]) && !tiers.some((t) => t.evidenceIds.length)) {
      throw bad('标记为「有详细证据」时，至少要有一个档位附带证据文件');
    }

    const offer = {
      id: uid('ofr'),
      profileId: profile.id,
      title,
      summary: String(req.body.summary || '').slice(0, 200),
      tags,
      tiers: tiers.sort((a, b) => a.price - b.price),
      status: 'open',
      views: 0,
      hiddenByAdmin: false,
      createdAt: now(),
    };
    db.offers.unshift(offer);
    save();
    res.json({ offer: publicOffer(offer, req.user) });
  })
);

tavernRouter.post(
  '/offers/:id/purchase',
  requireAuth,
  wrap((req, res) => {
    const offer = db.offers.find((x) => x.id === req.params.id);
    if (!offer || offer.hiddenByAdmin || offer.status !== 'open') throw missing('该情报当前不可交易');
    const tier = offer.tiers.find((t) => t.id === req.body.tierId);
    if (!tier) throw missing('没有这个档位');

    const seller = userOfProfile(offer.profileId);
    if (!seller) throw bad('卖方身份已失效');
    if (seller.id === req.user.id) throw bad('不能买自己的情报');
    if (hasUnlocked(req.user.id, offer.id, tier.id)) throw bad('你已经解锁过这一档了');

    // 买家也用马甲露面，保证卖家看不到真实身份
    const buyerProfile = req.body.buyerProfileId ? ownProfile(req.user, req.body.buyerProfileId) : null;

    debit(req.user, tier.price, 'offer_purchase', `解锁情报《${offer.title}》- ${tier.name}`, {
      type: 'offer',
      id: offer.id,
      profileId: buyerProfile?.id,
    });
    credit(seller, tier.price, 'offer_income', `售出情报《${offer.title}》- ${tier.name}`, {
      type: 'offer',
      id: offer.id,
      profileId: offer.profileId,
    });

    db.purchases.unshift({
      id: uid('buy'),
      offerId: offer.id,
      tierId: tier.id,
      buyerUserId: req.user.id,
      buyerProfileId: buyerProfile?.id || null,
      sellerProfileId: offer.profileId,
      amount: tier.price,
      createdAt: now(),
    });
    const sellerProfile = profileById(offer.profileId);
    if (sellerProfile) sellerProfile.dealsClosed = (sellerProfile.dealsClosed ?? 0) + 1;
    save();

    res.json({ offer: publicOffer(offer, req.user) });
  })
);

tavernRouter.post(
  '/offers/:id/withdraw',
  requireAuth,
  wrap((req, res) => {
    const offer = db.offers.find((x) => x.id === req.params.id);
    if (!offer) throw missing('情报不存在');
    if (userOfProfile(offer.profileId)?.id !== req.user.id) throw new HttpError(403, '这不是你发布的情报');
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
    let items = db.requests.filter((r) => !r.hiddenByAdmin);
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
    if (!r || r.hiddenByAdmin) throw missing('该委托已撤下');
    res.json({ request: publicRequest(r, req.user) });
  })
);

tavernRouter.post(
  '/requests',
  requireAuth,
  wrap((req, res) => {
    const profile = ownProfile(req.user, req.body.profileId);
    const title = String(req.body.title || '').trim().slice(0, 80);
    if (title.length < 4) throw bad('标题至少 4 个字');
    const tags = normalizeTags(req.body.tags);

    const tiers = (Array.isArray(req.body.tiers) ? req.body.tiers : []).map((t, i) => {
      const price = Math.round(Number(t.price));
      if (!Number.isFinite(price) || price <= 0) throw bad(`第 ${i + 1} 档赏金不合法`);
      return {
        id: uid('rt'),
        name: String(t.name || `第 ${i + 1} 档`).slice(0, 24),
        detail: String(t.detail || '').slice(0, 160),
        price,
      };
    });
    if (!tiers.length) throw bad('阶梯价格至少要有一档');
    if (tiers.length > 5) throw bad('阶梯价格最多 5 档');
    tiers.sort((a, b) => a.price - b.price);

    const maxPrice = tiers[tiers.length - 1].price;
    const deposit = Math.round(Number(req.body.deposit));
    if (!Number.isFinite(deposit) || deposit < maxPrice) {
      throw bad(`保证金不得低于最高档赏金（${maxPrice} TMT），这是委托方不拖欠的凭据`);
    }

    lockEscrow(req.user, deposit, { type: 'request', id: 'pending', profileId: profile.id });

    const request = {
      id: uid('req'),
      profileId: profile.id,
      title,
      brief: String(req.body.brief || '').slice(0, 600),
      tags,
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
    if (!request || request.hiddenByAdmin) throw missing('该委托不存在');
    if (request.status !== 'open') throw bad('该委托已关闭');
    const profile = ownProfile(req.user, req.body.profileId);
    if (userOfProfile(request.profileId)?.id === req.user.id) throw bad('不能应征自己发布的委托');

    const tier = request.tiers.find((t) => t.id === req.body.tierId);
    if (!tier) throw missing('没有这个赏金档位');
    const content = String(req.body.content || '').trim();
    if (content.length < 10) throw bad('提交内容至少 10 个字');

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
    if (!request) throw missing('该委托不存在');
    if (userOfProfile(request.profileId)?.id !== req.user.id) throw new HttpError(403, '只有委托方能结算');
    const submission = db.submissions.find((s) => s.id === req.body.submissionId && s.requestId === request.id);
    if (!submission) throw missing('没有这条应征');
    if (submission.status !== 'pending') throw bad('这条应征已经处理过了');

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
    if (!supplier) throw bad('对方身份已失效');
    payFromEscrow(req.user, supplier, tier.price, { type: 'request', id: request.id }, `委托《${request.title}》- ${tier.name}`);
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
    if (!request) throw missing('该委托不存在');
    if (userOfProfile(request.profileId)?.id !== req.user.id) throw new HttpError(403, '只有委托方能关闭');
    if (request.status === 'closed') throw bad('已经关闭了');
    const pending = db.submissions.filter((s) => s.requestId === request.id && s.status === 'pending');
    if (pending.length) throw bad(`还有 ${pending.length} 条应征未处理，先结清再关闭`);

    releaseEscrow(req.user, request.depositRemaining, { type: 'request', id: request.id }, `委托《${request.title}》保证金退回`);
    request.depositRemaining = 0;
    request.status = 'closed';
    save();
    res.json({ request: publicRequest(request, req.user) });
  })
);

/* -------------------------------- 举报 -------------------------------- */

export const REPORT_REASONS = [
  { id: 'fake', label: '恶意提供假信息' },
  { id: 'deadbeat', label: '恶意拖欠付款' },
  { id: 'doxx', label: '试图人肉 / 泄露他人真实身份' },
  { id: 'reupload', label: '倒卖他人情报' },
  { id: 'illegal', label: '违法或危害公共安全的内容' },
  { id: 'other', label: '其他' },
];

tavernRouter.get(
  '/report-reasons',
  wrap((_req, res) => res.json({ reasons: [
    { id: 'fake', label: 'Deliberately false information' },
    { id: 'deadbeat', label: 'Deliberate non-payment' },
    { id: 'doxx', label: 'Harassment or identity exposure' },
    { id: 'reupload', label: 'Reselling another source’s material' },
    { id: 'illegal', label: 'Illegal or dangerous content' },
    { id: 'other', label: 'Other' },
  ] }))
);

tavernRouter.post(
  '/reports',
  requireAuth,
  wrap((req, res) => {
    const targetType = ['offer', 'request', 'submission', 'profile'].includes(req.body.targetType) ? req.body.targetType : null;
    if (!targetType) throw bad('举报对象类型不合法');
    const pool = { offer: db.offers, request: db.requests, submission: db.submissions, profile: db.profiles }[targetType];
    const target = pool.find((x) => x.id === req.body.targetId);
    if (!target) throw missing('举报对象不存在');
    if (!REPORT_REASONS.some((r) => r.id === req.body.reason)) throw bad('请选择举报理由');

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
            offerTitle: offer?.title || '（已撤下）',
            tierName: offer?.tiers.find((t) => t.id === p.tierId)?.name || '-',
          };
        }),
      submissions: db.submissions
        .filter((s) => myProfileIds.includes(s.profileId))
        .map((s) => ({
          id: s.id,
          requestId: s.requestId,
          requestTitle: db.requests.find((r) => r.id === s.requestId)?.title || '（已撤下）',
          status: s.status,
          paid: s.paid || 0,
          createdAt: s.createdAt,
        })),
    });
  })
);
