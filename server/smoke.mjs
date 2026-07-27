/** 接口冒烟测试：跑一遍主要业务闭环。用完可删。 */
const BASE = 'http://localhost:4000/api';
let pass = 0;
let fail = 0;

async function call(path, { method = 'GET', body, token, ghost } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ghost) headers['x-ghost-session'] = ghost;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : {} };
}

function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

const login = async (u, p) => (await call('/auth/login', { method: 'POST', body: { username: u, password: p } })).data;

console.log('\n— 公共接口 —');
check('健康检查', (await call('/health')).data.ok);
const news = await call('/news?q=管线');
check('新闻搜索', news.data.items.length === 1, JSON.stringify(news.data.total));
check('新闻详情', (await call('/news/news_pipeline')).data.article.body.length > 50);
check('记者展廊', (await call('/journalists')).data.items.length === 5);
check('记者详情含代表作', (await call('/journalists/jnl_kai')).data.journalist.signatureWorks.length === 1);

console.log('\n— 账号 —');
const spy = await login('nightowl', 'nightowl123456');
const boss = await login('chancellor', 'chancellor123456');
const admin = await login('admin', 'admin123456');
check('三个演示账号可登录', !!spy.token && !!boss.token && !!admin.token);
check('管理员角色正确', admin.user.role === 'admin');

console.log('\n— 酒馆：付费墙 —');
const anon = await call('/tavern/offers/ofr_pipeline');
check('未登录看不到正文', anon.data.offer.tiers.every((t) => t.content === null));
const asBoss = await call('/tavern/offers/ofr_pipeline', { token: boss.token });
check('已购档位可见正文', asBoss.data.offer.tiers[0].content !== null);
check('未购档位仍然隐藏', asBoss.data.offer.tiers[1].content === null);
check('卖家只以马甲示人', asBoss.data.offer.seller.alias === '夜航船' && !('userId' in asBoss.data.offer.seller));

const buy = await call('/tavern/offers/ofr_pipeline/purchase', {
  method: 'POST',
  token: boss.token,
  body: { tierId: 'tier_p2', buyerProfileId: 'prf_chan' },
});
check('购买档位成功', buy.status === 200 && buy.data.offer.tiers[1].content !== null, buy.data.error);
check('重复购买被拒', (await call('/tavern/offers/ofr_pipeline/purchase', { method: 'POST', token: boss.token, body: { tierId: 'tier_p2' } })).status === 400);
check('不能买自己的情报', (await call('/tavern/offers/ofr_pipeline/purchase', { method: 'POST', token: spy.token, body: { tierId: 'tier_p3' } })).status === 400);

console.log('\n— 酒馆：发布与标签 —');
const noEvidence = await call('/tavern/offers', {
  method: 'POST',
  token: spy.token,
  body: { profileId: 'prf_owl', title: '测试标题足够长', tags: ['军事'], tiers: [{ name: 'A', price: 10, content: '这段内容够十个字了吧' }] },
});
check('缺少证据标签被拒', noEvidence.status === 400, noEvidence.data.error);

const badEvidence = await call('/tavern/offers', {
  method: 'POST',
  token: spy.token,
  body: { profileId: 'prf_owl', title: '测试标题足够长', tags: ['有详细证据'], tiers: [{ name: 'A', price: 10, content: '这段内容够十个字了吧' }] },
});
check('声称有证据却没附件被拒', badEvidence.status === 400, badEvidence.data.error);

const created = await call('/tavern/offers', {
  method: 'POST',
  token: spy.token,
  body: {
    profileId: 'prf_owl',
    title: '冒烟测试用的情报标题',
    summary: '摘要',
    tags: ['没有详细证据', '军事'],
    tiers: [
      { name: '概要', detail: '一句话', price: 10, content: '这一档的内容至少十个字。' },
      { name: '全文', detail: '完整', price: 50, content: '这一档的内容更详细一些，也超过十个字。' },
    ],
  },
});
check('发布情报成功', created.status === 200, created.data.error);
check('档位按价格升序', created.data.offer?.tiers[0].price === 10);

