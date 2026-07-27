import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../../lib/api';
import type { BountyRequest, Mask } from '../../lib/types';
import { MaskBadge, Modal, Spinner, TagChip } from '../../components/ui';
import { EvidenceUploader } from './EvidenceUploader';
import { fmtDate, fmtSize, fromNow, tmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ReportButton } from './ReportButton';
import { TavernNotice } from './TavernNotice';
import type { EvidenceFile } from '../../lib/types';

export default function RequestPage() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [request, setRequest] = useState<BountyRequest | null>(null);
  const [error, setError] = useState('');
  const [masks, setMasks] = useState<Mask[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ profileId: '', tierId: '', content: '' });
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () =>
    get<{ request: BountyRequest }>(`/tavern/requests/${id}`)
      .then((r) => setRequest(r.request))
      .catch((e) => setError(e.message));

  useEffect(() => {
    setRequest(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (user) void get<{ profiles: Mask[] }>('/tavern/profiles').then((r) => setMasks(r.profiles.filter((p) => !p.retired)));
  }, [user]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await post<{ request: BountyRequest }>(`/tavern/requests/${id}/submit`, {
        ...form,
        evidenceIds: files.map((f) => f.id),
      });
      setRequest(r.request);
      setOpen(false);
      setForm({ profileId: '', tierId: '', content: '' });
      setFiles([]);
      toast.push('Submitted. If accepted, your reward is paid directly from escrow.', 'good');
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const settle = async (submissionId: string, action: 'accept' | 'reject') => {
    try {
      const r = await post<{ request: BountyRequest }>(`/tavern/requests/${id}/settle`, { submissionId, action });
      setRequest(r.request);
      toast.push(action === 'accept' ? 'Accepted and paid' : 'Declined and recorded', action === 'accept' ? 'good' : 'info');
      await refresh();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  const close = async () => {
    try {
      const r = await post<{ request: BountyRequest }>(`/tavern/requests/${id}/close`);
      setRequest(r.request);
      toast.push('Request closed. Remaining escrow has been returned.', 'good');
      await refresh();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  if (error) return <div className="tavern empty">{error}</div>;
  if (!request) return <div className="tavern"><Spinner label="Opening this request" /></div>;

  return (
    <div className="tavern stack" style={{ gap: 20 }}>
      <TavernNotice />
      <Link to="/tavern" className="muted">
        ← Back to the Newsroom
      </Link>

      <div className="card card--pad stack">
        <div className="row row--between">
          <MaskBadge mask={request.buyer} />
          <div className="row">
            <span className="muted">{fromNow(request.createdAt)}</span>
            <ReportButton targetType="request" targetId={request.id} />
          </div>
        </div>
        <h1 style={{ fontSize: 27 }}>{request.title}</h1>
        <p className="soft" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{request.brief}</p>
        <div className="row" style={{ gap: 6 }}>
          {request.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
        <div className="row" style={{ gap: 18 }}>
          <span className="chip chip--good">{tmt(request.deposit)} in escrow</span>
          <span className={`chip ${request.status === 'open' ? '' : 'chip--danger'}`}>{request.status === 'open' ? 'Open' : 'Closed'}</span>
          {request.deadline && <span className="muted">Deadline {fmtDate(request.deadline)}</span>}
        </div>
      </div>

      <div className="stack">
        <div className="eyebrow">REWARD TIERS · PAYMENT SCALES WITH DETAIL</div>
        {request.tiers.map((t) => (
          <div key={t.id} className="tier">
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 15.5 }}>{t.name}</strong>
              <div className="soft" style={{ marginTop: 4 }}>{t.detail || 'No additional requirements provided'}</div>
            </div>
            <div className="stack" style={{ alignItems: 'flex-end', gap: 8, minWidth: 128 }}>
              <div className="tier__price">{tmt(t.price)}</div>
              {!request.isOwner && request.status === 'open' && (
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!user}
                  onClick={() => {
                    setForm((f) => ({ ...f, tierId: t.id }));
                    setOpen(true);
                  }}
                >
                  Submit to this tier
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card card--pad stack">
        <div className="row row--between">
          <div className="eyebrow">SUBMISSIONS ({request.submissionCount})</div>
          {request.isOwner && request.status === 'open' && (
            <button className="btn btn--sm" onClick={close}>
              Close request and return remaining escrow
            </button>
          )}
        </div>

        {request.submissions.length === 0 && <div className="muted">No submissions yet.</div>}

        {request.submissions.map((s) => {
          const tier = request.tiers.find((t) => t.id === s.tierId);
          return (
            <div key={s.id} className="tier" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="row row--between">
                <div className="row">
                  <MaskBadge mask={s.supplier} showMark={false} />
                  <span className="muted">Submitted to {tier?.name} · {fromNow(s.createdAt)}</span>
                </div>
                <span className={`chip ${s.status === 'accepted' ? 'chip--good' : s.status === 'rejected' ? 'chip--danger' : 'chip--warn'}`}>
                  {s.status === 'accepted' ? 'Accepted and paid' : s.status === 'rejected' ? 'Declined' : 'Awaiting review'}
                </span>
              </div>

              <div style={{ marginTop: 10 }}>
                {s.content ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{s.content}</div>
                ) : (
                  <div className="redacted">Submission content is visible only to the requester.</div>
                )}
              </div>

              {s.evidence.length > 0 && (
                <div className="row" style={{ gap: 12, marginTop: 10 }}>
                  {s.evidence.map((f) => (
                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                      📎 {f.name} <span className="muted">{fmtSize(f.size)}</span>
                    </a>
                  ))}
                </div>
              )}
              {!s.content && s.evidenceCount > 0 && <div className="muted" style={{ marginTop: 8 }}>{s.evidenceCount} evidence files attached</div>}

              {request.isOwner && s.status === 'pending' && (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => settle(s.id, 'accept')}>
                    Accept and pay {tmt(tier?.price ?? 0)}
                  </button>
                  <button className="btn btn--danger btn--sm" onClick={() => settle(s.id, 'reject')}>
                    Decline
                  </button>
                  <ReportButton targetType="submission" targetId={s.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Submit information"
        subtitle="Only the requester can read this submission. The arbitration team may inspect it if a dispute is opened."
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={busy || !form.profileId || !form.tierId || form.content.trim().length < 10}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="field">
            <label>Submit under which mask?</label>
            <select className="select" value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })}>
              <option value="">Choose a mask</option>
              {masks.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.sigil} {m.alias}
                </option>
              ))}
            </select>
            {masks.length === 0 && (
              <div className="hint">
                You do not have a mask yet. <Link to="/masks">Create one first →</Link>
              </div>
            )}
          </div>
          <div className="field">
            <label>Submission tier</label>
            <select className="select" value={form.tierId} onChange={(e) => setForm({ ...form, tierId: e.target.value })}>
              <option value="">Choose a tier</option>
              {request.tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · {tmt(t.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Information</label>
            <textarea className="textarea" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Specific, verifiable details are more likely to be accepted." />
          </div>
          <EvidenceUploader files={files} onChange={setFiles} />
        </div>
      </Modal>
    </div>
  );
}
