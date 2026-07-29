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
      title: String(req.body.title || 'Untitled story').slice(0, 120),
      summary: String(req.body.summary || '').slice(0, 300),
      body: String(req.body.body || ''),
      section: String(req.body.section || 'Headlines'),
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
    audit(req.user, 'news.create', `Created story “${article.title}”`);
    save();
    res.json({ article });
  })
);

adminRouter.patch(
  '/news/:id',
  wrap((req, res) => {
    const a = db.news.find((x) => x.id === req.params.id);
    if (!a) throw missing('News article not found.');
    for (const key of ['title', 'summary', 'body', 'section', 'cover', 'dateline', 'status', 'featured', 'publishedAt']) {
      if (req.body[key] !== undefined) a[key] = req.body[key];
    }
    if (Array.isArray(req.body.tags)) a.tags = req.body.tags.slice(0, 8);
    if (Array.isArray(req.body.authorIds)) a.authorIds = req.body.authorIds;
    a.readingMinutes = Math.max(1, Math.round(String(a.body || '').length / 400));
    audit(req.user, 'news.update', `Updated story “${a.title}”`);
    save();
    res.json({ article: a });
  })
);

adminRouter.delete(
  '/news/:id',
  wrap((req, res) => {
    const i = db.news.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw missing('News article not found.');
    audit(req.user, 'news.delete', `Deleted story “${db.news[i].title}”`);
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
      name: String(req.body.name || 'New colleague').slice(0, 40),
      title: String(req.body.title || 'Journalist').slice(0, 40),
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
    audit(req.user, 'journalist.create', `Added journalist ${j.name}`);
    save();
    res.json({ journalist: j });
  })
);

adminRouter.patch(
  '/journalists/:id',
  wrap((req, res) => {
    const j = db.journalists.find((x) => x.id === req.params.id);
    if (!j) throw missing('Journalist not found.');
    for (const key of ['name', 'title', 'avatar', 'portraitTone', 'tagline', 'bio', 'contact', 'featured', 'hidden', 'joinedAt']) {
      if (req.body[key] !== undefined) j[key] = req.body[key];
    }
    for (const key of ['beats', 'awards', 'milestones', 'signatureWorks']) {
      if (Array.isArray(req.body[key])) j[key] = req.body[key];
    }
    audit(req.user, 'journalist.update', `Updated journalist ${j.name}`);
    save();
    res.json({ journalist: j });
  })
);

adminRouter.delete(
  '/journalists/:id',
  wrap((req, res) => {
    const i = db.journalists.findIndex((x) => x.id === req.params.id);
    if (i < 0) throw missing('Journalist not found.');
    audit(req.user, 'journalist.delete', `Removed journalist ${db.journalists[i].name}`);
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
    if (!t) throw missing('Tag not found.');
    if (t.kind === 'system') throw bad('System evidence tags cannot be modified.');
    for (const key of ['label', 'color', 'description', 'archived']) if (req.body[key] !== undefined) t[key] = req.body[key];
    audit(req.user, 'tag.update', `Updated tag ${t.label}`);
    save();
    res.json({ tag: t });
  })
);

/* -------------------------------- 用户 -------------------------------- */

adminRouter.get(
  '/users',
  wrap((_req, res) => {
    res.json({
      items: db.users.map((u) => {
        const disclosed = db.arbitrations.some((item) => item.disclosure?.subject === u.username);
        return {
          ...publicUser(u),
          frozenFunds: u.frozenFunds ?? 0,
          banReason: u.banReason || null,
          identityDisclosed: disclosed,
          profiles: disclosed ? db.profiles.filter((p) => p.userId === u.id).map((p) => ({ id: p.id, alias: p.alias, retired: !!p.retired })) : [],
        };
      }),
    });
  })
);

adminRouter.patch(
  '/users/:id',
  wrap((req, res) => {
    const u = db.users.find((x) => x.id === req.params.id);
    if (!u) throw missing('User not found.');
    if (req.body.siteRole && ['user', 'read_only_user', 'journalist', 'admin', 'read_only_admin'].includes(req.body.siteRole)) {
      u.siteRole = req.body.siteRole;
      u.role = req.body.siteRole === 'admin' ? 'admin' : 'user';
    }
    if (req.body.banned !== undefined) {
      u.banned = !!req.body.banned;
      u.banReason = req.body.banned ? String(req.body.banReason || 'Administrative action') : null;
    }
    if (req.body.grant) credit(u, Math.abs(Number(req.body.grant)), 'grant', 'Administrative grant');
    audit(req.user, 'user.update', `Updated user ${u.username}`);
    save();
    res.json({ user: publicUser(u) });
  })
);

