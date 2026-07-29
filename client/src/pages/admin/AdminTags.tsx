import { useEffect, useState } from 'react';
import { get, patch, post } from '../../lib/api';
import type { Tag } from '../../lib/types';
import { Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAdminLanguage } from './AdminLanguage';

export default function AdminTags() {
  const { t } = useAdminLanguage();
  const toast = useToast();
  const [rows, setRows] = useState<Tag[] | null>(null);
  const [label, setLabel] = useState('');
  const load = () => get<{ items: Tag[] }>('/admin/tags').then((result) => setRows(result.items));
  useEffect(() => { void load(); }, []);
  const update = async (id: string, body: Partial<Tag>) => { try { await patch(`/admin/tags/${id}`, body); await load(); } catch (error) { toast.push((error as Error).message, 'bad'); } };
  const create = async () => { if (!label.trim()) return; try { await post('/tavern/tags', { label: label.trim() }); setLabel(''); await load(); toast.push(t('Tag added.', '标签已添加。'), 'good'); } catch (error) { toast.push((error as Error).message, 'bad'); } };
  if (!rows) return <Spinner />;
  return <div className="stack">
    <h2>{t(`Tags (${rows.length})`, `标签（${rows.length}）`)}</h2>
    <div className="notice-banner">{t('Evidence tags are protected system tags and cannot be modified. Other tags may be recolored or archived here.', '证据标签是不可修改的系统标签。其他标签可以在此修改颜色或归档。')}</div>
    <div className="card card--pad row"><input className="input" style={{ flex: 1 }} value={label} onChange={(event) => setLabel(event.target.value)} placeholder={t('New tag name', '新标签名称')} maxLength={16} /><button className="btn btn--primary" onClick={create}>{t('Add', '添加')}</button></div>
    <div className="card card--pad admin-table-scroll"><table className="table"><thead><tr><th>{t('Tag', '标签')}</th><th>{t('Type', '类型')}</th><th>{t('Color', '颜色')}</th><th>{t('Description', '说明')}</th><th>{t('Status', '状态')}</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className="chip" style={{ background: `${row.color}1a`, borderColor: `${row.color}55`, color: row.color }}>{row.label}</span></td><td>{row.kind === 'system' ? t('System', '系统') : t('Custom', '自定义')}</td><td><input type="color" value={row.color} disabled={row.kind === 'system'} onChange={(event) => update(row.id, { color: event.target.value })} /></td><td><input className="input" defaultValue={row.description || ''} disabled={row.kind === 'system'} onBlur={(event) => event.target.value !== (row.description || '') && update(row.id, { description: event.target.value })} placeholder={t('None', '无')} /></td><td>{row.archived ? <span className="chip chip--danger">{t('Archived', '已归档')}</span> : <span className="chip chip--good">{t('Active', '启用中')}</span>}</td><td>{row.kind !== 'system' && <button className="btn btn--sm" onClick={() => update(row.id, { archived: !row.archived })}>{row.archived ? t('Restore', '恢复') : t('Archive', '归档')}</button>}</td></tr>)}</tbody></table></div>
  </div>;
}
