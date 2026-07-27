import { Router } from 'express';
import { db, save } from '../db.js';
import { requireAdmin } from '../auth.js';
import { audit, credit, publicProfile, publicUser, record, walletOf } from '../services.js';
import { bad, missing, now, uid, wrap } from '../util.js';
import { REPORT_REASONS } from './tavern.routes.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

/* -------------------------------- 概览 -------------------------------- */

adminRouter.get(
  '/overview',
  wrap((_req, res) => {
    res.json({
      counts: {
        users: db.users.length,
        bannedUsers: db.users.filter((u) => u.banned).length,
        profiles: db.profiles.filter((p) => !p.retired).length,
        news: db.news.filter((a) => a.status === 'published').length,
        drafts: db.news.filter((a) => a.status !== 'published').length,
        journalists: db.journalists.length,
        offers: db.offers.filter((o) => o.status === 'open').length,
        requests: db.requests.filter((r) => r.status === 'open').length,
        pendingReports: db.reports.filter((r) => r.status === 'pending').length,
        tomatoes: db.tomatoes.length,
      },
      coinSupply: db.users.reduce((s, u) => s + (u.coins ?? 0) + (u.escrow ?? 0), 0),
      escrowHeld: db.users.reduce((s, u) => s + (u.escrow ?? 0), 0),
      recentAudit: db.auditLog.slice(0, 20),
    });
  })
);

/* -------------------------------- 新闻 -------------------------------- */

adminRouter.get(
  '/news',
  wrap((_req, res) => res.json({ items: db.news.slice().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)) }))
);

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || uid('post');

adminRouter.post(
  '/news',
  wrap((req, res) => {
    const article = {
      id: uid('news'),
      slug: slugify(req.body.slug || req.body.title),
      title: String(req.body.title || '未命名报道').slice(0, 120),
      summary: String(req.body.summary || '').slice(0, 300),
      body: String(req.body.body || ''),
      section: String(req.body.section || '要闻'),
      tags: Array.isArray(req.body.tags) ? req.body.tags.slice(0, 8) : [],
      cover: req.body.cover || null,
      dateline: String(req.body.dateline || ''),
      authorIds: Array.isArray(req.body.authorIds) ? req.body.authorIds : [],
      status: req.body.status === 'draft' ? 'draft' : 'published',
      featured: !!req.body.featured,
      readingMinutes: Math.max(1, Math.round(String(req.body.body || '').length / 400)),
      views: 0,
      publishedAt: req.body.publishedAt || now(),
    };
    db.news.unshift(article);
    audit(req.user, 'news.create', `创建报道《${article.title}》`);
    save();
    res.json({ article });
  })
);

adminRouter.patch(
  '/news/:id',
  wrap((req, res) => {
    const a = db.news.find((x) => x.id === req.params.id);
    if (!a) throw missing('报道不存在');
    for (const key of ['title', 'summary', 'body', 'section', 'cover', 'dateline', 'status', 'featured', 'publishedAt']) {
      if (req.body[key] !== undefined) a[key] = req.body[key];
    }
    if (Array.isArray(req.body.tags)) a.tags = req.body.tags.slice(0, 8);
    if (Array.isArray(req.body.authorIds)) a.authorIds = req.body.authorIds;
    a.readingMinutes = Math.max(1, Math.round(String(a.body || '').length / 400));
    audit(req.user, 'news.update', `修改报道《${a.title}》`);
    save();
    res.json({ article: a });
  })
);

adminRouter.delete(
  '/news/:id',
  wrap((req, res) => {
    const i = db.news.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw missing('报道不存在');
    audit(req.user, 'news.delete', `删除报道《${db.news[i].title}》`);
    db.news.splice(i, 1);
    save();
    res.json({ ok: true });
  })
);

/* -------------------------------- 记者 -------------------------------- */

adminRouter.get(
  '/journalists',
  wrap((_req, res) => res.json({ items: db.journalists }))
);

