import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../../lib/api';
import type { BountyRequest, Mask } from '../../lib/types';
import { MaskBadge, Modal, Spinner, TagChip } from '../../components/ui';
import { EvidenceUploader } from './EvidenceUploader';
import { fmtDate, fromNow, tmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ReportButton } from './ReportButton';
import { TavernNotice } from './TavernNotice';
import type { EvidenceFile } from '../../lib/types';
import { EvidencePreview } from './EvidencePreview';

export default function RequestPage() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [request, setRequest] = useState<BountyRequest | null>(null);
  const [error, setError] = useState('');
  const [masks, setMasks] = useState<Mask[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ profileId: '', tierId: '', title: '', content: '' });
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState<{ submissionId: string; tierName: string; price: number } | null>(null);
  const [paymentSource, setPaymentSource] = useState<'escrow' | 'wallet'>('escrow');

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
      setForm({ profileId: '', tierId: '', title: '', content: '' });
      setFiles([]);
      toast.push('Report submitted. Payment will be settled after the request recipient manually accepts it.', 'good');
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const settle = async (submissionId: string, action: 'accept' | 'reject', source?: 'escrow' | 'wallet') => {
    try {
      const r = await post<{ request: BountyRequest }>(`/tavern/requests/${id}/settle`, { submissionId, action, paymentSource: source });
      setRequest(r.request);
      setSettling(null);
      toast.push(action === 'accept' ? 'Report accepted, paid, and unlocked.' : 'Report declined and recorded.', action === 'accept' ? 'good' : 'info');
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
        ← Back to the Tavern
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
                {s.title && <h3 style={{ fontSize: 17, marginBottom: 8 }}>{s.title}</h3>}
                {s.content ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{s.content}</div>
                ) : (
                  <div className="redacted">{request.isOwner && s.status === 'pending' ? 'Accept and pay this report to unlock its confidential text and evidence.' : 'Confidential report text is locked.'}</div>
                )}
              </div>

              {s.evidence.length > 0 && (
                <div className="row" style={{ gap: 12, marginTop: 10 }}>
                  {s.evidence.map((f) => <EvidencePreview key={f.id} file={f} />)}
                </div>
              )}
              {!s.content && s.evidenceCount > 0 && <div className="muted" style={{ marginTop: 8 }}>{s.evidenceCount} evidence files attached</div>}

              {request.isOwner && s.status === 'pending' && (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn btn--primary btn--sm" onClick={() => {
                    setPaymentSource('escrow');
                    setSettling({ submissionId: s.id, tierName: tier?.name || 'Report', price: tier?.price ?? 0 });
                  }}>
                    Accept and choose payment
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
        open={!!settling}
        onClose={() => setSettling(null)}
        title="Accept and pay for this report"
        subtitle={settling ? `${settling.tierName} costs ${tmt(settling.price)}. Choose which balance should fund this payment.` : ''}
        footer={<>
          <button className="btn" onClick={() => setSettling(null)}>Cancel</button>
          <button
            className="btn btn--primary"
            disabled={!settling || busy || (paymentSource === 'escrow' ? (request.depositRemaining ?? 0) : (user?.wallet.available ?? 0)) < (settling?.price ?? 0)}
            onClick={async () => {
              if (!settling) return;
              setBusy(true);
              try { await settle(settling.submissionId, 'accept', paymentSource); } finally { setBusy(false); }
            }}
          >
            {busy ? 'Processing…' : `Pay ${settling ? tmt(settling.price) : ''}`}
          </button>
        </>}
      >
        <div className="stack">
          <label className="tier" style={{ cursor: 'pointer' }}>
            <input type="radio" name="payment-source" checked={paymentSource === 'escrow'} onChange={() => setPaymentSource('escrow')} />
            <div style={{ flex: 1 }}><strong>Request escrow</strong><div className="muted">Remaining: {tmt(request.depositRemaining ?? 0)}</div></div>
          </label>
          <label className="tier" style={{ cursor: 'pointer' }}>
            <input type="radio" name="payment-source" checked={paymentSource === 'wallet'} onChange={() => setPaymentSource('wallet')} />
            <div style={{ flex: 1 }}><strong>My wallet</strong><div className="muted">Available: {tmt(user?.wallet.available ?? 0)}</div></div>
          </label>
          {settling && (paymentSource === 'escrow' ? (request.depositRemaining ?? 0) : (user?.wallet.available ?? 0)) < settling.price && (
            <div className="error-text">The selected balance does not contain enough TMT. Choose the other payment source or add funds.</div>
          )}
          <div className="hint">Wallet payment does not reduce the request escrow. Unused escrow remains reserved until the request is closed.</div>
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Submit a report"
        subtitle="The requester sees your title first. Your confidential text and evidence unlock only if they manually accept and pay for the report."
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={submit} disabled={busy || !form.profileId || !form.tierId || form.title.trim().length < 4 || form.content.trim().length < 10}>
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
                You do not have a mask yet. <Link to="/tavern/desk?tab=masks">Create one first →</Link>
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
            <label>Report title (visible before payment)</label>
            <input className="input" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Describe what your report provides without revealing the answer" />
          </div>
          <div className="field">
            <label>Confidential report text</label>
            <textarea className="textarea" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="This text remains locked until the requester accepts and pays." />
          </div>
          <EvidenceUploader files={files} onChange={setFiles} />
          <div className="notice-banner">Payment is not automatic when you submit. The reward is settled only after the request recipient manually chooses and accepts your report.</div>
        </div>
      </Modal>
    </div>
  );
}
