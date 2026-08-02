import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, qs } from '../lib/api';
import type { JournalistCard } from '../lib/types';
import { Empty, SearchBox, Spinner } from '../components/ui';

export default function JournalistsPage() {
  const [q, setQ] = useState('');
  const [beat, setBeat] = useState('all');
  const [items, setItems] = useState<JournalistCard[] | null>(null);
  const [beats, setBeats] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void get<{ items: JournalistCard[]; beats: string[] }>(`/journalists${qs({ q, beat })}`).then((result) => { setItems(result.items); setBeats(result.beats); });
    }, 220);
    return () => clearTimeout(timer);
  }, [q, beat]);

  return <div className="stack" style={{ gap: 22 }}>
    <div className="page-head"><div><div className="eyebrow">THE PEOPLE BEHIND THE BYLINES</div><h1 className="page-title">Contributors</h1><div className="page-sub">Every name carries a record that readers are welcome to question.</div></div></div>
    <div><div className="eyebrow">CONTRIBUTOR DIRECTORY</div><h2>Browse every byline</h2></div>
    <div className="card card--pad stack"><SearchBox value={q} onChange={setQ} placeholder="Search names, beats, published work and awards…" /><div className="row" style={{ gap: 6 }}><button className={`chip ${beat === 'all' ? 'chip--on' : ''}`} onClick={() => setBeat('all')}>All beats</button>{beats.map((value) => <button key={value} className={`chip ${beat === value ? 'chip--on' : ''}`} onClick={() => setBeat(value)}>{value}</button>)}</div></div>
    {!items ? <Spinner /> : items.length === 0 ? <Empty title="No contributors matched your search" /> : <div className="grid grid--2">{items.map((contributor) => <Link key={contributor.id} to={`/journalists/${contributor.id}`} className="card card--pad card--hover" style={{ display: 'flex', gap: 16 }}>
      <div className="jnl-portrait" style={{ background: `linear-gradient(135deg, ${contributor.portraitTone}, #0b2545)` }}>{contributor.name.slice(0, 1)}</div>
      <div className="stack" style={{ gap: 7, flex: 1 }}><div className="row row--between"><div><div style={{ fontWeight: 760, fontSize: 17 }}>{contributor.name}</div><div className="muted">{contributor.title}</div></div>{contributor.featured && <span className="chip chip--warn">★ Featured</span>}</div>
        <div className="soft" style={{ fontSize: 13.5, fontStyle: 'italic' }}>“{contributor.tagline}”</div>
        <div className="row" style={{ gap: 6 }}>{contributor.beats.map((value) => <span key={value} className="chip">{value}</span>)}</div>
        <div className="row muted" style={{ gap: 14 }}><span>📰 {contributor.storyCount} news articles</span><span>🏆 {contributor.awards} awards</span></div>
      </div>
    </Link>)}</div>}
    <div className="divider" />
    <nav className="contributor-honor-nav" aria-label="Contributor honors">
      <Link className="card card--pad card--hover row row--between" to="/journalists/hall-of-fame"><div><div className="eyebrow">HALL OF FAME</div><h2>Stars of Know Morrow</h2></div><span className="btn btn--sm">Enter →</span></Link>
      <Link className="card card--pad card--hover row row--between" to="/journalists/friends"><div><div className="eyebrow">FRIENDS OF THE PAPER</div><h2>Outstanding contributors</h2></div><span className="btn btn--sm">Enter →</span></Link>
      <Link className="card card--pad card--hover row row--between" to="/journalists/memorial"><div><div className="eyebrow">MEMORIAL HALL</div><h2>Players who have departed</h2></div><span className="btn btn--sm">Enter →</span></Link>
    </nav>
  </div>;
}