adminRouter.post(
  '/journalists',
  wrap((req, res) => {
    const j = {
      id: uid('jnl'),
      name: String(req.body.name || '新同事').slice(0, 40),
      title: String(req.body.title || '记者').slice(0, 40),
      avatar: req.body.avatar || null,
      portraitTone: req.body.portraitTone || '#2f6bff',
      tagline: String(req.body.tagline || '').slice(0, 80),
      bio: String(req.body.bio || ''),
      beats: Array.isArray(req.body.beats) ? req.body.beats : [],
      awards: Array.isArray(req.body.awards) ? req.body.awards : [],
      milestones: Array.isArray(req.body.milestones) ? req.body.milestones : [],
      signatureWorks: Array.isArray(req.body.signatureWorks) ? req.body.signatureWorks : [],
      contact: req.body.contact || null,
      featured: !!req.body.featured,
      hidden: false,
      joinedAt: req.body.joinedAt || now(),
    };
    db.journalists.push(j);
    audit(req.user, 'journalist.create', `新增记者 ${j.name}`);
    save();
    res.json({ journalist: j });
  })
);

adminRouter.patch(
  '/journalists/:id',
  wrap((req, res) => {
    const j = db.journalists.find((x) => x.id === req.params.id);
    if (!j) throw missing('记者不存在');
    for (const key of ['name', 'title', 'avatar', 'portraitTone', 'tagline', 'bio', 'contact', 'featured', 'hidden', 'joinedAt']) {
      if (req.body[key] !== undefined) j[key] = req.body[key];
    }
    for (const key of ['beats', 'awards', 'milestones', 'signatureWorks']) {
      if (Array.isArray(req.body[key])) j[key] = req.body[key];
    }
    audit(req.user, 'journalist.update', `更新记者 ${j.name}`);
    save();
    res.json({ journalist: j });
  })
);

adminRouter.delete(
  '/journalists/:id',
  wrap((req, res) => {
    const i = db.journalists.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw missing('记者不存在');
    audit(req.user, 'journalist.delete', `移除记者 ${db.journalists[i].name}`);
    db.journalists.splice(i, 1);
    save();
    res.json({ ok: true });
  })
);

/* -------------------------------- 标签 -------------------------------- */

adminRouter.get(
  '/tags',
  wrap((_req, res) => res.json({ items: db.tags }))
);

adminRouter.patch(
  '/tags/:id',
  wrap((req, res) => {
    const t = db.tags.find((x) => x.id === req.params.id);
    if (!t) throw missing('标签不存在');
    if (t.kind === 'system' && req.body.label && req.body.label !== t.label) throw bad('系统证据标签不可改名');
    if (t.kind === 'system' && req.body.archived) throw bad('系统证据标签不可归档');
    for (const key of ['label', 'color', 'description', 'archived']) if (req.body[key] !== undefined) t[key] = req.body[key];
    audit(req.user, 'tag.update', `调整标签 ${t.label}`);
    save();
    res.json({ tag: t });
  })
);

/* -------------------------------- 用户 -------------------------------- */

adminRouter.get(
  '/users',
  wrap((_req, res) => {
    res.json({
      items: db.users.map((u) => ({
        ...publicUser(u),
        frozenFunds: u.frozenFunds ?? 0,
        banReason: u.banReason || null,
        profiles: db.profiles.filter((p) => p.userId === u.id).map((p) => ({ id: p.id, alias: p.alias, retired: !!p.retired })),
      })),
    });
  })
);

adminRouter.patch(
  '/users/:id',
  wrap((req, res) => {
    const u = db.users.find((x) => x.id === req.params.id);
    if (!u) throw missing('用户不存在');
    if (req.body.role && ['user', 'admin'].includes(req.body.role)) u.role = req.body.role;
    if (req.body.banned !== undefined) {
      u.banned = !!req.body.banned;
      u.banReason = req.body.banned ? String(req.body.banReason || '管理员处置') : null;
    }
    if (req.body.grant) credit(u, Math.abs(Number(req.body.grant)), 'grant', '管理员发放');
    audit(req.user, 'user.update', `调整用户 ${u.username}`);
    save();
    res.json({ user: publicUser(u) });
  })
);

/* --------------------------- 举报 / 站内仲裁 --------------------------- */

function describeTarget(r) {
  if (r.targetType === 'offer') {
    const o = db.offers.find((x) => x.id === r.targetId);
    return { label: o ? `情报《${o.title}》` : '（已删除的情报）', profileId: o?.profileId || null };
  }
  if (r.targetType === 'request') {
    const q = db.requests.find((x) => x.id === r.targetId);
    return { label: q ? `委托《${q.title}》` : '（已删除的委托）', profileId: q?.profileId || null };
  }
  if (r.targetType === 'submission') {
    const s = db.submissions.find((x) => x.id === r.targetId);
    return { label: s ? `一条应征材料` : '（已删除的应征）', profileId: s?.profileId || null };
  }
  const p = db.profiles.find((x) => x.id === r.targetId);
  return { label: p ? `马甲「${p.alias}」` : '（已注销的马甲）', profileId: p?.id || null };
}

