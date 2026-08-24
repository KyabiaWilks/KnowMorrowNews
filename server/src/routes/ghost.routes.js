/**
 * Ghost 通道 —— 只给站长本人的「无痕」视角。
 *
 * 约定：这个文件里的任何处理器都不得调用 audit()、不得递增 views、
 * 不得写入 db（除非明确要求）。查看行为对被查看者完全不可见。
 */
import { Router } from 'express';
import { db, queryDatabase } from '../db.js';
import { openGhostSession, closeGhostSession, requireGhost } from '../auth.js';
import { walletOf } from '../services.js';
import { matchText, wrap, HttpError } from '../util.js';

export const ghostRouter = Router();

ghostRouter.post(
  '/session',
  wrap((req, res) => {
    const session = openGhostSession(String(req.body.key || ''));
    // 口令错误时伪装成不存在的路由，避免被探测
    if (!session) throw new HttpError(404, 'Not Found');
    res.json(session);
  })
);

ghostRouter.delete(
  '/session',
  wrap((req, res) => {
    closeGhostSession(req.headers['x-ghost-session']);
    res.json({ ok: true });
  })
);

ghostRouter.use(requireGhost);

const userOf = (id) => db.users.find((u) => u.id === id) || null;
const profileOf = (id) => db.profiles.find((p) => p.id === id) || null;

/** 摘下面具：马甲 -> 真实账号 */
function unmask(profileId) {
  const p = profileOf(profileId);
  if (!p) return { profileId, alias: '（已注销）', username: '?', userId: null };
  const u = userOf(p.userId);
  return {
    profileId: p.id,
    alias: p.alias,
    sigil: p.sigil,
    userId: p.userId,
    username: u?.username || '?',
    displayName: u?.displayName || '?',
    banned: !!u?.banned,
  };
}

ghostRouter.get(
  '/overview',
  wrap((_req, res) => {
    const volume = db.purchases.reduce((s, p) => s + p.amount, 0);
    res.json({
      stats: {
        users: db.users.length,
        profiles: db.profiles.length,
        maskRatio: db.users.length ? +(db.profiles.length / db.users.length).toFixed(2) : 0,
        offers: db.offers.length,
        requests: db.requests.length,
        purchases: db.purchases.length,
        volume,
        escrow: db.users.reduce((s, u) => s + (u.escrow ?? 0), 0),
        pendingReports: db.reports.filter((r) => r.status === 'pending').length,
      },
      // 谁在这个站里最活跃 —— 按真实账号聚合，跨马甲
      topActors: db.users
        .map((u) => {
          const profiles = db.profiles.filter((p) => p.userId === u.id);
          const ids = profiles.map((p) => p.id);
          return {
            userId: u.id,
            username: u.username,
            role: u.role,
            aliases: profiles.map((p) => p.alias),
            sells: db.offers.filter((o) => ids.includes(o.profileId)).length,
            buys: db.purchases.filter((p) => p.buyerUserId === u.id).length,
            spent: db.purchases.filter((p) => p.buyerUserId === u.id).reduce((s, p) => s + p.amount, 0),
            earned: db.transactions.filter((t) => t.userId === u.id && t.delta > 0).reduce((s, t) => s + t.delta, 0),
            wallet: walletOf(u),
          };
        })
        .sort((a, b) => b.sells + b.buys - (a.sells + a.buys))
        .slice(0, 12),
      timeline: [...db.offers.map((o) => ({ kind: 'offer', at: o.createdAt, text: o.title, who: unmask(o.profileId) })),
        ...db.requests.map((r) => ({ kind: 'request', at: r.createdAt, text: r.title, who: unmask(r.profileId) })),
        ...db.purchases.map((p) => ({
          kind: 'purchase',
          at: p.createdAt,
          text: `${db.offers.find((o) => o.id === p.offerId)?.title || '（已撤）'} · ${p.amount} TMT`,
          who: { username: userOf(p.buyerUserId)?.username || '?', alias: p.buyerProfileId ? profileOf(p.buyerProfileId)?.alias : '（未披马甲）' },
        }))]
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 40),
    });
  })
);

