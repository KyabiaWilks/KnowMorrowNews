/**
 * Ghost —— 站长专用的无痕视角。
 *
 * 这个页面不在任何导航里出现，用服务端的 GHOST_KEY 进入。
 * 会话密钥只放在 sessionStorage，关掉标签页即失效；
 * 服务端对本页的所有查询都不写审计日志、不增加浏览数、不通知任何人。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { del, get, ghostStore, post } from '../../lib/api';
import { fmtTime, tmt } from '../../lib/format';

type Tab = 'overview' | 'identities' | 'offers' | 'requests' | 'ledger' | 'reports' | 'tomatoes' | 'ign-copies' | 'ticket-archives' | 'ticket-messages' | 'search';
type Language = 'en' | 'zh';
type Translate = (english: string, chinese: string) => string;

const TABS: { id: Tab; en: string; zh: string }[] = [
  { id: 'overview', en: 'Overview', zh: '总览' },
  { id: 'identities', en: 'Identities', zh: '身份对照' },
  { id: 'offers', en: 'Full tips', zh: '情报全文' },
  { id: 'requests', en: 'Requests', zh: '委托与投递' },
  { id: 'ledger', en: 'Ledger', zh: '资金流水' },
  { id: 'reports', en: 'Reports', zh: '举报底档' },
  { id: 'tomatoes', en: 'Tomatoes', zh: '番茄溯源' },
  { id: 'ign-copies', en: 'IGN copies', zh: 'IGN 复制记录' },
  { id: 'ticket-archives', en: 'Ticket archives', zh: 'Ticket 归档' },
  { id: 'ticket-messages', en: 'Ticket messages', zh: 'Ticket 消息' },
  { id: 'search', en: 'Search', zh: '全站检索' },
];

function LanguageSwitch({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <div className="ghost-language" role="group" aria-label="Ghost language"><button type="button" className={language === 'en' ? 'on' : ''} onClick={() => onChange('en')}>EN</button><button type="button" className={language === 'zh' ? 'on' : ''} onClick={() => onChange('zh')}>中文</button></div>;
}

export default function GhostPage() {
  const [authed, setAuthed] = useState(!!ghostStore.get());
  const [tab, setTab] = useState<Tab>('overview');
  const [q, setQ] = useState('');
  // 数据带上它所属的标签页：切换标签时旧数据的形状对不上新视图，必须先丢掉
  const [loaded, setLoaded] = useState<{ tab: Tab; payload: any } | null>(null);
  const [err, setErr] = useState('');
  const [language, setLanguageState] = useState<Language>(() => localStorage.getItem('know-morrow.ghost-language') === 'zh' ? 'zh' : 'en');
  const setLanguage = (next: Language) => { localStorage.setItem('know-morrow.ghost-language', next); setLanguageState(next); };
  const t: Translate = useCallback((english, chinese) => language === 'zh' ? chinese : english, [language]);

  const load = useCallback(async () => {
    setErr('');
    try {
      const path = tab === 'search' ? `/ghost/search?q=${encodeURIComponent(q)}` : `/ghost/${tab}${q ? `?q=${encodeURIComponent(q)}` : ''}`;
      setLoaded({ tab, payload: await get(path, true) });
    } catch (e) {
      if ((e as { status?: number }).status === 404) {
        ghostStore.clear();
        setAuthed(false);
      }
      setErr((e as Error).message);
    }
  }, [tab, q]);

  const data = loaded?.tab === tab ? loaded.payload : null;

  useEffect(() => {
    if (!authed) return;
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [authed, load]);

  if (!authed) return <Gate onPass={() => setAuthed(true)} language={language} setLanguage={setLanguage} t={t} />;

  return (
    <div className="ghost">
      <div className="ghost__inner">
        <div className="ghost__bar">
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>👁 GHOST TERMINAL</div>
            <div style={{ opacity: 0.6, fontSize: 11.5 }}>
              {t('Trace-free mode · This session creates no logs · Closing the tab ends it', '无痕模式 · 本次会话不产生任何日志 · 关闭标签页即失效')}
            </div>
          </div>
          <LanguageSwitch language={language} onChange={setLanguage} />
          <input
            style={{ marginLeft: 'auto', width: 300 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'search' ? t('Search the entire site, including paid text…', '搜遍全站（含付费正文）…') : t('Filter this view…', '在当前视图内过滤…')}
          />
          <button
            style={{ background: 'transparent', border: '1px solid rgba(255,157,122,.5)', color: '#ff9d7a', padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5 }}
            onClick={async () => {
              await del('/ghost/session', true).catch(() => {});
              ghostStore.clear();
              setAuthed(false);
            }}
          >
            {t('Disconnect', '断开')}
          </button>
        </div>

        <div className="ghost__tabs" style={{ marginBottom: 16 }}>
          {TABS.map((item) => (
            <button key={item.id} className={tab === item.id ? 'on' : ''} onClick={() => setTab(item.id)}>
              {language === 'zh' ? item.zh : item.en}
            </button>
          ))}
        </div>

        {err && <div className="ghost-warn">✖ {err}</div>}
        {!data && !err && <div style={{ opacity: 0.6 }} className="caret">{t('Reading', '读取中')}</div>}

        {data && tab === 'overview' && <Overview data={data} t={t} />}
        {data && tab === 'identities' && <Identities data={data} t={t} />}
        {data && tab === 'offers' && <Offers data={data} t={t} />}
        {data && tab === 'requests' && <Requests data={data} t={t} />}
        {data && tab === 'ledger' && <Ledger data={data} t={t} />}
        {data && tab === 'reports' && <Reports data={data} t={t} />}
        {data && tab === 'tomatoes' && <Tomatoes data={data} t={t} />}
        {data && tab === 'ign-copies' && <IgnCopies data={data} t={t} />}
        {data && tab === 'ticket-archives' && <TicketArchives data={data} t={t} />}
        {data && tab === 'ticket-messages' && <TicketMessages data={data} t={t} />}
        {data && tab === 'search' && <SearchResults data={data} t={t} />}
      </div>
    </div>
  );
}

function Gate({ onPass, language, setLanguage, t }: { onPass: () => void; language: Language; setLanguage: (language: Language) => void; t: Translate }) {
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const res = await post<{ sessionKey: string }>('/ghost/session', { key });
      ghostStore.set(res.sessionKey);
      onPass();
    } catch {
      setErr(t('Access denied.', '访问被拒绝。'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ghost-gate">
      <form className="ghost-gate__box" onSubmit={submit}>
        <LanguageSwitch language={language} onChange={setLanguage} />
        <div style={{ fontSize: 15, marginBottom: 4 }}>jontop:~$ ./ghost --attach</div>
        <div style={{ opacity: 0.55, fontSize: 12, marginBottom: 18 }}>
          {t('This terminal can read all site data, including Tavern identities and paid text.', '此终端可读取全站任意数据，包括酒馆内的匿名身份与付费正文。')}
          <br />
          {t('Viewing leaves no trace.', '查看行为不会留下任何痕迹。')}
        </div>
        <input
          autoFocus
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="passphrase"
          style={{ width: '100%', marginBottom: 12 }}
        />
        {err && <div className="ghost-warn" style={{ marginBottom: 10 }}>{err}</div>}
        <button
          style={{ width: '100%', background: '#7dffc4', color: '#04070c', border: 'none', padding: '9px', borderRadius: 5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
          disabled={busy}
        >
          {busy ? t('Authenticating…', '认证中…') : t('ENTER', '进入')}
        </button>
      </form>
    </div>
  );
}

/* ------------------------------- 各视图 ------------------------------- */

