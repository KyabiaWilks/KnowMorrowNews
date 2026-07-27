import { useEffect, useState } from 'react';
import { get, patch, post } from '../../lib/api';
import { Empty, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtTime } from '../../lib/format';

type Row = { id: string; page: string; note: string; alias: string; hidden: boolean; createdAt: string };

export default function AdminTomatoes() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState('');

  const load = () => get<{ items: Row[] }>('/admin/tomatoes').then((r) => setRows(r.items));

  useEffect(() => {
    void load();
  }, []);

  const clear = async () => {
    if (!page) return toast.push('先选一个页面', 'bad');
    if (!window.confirm(`清扫 ${page} 上的所有番茄？`)) return;
    const r = await post<{ removed: number }>('/admin/tomatoes/clear', { page });
    toast.push(`擦掉了 ${r.removed} 颗番茄`, 'good');
    await load();
  };

  if (!rows) return <Spinner />;
  const pages = [...new Set(rows.map((r) => r.page))];

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 style={{ fontSize: 20 }}>番茄治理（{rows.length}）</h2>
        <div className="row">
          <select className="select" style={{ width: 200 }} value={page} onChange={(e) => setPage(e.target.value)}>
            <option value="">选择页面…</option>
            {pages.map((p) => (
              <option key={p} value={p}>
                {p}（{rows.filter((r) => r.page === p).length}）
              </option>
            ))}
          </select>
          <button className="btn btn--danger" onClick={clear}>
            清扫该页
          </button>
        </div>
      </div>

      <div className="notice-banner">
        隐藏只是让番茄不再显示给读者，记录仍然保留。用户自己也可以擦掉自己扔的番茄。
      </div>

      {rows.length === 0 ? (
        <Empty icon="🍅" title="墙上很干净" />
      ) : (
        <div className="card card--pad">
          <table className="table">
            <thead>
              <tr>
                <th>时间</th>
                <th>页面</th>
                <th>署名</th>
                <th>留言</th>
                <th>状态</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{fmtTime(t.createdAt)}</td>
                  <td className="mono">{t.page}</td>
                  <td>{t.alias}</td>
                  <td>{t.note || <span className="muted">（无）</span>}</td>
                  <td>{t.hidden ? <span className="chip chip--danger">已隐藏</span> : <span className="chip chip--good">显示中</span>}</td>
                  <td>
                    <button className="btn btn--sm" onClick={() => patch(`/admin/tomatoes/${t.id}`, { hidden: !t.hidden }).then(load)}>
                      {t.hidden ? '恢复显示' : '隐藏'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
