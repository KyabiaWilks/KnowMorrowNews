import { useEffect, useState } from 'react';
import { get } from '../../lib/api';
import { Spinner, Stat } from '../../components/ui';
import { fmtTime, tmt } from '../../lib/format';

type Overview = {
  counts: Record<string, number>;
  coinSupply: number;
  escrowHeld: number;
  recentAudit: { id: string; actorName: string; action: string; detail: string; createdAt: string }[];
};

const LABELS: Record<string, string> = {
  users: '注册用户',
  bannedUsers: '被封禁',
  profiles: '在用马甲',
  news: '已刊发报道',
  drafts: '草稿',
  journalists: '记者',
  offers: '在售情报',
  requests: '征集中委托',
  pendingReports: '待仲裁举报',
  tomatoes: '墙上的番茄',
};

export default function AdminOverview() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    void get<Overview>('/admin/overview').then(setData);
  }, []);

  if (!data) return <Spinner />;

  return (
    <div className="stack" style={{ gap: 18 }}>
      {data.counts.pendingReports > 0 && (
        <div className="notice-banner">
          有 <strong>{data.counts.pendingReports}</strong> 条举报等待仲裁小组处理。
        </div>
      )}

      <div className="grid grid--4">
        {Object.entries(data.counts).map(([k, v]) => (
          <Stat key={k} value={v} label={LABELS[k] || k} />
        ))}
      </div>

      <div className="grid grid--2">
        <Stat value={tmt(data.coinSupply)} label="站内 TMT 总量" />
        <Stat value={tmt(data.escrowHeld)} label="委托保证金托管中" />
      </div>

      <div className="card card--pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          审计日志（最近 20 条）
        </div>
        <table className="table table--tight">
          <thead>
            <tr>
              <th>时间</th>
              <th>操作者</th>
              <th>动作</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {data.recentAudit.map((l) => (
              <tr key={l.id}>
                <td className="mono">{fmtTime(l.createdAt)}</td>
                <td>{l.actorName}</td>
                <td>
                  <span className="chip">{l.action}</span>
                </td>
                <td>{l.detail}</td>
              </tr>
            ))}
            {data.recentAudit.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 26 }}>
                  还没有管理操作记录。
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="hint" style={{ marginTop: 10 }}>
          注意：hacker 通道（/ghost）的查看行为<strong>不会</strong>出现在这里，这是设计使然。
        </div>
      </div>
    </div>
  );
}