const newTag = await call('/tavern/tags', { method: 'POST', token: spy.token, body: { label: '冒烟标签' } });
check('用户可新增标签', newTag.status === 200 && newTag.data.tag.kind === 'custom');

console.log('\n— 酒馆：委托、保证金与阶梯结算 —');
const before = (await call('/wallet', { token: boss.token })).data.wallet;
const req = await call('/tavern/requests', {
  method: 'POST',
  token: boss.token,
  body: {
    profileId: 'prf_chan2',
    title: '冒烟测试的求购委托',
    brief: '要点东西',
    tags: ['有详细证据', '经济'],
    tiers: [
      { name: '线索', detail: '方向', price: 50 },
      { name: '凭证', detail: '材料', price: 200 },
    ],
    deposit: 200,
  },
});
check('发布委托成功', req.status === 200, req.data.error);
const afterLock = (await call('/wallet', { token: boss.token })).data.wallet;
check('保证金进入托管', afterLock.escrow === before.escrow + 200 && afterLock.coins === before.coins - 200);

const lowDeposit = await call('/tavern/requests', {
  method: 'POST',
  token: boss.token,
  body: { profileId: 'prf_chan2', title: '保证金不够的委托', tags: ['没有详细证据'], tiers: [{ name: 'A', price: 500 }], deposit: 100 },
});
check('保证金低于最高档被拒', lowDeposit.status === 400, lowDeposit.data.error);

const reqId = req.data.request.id;
const tier200 = req.data.request.tiers.find((t) => t.price === 200).id;
const sub = await call(`/tavern/requests/${reqId}/submit`, {
  method: 'POST',
  token: spy.token,
  body: { profileId: 'prf_owl', tierId: tier200, content: '这是投递给委托方的情报内容，足够长。' },
});
check('间谍应征成功', sub.status === 200, sub.data.error);

const asOther = await call(`/tavern/requests/${reqId}`, { token: admin.token });
check('第三方看不到投递内容', asOther.data.request.submissions[0].content === null);
const asOwner = await call(`/tavern/requests/${reqId}`, { token: boss.token });
check('委托方能看到投递内容', asOwner.data.request.submissions[0].content !== null);

const spyBefore = (await call('/wallet', { token: spy.token })).data.wallet.coins;
const settle = await call(`/tavern/requests/${reqId}/settle`, {
  method: 'POST',
  token: boss.token,
  body: { submissionId: sub.data.request.submissions[0].id, action: 'accept' },
});
check('采纳并结算', settle.status === 200, settle.data.error);
check('赏金从托管付给间谍', (await call('/wallet', { token: spy.token })).data.wallet.coins === spyBefore + 200);
const closed = await call(`/tavern/requests/${reqId}/close`, { method: 'POST', token: boss.token });
check('关闭委托退回剩余保证金', closed.status === 200 && (await call('/wallet', { token: boss.token })).data.wallet.escrow === before.escrow);

console.log('\n— 番茄弹幕 —');
const coinsBefore = (await call('/wallet', { token: spy.token })).data.wallet.coins;
const thrown = await call('/tomatoes', { method: 'POST', token: spy.token, body: { page: '/news', x: 30, y: 40, note: '冒烟' } });
check('投掷番茄成功', thrown.status === 200, thrown.data.error);
check('扣除 tomato coin', (await call('/wallet', { token: spy.token })).data.wallet.coins === coinsBefore - 1);
check('番茄不暴露投掷者', !('userId' in thrown.data.tomato) && thrown.data.tomato.alias === '匿名投掷者');
check('越界坐标被拒', (await call('/tomatoes', { method: 'POST', token: spy.token, body: { page: '/news', x: 300, y: 40 } })).status === 400);
check('未登录不能投掷', (await call('/tomatoes', { method: 'POST', body: { page: '/news', x: 1, y: 1 } })).status === 401);

