import { useEffect, useState } from 'react';
import { get, patch } from '../../lib/api';
import type { Wallet } from '../../lib/types';
import { SearchBox, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtDate, tmt } from '../../lib/format';

type Row = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  wallet: Wallet;
  frozenFunds: number;
  profiles: { id: string; alias: string; retired: boolean }[];
};

export default function AdminUsers() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');

  const load = () => get<{ items: Row[] }>('/admin/users').then((r) => setRows(r.items));

  useEffect(() => {
    void load();
  }, []);

  const act = async (id: string, body: Record<string, unknown>) => {
    try {
      await patch(`/admin/users/${id}`, body);
      await load();
      toast.push('已更新', 'good');
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  if (!rows) return <Spinner />;
  const filtered = rows.filter(
    (r) => !q || r.username.includes(q) || r.displayName.includes(q) || r.profiles.some((p) => p.alias.includes(q))
  );

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 style={{ fontSize: 20 }}>用户与马甲（{rows.length}）</h2>
        <SearchBox value={q} onChange={setQ} placeholder="按用户名或马甲代号搜索…" />
      </div>

      <div className="notice-banner">
        管理台会显示马甲与账号的从属关系，因为仲裁需要它。请只在处理举报时使用。日常运营请走「举报与仲裁」页面。
      </div>

      <div className="card card--pad">
        <table className="table">
          <thead>
            <tr>
              <th>账号</th>
              <th>马甲</th>
              <th>钱包</th>
              <th>注册</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>
                  <div style={{ fontWeight: 650 }}>{u.username}</div>
                  <div className="muted">{u.displayName} · {u.role === 'admin' ? '管理员' : '用户'}</div>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {u.profiles.length === 0 && <span className="muted">—</span>}
                    {u.profiles.map((p) => (
                      <span key={p.id} className={`chip ${p.retired ? 'chip--danger' : ''}`}>
                        {p.alias}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="mono">
                  <div>{tmt(u.wallet.coins)}</div>
                  {u.wallet.escrow > 0 && <div className="muted">托管 {u.wallet.escrow}</div>}
                  {u.frozenFunds > 0 && <div style={{ color: 'var(--bad)' }}>冻结 {u.frozenFunds}</div>}
                </td>
                <td className="mono">{fmtDate(u.createdAt)}</td>
                <td>
                  {u.banned ? (
                    <div>
                      <span className="chip chip--danger">已封禁</span>
                      <div className="muted">{u.banReason}</div>
                    </div>
                  ) : (
                    <span className="chip chip--good">正常</span>
                  )}
                </td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <button className="btn btn--sm" onClick={() => act(u.id, { grant: 100 })}>
                      +100
                    </button>
                    <button
                      className={`btn btn--sm ${u.banned ? '' : 'btn--danger'}`}
                      onClick={() => {
                        if (u.banned) return act(u.id, { banned: false });
                        const reason = window.prompt(`封禁 ${u.username} 名下全部马甲，原因：`);
                        if (reason) act(u.id, { banned: true, banReason: reason });
                      }}
                    >
                      {u.banned ? '解封' : '封禁'}
                    </button>
                    <button className="btn btn--sm" onClick={() => act(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}>
                      {u.role === 'admin' ? '降为用户' : '设为管理员'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