/* --------------------------- 举报 / 站内仲裁 --------------------------- */

function describeTarget(r) {
  if (r.targetType === 'offer') {
    const o = db.offers.find((x) => x.id === r.targetId);
    return { label: o ? `Information: “${o.title}”` : '(deleted information listing)', profileId: o?.profileId || null };
  }
  if (r.targetType === 'request') {
    const q = db.requests.find((x) => x.id === r.targetId);
    return { label: q ? `Request: “${q.title}”` : '(deleted request)', profileId: q?.profileId || null };
  }
  if (r.targetType === 'submission') {
    const s = db.submissions.find((x) => x.id === r.targetId);
    return { label: s ? 'Request submission' : '(deleted submission)', profileId: s?.profileId || null };
  }
  const p = db.profiles.find((x) => x.id === r.targetId);
  return { label: p ? `Mask: “${p.alias}”` : '(retired mask)', profileId: p?.id || null };
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
          reporter: r.reporterProfileId ? publicProfile(r.reporterProfileId) : { alias: 'Unnamed reporter', sigil: '✉' },
          // 仲裁需要看到被举报方的真实账号，这是规约里写明的例外
          accused: accused
            ? (() => {
                const accusedUser = db.users.find((u) => u.id === accused.userId);
                const disclosed = !!accusedUser && db.arbitrations.some((item) => item.disclosure?.subject === accusedUser.username);
                return {
                  alias: accused.alias,
                  identityDisclosed: disclosed,
                  username: disclosed ? accusedUser.username : null,
                  alts: disclosed ? db.profiles.filter((profile) => profile.userId === accused.userId).map((profile) => profile.alias) : [],
                };
              })()
            : null,
          arbitration: db.arbitrations.find((a) => a.reportId === r.id) || null,
          judgments: (db.arbitrationJudgments || []).filter((item) => item.reportId === r.id).map((item) => ({
            id: item.id,
            verdict: item.verdict,
            severity: item.severity,
            penalties: item.penalties,
            summary: item.summary,
            submittedBy: item.submittedBy,
            submittedAt: item.submittedAt,
          })),
        };
      });
    res.json({ items, reasons: REPORT_REASONS });
  })
);

export const PENALTIES = [
  { id: 'warn', label: 'Warning on record' },
  { id: 'takedown', label: 'Remove reported content' },
  { id: 'ban_all_alts', label: 'Suspend the account and all masks' },
  { id: 'freeze_funds', label: 'Freeze account funds' },
  { id: 'compensate', label: 'Compensate the harmed party' },
  { id: 'public_disclosure', label: 'Public identity disclosure' },
];

adminRouter.get(
  '/penalties',
  wrap((_req, res) => res.json({ penalties: PENALTIES }))
);

adminRouter.post('/reports/:id/judgments', wrap((req, res) => {
  const report = db.reports.find((item) => item.id === req.params.id);
  if (!report) throw missing('Report not found.');
  if (report.status !== 'pending') throw bad('This report already has a final decision.');
  const verdict = req.body.verdict === 'upheld' ? 'upheld' : 'dismissed';
  const severity = ['minor', 'major', 'severe'].includes(req.body.severity) ? req.body.severity : 'minor';
  const penalties = (Array.isArray(req.body.penalties) ? req.body.penalties : []).filter((id) => PENALTIES.some((item) => item.id === id));
  db.arbitrationJudgments ||= [];
  const existing = db.arbitrationJudgments.find((item) => item.reportId === report.id && item.adminUserId === req.user.id);
  const judgment = {
    id: existing?.id || uid('jdg'), reportId: report.id, adminUserId: req.user.id,
    submittedBy: req.user.username, verdict, severity, penalties,
    summary: String(req.body.summary || '').trim().slice(0, 500),
    submittedAt: now(),
  };
  if (existing) Object.assign(existing, judgment);
  else db.arbitrationJudgments.unshift(judgment);
  audit(req.user, 'report.judgment', `Submitted an independent judgment for ${report.id}`);
  save();
  res.json({ judgment });
}));

