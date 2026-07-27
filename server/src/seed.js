/**
 * 初始内容。首次启动会自动执行；`npm run seed -- --force` 可重置。
 */
import { fileURLToPath } from 'node:url';
import { db, replaceAll, save, isEmpty } from './db.js';
import { hashPassword } from './auth.js';
import { uid } from './util.js';

const iso = (daysAgo, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, (daysAgo * 7) % 60, 0, 0);
  return d.toISOString();
};

export function seedDatabase() {
  const users = [
    mkUser('admin', 'admin123456', '总编·林望舒', 'admin', 4000),
    mkUser('lyra', 'lyra123456', '记者 Lyra', 'user', 860),
    mkUser('nightowl', 'nightowl123456', '夜枭', 'user', 1420),
    mkUser('chancellor', 'chancellor123456', '某国幕僚', 'user', 5200),
    mkUser('reader', 'reader123456', '普通读者', 'user', 200),
  ];

  const journalists = [
    {
      id: 'jnl_lyra',
      name: '沈知夜',
      title: '首席战地记者',
      avatar: null,
      portraitTone: '#2f6bff',
      tagline: '月亮不睡，我就不睡。',
      bio: '在三场边境冲突中完成一线报道，擅长在信息封锁区建立稳定信源网络。她的原则是：不发无法自证的稿子。',
      beats: ['战地', '边境', '人道'],
      awards: [
        { name: '地平线年度报道奖', year: 2025, work: '《雪线以南的四十七天》' },
        { name: '国际新闻自由勋章', year: 2024, work: '边境封锁区系列' },
      ],
      milestones: [
        { year: 2021, text: '以自由撰稿人身份加入《地平线》' },
        { year: 2023, text: '建立跨境线人核查流程，被编辑部列为标准' },
        { year: 2025, text: '出任首席战地记者' },
      ],
      signatureWorks: [{ newsId: 'news_border', note: '连续 47 天驻守封锁线的现场记录' }],
      contact: 'zhiye@jontop.press',
      featured: true,
      hidden: false,
      joinedAt: '2021-04-11T00:00:00.000Z',
    },
    {
      id: 'jnl_kai',
      name: '陆见川',
      title: '调查报道组组长',
      avatar: null,
      portraitTone: '#1b9c8a',
      tagline: '数据不会撒谎，撒谎的是删掉数据的人。',
      bio: '前审计师，转行做调查记者。以卫星影像比对与公开财报交叉验证著称，主导过三起跨国能源黑幕的揭露。',
      beats: ['调查', '能源', '数据新闻'],
      awards: [{ name: '深度调查金奖', year: 2025, work: '《三号管线的影子账本》' }],
      milestones: [
        { year: 2019, text: '离开审计事务所，加入《地平线》调查组' },
        { year: 2024, text: '组建数据新闻小组' },
      ],
      signatureWorks: [{ newsId: 'news_pipeline', note: '用 12 组卫星影像还原被抹去的运输记录' }],
      contact: 'jianchuan@jontop.press',
      featured: true,
      hidden: false,
      joinedAt: '2019-09-02T00:00:00.000Z',
    },
    {
      id: 'jnl_mira',
      name: 'Mira Vance',
      title: '外交与峰会条线',
      avatar: null,
      portraitTone: '#7a5cff',
      tagline: '外交辞令的缝隙里藏着真正的议程。',
      bio: '连续七届跟访环月峰会，能在联合公报发布前三小时给出准确的措辞预测。',
      beats: ['外交', '峰会', '条约'],
      awards: [{ name: '最佳国际报道', year: 2023, work: '《公报里的省略号》' }],
      milestones: [
        { year: 2020, text: '首次独立跟访环月峰会' },
        { year: 2026, text: '主笔《条约季》专栏' },
      ],
      signatureWorks: [{ newsId: 'news_summit', note: '提前 40 小时预判了联合声明的核心分歧' }],
      contact: 'mira@jontop.press',
      featured: false,
      hidden: false,
      joinedAt: '2020-01-20T00:00:00.000Z',
    },
    {
      id: 'jnl_ash',
      name: '阿什·科尔',
      title: '视觉与影像总监',
      avatar: null,
      portraitTone: '#e05a3a',
      tagline: '一张对的照片，抵得上三千字的辩解。',
      bio: '负责《地平线》全部视觉叙事，开发了本报的影像真伪核验流程。',
      beats: ['摄影', '影像核验'],
      awards: [{ name: '年度新闻摄影', year: 2024, work: '《港口的最后一班船》' }],
      milestones: [{ year: 2022, text: '建立影像溯源实验室' }],
      signatureWorks: [],
      contact: 'ash@jontop.press',
      featured: false,
      hidden: false,
      joinedAt: '2022-06-15T00:00:00.000Z',
    },
    {
      id: 'jnl_wen',
      name: '温子涵',
      title: '经济与市场记者',
      avatar: null,
      portraitTone: '#f0a92b',
      tagline: '价格是最诚实的谣言。',
      bio: '关注大宗商品与新兴代币市场，是最早报道 tomato coin 在灰色市场流通的记者。',
      beats: ['经济', '市场', '代币'],
      awards: [],
      milestones: [{ year: 2026, text: '开设《番茄行情》每日栏目' }],
      signatureWorks: [{ newsId: 'news_tomato', note: '第一篇系统梳理 TMT 流通结构的报道' }],
      contact: 'zihan@jontop.press',
      featured: false,
      hidden: false,
      joinedAt: '2023-03-08T00:00:00.000Z',
    },
  ];

  const news = [
    mkNews({
      id: 'news_border',
      title: '雪线以南的四十七天：封锁区里的一座临时医院',
      summary: '在通讯中断的四十七天里，一座由三名医生撑起的临时医院成了雪线以南唯一的秩序。',
      section: '深度',
      tags: ['边境', '人道', '独家'],
      authorIds: ['jnl_lyra'],
      daysAgo: 1,
      featured: true,
      dateline: '雪线南麓 · 本报特派记者',
      body: `封锁线在第十一天彻底合拢。\n\n沈知夜抵达时，临时医院只有一台靠柴油发电机维持的制氧机，和一本用铅笔记录的伤员名册。名册上第 214 个名字被划掉又重新写上——那是一名在三天内两次被送来的少年。\n\n"我们不缺勇气，我们缺柴油。"负责调度的医生说。\n\n本报核实了名册上 47 个可辨认姓名中的 31 个，并通过两条独立渠道确认了物资运输在第 19 天被中断的事实。截至发稿，相关方仍未回应本报的置评请求。`,
    }),
    mkNews({
      id: 'news_pipeline',
      title: '三号管线的影子账本：被抹去的十二次夜间运输',
      summary: '卫星影像与港口日志的交叉比对显示，官方公布的运输记录缺失了至少十二个夜班。',
      section: '调查',
      tags: ['能源', '调查', '数据新闻', '独家'],
      authorIds: ['jnl_kai', 'jnl_ash'],
      daysAgo: 3,
      featured: true,
      dateline: '本报调查组',
      body: `我们拿到了两组互相独立的数据：一组是公开的港口停靠日志，另一组是商业卫星在同一时段的夜间红外影像。\n\n把它们叠在一起，出现了十二个"幽灵夜班"——影像里有船，日志里没有。\n\n本报请三位航运分析师独立复核了影像判读，结论一致。管线运营方回应称"数据口径不同"，但拒绝提供原始口径说明。`,
    }),
    mkNews({
      id: 'news_summit',
      title: '环月峰会第三日：联合声明的措辞之争',
      summary: '一个副词的去留，决定了三个国家未来两年的能源配额。',
      section: '外交',
      tags: ['峰会', '外交', '条约'],
      authorIds: ['jnl_mira'],
      daysAgo: 2,
      dateline: '环月会议中心',
      body: `谈判在凌晨两点卡在一个副词上："应当"还是"必须"。\n\n三名接近谈判桌的人士向本报描述了相同的场景：文本被投在墙上，代表们逐字念出来，像在念判决书。\n\n最终版本采用了"应当"。这意味着履约缺乏强制力，但也意味着协议得以签署。`,
    }),
    mkNews({
      id: 'news_tomato',
      title: 'tomato coin 的两副面孔：从打赏代币到情报结算工具',
      summary: 'TMT 最初只是读者给记者打赏的小额代币，如今它出现在了更隐秘的账本上。',
      section: '经济',
      tags: ['代币', '经济', '市场'],
      authorIds: ['jnl_wen'],
      daysAgo: 4,
      dateline: '本报市场组',
      body: `一枚番茄的价格，正在从"一次鼓掌"变成"一条命的信息费"。\n\n本报统计了过去 90 天可观测的 TMT 流转，发现小额高频的打赏类交易占比在下降，而单笔 200 枚以上的转账占比翻了三倍。\n\n"任何一种能匿名结算的东西，最后都会被用来买卖秘密。"一位不愿具名的市场分析师说。`,
    }),
    mkNews({
      id: 'news_harbor',
      title: '港口的最后一班船：一张照片背后的三个月',
      summary: '影像组还原了这张获奖照片的拍摄链条，以及它为何差点没能发出来。',
      section: '影像',
      tags: ['摄影', '影像核验'],
      authorIds: ['jnl_ash'],
      daysAgo: 6,
      dateline: '本报影像实验室',
      body: `这张照片有过四个版本，只有一个版本是我们敢发的。\n\n影像核验流程包括：原始文件哈希留存、拍摄设备元数据比对、同场景第二信源交叉验证。缺一项，稿子就压着。`,
    }),
    mkNews({
      id: 'news_arbitration',
      title: '本报设立站内仲裁：关于匿名情报交易的规约说明',
      summary: '恶意提供假信息与恶意拖欠付款，将进入仲裁流程。',
      section: '公告',
      tags: ['公告', '酒馆'],
      authorIds: ['jnl_kai'],
      daysAgo: 8,
      dateline: '编辑部',
      body: `匿名不等于免责。\n\n自本公告起，站内一切情报交易纠纷由《地平线》仲裁小组处理。可裁定的处罚包括：封禁涉事用户名下全部马甲账号、冻结站内财产用于弥补客户损失。情节过于严重者，可能受到公开信息处罚。\n\n我们保留在极端情形下向公众披露涉事账号信息的权利。`,
    }),
    mkNews({
      id: 'news_blackout',
      title: '东岸三城同时断网六小时，官方称为"计划检修"',
      summary: '三座城市的骨干网在同一分钟中断，运营商的解释无法覆盖时间上的巧合。',
      section: '要闻',
      tags: ['基础设施', '未证实传闻'],
      authorIds: ['jnl_kai', 'jnl_mira'],
      daysAgo: 5,
      dateline: '东岸',
      body: `断网发生在当地时间 03:14，恢复于 09:20。\n\n三家运营商给出了措辞几乎相同的公告。本报正在核实两条相互矛盾的线索，在证据充分前不做定性。`,
    }),
    mkNews({
      id: 'news_moon',
      title: '社论：我们为什么把一轮地平线上的月亮当作眼睛',
      summary: '关于本报徽记的一点解释，以及我们对"看见"的理解。',
      section: '社论',
      tags: ['社论'],
      authorIds: ['jnl_mira'],
      daysAgo: 12,
      dateline: '编辑部',
      body: `月亮不发光，它只是把光还给你。\n\n我们把它画在地平线上，让它像一只将睁未睁的眼睛——提醒自己：新闻的本分不是照亮，而是不闭眼。`,
    }),
  ];

  const tags = [
    mkTag('有详细证据', 'system', '#1b9c8a', '附带可核验的文件、影像或原始记录'),
    mkTag('没有详细证据', 'system', '#e05a3a', '仅为口述、传闻或推断'),
    mkTag('军事', 'custom', '#3f7bff'),
    mkTag('外交', 'custom', '#7a5cff'),
    mkTag('能源', 'custom', '#f0a92b'),
    mkTag('内部人事', 'custom', '#e0518a'),
    mkTag('卫星影像', 'custom', '#2fb8d8'),
    mkTag('时效性强', 'custom', '#ff7a45'),
    mkTag('高风险', 'custom', '#d33f3f'),
    mkTag('经济', 'custom', '#4caf7d'),
    mkTag('基础设施情报', 'custom', '#5b8def'),
  ];

  const profiles = [
    mkProfile('prf_owl', users[2].id, '夜航船', '☾', '只在午夜之后回消息。'),
    mkProfile('prf_ash', users[2].id, '灰烬账房', '🜂', '负责把数字对上。'),
    mkProfile('prf_lyra', users[1].id, '雪线以南', '✶', '你猜我在哪。'),
    mkProfile('prf_chan', users[3].id, '第七顾问', '⚑', '代表某个不愿具名的办公室。'),
    mkProfile('prf_chan2', users[3].id, '空椅子', '❖', ''),
  ];

  const offers = [
    {
      id: 'ofr_pipeline',
      profileId: 'prf_owl',
      title: '三号管线夜班调度表（内部流出）',
      summary: '包含十二个未公开夜班的时间、船名与签收人代号。',
      tags: ['有详细证据', '能源', '卫星影像'],
      tiers: [
        { id: 'tier_p1', name: '概要', detail: '时间段与船只数量', price: 40, content: '十二个夜班分布在 3 月 4 日至 4 月 19 日之间，集中在每周二、周五 01:00-04:00，共涉及 5 艘船。', evidenceIds: [] },
        { id: 'tier_p2', name: '完整名单', detail: '船名、吨位、签收人代号', price: 180, content: '船名：MV Kestrel / MV Ondine / MV Bright Fen / MV Sable / MV Ninth Hour。签收人代号 K-2、K-7、L-1。K-7 在四次运输中同时出现在两个港口的签收栏——这是伪造的直接痕迹。', evidenceIds: [] },
        { id: 'tier_p3', name: '含原始扫描件', detail: '调度表照片与元数据', price: 420, content: '原始调度表共 6 页，拍摄于运营中心值班室。第 4 页右下角有手写批注："此页不入系统"。', evidenceIds: [] },
      ],
      status: 'open',
      views: 214,
      hiddenByAdmin: false,
      createdAt: iso(3, 23),
    },
    {
      id: 'ofr_summit',
      profileId: 'prf_chan2',
      title: '环月峰会闭门会的三份草案措辞差异',
      summary: '为什么最后用的是"应当"而不是"必须"。',
      tags: ['没有详细证据', '外交', '时效性强'],
      tiers: [
        { id: 'tier_s1', name: '口述还原', detail: '无文件，仅在场者描述', price: 60, content: '第二版草案中"必须"出现 4 次，第三版全部替换为"应当"，替换动议由第三方代表团在凌晨 01:40 提出，理由是"避免国内立法冲突"。', evidenceIds: [] },
        { id: 'tier_s2', name: '含提案方与交换条件', detail: '谁提的，换到了什么', price: 260, content: '提出替换的是能源配额受益最小的一方，交换条件是在附件三里增加一条为期两年的过渡期条款。附件三未随公报公开。', evidenceIds: [] },
      ],
      status: 'open',
      views: 388,
      hiddenByAdmin: false,
      createdAt: iso(2, 20),
    },
    {
      id: 'ofr_blackout',
      profileId: 'prf_ash',
      title: '东岸断网当晚，三家运营商的内部工单编号',
      summary: '工单是同一个模板生成的，创建时间相差 90 秒。',
      tags: ['有详细证据', '基础设施情报', '高风险'],
      tiers: [
        { id: 'tier_b1', name: '工单编号与时间戳', detail: '可自行向内部人核对', price: 120, content: '工单号 EM-33481 / EM-33482 / EM-33489，创建时间 02:58:11、02:58:44、02:59:41，创建者字段均为同一个服务账号。', evidenceIds: [] },
        { id: 'tier_b2', name: '含下发指令的上级系统截图', detail: '风险较高，请自行评估', price: 500, content: '上级系统为区域调度平台，指令类型标记为"预案演练"，但演练计划表中当日无安排。', evidenceIds: [] },
      ],
      status: 'open',
      views: 501,
      hiddenByAdmin: false,
      createdAt: iso(5, 2),
    },
    {
      id: 'ofr_fake',
      profileId: 'prf_lyra',
      title: '某国防长本周将辞职（已被举报）',
      summary: '来源单一，尚未通过二次核实。',
      tags: ['没有详细证据', '内部人事'],
      tiers: [{ id: 'tier_f1', name: '全文', detail: '一条转述', price: 90, content: '据称辞呈已交，将在周五公布。转述者本人未直接接触文件。', evidenceIds: [] }],
      status: 'open',
      views: 96,
      hiddenByAdmin: false,
      createdAt: iso(6, 15),
    },
  ];

  const requests = [
    {
      id: 'req_pipeline',
      profileId: 'prf_chan',
      title: '求购：三号管线运营方与港务的资金往来凭证',
      brief: '需要能对应到具体日期的转账凭证或对账单。只要能证明"夜班"与资金流对得上，价格好商量。',
      tags: ['有详细证据', '能源', '经济'],
      tiers: [
        { id: 'rt_1', name: '线索级', detail: '给出可查证的方向即可', price: 80 },
        { id: 'rt_2', name: '凭证级', detail: '至少一份可核验的对账单', price: 400 },
        { id: 'rt_3', name: '完整链条', detail: '资金流与运输时间一一对应', price: 1200 },
      ],
      deposit: 1200,
      depositRemaining: 1200,
      deadline: iso(-14, 12),
      status: 'open',
      hiddenByAdmin: false,
      createdAt: iso(4, 11),
    },
    {
      id: 'req_blackout',
      profileId: 'prf_chan',
      title: '求购：东岸断网期间的区域调度平台操作日志',
      brief: '仅需 03:00-09:30 时段。可接受脱敏，但需保留操作账号与时间戳。',
      tags: ['有详细证据', '高风险'],
      tiers: [
        { id: 'rt_4', name: '片段', detail: '任意 30 分钟连续日志', price: 300 },
        { id: 'rt_5', name: '全时段', detail: '完整 6.5 小时', price: 900 },
      ],
      deposit: 900,
      depositRemaining: 900,
      deadline: iso(-7, 12),
      status: 'open',
      hiddenByAdmin: false,
      createdAt: iso(2, 16),
    },
  ];

  const next = {
    meta: { version: 1, seededAt: new Date().toISOString() },
    users,
    profiles,
    news,
    journalists,
    tags,
    offers,
    requests,
    purchases: [
      { id: uid('buy'), offerId: 'ofr_pipeline', tierId: 'tier_p1', buyerUserId: users[3].id, buyerProfileId: 'prf_chan', sellerProfileId: 'prf_owl', amount: 40, createdAt: iso(2, 14) },
      { id: uid('buy'), offerId: 'ofr_summit', tierId: 'tier_s1', buyerUserId: users[1].id, buyerProfileId: 'prf_lyra', sellerProfileId: 'prf_chan2', amount: 60, createdAt: iso(1, 10) },
    ],
    submissions: [],
    evidence: [],
    reports: [
      {
        id: 'rpt_fake',
        reporterUserId: users[3].id,
        reporterProfileId: 'prf_chan',
        targetType: 'offer',
        targetId: 'ofr_fake',
        reason: 'fake',
        detail: '同一条"辞职"消息该账号已经卖过三次，每次日期都不一样。',
        evidenceIds: [],
        status: 'pending',
        createdAt: iso(1, 21),
      },
    ],
    arbitrations: [],
    tomatoes: [
      mkTomato('/', 22, 68, '月亮真好看', '匿名投掷者', users[4].id),
      mkTomato('/news', 61, 41, '这篇写得好', '☾ 夜航船', users[2].id, 'prf_owl'),
      mkTomato('/tavern', 44, 55, '', '匿名投掷者', users[3].id),
      mkTomato('/journalists', 77, 30, '沈记者辛苦了', '匿名投掷者', users[1].id),
    ],
    transactions: [],
    auditLog: [],
  };

  replaceAll(next);

  // 补一笔初始账本，让钱包页面一开始就有内容
  for (const u of db.users) {
    db.transactions.push({
      id: uid('tx'),
      userId: u.id,
      profileId: null,
      delta: u.coins,
      kind: 'grant',
      memo: '开站初始配额',
      refType: null,
      refId: null,
      createdAt: iso(30, 8),
    });
  }
  save(true);
  console.log(`[jontop] 初始内容写入完成：${db.news.length} 篇报道 / ${db.journalists.length} 位记者 / ${db.offers.length} 条情报`);
}

