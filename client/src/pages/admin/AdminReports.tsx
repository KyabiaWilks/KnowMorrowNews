import { useEffect, useState } from 'react';
import { get, post } from '../../lib/api';
import { Empty, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtTime } from '../../lib/format';
import { useAdminLanguage } from './AdminLanguage';

type Report = {
  id: string; targetLabel: string; reason: string; detail: string;
  status: 'pending' | 'upheld' | 'dismissed'; createdAt: string;
  evidence: { id: string; name: string; url: string }[];
  reporter: { alias: string; sigil: string };
  accused: { alias: string; username: string; alts: string[] } | null;
  arbitration: { summary: string; executed: string[]; decidedBy: string; decidedAt: string } | null;
};
type Penalty = { id: string; label: string };
const initialForm = { verdict: 'upheld', severity: 'major', penalties: [] as string[], summary: '', notes: '', compensation: 0, freezeAmount: 0, disclosureText: '' };

export default function AdminReports() {
  const toast = useToast();
  const { t } = useAdminLanguage();
  const [rows, setRows] = useState<Report[] | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [filter, setFilter] = useState('pending');
  const [target, setTarget] = useState<Report | null>(null);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const load = () => get<{ items: Report[] }>(`/admin/reports?status=${filter}`).then((result) => setRows(result.items));

  useEffect(() => { void load(); }, [filter]);
  useEffect(() => { void get<{ penalties: Penalty[] }>('/admin/penalties').then((result) => setPenalties(result.penalties)); }, []);

  const decide = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await post(`/admin/reports/${target.id}/arbitrate`, form);
      toast.push(t('Decision executed.', '裁决已执行。'), 'good');
      setTarget(null); setForm(initialForm); await load();
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally { setBusy(false); }
  };

  if (!rows) return <Spinner />;
  const filters = [
    ['pending', t('Pending', '待处理')], ['upheld', t('Upheld', '已成立')],
    ['dismissed', t('Dismissed', '未成立')], ['all', t('All', '全部')],
  ];

  return <div className="stack">
    <div className="row row--between"><h2>{t('Reports & arbitration', '举报与仲裁')}</h2><div className="row">{filters.map(([id, label]) => <button key={id} className={`chip ${filter === id ? 'chip--on' : ''}`} onClick={() => setFilter(id)}>{label}</button>)}</div></div>
    {rows.length === 0 ? <Empty icon="⚖️" title={t('Nothing in this queue', '此列表暂无内容')} /> : rows.map((report) => <article key={report.id} className="card card--pad stack">
      <div className="row row--between"><div className="row"><span className="chip chip--danger">{report.reason}</span><strong>{report.targetLabel}</strong></div><span className="muted">{fmtTime(report.createdAt)}</span></div>
      <div className="soft">{report.detail || t('(No additional details supplied.)', '（举报人未补充说明。）')}</div>
      {report.evidence.length > 0 && <div className="row">{report.evidence.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer">📎 {item.name}</a>)}</div>}
      <div className="divider" />
      <div className="row row--between"><span className="muted">{t('Reporter', '举报人')}: {report.reporter.sigil} {report.reporter.alias}</span>{report.accused && <span className="muted">{t('Reported account', '被举报账号')}: <strong>{report.accused.alias}</strong> · <code>{report.accused.username}</code> · {t('Masks', '马甲')}: {report.accused.alts.join(', ') || '—'}</span>}</div>
      {report.arbitration ? <div className="card card--pad" style={{ background: 'var(--blue-50)' }}><strong>{report.arbitration.summary}</strong><div className="muted">{report.arbitration.executed.join(', ') || t('No additional action.', '未执行额外处置。')}</div><div className="muted">{t('Decided by', '裁决人')} {report.arbitration.decidedBy} · {fmtTime(report.arbitration.decidedAt)}</div></div>
        : <div><button className="btn btn--primary btn--sm" onClick={() => setTarget(report)}>{t('Open arbitration', '进入仲裁')}</button></div>}
    </article>)}
    <Modal open={!!target} onClose={() => setTarget(null)} wide title={t('Arbitration decision', '仲裁裁决')} subtitle={target ? `${target.targetLabel} · ${target.reason}` : ''}
      footer={<><button className="btn" onClick={() => setTarget(null)}>{t('Cancel', '取消')}</button><button className="btn btn--primary" onClick={decide} disabled={busy}>{busy ? t('Executing…', '执行中…') : t('Decide and execute', '作出裁决并执行')}</button></>}>
      <div className="stack">
        <div className="field"><label>{t('Verdict', '裁决结论')}</label><div className="row"><button className={`chip ${form.verdict === 'upheld' ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, verdict: 'upheld' })}>{t('Uphold report', '举报成立')}</button><button className={`chip ${form.verdict === 'dismissed' ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, verdict: 'dismissed' })}>{t('Dismiss report', '举报不成立')}</button></div></div>
        {form.verdict === 'upheld' && <>
          <div className="field"><label>{t('Severity', '严重程度')}</label><div className="row">{[['minor', t('Minor', '轻微')], ['major', t('Major', '严重')], ['severe', t('Severe', '非常严重')]].map(([id, label]) => <button key={id} className={`chip ${form.severity === id ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, severity: id })}>{label}</button>)}</div></div>
          <div className="field"><label>{t('Penalties', '执行处置')}</label><div className="row">{penalties.map((penalty) => <button key={penalty.id} className={`chip ${form.penalties.includes(penalty.id) ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, penalties: form.penalties.includes(penalty.id) ? form.penalties.filter((id) => id !== penalty.id) : [...form.penalties, penalty.id] })}>{penalty.label}</button>)}</div></div>
          {form.penalties.includes('freeze_funds') && <div className="field"><label>{t('Amount to freeze (0 freezes all available funds)', '冻结金额（0 表示全部可用余额）')}</label><input className="input" type="number" min={0} value={form.freezeAmount} onChange={(event) => setForm({ ...form, freezeAmount: Number(event.target.value) })} /></div>}
          {form.penalties.includes('compensate') && <div className="field"><label>{t('Compensation to reporter (TMT)', '划拨给举报人的赔偿（TMT）')}</label><input className="input" type="number" min={0} value={form.compensation} onChange={(event) => setForm({ ...form, compensation: Number(event.target.value) })} /></div>}
          {form.penalties.includes('public_disclosure') && <div className="field"><label>{t('Public disclosure text', '公开处置公告')}</label><textarea className="textarea" value={form.disclosureText} onChange={(event) => setForm({ ...form, disclosureText: event.target.value })} /><div className="hint" style={{ color: 'var(--bad)' }}>{t('Public disclosure is the most serious action. Verify the evidence before publishing.', '公开披露是最严厉的处置。发布前请确认相关证据。')}</div></div>}
        </>}
        <div className="field"><label>{t('Decision summary (visible to reporter)', '裁决摘要（举报人可见）')}</label><input className="input" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></div>
        <div className="field"><label>{t('Internal notes (administrators only)', '内部备注（仅管理员可见）')}</label><textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
      </div>
    </Modal>
  </div>;
}
