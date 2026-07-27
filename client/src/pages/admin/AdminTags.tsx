import { useEffect, useState } from 'react';
import { get, patch, post } from '../../lib/api';
import type { Tag } from '../../lib/types';
import { Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

export default function AdminTags() {
  const toast = useToast();
  const [rows, setRows] = useState<Tag[] | null>(null);
  const [label, setLabel] = useState('');

  const load = () => get<{ items: Tag[] }>('/admin/tags').then((r) => setRows(r.items));

  useEffect(() => {
    void load();
  }, []);

  const update = async (id: string, body: Partial<Tag>) => {
    try {
      await patch(`/admin/tags/${id}`, body);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  const create = async () => {
    if (!label.trim()) return;
    try {
      await post('/tavern/tags', { label: label.trim() });
      setLabel('');
      await load();
      toast.push('标签已添加', 'good');
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  if (!rows) return <Spinner />;

  return (
    <div className="stack">
      <h2 style={{ fontSize: 20 }}>标签（{rows.length}）</h2>
      <div className="notice-banner">
        「有详细证据 / 没有详细证据」是系统标签，不可改名、不可归档，每条情报与委托都必须二选一。其余标签任何用户都能新增，你可以在这里改色或归档。
      </div>

      <div className="card card--pad row">
        <input className="input" style={{ flex: 1 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="新增一个标签…" maxLength={16} />
        <button className="btn btn--primary" onClick={create}>
          添加
        </button>
      </div>

      <div className="card card--pad">
        <table className="table">
          <thead>
            <tr>
              <th>标签</th>
              <th>类型</th>
              <th>颜色</th>
              <th>说明</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  <span className="chip" style={{ background: `${t.color}1a`, borderColor: `${t.color}55`, color: t.color }}>
                    {t.label}
                  </span>
                </td>
                <td>{t.kind === 'system' ? '系统' : '自定义'}</td>
                <td>
                  <input type="color" value={t.color} onChange={(e) => update(t.id, { color: e.target.value })} style={{ width: 46, height: 26, border: 'none', background: 'none' }} />
                </td>
                <td>
                  <input
                    className="input"
                    defaultValue={t.description || ''}
                    onBlur={(e) => e.target.value !== (t.description || '') && update(t.id, { description: e.target.value })}
                    placeholder="（无）"
                  />
                </td>
                <td>{t.archived ? <span className="chip chip--danger">已归档</span> : <span className="chip chip--good">启用中</span>}</td>
                <td>
                  {t.kind !== 'system' && (
                    <button className="btn btn--sm" onClick={() => update(t.id, { archived: !t.archived })}>
                      {t.archived ? '恢复' : '归档'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
