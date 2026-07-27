import { useEffect, useState } from 'react';
import { get, post } from '../../lib/api';
import { Modal } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { Mask } from '../../lib/types';
type Reason = { id: string; label: string };

export function ReportButton({ targetType, targetId }: { targetType: 'offer' | 'request' | 'submission' | 'profile'; targetId: string }) {
  const { user } = useAuth(); const toast = useToast();
  const [open, setOpen] = useState(false); const [reasons, setReasons] = useState<Reason[]>([]); const [masks, setMasks] = useState<Mask[]>([]);
  const [reason, setReason] = useState(''); const [detail, setDetail] = useState(''); const [profileId, setProfileId] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    void get<{ reasons: Reason[] }>('/tavern/report-reasons').then((result) => setReasons(result.reasons));
    if (user) void get<{ profiles: Mask[] }>('/tavern/profiles').then((result) => setMasks(result.profiles.filter((profile) => !profile.retired)));
  }, [open, user]);
  const submit = async () => {
    setBusy(true);
    try { await post('/tavern/reports', { targetType, targetId, reason, detail, profileId: profileId || null }); toast.push('Report submitted. Track it from My Desk.', 'good'); setOpen(false); setReason(''); setDetail(''); }
    catch (error) { toast.push((error as Error).message, 'bad'); }
    finally { setBusy(false); }
  };
  return <>
    <button className="btn btn--sm" disabled={user?.readOnly} onClick={() => user ? setOpen(true) : toast.push('Sign in with Discord to file a report.', 'bad')} title={user?.readOnly ? 'Event Staff access is read-only' : 'Report this item to arbitration'}>⚠ Report</button>
    <Modal open={open} onClose={() => setOpen(false)} title="File a report" subtitle="Deliberate misinformation, fraud and deliberate non-payment may result in suspension, frozen funds and compensation." footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn--primary" onClick={submit} disabled={busy || !reason}>{busy ? 'Submitting…' : 'Submit report'}</button></>}>
      <div className="stack"><div className="field"><label>Reason</label><div className="row" style={{ gap: 6 }}>{reasons.map((item) => <button key={item.id} className={`chip ${reason === item.id ? 'chip--on' : ''}`} onClick={() => setReason(item.id)}>{item.label}</button>)}</div></div>
        <div className="field"><label>What happened?</label><textarea className="textarea" value={detail} maxLength={600} onChange={(event) => setDetail(event.target.value)} placeholder="Include dates, transaction details and any evidence the arbitration team should review." /></div>
        {masks.length > 0 && <div className="field"><label>File under a mask (optional)</label><select className="select" value={profileId} onChange={(event) => setProfileId(event.target.value)}><option value="">No public identity</option>{masks.map((mask) => <option key={mask.id} value={mask.id}>{mask.sigil} {mask.alias}</option>)}</select><div className="hint">The reported party never sees who filed the report. Only the arbitration team can access this identity.</div></div>}
      </div>
    </Modal>
  </>;
}
