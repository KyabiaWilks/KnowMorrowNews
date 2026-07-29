import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, qs } from '../../lib/api';
import type { BountyRequest, Offer, Tag } from '../../lib/types';
import { Empty, MaskBadge, SearchBox, Spinner, TagChip } from '../../components/ui';
import { fromNow, tmt } from '../../lib/format';
import { TavernNotice } from './TavernNotice';
import { useAuth } from '../../context/AuthContext';

type Mode = 'offers' | 'requests';

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <Link to={`/tavern/offers/${offer.id}`} className="card card--pad card--hover stack">
      <div className="row row--between">
        <MaskBadge mask={offer.seller} showMark={false} />
        <span className="muted">{fromNow(offer.createdAt)}</span>
      </div>
      <h3 style={{ fontSize: 16.5 }}>{offer.title}</h3>
      {offer.summary && <div className="soft" style={{ fontSize: 13.5 }}>{offer.summary}</div>}
      <div className="row" style={{ gap: 6 }}>{offer.tags.map((value) => <TagChip key={value} label={value} />)}</div>
      <div className="divider" style={{ margin: '2px 0', background: 'rgba(143,180,255,.16)' }} />
      <div className="row row--between">
        <span className="tier__price">From {tmt(offer.minPrice)}</span>
        <span className="muted">{offer.tiers.length} tiers · {offer.tiers.reduce((sum, tier) => sum + tier.buyers, 0)} purchases</span>
      </div>
    </Link>
  );
}

function RequestCard({ request }: { request: BountyRequest }) {
  return (
    <Link to={`/tavern/requests/${request.id}`} className="card card--pad card--hover stack">
      <div className="row row--between">
        <MaskBadge mask={request.buyer} showMark={false} />
        <span className={`chip ${request.status === 'open' ? 'chip--good' : ''}`}>{request.status === 'open' ? 'Open' : 'Closed'}</span>
      </div>
      <h3 style={{ fontSize: 16.5 }}>{request.title}</h3>
      <div className="soft" style={{ fontSize: 13.5 }}>{request.brief.slice(0, 90)}{request.brief.length > 90 ? '…' : ''}</div>
      <div className="row" style={{ gap: 6 }}>{request.tags.map((value) => <TagChip key={value} label={value} />)}</div>
      <div className="stack" style={{ gap: 5 }}>
        {request.tiers.map((tier) => (
          <div key={tier.id} className="row row--between" style={{ fontSize: 13 }}>
            <span className="soft">{tier.name} · {tier.detail}</span>
            <span className="tier__price" style={{ fontSize: 15 }}>{tmt(tier.price)}</span>
          </div>
        ))}
      </div>
      <div className="row row--between muted">
        <span>{tmt(request.deposit)} in escrow</span>
        <span>{request.submissionCount} submissions</span>
      </div>
    </Link>
  );
}

export default function TavernPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('offers');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [evidence, setEvidence] = useState('');
  const [sort, setSort] = useState('new');
  const [tags, setTags] = useState<Tag[]>([]);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [requests, setRequests] = useState<BountyRequest[] | null>(null);

  useEffect(() => {
    void get<{ tags: Tag[] }>('/tavern/tags').then((result) => setTags(result.tags));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setOffers(null);
      setRequests(null);
      void Promise.all([
        get<{ items: Offer[] }>(`/tavern/offers${qs({ q, tag, evidence, sort, pageSize: 30 })}`).then((result) => setOffers(result.items)),
        get<{ items: BountyRequest[] }>(`/tavern/requests${qs({ q, tag, pageSize: 30 })}`).then((result) => setRequests(result.items)),
      ]);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [q, tag, evidence, sort]);

  return (
    <div className="tavern stack" style={{ gap: 20 }}>
      <TavernNotice />
      <div className="page-head">
        <div>
          <div className="eyebrow">THE TAVERN · ANONYMOUS LEADS &amp; BOUNTIES</div>
          <h1 className="page-title">The Tavern</h1>
          <div className="tavern-slogan">Super Smash Beefers</div>
          <div className="page-sub">Trade whispers by the fire. Tips are pinned to the notice wall, while bounties wait at the keeper’s desk.</div>
        </div>
        <div className="row">
          <Link to="/tavern/rules" className="btn">House Rules</Link>
          {user && !user.readOnly && <Link to="/tavern/compose" className="btn btn--primary">＋ Post to the wall</Link>}
        </div>
      </div>

      <div className="card card--pad stack tavern-market__filters">
        <div className="row">
          <div className="tavern-market__mobile-tabs row" style={{ gap: 4 }}>
            <button className={`chip ${mode === 'offers' ? 'chip--on' : ''}`} onClick={() => setMode('offers')}>Tips for sale</button>
            <button className={`chip ${mode === 'requests' ? 'chip--on' : ''}`} onClick={() => setMode('requests')}>Reporting requests</button>
          </div>
          <SearchBox value={q} onChange={setQ} placeholder="Search titles, summaries, tags and mask names…" />
        </div>
        <div className="row" style={{ gap: 6 }}>
          <span className="muted">Evidence:</span>
          <button className={`chip ${evidence === '' ? 'chip--on' : ''}`} onClick={() => setEvidence('')}>Any</button>
          <button className={`chip chip--evidence ${evidence === 'yes' ? 'chip--on' : ''}`} onClick={() => setEvidence('yes')}>Detailed evidence</button>
          <button className={`chip chip--noevidence ${evidence === 'no' ? 'chip--on' : ''}`} onClick={() => setEvidence('no')}>No detailed evidence</button>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {tags.filter((value) => value.kind !== 'system').map((value) => (
            <TagChip key={value.id} label={`${value.label}${value.usage ? ` ${value.usage}` : ''}`} active={tag === value.label} onClick={() => setTag(tag === value.label ? '' : value.label)} />
          ))}
        </div>
      </div>

      <div className="tavern-market">
        <section className={`tavern-market__column ${mode !== 'offers' ? 'tavern-market__panel--inactive' : ''}`}>
          <div className="tavern-market__heading">
            <div>
              <div className="eyebrow">THE NOTICE WALL</div>
              <h2>Tips for sale</h2>
            </div>
            <select className="select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort tips">
              <option value="new">Newest posts</option>
              <option value="cheap">Lowest price</option>
              <option value="hot">Most viewed</option>
            </select>
          </div>
          <div className="tavern-market__list">
            {!offers ? <Spinner label="Reading the wall" /> : offers.length === 0
              ? <Empty icon="📜" title="The wall is empty" hint="Try another search or post the first lead." />
              : offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
          </div>
        </section>

        <section className={`tavern-market__column tavern-market__column--requests ${mode !== 'requests' ? 'tavern-market__panel--inactive' : ''}`}>
          <div className="tavern-market__heading">
            <div>
              <div className="eyebrow">THE KEEPER’S DESK</div>
              <h2>Reporting requests</h2>
            </div>
            <span className="chip">{requests?.length ?? 0} open</span>
          </div>
          <div className="tavern-market__list">
            {!requests ? <Spinner label="Checking open requests" /> : requests.length === 0
              ? <Empty icon="📌" title="No open reporting requests" hint="Post a bounty for something people should know." />
              : requests.map((request) => <RequestCard key={request.id} request={request} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