function Overview({ data, t }: { data: any; t: Translate }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
        {Object.entries(data.stats).map(([k, v]) => (
          <div key={k} className="ghost-card" style={{ margin: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{String(v)}</div>
            <div style={{ opacity: 0.55, fontSize: 11 }}>{k}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        <div className="ghost-card">
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>// {t('Cross-mask activity: the most active accounts', '跨马甲聚合：谁在这个站里最活跃')}</h3>
          <table className="ghost-table">
            <thead>
              <tr>
                <th>{t('Account', '真实账号')}</th>
                <th>{t('Masks', '持有马甲')}</th>
                <th>{t('Sold', '卖')}</th>
                <th>{t('Bought', '买')}</th>
                <th>{t('Spent', '花出')}</th>
                <th>{t('Earned', '赚到')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topActors.map((a: any) => (
                <tr key={a.userId}>
                  <td>
                    {a.username} <span className="ghost-tag">{a.role}</span>
                  </td>
                  <td>{a.aliases.join(' / ') || '—'}</td>
                  <td>{a.sells}</td>
                  <td>{a.buys}</td>
                  <td>{a.spent}</td>
                  <td>{a.earned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ghost-card">
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>// {t('Live timeline (identities revealed)', '实时时间线（已摘下面具）')}</h3>
          <div style={{ maxHeight: 420, overflow: 'auto' }}>
            {data.timeline.map((event: any, i: number) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(125,255,196,.08)' }}>
                <span className="ghost-tag">{event.kind}</span>{' '}
                <span style={{ opacity: 0.55 }}>{fmtTime(event.at)}</span>
                <div>{event.text}</div>
                <div style={{ opacity: 0.7 }}>
                  ↳ {event.who.username}
                  {event.who.alias ? ` (${t('mask', '面具')}：${event.who.alias})` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Identities({ data, t }: { data: any; t: Translate }) {
  return (
    <div>
      <div style={{ opacity: 0.6, marginBottom: 10 }}>// {t('Mask ⇄ account directory. No other site role can view this table.', '马甲 ⇄ 真实账号 对照表。站内任何其他角色都看不到这张表。')}</div>
      {data.items.map((row: any) => (
        <div key={row.user.id} className="ghost-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong style={{ fontSize: 15 }}>{row.user.username}</strong> <span className="ghost-tag">{row.user.role}</span>
              {row.user.banned && <span className="ghost-tag ghost-warn"> BANNED</span>}
              <div style={{ opacity: 0.55 }}>{row.user.displayName} · {t('Registered', '注册于')} {fmtTime(row.user.createdAt)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div>{t('Balance', '余额')} {row.user.wallet.coins} · {t('Escrow', '托管')} {row.user.wallet.escrow} · {t('Frozen', '冻结')} {row.user.wallet.frozen}</div>
              <div style={{ opacity: 0.55 }}>{row.profiles.length} {t('masks', '副面具')}</div>
            </div>
          </div>
          {row.profiles.length > 0 && (
            <table className="ghost-table" style={{ marginTop: 10 }}>
              <thead>
                <tr>
                  <th>{t('Mask', '面具')}</th>
                  <th>{t('Tips', '发布情报')}</th>
                  <th>{t('Requests', '发布委托')}</th>
                  <th>{t('Created', '创建时间')}</th>
                  <th>{t('Status', '状态')}</th>
                </tr>
              </thead>
              <tbody>
                {row.profiles.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      {p.sigil} {p.alias}
                    </td>
                    <td>{p.offers}</td>
                    <td>{p.requests}</td>
                    <td>{fmtTime(p.createdAt)}</td>
                    <td>{p.retired ? <span className="ghost-warn">{t('retired', '已停用')}</span> : t('active', '启用')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

function Offers({ data, t }: { data: any; t: Translate }) {
  return (
    <div>
      <div style={{ opacity: 0.6, marginBottom: 10 }}>// {t('Every tier is expanded without payment. Sellers receive no notification.', '所有档位的正文都已展开，无需付费，卖方不会收到任何提示。')}</div>
      {data.items.map((o: any) => (
        <div key={o.id} className="ghost-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 15 }}>{o.title}</strong>
              <div style={{ opacity: 0.7 }}>
                {t('Seller account', '卖家真身')} → <strong>{o.seller.username}</strong> ({t('mask', '面具')}：{o.seller.sigil} {o.seller.alias})
              </div>
            </div>
            <div style={{ textAlign: 'right', opacity: 0.6 }}>
              {fmtTime(o.createdAt)} · {o.views} {t('views', '浏览')} · {o.status}
            </div>
          </div>

          <div style={{ margin: '8px 0' }}>
            {o.tags.map((t: string) => (
              <span key={t} className="ghost-tag" style={{ marginRight: 5 }}>
                {t}
              </span>
            ))}
          </div>

          {o.tiers.map((t: any) => (
            <div key={t.id} style={{ borderLeft: '2px solid rgba(125,255,196,.35)', paddingLeft: 11, margin: '9px 0' }}>
              <div style={{ opacity: 0.75 }}>
                【{t.name} · {tmt(t.price)}】{t.detail}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#c9ffe6' }}>{t.content}</div>
              {t.evidence.length > 0 && (
                <div style={{ marginTop: 5 }}>
                  {t.evidence.map((e: any) => (
                    <a key={e.id} href={e.url} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>
                      📎 {e.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {o.buyers.length > 0 && (
            <>
              <div style={{ opacity: 0.6, marginTop: 10 }}>// {t('Buyer list (permanently hidden from the seller)', '买家名单（对卖家永久保密）')}</div>
              <table className="ghost-table">
                <thead>
                  <tr>
                    <th>{t('Time', '时间')}</th>
                    <th>{t('Tier', '档位')}</th>
                    <th>{t('Amount', '金额')}</th>
                    <th>{t('Account', '真实账号')}</th>
                    <th>{t('Mask used', '出面用的马甲')}</th>
                  </tr>
                </thead>
                <tbody>
                  {o.buyers.map((b: any, i: number) => (
                    <tr key={i}>
                      <td>{fmtTime(b.at)}</td>
                      <td>{b.tier}</td>
                      <td>{b.amount}</td>
                      <td>
                        <strong>{b.buyer.username}</strong>
                      </td>
                      <td>{b.buyer.maskUsed || t('(none used)', '（未露面）')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ))}
      {data.items.length === 0 && <div style={{ opacity: 0.5 }}>// {t('No matching records', '无匹配记录')}</div>}
    </div>
  );
}

function Requests({ data, t }: { data: any; t: Translate }) {
  return (
    <div>
      {data.items.map((r: any) => (
        <div key={r.id} className="ghost-card">
          <strong style={{ fontSize: 15 }}>{r.title}</strong>
          <div style={{ opacity: 0.7 }}>
            {t('Requester account', '委托方真身')} → <strong>{r.buyer.username}</strong> ({t('mask', '面具')}：{r.buyer.alias}) · {t('Escrow', '保证金')} {r.deposit} ({t('remaining', '剩余')} {r.depositRemaining}) · {r.status}
          </div>
          <div style={{ opacity: 0.75, margin: '6px 0', whiteSpace: 'pre-wrap' }}>{r.brief}</div>
          <div style={{ opacity: 0.6 }}>
            {t('Tiers', '阶梯')}：{r.tiers.map((tier: any) => `${tier.name} ${tier.price}`).join(' / ')}
          </div>

          {r.submissions.length > 0 && (
            <>
              <div style={{ opacity: 0.6, marginTop: 10 }}>// {t('Submissions (visible only to the requester)', '投递内容（委托方以外不可见）')}</div>
              {r.submissions.map((s: any) => (
                <div key={s.id} style={{ borderLeft: '2px solid rgba(125,255,196,.35)', paddingLeft: 11, margin: '9px 0' }}>
                  <div style={{ opacity: 0.75 }}>
                    {s.supplier.username} ({t('mask', '面具')}：{s.supplier.alias}) · {s.status} · {fmtTime(s.createdAt)}
                    {s.paid ? ` · ${t('Paid', '已付')} ${s.paid}` : ''}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#c9ffe6' }}>{s.content}</div>
                </div>
              ))}
            </>
          )}
        </div>
      ))}
      {data.items.length === 0 && <div style={{ opacity: 0.5 }}>// {t('No matching records', '无匹配记录')}</div>}
    </div>
  );
}

function Ledger({ data, t }: { data: any; t: Translate }) {
  return (
    <div className="ghost-card">
      <table className="ghost-table">
        <thead>
          <tr>
            <th>{t('Time', '时间')}</th>
            <th>{t('Account', '账号')}</th>
            <th>{t('Mask used', '使用的马甲')}</th>
            <th>{t('Type', '类型')}</th>
            <th>{t('Memo', '说明')}</th>
            <th style={{ textAlign: 'right' }}>{t('Amount', '金额')}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((t: any) => (
            <tr key={t.id}>
              <td>{fmtTime(t.createdAt)}</td>
              <td>
                <strong>{t.username}</strong>
              </td>
              <td>{t.alias || '—'}</td>
              <td>
                <span className="ghost-tag">{t.kind}</span>
              </td>
              <td>{t.memo}</td>
              <td style={{ textAlign: 'right', color: t.delta >= 0 ? '#7dffc4' : '#ff9d7a' }}>
                {t.delta > 0 ? '+' : ''}
                {t.delta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reports({ data, t }: { data: any; t: Translate }) {
  return (
    <div>
      {data.items.map((r: any) => (
        <div key={r.id} className="ghost-card">
          <div>
            <span className="ghost-tag">{r.reason}</span> <span className="ghost-tag">{r.status}</span>{' '}
            <span style={{ opacity: 0.55 }}>{fmtTime(r.createdAt)}</span>
          </div>
          <div style={{ marginTop: 6 }}>{r.detail}</div>
          <div style={{ opacity: 0.7, marginTop: 6 }}>
            {t('Reporter account', '举报人真身')} → <strong>{r.reporter.username}</strong>
            {r.reporter.mask ? ` (${t('mask', '面具')}：${r.reporter.mask})` : t(' (unnamed)', '（未具名）')}
          </div>
          {r.arbitration && (
            <div style={{ opacity: 0.7, marginTop: 6 }}>
              {t('Decision', '裁决')}：{r.arbitration.summary} · {(r.arbitration.executed || []).join(t('; ', '；'))}
            </div>
          )}
        </div>
      ))}
      {data.items.length === 0 && <div style={{ opacity: 0.5 }}>// {t('No reports', '无举报记录')}</div>}
    </div>
  );
}

function Tomatoes({ data, t }: { data: any; t: Translate }) {
  return (
    <div className="ghost-card">
      <div style={{ opacity: 0.6, marginBottom: 8 }}>// {t('The account behind every tomato, including those signed as “Anonymous thrower”.', '每颗番茄背后的真实账号，包括署名为“匿名投掷者”的那些。')}</div>
      <table className="ghost-table">
        <thead>
          <tr>
            <th>{t('Time', '时间')}</th>
            <th>{t('Page', '页面')}</th>
            <th>{t('Public name', '对外署名')}</th>
            <th>{t('Account', '真实账号')}</th>
            <th>{t('Note', '留言')}</th>
            <th>{t('Status', '状态')}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((tomato: any) => (
            <tr key={tomato.id}>
              <td>{fmtTime(tomato.createdAt)}</td>
              <td>{tomato.page}</td>
              <td>{tomato.alias}</td>
              <td>
                <strong>{tomato.thrower}</strong>
              </td>
              <td>{tomato.note || '—'}</td>
              <td>{tomato.hidden ? <span className="ghost-warn">{t('hidden', '隐藏')}</span> : t('visible', '可见')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IgnCopies({ data, t }: { data: any; t: Translate }) {
  return (
    <div className="ghost-card">
      <div style={{ opacity: 0.6, marginBottom: 8 }}>// {t('Signed-in accounts that used a reporter’s Copy IGN button.', '点击记者“复制 IGN”按钮的已登录账号。')}</div>
      <table className="ghost-table">
        <thead><tr><th>{t('Time', '时间')}</th><th>{t('Account', '复制者账号')}</th><th>{t('Reporter', '记者')}</th><th>IGN</th><th>{t('Source page', '来源页面')}</th></tr></thead>
        <tbody>{data.items.map((entry: any) => <tr key={entry.id}>
          <td>{fmtTime(entry.createdAt)}</td>
          <td><strong>{entry.copierUsername}</strong></td>
          <td>{entry.journalistName}</td>
          <td><span className="ghost-tag">{entry.ign}</span></td>
          <td>{entry.page}</td>
        </tr>)}</tbody>
      </table>
      {data.items.length === 0 && <div style={{ opacity: 0.5, paddingTop: 8 }}>// {t('No IGN copy records', '暂无 IGN 复制记录')}</div>}
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  if (value == null || (Array.isArray(value) && value.length === 0)) return null;
  return <pre style={{ maxHeight: 320, margin: '8px 0 0', padding: 10, overflow: 'auto', border: '1px solid rgba(125,255,196,.12)', borderRadius: 4, background: 'rgba(0,0,0,.2)', color: '#bdebd5', fontSize: 11, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify(value, null, 2)}</pre>;
}

function TicketArchives({ data, t }: { data: any; t: Translate }) {
  return <div>
    <div style={{ opacity: 0.6, marginBottom: 10 }}>// {t('Archived Discord ticket channels and their original channel metadata.', '已归档的 Discord ticket 频道及原始频道信息。')}</div>
    {data.items.map((archive: any) => <article className="ghost-card" key={archive.channel_id}>
      <div className="row row--between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div><strong>{archive.channel_name || archive.channel_id}</strong><div style={{ opacity: 0.6 }}>Channel {archive.channel_id} · Guild {archive.guild_id || '—'}</div></div>
        <div style={{ textAlign: 'right', opacity: 0.65 }}>{archive.archived_at ? fmtTime(archive.archived_at) : '—'}<br />{archive.message_count ?? 0} {t('messages', '条消息')}</div>
      </div>
      {archive.topic && <p style={{ whiteSpace: 'pre-wrap' }}>{archive.topic}</p>}
      <div style={{ opacity: 0.65 }}>{t('Archived by', '归档操作人')}：{archive.archived_by_user_id || '—'} · {t('Channel type', '频道类型')}：{archive.channel_type ?? '—'}</div>
      <details style={{ marginTop: 8 }}><summary>{t('Raw channel record', '原始频道记录')}</summary><JsonBlock value={archive.raw_channel} /></details>
    </article>)}
    {data.items.length === 0 && <div style={{ opacity: 0.5 }}>// {t('No ticket archives', '暂无 Ticket 归档')}</div>}
  </div>;
}

function TicketMessages({ data, t }: { data: any; t: Translate }) {
  return <div>
    <div style={{ opacity: 0.6, marginBottom: 10 }}>// {t('Messages are grouped by ticket and ordered oldest to newest. Opening a ticket jumps to its latest message.', '消息按 Ticket 分类，内部从旧到新排列；展开 Ticket 时会自动定位到最新消息。')}</div>
    {data.tickets.map((ticket: any) => <TicketThread ticket={ticket} t={t} key={ticket.channelId} />)}
    {data.tickets.length === 0 && <div style={{ opacity: 0.5 }}>// {t('No ticket messages', '暂无 Ticket 消息')}</div>}
  </div>;
}

function TicketThread({ ticket, t }: { ticket: any; t: Translate }) {
  const threadRef = useRef<HTMLDivElement>(null);
  const jumpToLatest = () => {
    requestAnimationFrame(() => {
      if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
    });
  };
  return <details className="ghost-card" onToggle={(event) => { if (event.currentTarget.open) jumpToLatest(); }}>
    <summary style={{ cursor: 'pointer' }}>
      <strong>{ticket.channelName || ticket.channelId}</strong>
      <span style={{ opacity: 0.6 }}> · {ticket.messages.length} {t('messages', '条消息')} · Channel {ticket.channelId}</span>
      {ticket.archivedAt && <span style={{ float: 'right', opacity: 0.55 }}>{fmtTime(ticket.archivedAt)}</span>}
    </summary>
    {ticket.topic && <div style={{ margin: '9px 0', opacity: 0.65, whiteSpace: 'pre-wrap' }}>{ticket.topic}</div>}
    <div ref={threadRef} style={{ maxHeight: '68vh', marginTop: 10, paddingRight: 5, overflowY: 'auto', scrollBehavior: 'smooth' }}>
    {ticket.messages.map((message: any) => <article style={{ padding: '12px 0', borderTop: '1px solid rgba(125,255,196,.12)' }} key={`${message.channel_id}-${message.message_id}`}>
      <div className="row row--between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div><strong>{message.author_display_name || message.author_username || message.author_id || t('Unknown author', '未知作者')}</strong>{message.author_username && <span style={{ opacity: 0.6 }}> @{message.author_username}</span>}<div style={{ opacity: 0.55 }}>Author {message.author_id || '—'} · Channel {message.channel_id} · #{message.ordinal ?? '—'}</div></div>
        <div style={{ textAlign: 'right', opacity: 0.65 }}>{message.sent_at ? fmtTime(message.sent_at) : '—'}{message.edited_at && <><br />{t('Edited', '编辑于')} {fmtTime(message.edited_at)}</>}</div>
      </div>
      <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#c9ffe6' }}>{message.content || <span style={{ opacity: 0.45 }}>{t('(no text content)', '（无文本内容）')}</span>}</div>
      {(message.attachments?.length > 0 || message.embeds?.length > 0) && <details style={{ marginTop: 8 }} open><summary>{t('Attachments and embeds', '附件与嵌入内容')}</summary><JsonBlock value={{ attachments: message.attachments, embeds: message.embeds }} /></details>}
      <details style={{ marginTop: 8 }}><summary>{t('Raw message record', '原始消息记录')}</summary><JsonBlock value={message.raw_message} /></details>
    </article>)}
    </div>
  </details>;
}

function SearchResults({ data, t }: { data: any; t: Translate }) {
  if (!data.groups?.length) return <div style={{ opacity: 0.5 }}>// {t('Enter a keyword to search paid text, anonymous identities, and ledger entries.', '输入关键词开始检索。付费正文、匿名身份、资金流水都在检索范围内。')}</div>;
  const groupLabel = (kind: string) => ({
    identities: t('Identities', '身份'),
    tips: t('Full tips', '情报全文'),
    requests: t('Requests', '委托'),
    news: t('News', '报道'),
    ledger: t('Ledger', '流水'),
    'ticket-archives': t('Ticket archives', 'Ticket 归档'),
    'ticket-messages': t('Ticket messages', 'Ticket 消息'),
  }[kind] || kind);
  return (
    <div>
      {data.groups.map((g: any) => (
        <div key={g.kind} className="ghost-card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>
            // {groupLabel(g.kind)} ({g.hits.length})
          </h3>
          {g.hits.map((h: any) => (
            <div key={h.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(125,255,196,.08)' }}>
              <div>{h.title}</div>
              <div style={{ opacity: 0.6 }}>{h.sub}</div>
              {h.at && <div style={{ opacity: 0.45 }}>{fmtTime(h.at)}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