console.log('\n— 举报与仲裁 —');
const report = await call('/tavern/reports', {
  method: 'POST',
  token: boss.token,
  body: { targetType: 'offer', targetId: 'ofr_fake', reason: 'fake', detail: '重复售卖', profileId: 'prf_chan' },
});
check('提交举报成功', report.status === 200, report.data.error);
const adminReports = await call('/admin/reports?status=pending', { token: admin.token });
check('管理台能看到被举报方真实账号', adminReports.data.items.some((r) => r.accused?.username === 'lyra'));
check('普通用户访问管理台被拒', (await call('/admin/reports', { token: boss.token })).status === 403);

const targetReport = adminReports.data.items.find((r) => r.targetId === 'ofr_fake');
const verdict = await call(`/admin/reports/${targetReport.id}/arbitrate`, {
  method: 'POST',
  token: admin.token,
  body: {
    verdict: 'upheld',
    severity: 'severe',
    penalties: ['takedown', 'ban_all_alts', 'freeze_funds', 'compensate', 'public_disclosure'],
    compensation: 90,
    summary: '查实为重复售卖未经核实的消息',
  },
});
check('仲裁执行成功', verdict.status === 200, verdict.data.error);
check('执行了封禁全部马甲', verdict.data.arbitration.executed.some((x) => x.includes('封禁')));
check('执行了划扣赔偿', verdict.data.arbitration.executed.some((x) => x.includes('划扣')));
check('被封禁账号无法登录', (await call('/auth/login', { method: 'POST', body: { username: 'lyra', password: 'lyra123456' } })).status === 403);
check('涉事情报已下架', (await call('/tavern/offers/ofr_fake')).status === 404);
check('公开处罚公告已发布', (await call('/tavern/disclosures')).data.items.length === 1);

console.log('\n— Ghost 无痕通道 —');
check('错误口令伪装成 404', (await call('/ghost/session', { method: 'POST', body: { key: 'wrong' } })).status === 404);
check('无会话访问伪装成 404', (await call('/ghost/identities')).status === 404);
const ghost = await call('/ghost/session', { method: 'POST', body: { key: 'moon-sees-everything' } });
check('正确口令换到会话', ghost.status === 200 && !!ghost.data.sessionKey);
const gk = ghost.data.sessionKey;

const ids = await call('/ghost/identities', { ghost: gk });
check('可摘下所有面具', ids.data.items.some((r) => r.user.username === 'nightowl' && r.profiles.length === 2));
const gOffers = await call('/ghost/offers', { ghost: gk });
const pipeline = gOffers.data.items.find((o) => o.id === 'ofr_pipeline');
check('无需付费看到全部正文', pipeline.tiers.every((t) => typeof t.content === 'string' && t.content.length > 0));
check('看到卖家真身', pipeline.seller.username === 'nightowl');
check('看到买家真身', pipeline.buyers.some((b) => b.buyer.username === 'chancellor'));
const gTomato = await call('/ghost/tomatoes', { ghost: gk });
check('番茄可溯源到真实账号', gTomato.data.items.some((t) => t.note === '冒烟' && t.thrower === 'nightowl'));
const gSearch = await call('/ghost/search?q=K-7', { ghost: gk });
check('全站检索命中付费正文', gSearch.data.groups.some((g) => g.kind === '情报' && g.hits.length > 0));

const viewsBefore = pipeline.views;
await call('/ghost/offers', { ghost: gk });
const viewsAfter = (await call('/ghost/offers', { ghost: gk })).data.items.find((o) => o.id === 'ofr_pipeline').views;
check('ghost 浏览不增加计数', viewsBefore === viewsAfter);

const auditBefore = (await call('/admin/overview', { token: admin.token })).data.recentAudit.length;
await call('/ghost/ledger', { ghost: gk });
await call('/ghost/reports', { ghost: gk });
const auditAfter = (await call('/admin/overview', { token: admin.token })).data.recentAudit.length;
check('ghost 操作不写审计日志', auditBefore === auditAfter);

console.log(`\n通过 ${pass} 项，失败 ${fail} 项\n`);
process.exit(fail ? 1 : 0);
