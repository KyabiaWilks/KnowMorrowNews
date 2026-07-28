import { useEffect, useState } from 'react';
import { get } from '../../lib/api';
import { Spinner, Stat } from '../../components/ui';
import { fmtTime, tmt } from '../../lib/format';
import { useAdminLanguage } from './AdminLanguage';

type Overview = { counts: Record<string, number>; coinSupply: number; escrowHeld: number; recentAudit: { id: string; action: string; actorUserId?: string; createdAt: string }[] };

export default function AdminOverview() {
  const { t } = useAdminLanguage();
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { void get<Overview>('/admin/overview').then(setData); }, []);
  if (!data) return <Spinner />;
  const cards = [
    [data.counts.users || 0, t('Users', '用户')],
    [data.counts.news || 0, t('Published news', '已发布新闻')],
    [data.counts.drafts || 0, t('Drafts', '草稿')],
    [data.counts.journalists || 0, t('Journalists', '记者')],
    [data.counts.pendingReports || 0, t('Pending reports', '待处理举报')],
    [data.counts.tomatoes || 0, t('Tomatoes', '番茄')],
  ] as const;
  return <div className="stack">
    <div className="grid grid--3">{cards.map(([value, label]) => <Stat key={label} value={value} label={label} />)}</div>
    <div className="grid grid--2"><Stat value={tmt(data.coinSupply)} label={t('TMT supply', 'TMT 总量')} /><Stat value={tmt(data.escrowHeld)} label={t('Held in escrow', '托管金额')} /></div>
    <section className="card card--pad stack"><h2>{t('Recent audit activity', '最近审计记录')}</h2>{data.recentAudit.length === 0 ? <div className="muted">{t('No audit entries.', '暂无审计记录。')}</div> : <div className="admin-table-scroll"><table className="table"><thead><tr><th>{t('Time', '时间')}</th><th>{t('Action', '操作')}</th><th>{t('Actor', '操作者')}</th></tr></thead><tbody>{data.recentAudit.map((item) => <tr key={item.id}><td>{fmtTime(item.createdAt)}</td><td>{item.action}</td><td className="mono">{item.actorUserId || 'system'}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