/** 全部马甲与其主人的对照表 */
ghostRouter.get(
  '/identities',
  wrap((req, res) => {
    const q = req.query.q;
    const items = db.users
      .map((u) => ({
        user: {
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          role: u.role,
          banned: !!u.banned,
          createdAt: u.createdAt,
          wallet: walletOf(u),
        },
        profiles: db.profiles
          .filter((p) => p.userId === u.id)
          .map((p) => ({
            id: p.id,
            alias: p.alias,
            sigil: p.sigil,
            retired: !!p.retired,
            offers: db.offers.filter((o) => o.profileId === p.id).length,
            requests: db.requests.filter((r) => r.profileId === p.id).length,
            createdAt: p.createdAt,
          })),
      }))
      .filter((row) => matchText(q, row.user.username, row.user.displayName, ...row.profiles.map((p) => p.alias)));
    res.json({ items });
  })
);

/** 所有情报的完整正文 + 证据 + 买家真实身份，不付费、不留痕 */
ghostRouter.get(
  '/offers',
  wrap((req, res) => {
    const q = req.query.q;
    const items = db.offers
      .filter((o) => matchText(q, o.title, o.summary, ...(o.tags || []), ...o.tiers.map((t) => t.content)))
      .map((o) => ({
        id: o.id,
        title: o.title,
        summary: o.summary,
        tags: o.tags,
        status: o.status,
        hiddenByAdmin: !!o.hiddenByAdmin,
        createdAt: o.createdAt,
        views: o.views ?? 0,
        seller: unmask(o.profileId),
        tiers: o.tiers.map((t) => ({
          id: t.id,
          name: t.name,
          detail: t.detail,
          price: t.price,
          content: t.content,
          evidence: (t.evidenceIds || []).map((id) => db.evidence.find((e) => e.id === id)).filter(Boolean),
        })),
        buyers: db.purchases
          .filter((p) => p.offerId === o.id)
          .map((p) => ({
            at: p.createdAt,
            amount: p.amount,
            tier: o.tiers.find((t) => t.id === p.tierId)?.name,
            buyer: { userId: p.buyerUserId, username: userOf(p.buyerUserId)?.username || '?', maskUsed: p.buyerProfileId ? profileOf(p.buyerProfileId)?.alias : null },
          })),
      }));
    res.json({ items });
  })
);

ghostRouter.get(
  '/requests',
  wrap((req, res) => {
    const q = req.query.q;
    const items = db.requests
      .filter((r) => matchText(q, r.title, r.brief, ...(r.tags || [])))
      .map((r) => ({
        id: r.id,
        title: r.title,
        brief: r.brief,
        tags: r.tags,
        deposit: r.deposit,
        depositRemaining: r.depositRemaining,
        status: r.status,
        createdAt: r.createdAt,
        buyer: unmask(r.profileId),
        tiers: r.tiers,
        submissions: db.submissions
          .filter((s) => s.requestId === r.id)
          .map((s) => ({
            id: s.id,
            status: s.status,
            content: s.content,
            paid: s.paid || 0,
            createdAt: s.createdAt,
            supplier: unmask(s.profileId),
            evidence: (s.evidenceIds || []).map((id) => db.evidence.find((e) => e.id === id)).filter(Boolean),
          })),
      }));
    res.json({ items });
  })
);

/** 全站资金流水，附真实账号 */
ghostRouter.get(
  '/ledger',
  wrap((req, res) => {
    const q = req.query.q;
    const items = db.transactions
      .map((t) => ({
        ...t,
        username: userOf(t.userId)?.username || '?',
        alias: t.profileId ? profileOf(t.profileId)?.alias || null : null,
      }))
      .filter((t) => matchText(q, t.username, t.alias, t.memo, t.kind))
      .slice(0, 300);
    res.json({ items });
  })
);

/** 每颗番茄背后的真实投掷者 */
ghostRouter.get(
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
        thrower: userOf(t.userId)?.username || '?',
      })),
    });
  })
);

/** 谁复制了记者公开展示的 Minecraft IGN */
ghostRouter.get(
  '/ign-copies',
  wrap((req, res) => {
    const q = req.query.q;
    const items = db.auditLog
      .filter((entry) => entry.action === 'journalist.ign_copy')
      .map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        copierUserId: entry.actorId,
        copierUsername: userOf(entry.actorId)?.username || entry.actorName || '?',
        journalistId: entry.targetJournalistId,
        journalistName: entry.targetJournalistName || db.journalists.find((item) => item.id === entry.targetJournalistId)?.name || 'Deleted reporter',
        ign: entry.targetIgn,
        page: entry.page,
      }))
      .filter((entry) => matchText(q, entry.copierUsername, entry.journalistName, entry.ign));
    res.json({ items });
  })
);

