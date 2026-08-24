import { useEffect, useState } from 'react';
import { del, get, patch, post } from '../../lib/api';
import { Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtEasternDate } from '../../lib/format';
import { useAdminLanguage } from './AdminLanguage';
import { ImageUploadButton } from '../../components/ImageUploadButton';
import { NEWS_TAGS } from '../../lib/newsTags';

type Row = { id: string; title: string; summary: string; body: string; section: string; tags: string[]; cover: string | null; visualCredit: string | null; dateline: string; authorIds: string[]; illustratorIds: string[]; proofreaderIds: string[]; status: string; featured: boolean; publishedAt: string; views: number };
const blank = (): Partial<Row> => ({ title: '', summary: '', body: '', section: 'News', tags: [], cover: null, visualCredit: null, dateline: 'Know Morrow News Desk', authorIds: [], illustratorIds: [], proofreaderIds: [], status: 'published', featured: false });

export default function AdminNews() {
  const { t } = useAdminLanguage();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [journalists, setJournalists] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const load = () => get<{ items: Row[] }>('/admin/news').then((result) => setRows(result.items));
  useEffect(() => { void load(); void get<{ items: { id: string; name: string }[] }>('/admin/journalists').then((result) => setJournalists(result.items)); }, []);
  const save = async () => {
    if (!editing) return;
    const payload = { ...editing, tags: editing.tags };
    try { if (editing.id) await patch(`/admin/news/${editing.id}`, payload); else await post('/admin/news', payload); toast.push(t('News saved.', '新闻已保存。'), 'good'); setEditing(null); await load(); } catch (error) { toast.push((error as Error).message, 'bad'); }
  };
  const remove = async (row: Row) => { if (!window.confirm(t(`Delete “${row.title}”?`, `删除《${row.title}》？`))) return; await del(`/admin/news/${row.id}`); toast.push(t('News deleted.', '新闻已删除。'), 'good'); await load(); };
  if (!rows) return <Spinner />;
  return <div className="stack">
    <div className="row row--between"><h2>{t(`News (${rows.length})`, `新闻（${rows.length}）`)}</h2><button className="btn btn--primary" onClick={() => setEditing(blank())}>＋ {t('Create news', '新建新闻')}</button></div>
    <div className="card card--pad admin-table-scroll"><table className="table"><thead><tr><th>{t('Headline', '标题')}</th><th>{t('Section', '分区')}</th><th>{t('Contributors', '贡献者')}</th><th>{t('Published (ET)', '发布时间（美东）')}</th><th>{t('Views', '阅读')}</th><th>{t('Status', '状态')}</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.title}</strong><div className="muted">{row.summary.slice(0, 60)}{row.summary.length > 60 ? '…' : ''}</div></td><td>{row.section}</td><td><div>{t('Writer', '作者')}: {row.authorIds.map((id) => journalists.find((item) => item.id === id)?.name).filter(Boolean).join(', ') || '—'}</div><div>{t('Illustrator', '插图')}: {(row.illustratorIds || []).map((id) => journalists.find((item) => item.id === id)?.name).filter(Boolean).join(', ') || '—'}</div></td><td>{fmtEasternDate(row.publishedAt)} ET</td><td>{row.views}</td><td><span className={`chip ${row.status === 'published' ? 'chip--good' : 'chip--warn'}`}>{row.status === 'published' ? t('Published', '已发布') : t('Draft', '草稿')}</span></td><td><div className="row"><button className="btn btn--sm" onClick={() => setEditing(row)}>{t('Edit', '编辑')}</button><button className="btn btn--sm btn--danger" onClick={() => remove(row)}>{t('Delete', '删除')}</button></div></td></tr>)}</tbody></table></div>
    <Modal open={!!editing} onClose={() => setEditing(null)} wide title={editing?.id ? t('Edit news', '编辑新闻') : t('Create news', '新建新闻')} footer={<><button className="btn" onClick={() => setEditing(null)}>{t('Cancel', '取消')}</button><button className="btn btn--primary" onClick={save}>{t('Save', '保存')}</button></>}>
      {editing && <div className="stack">
        <label className="field"><span>{t('Headline', '标题')}</span><input className="input" value={editing.title || ''} onChange={(event) => setEditing({ ...editing, title: event.target.value })} /></label>
        <div className="grid grid--3"><label className="field"><span>{t('Section', '分区')}</span><input className="input" value={editing.section || ''} onChange={(event) => setEditing({ ...editing, section: event.target.value })} /></label><label className="field"><span>{t('Dateline', '电头')}</span><input className="input" value={editing.dateline || ''} onChange={(event) => setEditing({ ...editing, dateline: event.target.value })} /></label><label className="field"><span>{t('Status', '状态')}</span><select className="select" value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value })}><option value="published">{t('Published', '发布')}</option><option value="draft">{t('Draft', '草稿')}</option></select></label></div>
        <label className="field"><span>{t('Summary', '摘要')}</span><input className="input" value={editing.summary || ''} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} /></label>
        <div className="field"><span>{t('Cover image', '封面图像')}</span>{editing.cover && <img src={editing.cover} alt="" style={{ width: 220, maxHeight: 150, objectFit: 'cover', borderRadius: 10 }} />}<div className="row"><input className="input" style={{ flex: 1 }} value={editing.cover || ''} onChange={(event) => setEditing({ ...editing, cover: event.target.value || null })} placeholder={t('Image URL or upload', '图像链接或上传图片')} /><ImageUploadButton label={t('Upload cover', '上传封面')} onUploaded={(url) => setEditing({ ...editing, cover: url })} />{editing.cover && <button type="button" className="btn btn--sm" onClick={() => setEditing({ ...editing, cover: null })}>{t('Remove', '移除')}</button>}</div></div>
        <label className="field"><span>{t('Visual credit', '图片来源署名')}</span><input className="input" value={editing.visualCredit || ''} onChange={(event) => setEditing({ ...editing, visualCredit: event.target.value || null })} placeholder={t('For example: Image provided by the commissioning group.', '例如：图片由委托团体提供。')} /></label>
        <div className="field"><span>{t('News categories', '新闻分类')}</span><div className="row">{NEWS_TAGS.map((tag) => { const active = (editing.tags || []).includes(tag); return <button type="button" key={tag} className={`chip ${active ? 'chip--on' : ''}`} onClick={() => setEditing({ ...editing, tags: active ? (editing.tags || []).filter((value) => value !== tag) : [...(editing.tags || []), tag] })}>{tag}</button>; })}</div></div>
        <div className="field"><span>{t('Writers', '文章作者')}</span><div className="row">{journalists.map((journalist) => { const active = (editing.authorIds || []).includes(journalist.id); return <button type="button" key={journalist.id} className={`chip ${active ? 'chip--on' : ''}`} onClick={() => setEditing({ ...editing, authorIds: active ? (editing.authorIds || []).filter((id) => id !== journalist.id) : [...(editing.authorIds || []), journalist.id] })}>{journalist.name}</button>; })}</div></div>
        <div className="field"><span>{t('Illustrators', '插图作者')}</span><div className="row">{journalists.map((journalist) => { const active = (editing.illustratorIds || []).includes(journalist.id); return <button type="button" key={journalist.id} className={`chip ${active ? 'chip--on' : ''}`} onClick={() => setEditing({ ...editing, illustratorIds: active ? (editing.illustratorIds || []).filter((id) => id !== journalist.id) : [...(editing.illustratorIds || []), journalist.id] })}>{journalist.name}</button>; })}</div></div>
        <div className="field"><span>{t('Proofreaders', '校对')}</span><div className="row">{journalists.map((journalist) => { const active = (editing.proofreaderIds || []).includes(journalist.id); return <button type="button" key={journalist.id} className={`chip ${active ? 'chip--on' : ''}`} onClick={() => setEditing({ ...editing, proofreaderIds: active ? (editing.proofreaderIds || []).filter((id) => id !== journalist.id) : [...(editing.proofreaderIds || []), journalist.id] })}>{journalist.name}</button>; })}</div></div>
        <label className="field"><span>{t('Article body', '正文')}</span><textarea className="textarea" style={{ minHeight: 260 }} value={editing.body || ''} onChange={(event) => setEditing({ ...editing, body: event.target.value })} /></label>
        <label className="row"><input type="checkbox" checked={!!editing.featured} onChange={(event) => setEditing({ ...editing, featured: event.target.checked })} /> {t('Feature on the front page', '设为首页重点')}</label>
      </div>}
    </Modal>
  </div>;
}
