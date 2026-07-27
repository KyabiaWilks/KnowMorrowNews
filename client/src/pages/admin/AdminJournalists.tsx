import { useEffect, useState } from 'react';
import { del, get, patch, post } from '../../lib/api';
import { Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';

type Award = { name: string; year: number; work?: string };
type Row = {
  id: string;
  name: string;
  title: string;
  tagline: string;
  bio: string;
  beats: string[];
  awards: Award[];
  milestones: { year: number; text: string }[];
  contact: string | null;
  portraitTone: string;
  featured: boolean;
  hidden: boolean;
};

const blank = (): Partial<Row> => ({
  name: '',
  title: '记者',
  tagline: '',
  bio: '',
  beats: [],
  awards: [],
  milestones: [],
  portraitTone: '#2f6bff',
  featured: false,
});

export default function AdminJournalists() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const load = () => get<{ items: Row[] }>('/admin/journalists').then((r) => setRows(r.items));

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!editing) return;
    const payload = {
      ...editing,
      beats: typeof editing.beats === 'string' ? String(editing.beats).split(/[,，\s]+/).filter(Boolean) : editing.beats,
    };
    try {
      if (editing.id) await patch(`/admin/journalists/${editing.id}`, payload);
      else await post('/admin/journalists', payload);
      toast.push('已保存', 'good');
      setEditing(null);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  const addAward = () => {
    if (!editing) return;
    setEditing({ ...editing, awards: [...(editing.awards || []), { name: '', year: new Date().getFullYear(), work: '' }] });
  };

  const addMilestone = () => {
    if (!editing) return;
    setEditing({ ...editing, milestones: [...(editing.milestones || []), { year: new Date().getFullYear(), text: '' }] });
  };

  if (!rows) return <Spinner />;

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 style={{ fontSize: 20 }}>记者（{rows.length}）</h2>
        <button className="btn btn--primary" onClick={() => setEditing(blank())}>
          ＋ 新增记者
        </button>
      </div>

      <div className="grid grid--2">
        {rows.map((j) => (
          <div key={j.id} className="card card--pad row" style={{ alignItems: 'flex-start' }}>
            <div className="jnl-portrait" style={{ width: 54, height: 54, fontSize: 20, background: `linear-gradient(135deg, ${j.portraitTone}, #0b2545)` }}>
              {j.name.slice(0, 1)}
            </div>
            <div className="stack" style={{ flex: 1, gap: 5 }}>
              <div className="row row--between">
                <strong>{j.name}</strong>
                {j.hidden && <span className="chip chip--danger">已隐藏</span>}
              </div>
              <div className="muted">{j.title} · {(j.beats || []).join('、')}</div>
              <div className="muted">🏆 {(j.awards || []).length} 项获奖</div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--sm" onClick={() => setEditing(j)}>
                  编辑
                </button>
                <button className="btn btn--sm" onClick={() => patch(`/admin/journalists/${j.id}`, { hidden: !j.hidden }).then(load)}>
                  {j.hidden ? '重新展示' : '暂时隐藏'}
                </button>
                <button
                  className="btn btn--sm btn--danger"
                  onClick={async () => {
                    if (!window.confirm(`移除 ${j.name}？`)) return;
                    await del(`/admin/journalists/${j.id}`);
                    await load();
                  }}
                >
                  移除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        wide
        title={editing?.id ? `编辑 ${editing.name}` : '新增记者'}
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
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>姓名</label>
                <input className="input" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>职务</label>
                <input className="input" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div className="field" style={{ width: 110 }}>
                <label>主题色</label>
                <input className="input" type="color" value={editing.portraitTone || '#2f6bff'} onChange={(e) => setEditing({ ...editing, portraitTone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>一句话格言</label>
              <input className="input" value={editing.tagline || ''} onChange={(e) => setEditing({ ...editing, tagline: e.target.value })} />
            </div>
            <div className="field">
              <label>条线（逗号分隔）</label>
              <input
                className="input"
                value={Array.isArray(editing.beats) ? editing.beats.join('，') : editing.beats || ''}
                onChange={(e) => setEditing({ ...editing, beats: e.target.value as unknown as string[] })}
              />
            </div>
            <div className="field">
              <label>简介</label>
              <textarea className="textarea" value={editing.bio || ''} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} />
            </div>
            <div className="field">
              <label>联系方式</label>
              <input className="input" value={editing.contact || ''} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} />
            </div>

            <div className="field">
              <div className="row row--between">
                <label>获奖记录</label>
                <button className="btn btn--sm" onClick={addAward}>
                  ＋ 添加
                </button>
              </div>
              {(editing.awards || []).map((a, i) => (
                <div key={i} className="row" style={{ marginTop: 6 }}>
                  <input
                    className="input"
                    style={{ flex: 2 }}
                    placeholder="奖项名称"
                    value={a.name}
                    onChange={(e) => setEditing({ ...editing, awards: (editing.awards || []).map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
                  />
                  <input
                    className="input"
                    style={{ width: 92 }}
                    type="number"
                    value={a.year}
                    onChange={(e) => setEditing({ ...editing, awards: (editing.awards || []).map((x, j) => (j === i ? { ...x, year: Number(e.target.value) } : x)) })}
                  />
                  <input
                    className="input"
                    style={{ flex: 2 }}
                    placeholder="获奖作品"
                    value={a.work || ''}
                    onChange={(e) => setEditing({ ...editing, awards: (editing.awards || []).map((x, j) => (j === i ? { ...x, work: e.target.value } : x)) })}
                  />
                  <button className="btn btn--sm btn--danger" onClick={() => setEditing({ ...editing, awards: (editing.awards || []).filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="field">
              <div className="row row--between">
                <label>履历</label>
                <button className="btn btn--sm" onClick={addMilestone}>
                  ＋ 添加
                </button>
              </div>
              {(editing.milestones || []).map((m, i) => (
                <div key={i} className="row" style={{ marginTop: 6 }}>
                  <input
                    className="input"
                    style={{ width: 92 }}
                    type="number"
                    value={m.year}
                    onChange={(e) => setEditing({ ...editing, milestones: (editing.milestones || []).map((x, j) => (j === i ? { ...x, year: Number(e.target.value) } : x)) })}
                  />
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    value={m.text}
                    onChange={(e) => setEditing({ ...editing, milestones: (editing.milestones || []).map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                  />
                  <button className="btn btn--sm btn--danger" onClick={() => setEditing({ ...editing, milestones: (editing.milestones || []).filter((_, j) => j !== i) })}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <label className="row" style={{ gap: 8 }}>
              <input type="checkbox" checked={!!editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} />
              在展廊置顶推荐
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