ghostRouter.get(
  '/reports',
  wrap((_req, res) => {
    res.json({
      items: db.reports.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        reason: r.reason,
        detail: r.detail,
        status: r.status,
        createdAt: r.createdAt,
        reporter: { userId: r.reporterUserId, username: userOf(r.reporterUserId)?.username || '?', mask: r.reporterProfileId ? profileOf(r.reporterProfileId)?.alias : null },
        arbitration: db.arbitrations.find((a) => a.reportId === r.id) || null,
      })),
    });
  })
);

/** Discord ticket channels and their archival metadata. */
ghostRouter.get(
  '/ticket-archives',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const result = await queryDatabase(
      `SELECT channel_id, guild_id, channel_name, topic, channel_type,
              archived_at, archived_by_user_id, message_count, raw_channel
         FROM ticket_archives
        WHERE $1 = '' OR concat_ws(' ', channel_id, guild_id, channel_name, topic,
                                    archived_by_user_id, raw_channel::text) ILIKE $2
        ORDER BY archived_at DESC NULLS LAST, channel_id
        LIMIT 300`,
      [q, `%${q}%`],
    );
    res.json({ items: result.rows });
  })
);

/** Every original message captured from archived ticket channels. */
ghostRouter.get(
  '/ticket-messages',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const result = await queryDatabase(
      `SELECT m.channel_id, m.message_id, m.ordinal, m.author_id, m.author_username,
              m.author_display_name, m.content, m.sent_at, m.edited_at,
              m.attachments, m.embeds, m.raw_message,
              a.channel_name, a.topic, a.archived_at
         FROM ticket_messages m
         LEFT JOIN ticket_archives a ON a.channel_id = m.channel_id
        WHERE $1 = '' OR concat_ws(' ', m.channel_id, m.message_id, m.author_id,
                                    m.author_username, m.author_display_name, m.content,
                                    m.attachments::text, m.embeds::text, m.raw_message::text,
                                    a.channel_name, a.topic) ILIKE $2
        ORDER BY m.channel_id, m.ordinal ASC NULLS LAST, m.sent_at ASC NULLS LAST`,
      [q, `%${q}%`],
    );
    const tickets = [];
    const byChannel = new Map();
    for (const row of result.rows) {
      let ticket = byChannel.get(row.channel_id);
      if (!ticket) {
        ticket = {
          channelId: row.channel_id,
          channelName: row.channel_name,
          topic: row.topic,
          archivedAt: row.archived_at,
          messages: [],
        };
        byChannel.set(row.channel_id, ticket);
        tickets.push(ticket);
      }
      const { channel_name, topic, archived_at, ...message } = row;
      ticket.messages.push(message);
    }
    tickets.sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')) || String(a.channelName || a.channelId).localeCompare(String(b.channelName || b.channelId)));
    res.json({ tickets });
  })
);