adminRouter.get(
  '/reports',
  wrap((req, res) => {
    const status = req.query.status || 'all';
    const items = db.reports
      .filter((r) => status === 'all' || r.status === status)
      .map((r) => {
        const target = describeTarget(r);
        const accused = target.profileId ? db.profiles.find((p) => p.id === target.profileId) : null;
        return {
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          targetLabel: target.label,
          reason: REPORT_REASONS.find((x) => x.id === r.reason)?.label || r.reason,
          detail: r.detail,
          status: r.status,
          createdAt: r.createdAt,
          evidence: (r.evidenceIds || []).map((id) => db.evidence.find((e) => e.id === id)).filter(Boolean).map((e) => ({ id: e.id, name: e.name, url: e.url })),
          reporter: r.reporterProfileId ? publicProfile(r.reporterProfileId) : { alias: '未具名举报', sigil: '✉' },
          // 仲裁需要看到被举报方的真实账号，这是规约里写明的例外
          accused: accused
            ? {
                profileId: accused.id,
                alias: accused.alias,
                userId: accused.userId,
                username: db.users.find((u) => u.id === accused.userId)?.username || '?',
                alts: db.profiles.filter((p) => p.userId === accused.userId).map((p) => p.alias),
              }
            : null,
          arbitration: db.arbitrations.find((a) => a.reportId === r.id) || null,
        };
      });
    res.json({ items, reasons: REPORT_REASONS });
  })
);

export const PENALTIES = [
  { id: 'warn', label: '警告并记录在案' },
  { id: 'takedown', label: '下架涉事内容' },
  { id: 'ban_all_alts', label: '封禁该用户的全部马甲账号' },
  { id: 'freeze_funds', label: '冻结站内财产' },
  { id: 'compensate', label: '划扣财产弥补客户损失' },
  { id: 'public_disclosure', label: '公开信息处罚' },
];

adminRouter.get(
  '/penalties',
  wrap((_req, res) => res.json({ penalties: PENALTIES }))
);

/**
 * 仲裁裁决。按规约可执行：封禁全部马甲、冻结并划扣财产弥补损失，
 * 情节过于严重者公开其信息。
 */
