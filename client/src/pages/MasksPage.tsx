import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import type { Mask } from '../lib/types';
import { Empty, MaskBadge, Modal, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { fmtDate, tmt } from '../lib/format';

export default function MasksPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ profiles: Mask[]; max: number; sigils: string[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ alias: '', bio: '', sigil: '' });
  const [busy, setBusy] = useState(false);
  const load = () => get<{ profiles: Mask[]; max: number; sigils: string[] }>('/tavern/profiles').then(setData);
  useEffect(() => { void load(); }, []);

  const create = async () => {
    setBusy(true);
    try {
      await post('/tavern/profiles', form);
      toast.push(`Your new mask “${form.alias}” is ready.`, 'good');
      setOpen(false);
      setForm({ alias: '', bio: '', sigil: '' });
      await load();
      await refresh();
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const retire = async (id: string, alias: string) => {
    if (!window.confirm(`Retire “${alias}”? Transaction history will remain, but this mask cannot publish new material.`)) return;
    try {
      await post(`/tavern/profiles/${id}/retire`);
      toast.push('Mask retired.', 'good');
      await load();
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    }
  };

  if (!data) return <Spinner />;
  const active = data.profiles.filter((profile) => !profile.retired);
  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head"><div><div className="eyebrow">ANONYMOUS IDENTITIES</div><h1 className="page-title">My Masks</h1><div className="page-sub">Account {user?.username} · {active.length} of {data.max} masks active. Other Newsroom participants see only the mask you choose.</div></div><button className="btn btn--primary" onClick={() => setOpen(true)} disabled={active.length >= data.max || user?.readOnly}>＋ Create a mask</button></div>
    <div className="notice-banner">Masks are not publicly linked to one another, but they belong to one account. If arbitration confirms a violation, sanctions apply to <strong>every mask on that account</strong>.</div>
    {data.profiles.length === 0 ? <Empty icon="🎭" title="You do not have an active mask" hint="Nobody posts under a real account name. Create a mask before returning to the Newsroom." /> : <div className="grid grid--3">{data.profiles.map((profile) => <div key={profile.id} className="card card--pad stack" style={{ opacity: profile.retired ? .55 : 1 }}>
      <div className="row row--between"><MaskBadge mask={profile} />{profile.retired && <span className="chip chip--danger">Retired</span>}</div>
      <div className="muted" style={{ minHeight: 32 }}>{profile.bio || 'No biography provided.'}</div><div className="divider" style={{ margin: '4px 0' }} />
      <div className="row row--between muted"><span>{profile.offers ?? 0} tips posted</span><span>{profile.requests ?? 0} requests posted</span></div>
      <div className="row row--between muted"><span>{profile.dealsClosed} completed deals</span><span>{tmt(profile.earnings ?? 0)} earned</span></div>
      <div className="row row--between muted"><span>Created {fmtDate(profile.createdAt)}</span><span className="mono">#{profile.mark}</span></div>
      {!profile.retired && <button className="btn btn--sm btn--danger" onClick={() => retire(profile.id, profile.alias)} disabled={user?.readOnly}>Retire this mask</button>}
    </div>)}</div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Create a new mask" subtitle="Aliases are unique across the site and cannot be renamed after creation." footer={<><button className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn btn--primary" onClick={create} disabled={busy || form.alias.trim().length < 2}>{busy ? 'Creating…' : 'Create mask'}</button></>}>
      <div className="stack"><div className="field"><label>Alias</label><input className="input" value={form.alias} maxLength={20} onChange={(event) => setForm({ ...form, alias: event.target.value })} placeholder="For example: Night Vessel" /></div>
        <div className="field"><label>Sigil</label><div className="row" style={{ gap: 6 }}>{data.sigils.map((sigil) => <button key={sigil} className={`chip ${form.sigil === sigil ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, sigil })}>{sigil}</button>)}</div><div className="hint">Leave blank to receive a random sigil.</div></div>
        <div className="field"><label>Short biography (optional)</label><input className="input" value={form.bio} maxLength={120} onChange={(event) => setForm({ ...form, bio: event.target.value })} placeholder="Replies only after midnight." /></div>
      </div>
    </Modal>
  </div>;
}