/** 一次搜遍全站：新闻、情报正文、委托、马甲、流水、番茄 */
ghostRouter.get(
  '/search',
  wrap(async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ groups: [] });
    const [ticketArchives, ticketMessages] = await Promise.all([
      queryDatabase(
        `SELECT channel_id, channel_name, topic, archived_at, message_count
           FROM ticket_archives
          WHERE concat_ws(' ', channel_id, guild_id, channel_name, topic,
                           archived_by_user_id, raw_channel::text) ILIKE $1
          ORDER BY archived_at DESC NULLS LAST
          LIMIT 40`,
        [`%${q}%`],
      ),
      queryDatabase(
        `SELECT m.channel_id, m.message_id, m.ordinal, m.author_username,
                m.author_display_name, m.content, m.sent_at, a.channel_name
           FROM ticket_messages m
           LEFT JOIN ticket_archives a ON a.channel_id = m.channel_id
          WHERE concat_ws(' ', m.channel_id, m.message_id, m.author_id,
                           m.author_username, m.author_display_name, m.content,
                           m.attachments::text, m.embeds::text, m.raw_message::text,
                           a.channel_name, a.topic) ILIKE $1
          ORDER BY m.sent_at DESC NULLS LAST
          LIMIT 80`,
        [`%${q}%`],
      ),
    ]);
    const groups = [
      {
        kind: 'identities',
        hits: db.profiles
          .filter((p) => matchText(q, p.alias, p.bio, userOf(p.userId)?.username))
          .map((p) => ({ id: p.id, title: `${p.sigil} ${p.alias}`, sub: `Account: ${userOf(p.userId)?.username}`, href: `/ghost/identities` })),
      },
      {
        kind: 'tips',
        hits: db.offers
          .filter((o) => matchText(q, o.title, o.summary, ...o.tiers.map((t) => t.content)))
          .map((o) => ({ id: o.id, title: o.title, sub: `Seller account: ${unmask(o.profileId).username}`, href: `/ghost/offers` })),
      },
      {
        kind: 'requests',
        hits: db.requests
          .filter((r) => matchText(q, r.title, r.brief))
          .map((r) => ({ id: r.id, title: r.title, sub: `Requester account: ${unmask(r.profileId).username}`, href: `/ghost/requests` })),
      },
      {
        kind: 'news',
        hits: db.news.filter((a) => matchText(q, a.title, a.body)).map((a) => ({ id: a.id, title: a.title, sub: a.status, href: `/news/${a.id}` })),
      },
      {
        kind: 'ledger',
        hits: db.transactions
          .filter((t) => matchText(q, t.memo, userOf(t.userId)?.username))
          .slice(0, 40)
          .map((t) => ({ id: t.id, title: `${t.delta > 0 ? '+' : ''}${t.delta} TMT · ${t.memo}`, sub: userOf(t.userId)?.username, href: `/ghost/ledger` })),
      },
      {
        kind: 'ticket-archives',
        hits: ticketArchives.rows.map((ticket) => ({
          id: ticket.channel_id,
          title: ticket.channel_name || ticket.channel_id,
          sub: `${ticket.message_count ?? 0} messages${ticket.topic ? ` · ${ticket.topic}` : ''}`,
          at: ticket.archived_at,
          href: '/ghost/ticket-archives',
        })),
      },
      {
        kind: 'ticket-messages',
        hits: ticketMessages.rows.map((message) => ({
          id: `${message.channel_id}-${message.message_id}`,
          title: `${message.author_display_name || message.author_username || 'Unknown author'} · ${message.channel_name || message.channel_id}`,
          sub: String(message.content || '(no text content)').slice(0, 280),
          at: message.sent_at,
          href: '/ghost/ticket-messages',
        })),
      },
    ].filter((g) => g.hits.length);
    res.json({ groups });
  })
);

/** 单个账号的完整档案 */
ghostRouter.get(
  '/user/:id',
  wrap((req, res) => {
    const u = userOf(req.params.id);
    if (!u) throw new HttpError(404, 'Not Found');
    const profiles = db.profiles.filter((p) => p.userId === u.id);
    const ids = profiles.map((p) => p.id);
    res.json({
      user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role, banned: !!u.banned, createdAt: u.createdAt, wallet: walletOf(u) },
      profiles,
      offers: db.offers.filter((o) => ids.includes(o.profileId)),
      requests: db.requests.filter((r) => ids.includes(r.profileId)),
      purchases: db.purchases.filter((p) => p.buyerUserId === u.id),
      submissions: db.submissions.filter((s) => ids.includes(s.profileId)),
      transactions: db.transactions.filter((t) => t.userId === u.id).slice(0, 100),
      tomatoes: db.tomatoes.filter((t) => t.userId === u.id).length,
      reportsFiled: db.reports.filter((r) => r.reporterUserId === u.id).length,
      reportsAgainst: db.reports.filter((r) => {
        if (r.targetType === 'profile') return ids.includes(r.targetId);
        if (r.targetType === 'offer') return db.offers.some((o) => o.id === r.targetId && ids.includes(o.profileId));
        if (r.targetType === 'request') return db.requests.some((x) => x.id === r.targetId && ids.includes(x.profileId));
        if (r.targetType === 'submission') return db.submissions.some((s) => s.id === r.targetId && ids.includes(s.profileId));
        return false;
      }).length,
    });
  })
);
