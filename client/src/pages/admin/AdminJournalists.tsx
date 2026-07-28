import { useEffect, useState } from 'react';
import { del, get, patch, post } from '../../lib/api';
import { Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAdminLanguage } from './AdminLanguage';

type Award = { name: string; year: number; work?: string };
type Milestone = { year: number; text: string };
type Row = {
  id: string; name: string; title: string; tagline: string; bio: string;
  beats: string[]; awards: Award[]; milestones: Milestone[]; contact: string | null;
  portraitTone: string; featured: boolean; hidden: boolean;
};

const blank = (): Partial<Row> => ({
  name: '', title: 'Journalist', tagline: '', bio: '', beats: [], awards: [],
  milestones: [], contact: '', portraitTone: '#2f6bff', featured: false, hidden: false,
});

export default function AdminJournalists() {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const load = () => get<{ items: Row[] }>('/admin/journalists').then((result) => setRows(result.items));

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!editing) return;
    const payload = {
      ...editing,
      beats: typeof editing.beats === 'string'
        ? String(editing.beats).split(/[,，\n]+/).map((item) => item.trim()).filter(Boolean)
        : editing.beats,
    };
    try {
      if (editing.id) await patch(`/admin/journalists/${editing.id}`, payload);
      else await post('/admin/journalists', payload);
      toast.push(t('Journalist saved.', '记者资料已保存。'), 'good');
      setEditing(null);
      await load();
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    }
  };

  if (!rows) return <Spinner />;

  return (
    <div className="stack">
      <div className="row row--between">
        <h2>{t(`Journalists (${rows.length})`, `记者（${rows.length}）`)}</h2>
        <button className="btn btn--primary" onClick={() => setEditing(blank())}>{t('Add journalist', '新增记者')}</button>
      </div>
      <div className="grid grid--2">
        {rows.map((journalist) => (
          <article key={journalist.id} className="card card--pad row" style={{ alignItems: 'flex-start' }}>
            <div className="jnl-portrait" style={{ width: 54, height: 54, fontSize: 20, background: `linear-gradient(135deg, ${journalist.portraitTone}, #0b2545)` }}>
              {journalist.name.slice(0, 1)}
            </div>
            <div className="stack" style={{ flex: 1, gap: 6 }}>
              <div className="row row--between"><strong>{journalist.name}</strong>{journalist.hidden && <span className="chip chip--danger">{t('Hidden', '已隐藏')}</span>}</div>
              <div className="muted">{journalist.title} · {journalist.beats.join(', ') || t('No beats', '暂无分区')}</div>
              <div className="muted">{t(`${journalist.awards.length} awards`, `${journalist.awards.length} 项获奖记录`)}</div>
              <div className="row">
                <button className="btn btn--sm" onClick={() => setEditing(journalist)}>{t('Edit', '编辑')}</button>
                <button className="btn btn--sm" onClick={() => patch(`/admin/journalists/${journalist.id}`, { hidden: !journalist.hidden }).then(load)}>
                  {journalist.hidden ? t('Show', '重新显示') : t('Hide', '隐藏')}
                </button>
                <button className="btn btn--sm btn--danger" onClick={async () => {
                  if (!window.confirm(t(`Remove ${journalist.name}?`, `确认移除 ${journalist.name}？`))) return;
                  await del(`/admin/journalists/${journalist.id}`); await load();
                }}>{t('Remove', '移除')}</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} wide
        title={editing?.id ? t(`Edit ${editing.name}`, `编辑 ${editing.name}`) : t('Add journalist', '新增记者')}
        footer={<><button className="btn" onClick={() => setEditing(null)}>{t('Cancel', '取消')}</button><button className="btn btn--primary" onClick={save}>{t('Save', '保存')}</button></>}>
        {editing && <div className="stack">
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>{t('Name', '姓名')}</label><input className="input" value={editing.name || ''} onChange={(event) => setEditing({ ...editing, name: event.target.value })} /></div>
            <div className="field" style={{ flex: 1 }}><label>{t('Title', '职务')}</label><input className="input" value={editing.title || ''} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></div>
            <div className="field" style={{ width: 110 }}><label>{t('Color', '主题色')}</label><input className="input" type="color" value={editing.portraitTone || '#2f6bff'} onChange={(event) => setEditing({ ...editing, portraitTone: event.target.value })} /></div>
          </div>
          <div className="field"><label>{t('Tagline', '格言')}</label><input className="input" value={editing.tagline || ''} onChange={(event) => setEditing({ ...editing, tagline: event.target.value })} /></div>
          <div className="field"><label>{t('Beats (comma separated)', '负责分区（逗号分隔）')}</label><input className="input" value={Array.isArray(editing.beats) ? editing.beats.join(', ') : editing.beats || ''} onChange={(event) => setEditing({ ...editing, beats: event.target.value as unknown as string[] })} /></div>
          <div className="field"><label>{t('Biography', '简介')}</label><textarea className="textarea" value={editing.bio || ''} onChange={(event) => setEditing({ ...editing, bio: event.target.value })} /></div>
          <div className="field"><label>{t('Contact', '联系方式')}</label><input className="input" value={editing.contact || ''} onChange={(event) => setEditing({ ...editing, contact: event.target.value })} /></div>
          <div className="field">
            <div className="row row--between"><label>{t('Awards', '获奖记录')}</label><button className="btn btn--sm" onClick={() => setEditing({ ...editing, awards: [...(editing.awards || []), { name: '', year: new Date().getFullYear(), work: '' }] })}>{t('Add', '添加')}</button></div>
            {(editing.awards || []).map((award, index) => <div className="row" key={index}>
              <input className="input" style={{ flex: 2 }} placeholder={t('Award', '奖项')} value={award.name} onChange={(event) => setEditing({ ...editing, awards: (editing.awards || []).map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} />
              <input className="input" style={{ width: 92 }} type="number" value={award.year} onChange={(event) => setEditing({ ...editing, awards: (editing.awards || []).map((item, itemIndex) => itemIndex === index ? { ...item, year: Number(event.target.value) } : item) })} />
              <input className="input" style={{ flex: 2 }} placeholder={t('Work', '获奖作品')} value={award.work || ''} onChange={(event) => setEditing({ ...editing, awards: (editing.awards || []).map((item, itemIndex) => itemIndex === index ? { ...item, work: event.target.value } : item) })} />
              <button className="btn btn--sm btn--danger" aria-label={t('Remove award', '删除奖项')} onClick={() => setEditing({ ...editing, awards: (editing.awards || []).filter((_, itemIndex) => itemIndex !== index) })}>×</button>
            </div>)}
          </div>
          <div className="field">
            <div className="row row--between"><label>{t('Milestones', '履历')}</label><button className="btn btn--sm" onClick={() => setEditing({ ...editing, milestones: [...(editing.milestones || []), { year: new Date().getFullYear(), text: '' }] })}>{t('Add', '添加')}</button></div>
            {(editing.milestones || []).map((milestone, index) => <div className="row" key={index}>
              <input className="input" style={{ width: 92 }} type="number" value={milestone.year} onChange={(event) => setEditing({ ...editing, milestones: (editing.milestones || []).map((item, itemIndex) => itemIndex === index ? { ...item, year: Number(event.target.value) } : item) })} />
              <input className="input" style={{ flex: 1 }} value={milestone.text} onChange={(event) => setEditing({ ...editing, milestones: (editing.milestones || []).map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} />
              <button className="btn btn--sm btn--danger" aria-label={t('Remove milestone', '删除履历')} onClick={() => setEditing({ ...editing, milestones: (editing.milestones || []).filter((_, itemIndex) => itemIndex !== index) })}>×</button>
            </div>)}
          </div>
          <label className="row"><input type="checkbox" checked={!!editing.featured} onChange={(event) => setEditing({ ...editing, featured: event.target.checked })} />{t('Feature this journalist', '置顶推荐这位记者')}</label>
        </div>}
      </Modal>
    </div>
  );
}