/**
 * 仲裁裁决。按规约可执行：封禁全部马甲、冻结并划扣财产弥补损失，
 * 情节过于严重者公开其信息。
 */
adminRouter.post(
  '/reports/:id/arbitrate',
  wrap((req, res) => {
    const report = db.reports.find((x) => x.id === req.params.id);
    if (!report) throw missing('Report not found.');
    if (report.status !== 'pending') throw bad('This report has already been processed.');
    const judgments = (db.arbitrationJudgments || []).filter((item) => item.reportId === report.id);
    if (new Set(judgments.map((item) => item.adminUserId)).size < 2) {
      throw bad('At least two administrators must submit independent judgments before the final decision.');
    }

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
        executed.push('Reported content removed');
      }
      if (penalties.includes('ban_all_alts')) {
        accusedUser.banned = true;
        accusedUser.banReason = `Arbitration decision: ${REPORT_REASONS.find((x) => x.id === report.reason)?.label || report.reason}`;
        for (const p of db.profiles.filter((p) => p.userId === accusedUser.id)) p.retired = true;
        for (const o of db.offers.filter((o) => db.profiles.some((p) => p.id === o.profileId && p.userId === accusedUser.id))) {
          o.status = 'withdrawn';
        }
        executed.push(`Suspended ${accusedUser.username} and all ${db.profiles.filter((p) => p.userId === accusedUser.id).length} associated masks`);
      }
      if (penalties.includes('freeze_funds')) {
        const amount = Math.max(0, Number(req.body.freezeAmount) || walletOf(accusedUser).available);
        accusedUser.frozenFunds = (accusedUser.frozenFunds ?? 0) + amount;
        record(accusedUser.id, 0, 'freeze', `Arbitration freeze: ${amount} TMT`, { type: 'report', id: report.id });
        executed.push(`Frozen ${amount} TMT`);
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
        record(accusedUser.id, -take, 'arbitration_debit', `Arbitration compensation debit: ${take} TMT`, { type: 'report', id: report.id });
        if (victim) credit(victim, take, 'arbitration_credit', `Arbitration compensation received: ${take} TMT`, { type: 'report', id: report.id });
        executed.push(`Transferred ${take} TMT to compensate the reporting party`);
      }
      if (penalties.includes('public_disclosure')) {
        executed.push('Published a public disclosure notice');
      }
    }

    const arb = {
      id: uid('arb'),
      reportId: report.id,
      verdict,
      severity,
      penalties,
      summary: String(req.body.summary || '').slice(0, 300) || (verdict === 'upheld' ? 'Report upheld' : 'Report dismissed'),
      notes: String(req.body.notes || '').slice(0, 1000),
      executed,
      disclosure:
        verdict === 'upheld' && penalties.includes('public_disclosure') && accusedUser
          ? {
              publishedAt: now(),
              subject: accusedUser.username,
              aliases: db.profiles.filter((p) => p.userId === accusedUser.id).map((p) => p.alias),
              statement: String(req.body.disclosureText || '').slice(0, 500) || `The account identity was disclosed following a severe finding of ${REPORT_REASONS.find((x) => x.id === report.reason)?.label || report.reason}.`,
            }
          : null,
      decidedBy: req.user.username,
      decidedAt: now(),
    };
    db.arbitrations.unshift(arb);
    report.status = verdict === 'upheld' ? 'upheld' : 'dismissed';
    audit(req.user, 'report.arbitrate', `Decided report ${report.id}: ${arb.summary}`);
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
    if (!t) throw missing('Tomato not found.');
    t.hidden = !!req.body.hidden;
    audit(req.user, 'tomato.moderate', `${t.hidden ? 'Hid' : 'Restored'} a tomato on ${t.page}`);
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
    audit(req.user, 'tomato.clear', `Cleared ${before - db.tomatoes.length} tomatoes from ${page || 'the entire site'}`);
    save();
    res.json({ removed: before - db.tomatoes.length });
  })
);
