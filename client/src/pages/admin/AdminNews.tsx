import { useEffect, useState } from 'react';
import { del, get, patch, post } from '../../lib/api';
import { Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtDate } from '../../lib/format';

type Row = {
  id: string;
  title: string;
  summary: string;
  body: string;
  section: string;
  tags: string[];
  dateline: string;
  authorIds: string[];
  status: string;
  featured: boolean;
  publishedAt: string;
  views: number;
};

const blank = (): Partial<Row> => ({ title: '', summary: '', body: '', section: '要闻', tags: [], dateline: '', authorIds: [], status: 'published', featured: false });

export default function AdminNews() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [journalists, setJournalists] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const load = () => get<{ items: Row[] }>('/admin/news').then((r) => setRows(r.items));

  useEffect(() => {
    void load();
    void get<{ items: { id: string; name: string }[] }>('/admin/journalists').then((r) => setJournalists(r.items));
  }, []);

  const save = async () => {
    if (!editing) return;
    const payload = { ...editing, tags: typeof editing.tags === 'string' ? String(editing.tags).split(/[,，\s]+/).filter(Boolean) : editing.tags };
    try {
      if (editing.id) await patch(`/admin/news/${editing.id}`, payload);
      else await post('/admin/news', payload);
      toast.push('已保存', 'good');
      setEditing(null);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  const remove = async (row: Row) => {
    if (!window.confirm(`删除《${row.title}》？`)) return;
    await del(`/admin/news/${row.id}`);
    toast.push('已删除');
    await load();
  };

  if (!rows) return <Spinner />;

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 style={{ fontSize: 20 }}>新闻（{rows.length}）</h2>
        <button className="btn btn--primary" onClick={() => setEditing(blank())}>
          ＋ 新建报道
        </button>
      </div>

      <div className="card card--pad">
        <table className="table">
          <thead>
            <tr>
              <th>标题</th>
              <th>版面</th>
              <th>记者</th>
              <th>刊发</th>
              <th>阅读</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ maxWidth: 320 }}>
                  <div style={{ fontWeight: 650 }}>{r.title}</div>
                  <div className="muted">{r.summary.slice(0, 50)}…</div>
                </td>
                <td>{r.section}</td>
                <td className="muted">{r.authorIds.map((id) => journalists.find((j) => j.id === id)?.name).filter(Boolean).join('、') || '—'}</td>
                <td className="mono">{fmtDate(r.publishedAt)}</td>
                <td>{r.views}</td>
                <td>
                  <span className={`chip ${r.status === 'published' ? 'chip--good' : 'chip--warn'}`}>{r.status === 'published' ? '已刊发' : '草稿'}</span>
                </td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                    <button className="btn btn--sm" onClick={() => setEditing(r)}>
                      编辑
                    </button>
                    <button className="btn btn--sm btn--danger" onClick={() => remove(r)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        wide
        title={editing?.id ? '编辑报道' : '新建报道'}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)}>
              取消
            </button>
            <button className="btn btn--primary" onClick={save}>
              保存
            </button>
          </>
        }
      >
        {editing && (
          <div className="stack">
            <div className="field">
              <label>标题</label>
              <input className="input" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>版面</label>
                <input className="input" value={editing.section || ''} onChange={(e) => setEditing({ ...editing, section: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>电头</label>
                <input className="input" value={editing.dateline || ''} onChange={(e) => setEditing({ ...editing, dateline: e.target.value })} placeholder="本报讯 / 特派记者" />
              </div>
              <div className="field" style={{ width: 130 }}>
                <label>状态</label>
                <select className="select" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="published">刊发</option>
                  <option value="draft">草稿</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>导语</label>
              <input className="input" value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            </div>
            <div className="field">
              <label>标签（逗号分隔）</label>
              <input
                className="input"
                value={Array.isArray(editing.tags) ? editing.tags.join('，') : editing.tags || ''}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value as unknown as string[] })}
              />
            </div>
            <div className="field">
              <label>署名记者</label>
              <div className="row" style={{ gap: 6 }}>
                {journalists.map((j) => {
                  const on = (editing.authorIds || []).includes(j.id);
                  return (
                    <button
                      key={j.id}
                      className={`chip ${on ? 'chip--on' : ''}`}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          authorIds: on ? (editing.authorIds || []).filter((x) => x !== j.id) : [...(editing.authorIds || []), j.id],
                        })
                      }
                    >
                      {j.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <label>正文（空行分段）</label>
              <textarea className="textarea" style={{ minHeight: 240 }} value={editing.body || ''} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </div>
            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={!!editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
              设为头版重点
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
