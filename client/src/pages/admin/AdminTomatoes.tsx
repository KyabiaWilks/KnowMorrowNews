import { useEffect, useState } from 'react';
import { get, patch, post } from '../../lib/api';
import { Empty, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtTime } from '../../lib/format';
import { useAdminLanguage } from './AdminLanguage';

type Row = { id: string; page: string; note: string; alias: string; hidden: boolean; createdAt: string };

export default function AdminTomatoes() {
  const { t } = useAdminLanguage();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [page, setPage] = useState('');
  const load = () => get<{ items: Row[] }>('/admin/tomatoes').then((result) => setRows(result.items));
  useEffect(() => { void load(); }, []);
  const clear = async () => {
    if (!page) return toast.push(t('Choose a page first.', '请先选择页面。'), 'bad');
    if (!window.confirm(t(`Remove every tomato from ${page}?`, `清除 ${page} 上的所有番茄？`))) return;
    const result = await post<{ removed: number }>('/admin/tomatoes/clear', { page });
    toast.push(t(`Removed ${result.removed} tomatoes.`, `已清除 ${result.removed} 颗番茄。`), 'good');
    await load();
  };
  if (!rows) return <Spinner />;
  const pages = [...new Set(rows.map((row) => row.page))];
  return <div className="stack">
    <div className="row row--between"><h2>{t(`Tomato moderation (${rows.length})`, `番茄管理（${rows.length}）`)}</h2><div className="row"><select className="select" style={{ width: 220 }} value={page} onChange={(event) => setPage(event.target.value)}><option value="">{t('Choose a page…', '选择页面…')}</option>{pages.map((item) => <option key={item} value={item}>{item} ({rows.filter((row) => row.page === item).length})</option>)}</select><button className="btn btn--danger" onClick={clear}>{t('Clear page', '清除该页')}</button></div></div>
    <div className="notice-banner">{t('Hiding removes a tomato from public view while retaining its moderation record. Users can remove their own tomatoes.', '隐藏会使番茄不再公开显示，但保留管理记录。用户也可以删除自己投掷的番茄。')}</div>
    {rows.length === 0 ? <Empty icon="🍅" title={t('No tomatoes to moderate', '没有需要管理的番茄')} /> : <div className="card card--pad admin-table-scroll"><table className="table"><thead><tr><th>{t('Time', '时间')}</th><th>{t('Page', '页面')}</th><th>{t('Name', '署名')}</th><th>{t('Message', '留言')}</th><th>{t('Status', '状态')}</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="mono">{fmtTime(row.createdAt)}</td><td className="mono">{row.page}</td><td>{row.alias}</td><td>{row.note || <span className="muted">{t('None', '无')}</span>}</td><td>{row.hidden ? <span className="chip chip--danger">{t('Hidden', '已隐藏')}</span> : <span className="chip chip--good">{t('Visible', '显示中')}</span>}</td><td><button className="btn btn--sm" onClick={() => patch(`/admin/tomatoes/${row.id}`, { hidden: !row.hidden }).then(load)}>{row.hidden ? t('Restore', '恢复显示') : t('Hide', '隐藏')}</button></td></tr>)}</tbody></table></div>}
  </div>;
}