adminRouter.post(
  '/reports/:id/arbitrate',
  wrap((req, res) => {
    const report = db.reports.find((x) => x.id === req.params.id);
    if (!report) throw missing('举报不存在');
    if (report.status !== 'pending') throw bad('该举报已处理');

    const verdict = req.body.verdict === 'upheld' ? 'upheld' : 'dismissed';
    const severity = ['minor', 'major', 'severe'].includes(req.body.severity) ? req.body.severity : 'minor';
    const penalties = (Array.isArray(req.body.penalties) ? req.body.penalties : []).filter((p) => PENALTIES.some((x) => x.id === p));
    const target = describeTarget(report);
    const accusedProfile = target.profileId ? db.profiles.find((p) => p.id === target.profileId) : null;
    const accusedUser = accusedProfile ? db.users.find((u) => u.id === accusedProfile.userId) : null;
    const executed = [];

    if (verdict === 'upheld' && accusedUser) {
      if (penalties.includes('takedown')) {
        if (report.targetType === 'offer') {
          const o = db.offers.find((x) => x.id === report.targetId);
          if (o) { o.hiddenByAdmin = true; o.status = 'withdrawn'; }
        }
        if (report.targetType === 'request') {
          const q = db.requests.find((x) => x.id === report.targetId);
          if (q) q.hiddenByAdmin = true;
        }
        executed.push('已下架涉事内容');
      }
      if (penalties.includes('ban_all_alts')) {
        accusedUser.banned = true;
        accusedUser.banReason = `仲裁裁定：${REPORT_REASONS.find((x) => x.id === report.reason)?.label || report.reason}`;
        for (const p of db.profiles.filter((p) => p.userId === accusedUser.id)) p.retired = true;
        for (const o of db.offers.filter((o) => db.profiles.some((p) => p.id === o.profileId && p.userId === accusedUser.id))) {
          o.status = 'withdrawn';
        }
        executed.push(`已封禁 ${accusedUser.username} 名下全部 ${db.profiles.filter((p) => p.userId === accusedUser.id).length} 个马甲`);
      }
      if (penalties.includes('freeze_funds')) {
        const amount = Math.max(0, Number(req.body.freezeAmount) || walletOf(accusedUser).available);
        accusedUser.frozenFunds = (accusedUser.frozenFunds ?? 0) + amount;
        record(accusedUser.id, 0, 'freeze', `仲裁冻结 ${amount} TMT`, { type: 'report', id: report.id });
        executed.push(`已冻结 ${amount} TMT`);
      }
      if (penalties.includes('compensate')) {
        const amount = Math.max(0, Number(req.body.compensation) || 0);
        const victim = db.users.find((u) => u.id === (report.reporterUserId || ''));
        const pool = (accusedUser.coins ?? 0) + (accusedUser.escrow ?? 0);
        const take = Math.min(amount, pool);
        let left = take;
        const fromEscrow = Math.min(left, accusedUser.escrow ?? 0);
        accusedUser.escrow -= fromEscrow;
        left -= fromEscrow;
        accusedUser.coins -= left;
        accusedUser.frozenFunds = Math.max(0, (accusedUser.frozenFunds ?? 0) - take);
        record(accusedUser.id, -take, 'arbitration_debit', `仲裁划扣赔偿 ${take} TMT`, { type: 'report', id: report.id });
        if (victim) credit(victim, take, 'arbitration_credit', `仲裁赔偿到账 ${take} TMT`, { type: 'report', id: report.id });
        executed.push(`已划扣 ${take} TMT 赔付举报方`);
      }
      if (penalties.includes('public_disclosure')) {
        executed.push('已列入公开处罚公告栏');
      }
    }

    const arb = {
      id: uid('arb'),
      reportId: report.id,
      verdict,
      severity,
      penalties,
      summary: String(req.body.summary || '').slice(0, 300) || (verdict === 'upheld' ? '举报成立' : '举报不成立'),
      notes: String(req.body.notes || '').slice(0, 1000),
      executed,
      disclosure:
        verdict === 'upheld' && penalties.includes('public_disclosure') && accusedUser
          ? {
              publishedAt: now(),
              subject: accusedUser.username,
              aliases: db.profiles.filter((p) => p.userId === accusedUser.id).map((p) => p.alias),
              statement: String(req.body.disclosureText || '').slice(0, 500) || `因${REPORT_REASONS.find((x) => x.id === report.reason)?.label}，情节严重，依规约公开其站内身份。`,
            }
          : null,
      decidedBy: req.user.username,
      decidedAt: now(),
    };
    db.arbitrations.unshift(arb);
    report.status = verdict === 'upheld' ? 'upheld' : 'dismissed';
    audit(req.user, 'report.arbitrate', `裁决举报 ${report.id}：${arb.summary}`);
    save();
    res.json({ arbitration: arb });
  })
);

/* ------------------------------ 番茄治理 ------------------------------ */

adminRouter.get(
  '/tomatoes',
  wrap((_req, res) => {
    res.json({
      items: db.tomatoes.slice(0, 300).map((t) => ({
        id: t.id,
        page: t.page,
        note: t.note,
        alias: t.alias,
        hidden: !!t.hidden,
        createdAt: t.createdAt,
      })),
    });
  })
);

adminRouter.patch(
  '/tomatoes/:id',
  wrap((req, res) => {
    const t = db.tomatoes.find((x) => x.id === req.params.id);
    if (!t) throw missing('番茄不存在');
    t.hidden = !!req.body.hidden;
    audit(req.user, 'tomato.moderate', `${t.hidden ? '隐藏' : '恢复'}了 ${t.page} 上的一颗番茄`);
    save();
    res.json({ ok: true });
  })
);

adminRouter.post(
  '/tomatoes/clear',
  wrap((req, res) => {
    const page = req.body.page;
    const before = db.tomatoes.length;
    db.tomatoes = db.tomatoes.filter((t) => (page ? t.page !== page : false));
    audit(req.user, 'tomato.clear', `清扫 ${page || '全站'} 的番茄（${before - db.tomatoes.length} 颗）`);
    save();
    res.json({ removed: before - db.tomatoes.length });
  })
);
