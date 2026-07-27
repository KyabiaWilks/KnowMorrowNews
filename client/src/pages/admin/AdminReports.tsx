import { useEffect, useState } from 'react';
import { get, post } from '../../lib/api';
import { Empty, Modal, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtTime } from '../../lib/format';

type Report = {
  id: string;
  targetType: string;
  targetLabel: string;
  reason: string;
  detail: string;
  status: 'pending' | 'upheld' | 'dismissed';
  createdAt: string;
  evidence: { id: string; name: string; url: string }[];
  reporter: { alias: string; sigil: string };
  accused: { profileId: string; alias: string; userId: string; username: string; alts: string[] } | null;
  arbitration: { summary: string; penalties: string[]; executed: string[]; decidedBy: string; decidedAt: string } | null;
};

type Penalty = { id: string; label: string };

export default function AdminReports() {
  const toast = useToast();
  const [rows, setRows] = useState<Report[] | null>(null);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [filter, setFilter] = useState('pending');
  const [target, setTarget] = useState<Report | null>(null);
  const [form, setForm] = useState({
    verdict: 'upheld',
    severity: 'major',
    penalties: [] as string[],
    summary: '',
    notes: '',
    compensation: 0,
    freezeAmount: 0,
    disclosureText: '',
  });
  const [busy, setBusy] = useState(false);

  const load = () => get<{ items: Report[] }>(`/admin/reports?status=${filter}`).then((r) => setRows(r.items));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    void get<{ penalties: Penalty[] }>('/admin/penalties').then((r) => setPenalties(r.penalties));
  }, []);

  const toggle = (id: string) =>
    setForm((f) => ({ ...f, penalties: f.penalties.includes(id) ? f.penalties.filter((x) => x !== id) : [...f.penalties, id] }));

  const decide = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await post(`/admin/reports/${target.id}/arbitrate`, form);
      toast.push('裁决已执行', 'good');
      setTarget(null);
      setForm({ verdict: 'upheld', severity: 'major', penalties: [], summary: '', notes: '', compensation: 0, freezeAmount: 0, disclosureText: '' });
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <Spinner />;

  return (
    <div className="stack">
      <div className="row row--between">
        <h2 style={{ fontSize: 20 }}>举报与仲裁</h2>
        <div className="row" style={{ gap: 4 }}>
          {[
            { id: 'pending', label: '待处理' },
            { id: 'upheld', label: '已成立' },
            { id: 'dismissed', label: '未成立' },
            { id: 'all', label: '全部' },
          ].map((f) => (
            <button key={f.id} className={`chip ${filter === f.id ? 'chip--on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon="⚖️" title="这一栏是空的" />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="card card--pad stack">
            <div className="row row--between">
              <div className="row">
                <span className="chip chip--danger">{r.reason}</span>
                <strong>{r.targetLabel}</strong>
              </div>
              <span className="muted">{fmtTime(r.createdAt)}</span>
            </div>

            <div className="soft">{r.detail || '（举报人没有补充说明）'}</div>

            {r.evidence.length > 0 && (
              <div className="row" style={{ gap: 10 }}>
                {r.evidence.map((e) => (
                  <a key={e.id} href={e.url} target="_blank" rel="noreferrer">
                    📎 {e.name}
                  </a>
                ))}
              </div>
            )}

            <div className="divider" style={{ margin: '2px 0' }} />

            <div className="row row--between">
              <div className="muted">
                举报人：{r.reporter.sigil} {r.reporter.alias}
              </div>
              {r.accused && (
                <div className="muted">
                  被举报：<strong>{r.accused.alias}</strong> · 真实账号 <code>{r.accused.username}</code> · 名下马甲 {r.accused.alts.join('、')}
                </div>
              )}
            </div>

            {r.arbitration ? (
              <div className="card card--pad" style={{ background: 'var(--blue-50)' }}>
                <div style={{ fontWeight: 700 }}>{r.arbitration.summary}</div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {r.arbitration.executed.join('；') || '未执行额外处罚'}
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  裁决人 {r.arbitration.decidedBy} · {fmtTime(r.arbitration.decidedAt)}
                </div>
              </div>
            ) : (
              <div className="row">
                <button className="btn btn--primary btn--sm" onClick={() => setTarget(r)}>
                  进入仲裁
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <Modal
        open={!!target}
        onClose={() => setTarget(null)}
        wide
        title="仲裁裁决"
        subtitle={target ? `${target.targetLabel} · ${target.reason}` : ''}
        footer={
          <>
            <button className="btn" onClick={() => setTarget(null)}>
              取消
            </button>
            <button className="btn btn--primary" onClick={decide} disabled={busy}>
              {busy ? '执行中…' : '作出裁决并执行'}
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="field">
            <label>裁决结论</label>
            <div className="row" style={{ gap: 6 }}>
              <button className={`chip ${form.verdict === 'upheld' ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, verdict: 'upheld' })}>
                举报成立
              </button>
              <button className={`chip ${form.verdict === 'dismissed' ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, verdict: 'dismissed' })}>
                举报不成立
              </button>
            </div>
          </div>

          {form.verdict === 'upheld' && (
            <>
              <div className="field">
                <label>情节严重程度</label>
                <div className="row" style={{ gap: 6 }}>
                  {[
                    { id: 'minor', label: '轻微' },
                    { id: 'major', label: '严重' },
                    { id: 'severe', label: '过于严重' },
                  ].map((s) => (
                    <button key={s.id} className={`chip ${form.severity === s.id ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, severity: s.id })}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>执行的处罚</label>
                <div className="row" style={{ gap: 6 }}>
                  {penalties.map((p) => (
                    <button key={p.id} className={`chip ${form.penalties.includes(p.id) ? 'chip--on' : ''}`} onClick={() => toggle(p.id)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.penalties.includes('freeze_funds') && (
                <div className="field" style={{ maxWidth: 240 }}>
                  <label>冻结金额（0 = 冻结全部可动用余额）</label>
                  <input className="input" type="number" min={0} value={form.freezeAmount} onChange={(e) => setForm({ ...form, freezeAmount: Number(e.target.value) })} />
                </div>
              )}

              {form.penalties.includes('compensate') && (
                <div className="field" style={{ maxWidth: 240 }}>
                  <label>划扣赔偿举报方的金额 TMT</label>
                  <input className="input" type="number" min={0} value={form.compensation} onChange={(e) => setForm({ ...form, compensation: Number(e.target.value) })} />
                </div>
              )}

              {form.penalties.includes('public_disclosure') && (
                <div className="field">
                  <label>公开处罚公告正文</label>
                  <textarea
                    className="textarea"
                    value={form.disclosureText}
                    onChange={(e) => setForm({ ...form, disclosureText: e.target.value })}
                    placeholder="留空则使用默认措辞。公告会连同该账号名下全部马甲一并披露。"
                  />
                  <div className="hint" style={{ color: 'var(--bad)' }}>
                    这是最重的一档处罚，一旦发布不可撤回。请确认证据充分。
                  </div>
                </div>
              )}
            </>
          )}

          <div className="field">
            <label>裁决摘要（举报人可见）</label>
            <input className="input" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="例如：查实为重复售卖同一条未经核实的消息。" />
          </div>
          <div className="field">
            <label>内部备注（仅管理台可见）</label>
            <textarea className="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
