import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post } from '../../lib/api';
import type { EvidenceFile, Mask, Tag } from '../../lib/types';
import { Spinner, TagPicker } from '../../components/ui';
import { EvidenceUploader } from './EvidenceUploader';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { tmt } from '../../lib/format';
import { TavernNotice } from './TavernNotice';

type OfferTier = { name: string; detail: string; price: number; content: string; files: EvidenceFile[] };
type ReqTier = { name: string; detail: string; price: number };

const blankOfferTier = (i: number): OfferTier => ({
  name: ['Summary', 'Full account', 'Source material', 'Exclusive addendum'][i] || `Tier ${i + 1}`,
  detail: '',
  price: [40, 180, 420, 800][i] ?? 100,
  content: '',
  files: [],
});

export default function ComposePage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState<'offer' | 'request'>('offer');
  const [masks, setMasks] = useState<Mask[] | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [busy, setBusy] = useState(false);

  const [common, setCommon] = useState({ profileId: '', title: '', tags: [] as string[] });
  const [summary, setSummary] = useState('');
  const [brief, setBrief] = useState('');
  const [deadline, setDeadline] = useState('');
  const [offerTiers, setOfferTiers] = useState<OfferTier[]>([blankOfferTier(0), blankOfferTier(1)]);
  const [reqTiers, setReqTiers] = useState<ReqTier[]>([
    { name: 'Lead', detail: 'A verifiable direction or source', price: 80 },
    { name: 'Evidence', detail: 'At least one independently verifiable file', price: 400 },
  ]);
  const [deposit, setDeposit] = useState(400);

  const loadTags = () => get<{ tags: Tag[] }>('/tavern/tags').then((r) => setTags(r.tags));

  useEffect(() => {
    void get<{ profiles: Mask[] }>('/tavern/profiles').then((r) => {
      const active = r.profiles.filter((p) => !p.retired);
      setMasks(active);
      if (active[0]) setCommon((c) => ({ ...c, profileId: active[0].id }));
    });
    void loadTags();
  }, []);

  const maxReqPrice = useMemo(() => Math.max(0, ...reqTiers.map((t) => t.price || 0)), [reqTiers]);
  useEffect(() => {
    setDeposit((d) => (d < maxReqPrice ? maxReqPrice : d));
  }, [maxReqPrice]);

  const createTag = async (label: string) => {
    try {
      await post('/tavern/tags', { label });
      await loadTags();
      setCommon((c) => ({ ...c, tags: [...c.tags, label] }));
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  const submitOffer = async () => {
    setBusy(true);
    try {
      const res = await post<{ offer: { id: string } }>('/tavern/offers', {
        profileId: common.profileId,
        title: common.title,
        summary,
        tags: common.tags,
        tiers: offerTiers.map((t) => ({ ...t, evidenceIds: t.files.map((f) => f.id) })),
      });
      toast.push('Posted. The title and tags are public; details are protected by tier.', 'good');
      navigate(`/tavern/offers/${res.offer.id}`);
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const submitRequest = async () => {
    setBusy(true);
    try {
      const res = await post<{ request: { id: string } }>('/tavern/requests', {
        profileId: common.profileId,
        title: common.title,
        brief,
        tags: common.tags,
        tiers: reqTiers,
        deposit,
        deadline: deadline || null,
      });
      toast.push(`Request posted with ${tmt(deposit)} in escrow.`, 'good');
      await refresh();
      navigate(`/tavern/requests/${res.request.id}`);
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (!masks) return <div className="tavern"><Spinner /></div>;

  if (masks.length === 0) {
    return (
      <div className="tavern">
        <TavernNotice />
        <div className="card card--pad stack" style={{ textAlign: 'center', padding: 44 }}>
          <div style={{ fontSize: 40 }}>🎭</div>
          <h2>You do not have an active mask</h2>
          <div className="muted">Nobody posts under a real account name. Create a mask before returning to the Newsroom.</div>
          <Link to="/masks" className="btn btn--primary" style={{ margin: '0 auto' }}>
            Create a mask
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="tavern stack" style={{ gap: 20 }}>
      <TavernNotice />
      <div className="page-head">
        <div>
          <div className="eyebrow">COMPOSE</div>
          <h1 className="page-title" style={{ color: '#f2f6ff' }}>Post to the Newsroom</h1>
          <div className="page-sub" style={{ color: '#8ba4cf' }}>
            Sell a tip on the wall, or fund a reporting request with escrow.
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className={`chip ${kind === 'offer' ? 'chip--on' : ''}`} onClick={() => setKind('offer')}>
            Sell information
          </button>
          <button className={`chip ${kind === 'request' ? 'chip--on' : ''}`} onClick={() => setKind('request')}>
            Request information
          </button>
        </div>
      </div>

      <div className="card card--pad stack">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label>Post under which mask?</label>
            <select className="select" value={common.profileId} onChange={(e) => setCommon({ ...common, profileId: e.target.value })}>
              {masks.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.sigil} {m.alias}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 2, minWidth: 280 }}>
            <label>Title (public)</label>
            <input className="input" value={common.title} maxLength={80} onChange={(e) => setCommon({ ...common, title: e.target.value })} placeholder="State what you have or what you need in one sentence" />
          </div>
        </div>

        <div className="field">
          <label>Tags (public; choose one evidence label)</label>
          <TagPicker tags={tags} value={common.tags} onChange={(next) => setCommon({ ...common, tags: next })} onCreate={createTag} />
        </div>

        {kind === 'offer' ? (
          <div className="field">
            <label>Public summary (optional)</label>
            <input className="input" value={summary} maxLength={200} onChange={(e) => setSummary(e.target.value)} placeholder="Explain why it matters without revealing the answer." />
          </div>
        ) : (
          <>
            <div className="field">
              <label>Request brief (public)</label>
              <textarea className="textarea" value={brief} maxLength={600} onChange={(e) => setBrief(e.target.value)} placeholder="Describe what you need, acceptable formats and redaction requirements." />
            </div>
            <div className="field" style={{ maxWidth: 240 }}>
              <label>Deadline (optional)</label>
              <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {kind === 'offer' ? (
        <div className="stack">
          <div className="row row--between">
            <div className="eyebrow">ACCESS TIERS · MORE DETAIL, HIGHER PRICE</div>
            <button className="btn btn--sm" disabled={offerTiers.length >= 4} onClick={() => setOfferTiers([...offerTiers, blankOfferTier(offerTiers.length)])}>
              ＋ Add tier
            </button>
          </div>

          {offerTiers.map((t, i) => (
            <div key={i} className="card card--pad stack">
              <div className="row row--between">
                <strong>Tier {i + 1}</strong>
                {offerTiers.length > 1 && (
                  <button className="btn btn--sm btn--danger" onClick={() => setOfferTiers(offerTiers.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="field" style={{ flex: 1, minWidth: 150 }}>
                  <label>Tier name</label>
                  <input className="input" value={t.name} onChange={(e) => setOfferTiers(offerTiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                </div>
                <div className="field" style={{ flex: 2, minWidth: 200 }}>
                  <label>What this tier includes</label>
                  <input className="input" value={t.detail} onChange={(e) => setOfferTiers(offerTiers.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} placeholder="For example: dates and quantities only" />
                </div>
                <div className="field" style={{ width: 130 }}>
                  <label>Price in TMT</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={t.price}
                    onChange={(e) => setOfferTiers(offerTiers.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))}
                  />
                </div>
              </div>
              <div className="field">
                <label>Protected content</label>
                <textarea
                  className="textarea"
                  value={t.content}
                  onChange={(e) => setOfferTiers(offerTiers.map((x, j) => (j === i ? { ...x, content: e.target.value } : x)))}
                  placeholder="Put the valuable details here. At least 10 characters."
                />
              </div>
              <EvidenceUploader files={t.files} onChange={(files) => setOfferTiers(offerTiers.map((x, j) => (j === i ? { ...x, files } : x)))} />
            </div>
          ))}

          <button className="btn btn--primary" disabled={busy} onClick={submitOffer}>
            {busy ? 'Posting…' : 'Post to the wall'}
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="row row--between">
            <div className="eyebrow">REWARD TIERS · PAY FOR THE DETAIL RECEIVED</div>
            <button className="btn btn--sm" disabled={reqTiers.length >= 5} onClick={() => setReqTiers([...reqTiers, { name: `Tier ${reqTiers.length + 1}`, detail: '', price: 100 }])}>
              ＋ Add tier
            </button>
          </div>

          {reqTiers.map((t, i) => (
            <div key={i} className="card card--pad row" style={{ alignItems: 'flex-start' }}>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>Tier name</label>
                <input className="input" value={t.name} onChange={(e) => setReqTiers(reqTiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </div>
              <div className="field" style={{ flex: 2, minWidth: 220 }}>
                <label>Acceptance criteria</label>
                <input className="input" value={t.detail} onChange={(e) => setReqTiers(reqTiers.map((x, j) => (j === i ? { ...x, detail: e.target.value } : x)))} />
              </div>
              <div className="field" style={{ width: 130 }}>
                <label>Reward in TMT</label>
                <input className="input" type="number" min={1} value={t.price} onChange={(e) => setReqTiers(reqTiers.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
              </div>
              {reqTiers.length > 1 && (
                <button className="btn btn--sm btn--danger" style={{ marginTop: 24 }} onClick={() => setReqTiers(reqTiers.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
          ))}

          <div className="card card--pad stack">
            <div className="eyebrow">ESCROW</div>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ width: 200 }}>
                <label>Escrow amount (at least {maxReqPrice})</label>
                <input className="input" type="number" min={maxReqPrice} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} />
              </div>
              <div className="muted" style={{ flex: 1, minWidth: 240 }}>
                Funds move into site escrow. Accepted submissions are paid directly, and any remainder is returned when the request closes.
                <br />
                Available now: <strong>{tmt(user?.wallet.available ?? 0)}</strong>
              </div>
            </div>
            {deposit > (user?.wallet.available ?? 0) && <div className="error-text">Insufficient balance. Add tomato coin from your wallet first.</div>}
          </div>

          <button className="btn btn--primary" disabled={busy || deposit > (user?.wallet.available ?? 0)} onClick={submitRequest}>
            {busy ? 'Publishing…' : `Escrow ${tmt(deposit)} and publish`}
          </button>
        </div>
      )}
    </div>
  );
}
