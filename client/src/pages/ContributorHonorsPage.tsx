import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import type { JournalistCard } from '../lib/types';
import { Empty, Spinner } from '../components/ui';
import { ContributorName } from '../components/ContributorName';

type Memorial = { id: string; name: string; minecraftId: string | null; avatar: string | null; departedAt: string };
type Friend = { id: string; name: string; username: string | null; title: string; contribution: string; avatar: string | null; registered: boolean; initialTmt: number };
type Honors = { hallOfFame: JournalistCard[]; friends: Friend[]; memorials: Memorial[] };
const COPY = {
  hallOfFame: { eyebrow: 'HALL OF FAME', title: 'Stars of Know Morrow', text: 'Public figures whose work and presence became part of the paper’s history.', empty: 'The Hall of Fame is awaiting its first name' },
  friends: { eyebrow: 'FRIENDS OF THE PAPER', title: 'Outstanding contributors', text: 'People whose time, craft, and trust materially strengthened Know Morrow News.', empty: 'No friends have been listed yet' },
  memorials: { eyebrow: 'MEMORIAL HALL', title: 'Players who have departed', text: 'Their accounts are preserved as read-only records, and their names remain with us.', empty: 'The Memorial Hall is quiet' },
} as const;

export default function ContributorHonorsPage({ kind }: { kind: keyof Honors }) {
  const [honors, setHonors] = useState<Honors | null>(null);
  useEffect(() => { void get<{ honors: Honors }>('/journalists').then((result) => setHonors(result.honors)); }, []);
  const copy = COPY[kind];
  if (!honors) return <Spinner />;
  return <div className="stack" style={{ gap: 22 }}>
    <Link to="/journalists" className="muted">← Back to Contributors</Link>
    <div className="page-head"><div><div className="eyebrow">{copy.eyebrow}</div><h1 className="page-title">{copy.title}</h1><div className="page-sub">{copy.text}</div></div></div>
    {kind === 'memorials' ? honors.memorials.length === 0 ? <Empty title={copy.empty} /> : <div className="grid grid--3">{honors.memorials.map((person) => <article className="card card--pad row" key={person.id}>{person.avatar ? <img className="mc-avatar" src={person.avatar} alt="" /> : <div className="jnl-portrait">{person.name.slice(0, 1)}</div>}<div><h3>{person.name}</h3>{person.minecraftId && <div className="muted">Minecraft: {person.minecraftId}</div>}<div className="muted">Remembered since {new Date(person.departedAt).toLocaleDateString()}</div></div></article>)}</div>
      : kind === 'friends' ? honors.friends.length === 0 ? <Empty title={copy.empty} /> : <div className="grid grid--3">{honors.friends.map((person) => <article className="card card--pad contributor-friend" key={person.id}>{person.avatar ? <img className="contributor-friend__avatar" src={person.avatar} alt="" /> : <div className="jnl-portrait">{person.name.slice(0, 1)}</div>}<div><div className="row row--between"><h2><ContributorName contributor>{person.name}</ContributorName></h2>{person.registered && <span className="chip chip--good">Registered</span>}</div><div className="muted">{person.title}</div><p>{person.contribution}</p>{person.initialTmt > 0 && <div className="chip">Initial recognition award · {person.initialTmt} TMT</div>}</div></article>)}</div>
        : honors.hallOfFame.length === 0 ? <Empty title={copy.empty} /> : <div className="grid grid--3">{honors.hallOfFame.map((person) => <Link className="card card--pad card--hover" to={`/journalists/${person.id}`} key={person.id}><div className="jnl-portrait" style={{ background: `linear-gradient(135deg, ${person.portraitTone}, #0b2545)` }}>{person.name.slice(0, 1)}</div><h2>{person.name}</h2><div className="muted">{person.title}</div><p className="soft">“{person.tagline}”</p></Link>)}</div>}
  </div>;
}