function mkUser(username, password, displayName, role, coins) {
  return {
    id: uid('usr'),
    username,
    displayName,
    password: hashPassword(password),
    role,
    coins,
    escrow: 0,
    frozenFunds: 0,
    banned: false,
    banReason: null,
    noticeAckedAt: null,
    createdAt: iso(40, 10),
  };
}

function mkNews({ id, title, summary, body, section, tags, authorIds, daysAgo, featured = false, dateline = '' }) {
  return {
    id,
    slug: id.replace(/^news_/, ''),
    title,
    summary,
    body,
    section,
    tags,
    cover: null,
    dateline,
    authorIds,
    status: 'published',
    featured,
    readingMinutes: Math.max(1, Math.round(body.length / 400)),
    views: 40 + ((daysAgo * 137) % 900),
    publishedAt: iso(daysAgo),
  };
}

function mkTag(label, kind, color, description = '') {
  return { id: uid('tag'), label, kind, color, description, createdBy: null, archived: false, createdAt: iso(30) };
}

function mkProfile(id, userId, alias, sigil, bio) {
  return { id, userId, alias, sigil, bio, reputation: 0, dealsClosed: 0, retired: false, createdAt: iso(20) };
}

function mkTomato(page, x, y, note, alias, userId, profileId = null) {
  const splats = ['splat-a', 'splat-b', 'splat-c', 'splat-d'];
  return {
    id: uid('tmt'),
    page,
    x,
    y,
    rot: Math.floor(Math.random() * 360),
    scale: 0.9 + Math.random() * 0.4,
    splat: splats[Math.floor(Math.random() * splats.length)],
    note,
    alias,
    userId,
    profileId,
    hidden: false,
    createdAt: iso(1, 12),
  };
}

// 直接执行时：node src/seed.js [--force]
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  if (!isEmpty() && !force) {
    console.log('[jontop] 数据库已有内容。加 --force 可覆盖重置。');
  } else {
    seedDatabase();
  }
}
