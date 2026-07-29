import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../../lib/api';
import type { Mask, Offer, Tier } from '../../lib/types';
import { MaskBadge, Modal, Spinner, TagChip } from '../../components/ui';
import { fromNow, tmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ReportButton } from './ReportButton';
import { TavernNotice } from './TavernNotice';
import { EvidencePreview } from './EvidencePreview';

export default function OfferPage() {
  const { id } = useParams(); const { user, refresh } = useAuth(); const toast = useToast();
  const [offer, setOffer] = useState<Offer | null>(null); const [error, setError] = useState(''); const [buying, setBuying] = useState<Tier | 'buyout' | null>(null);
  const [masks, setMasks] = useState<Mask[]>([]); const [maskId, setMaskId] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { setOffer(null); void get<{ offer: Offer }>(`/tavern/offers/${id}`).then((result) => setOffer(result.offer)).catch((reason) => setError(reason.message)); }, [id]);
  useEffect(() => { if (user) void get<{ profiles: Mask[] }>('/tavern/profiles').then((result) => setMasks(result.profiles.filter((profile) => !profile.retired))); }, [user]);
  const purchase = async () => {
    if (!buying) return; setBusy(true);
    try { const result = await post<{ offer: Offer }>(`/tavern/offers/${id}/purchase`, { tierId: buying === 'buyout' ? null : buying.id, buyout: buying === 'buyout', buyerProfileId: maskId || null }); setOffer(result.offer); setBuying(null); toast.push(buying === 'buyout' ? 'Exclusive buyout completed. Every tier is now unlocked.' : 'Unlocked. The seller cannot see your account identity.', 'good'); await refresh(); }
    catch (error) { toast.push((error as Error).message, 'bad'); } finally { setBusy(false); }
  };
  const withdraw = async () => {
    if (!offer || !window.confirm('Withdraw this listing? It will disappear from the Tavern, but existing buyers will keep access to what they purchased. This cannot be undone.')) return;
    setBusy(true);
    try {
      await post(`/tavern/offers/${offer.id}/withdraw`);
      setOffer({ ...offer, status: 'withdrawn' });
      toast.push('Listing withdrawn. Existing buyers still have access from My Purchases.', 'good');
    } catch (reason) {
      toast.push((reason as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  const saveAlertSettings = async (muted: boolean, tierIds: string[]) => {
    if (!offer) return;
    try {
      const result = await post<{ settings: { muted: boolean; tierIds: string[] } }>(`/tavern/offers/${offer.id}/notification-settings`, { muted, tierIds });
      setOffer({ ...offer, notificationSettings: result.settings });
      toast.push('Listing notification settings saved.', 'good');
    } catch (reason) {
      toast.push((reason as Error).message, 'bad');
    }
  };
  if (error) return <div className="tavern empty">{error}</div>;
  if (!offer) return <div className="tavern"><Spinner label="Opening this tip" /></div>;
  return <div className="tavern stack" style={{ gap: 20 }}><TavernNotice /><Link to="/tavern" className="muted">← Back to the Tavern</Link>
    <div className="card card--pad stack"><div className="row row--between"><MaskBadge mask={offer.seller} /><div className="row"><span className="muted">{fromNow(offer.createdAt)} · {offer.views} views</span><ReportButton targetType="offer" targetId={offer.id} /></div></div><h1 style={{ fontSize: 27 }}>{offer.title}</h1>{offer.summary && <p className="soft" style={{ margin: 0 }}>{offer.summary}</p>}<div className="row" style={{ gap: 6 }}>{offer.tags.map((value) => <TagChip key={value} label={value} />)}</div><div className="row row--between">{offer.isOwner && <div className="chip chip--warn">This is your listing</div>}{offer.isOwner && offer.status === 'open' && !user?.readOnly && <button type="button" className="btn btn--danger btn--sm" disabled={busy} onClick={() => void withdraw()}>Withdraw listing</button>}{offer.status !== 'open' && <div className="chip chip--danger">This listing is closed</div>}</div></div>
    {offer.isOwner && offer.notificationSettings && <section className="card card--pad stack"><div><div className="eyebrow">LISTING NOTIFICATIONS</div><h2>When should this post notify you?</h2></div><label className="row"><input type="checkbox" checked={offer.notificationSettings.muted} onChange={(event) => void saveAlertSettings(event.target.checked, offer.notificationSettings?.tierIds || [])} /><span><strong>Mute this entire listing</strong><span className="hint"> No purchase milestones, tier alerts, or buyout alerts will be sent.</span></span></label><div className="muted">By default, notifications are sent only for purchase #1, #10, #100, #500, and an exclusive buyout. Select tiers below to receive an alert every time that tier is purchased.</div><div className="row">{offer.tiers.map((tier) => { const checked = offer.notificationSettings?.tierIds.includes(tier.id) || false; return <label className="chip" key={tier.id}><input type="checkbox" disabled={offer.notificationSettings?.muted} checked={checked} onChange={(event) => { const current = offer.notificationSettings?.tierIds || []; const next = event.target.checked ? [...current, tier.id] : current.filter((id) => id !== tier.id); void saveAlertSettings(offer.notificationSettings?.muted || false, next); }} /> Notify when “{tier.name}” sells</label>; })}</div></section>}
    {offer.exclusive && <div className="card card--pad row row--between"><div><div className="eyebrow">EXCLUSIVE BUYOUT</div><strong>One buyer receives every tier; the listing then closes.</strong></div><div className="row"><span className="tier__price">{tmt(offer.exclusivePrice || 0)}</span><button className="btn btn--primary" disabled={!user || user.readOnly || offer.isOwner || offer.status !== 'open'} onClick={() => setBuying('buyout')}>Buy out exclusively</button></div></div>}
    <div className="stack"><div className="eyebrow">{offer.exclusive ? 'INCLUDED INFORMATION TIERS' : 'ACCESS TIERS · MORE DETAIL, HIGHER PRICE'}</div>{offer.tiers.map((tier) => <div key={tier.id} className={`tier ${tier.unlocked ? 'tier--unlocked' : 'tier--locked'}`}>
      <div style={{ flex: 1 }}><div className="row row--between"><div><strong style={{ fontSize: 15.5 }}>{tier.name}</strong>{tier.detail && <span className="muted"> · {tier.detail}</span>}</div><div className="row"><span className="muted">{tier.buyers} purchases</span>{tier.evidenceCount > 0 && <span className="chip chip--good">📎 {tier.evidenceCount} evidence files</span>}</div></div>
        <div style={{ marginTop: 10 }}>{tier.unlocked ? <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>{tier.content}</div> : <div className="stack" style={{ gap: 5 }}><div className="redacted">This information becomes visible after the tier is unlocked.</div><div className="redacted" style={{ width: '78%' }}>Supporting details remain protected.</div></div>}</div>
        {tier.unlocked && tier.evidence.length > 0 && <div className="stack" style={{ gap: 12, marginTop: 12 }}><div className="eyebrow">EVIDENCE</div>{tier.evidence.map((file) => <EvidencePreview key={file.id} file={file} />)}</div>}
      </div>
      <div className="stack" style={{ alignItems: 'flex-end', gap: 8, minWidth: 128 }}><div className="tier__price">{offer.exclusive ? 'Included' : tmt(tier.price)}</div>{tier.unlocked ? <span className="chip chip--good">Unlocked</span> : !offer.exclusive && <button className="btn btn--primary btn--sm" disabled={!user || user.readOnly || offer.isOwner || offer.status !== 'open'} onClick={() => setBuying(tier)}>Unlock this tier</button>}</div>
    </div>)}</div>
    {!user && <div className="card card--pad muted">Sign in to unlock paid content. <Link to="/login">Sign in with Discord →</Link></div>}
    <Modal open={!!buying} onClose={() => setBuying(null)} title={buying === 'buyout' ? 'Exclusive buyout' : `Unlock “${buying?.name || ''}”`} subtitle={`This costs ${tmt(buying === 'buyout' ? offer.exclusivePrice || 0 : buying?.price ?? 0)}. The seller never sees your account identity.`} footer={<><button className="btn" onClick={() => setBuying(null)}>Not yet</button><button className="btn btn--primary" onClick={purchase} disabled={busy || (buying === 'buyout' ? offer.exclusivePrice || 0 : buying?.price ?? 0) > (user?.wallet.available ?? 0)}>{busy ? 'Processing…' : `Pay ${tmt(buying === 'buyout' ? offer.exclusivePrice || 0 : buying?.price ?? 0)}`}</button></>}>
      <div className="stack"><div className="row row--between"><span className="soft">Available balance</span><strong>{tmt(user?.wallet.available ?? 0)}</strong></div><div className="field"><label>Purchase under a mask (optional)</label><select className="select" value={maskId} onChange={(event) => setMaskId(event.target.value)}><option value="">Remain completely anonymous</option>{masks.map((mask) => <option key={mask.id} value={mask.id}>{mask.sigil} {mask.alias}</option>)}</select><div className="hint">A selected mask remains isolated from your account and other masks.</div></div>{buying && (buying === 'buyout' ? offer.exclusivePrice || 0 : buying.price) > (user?.wallet.available ?? 0) && <div className="error-text">Insufficient balance. Add tomato coin from your wallet first.</div>}</div>
    </Modal>
  </div>;
}
