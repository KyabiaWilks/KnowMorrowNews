import { useCallback, useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTomato } from '../context/TomatoContext';
import { Spinner } from '../components/ui';
import { TomatoIcon } from '../components/TomatoIcon';

type Candidate = { id: string; side: 'left' | 'right'; name: string; nationality: string; organization: string; slogan: string; image: string };
type VoteData = { event: { id: string; title: string; subtitle: string; status: string; candidates: Candidate[] }; counts: Record<string, number>; totalVotes: number; myManualVote: string | null };

export default function LeadershipVotePage() {
  const { user } = useAuth();
  const tomato = useTomato();
  const toast = useToast();
  const [data, setData] = useState<VoteData | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => void get<VoteData>('/events/leadership-2026').then(setData), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refreshResults = () => window.setTimeout(load, 180);
    window.addEventListener('know-morrow:tomato-thrown', refreshResults);
    return () => window.removeEventListener('know-morrow:tomato-thrown', refreshResults);
  }, [load]);
  if (!data) return <Spinner label="Opening the ballot" />;

  const submit = async () => {
    if (!selected) return toast.push('Choose a candidate before submitting your ballot.', 'bad');
    setBusy(true);
    try {
      const result = await post<VoteData>('/events/leadership-2026/vote', { candidateId: selected });
      setData(result);
      toast.push('Your manual ballot has been recorded.', 'good');
    } catch (error) { toast.push((error as Error).message, 'bad'); }
    finally { setBusy(false); }
  };

  return <div className="vote-event stack">
    <header className="vote-event__head">
      <div className="eyebrow">KNOW MORROW PUBLIC BALLOT · LIVE</div>
      <h1>{data.event.title}</h1>
      <p>{data.event.subtitle}</p>
      <div className="vote-event__instruction"><TomatoIcon size={24} /> Arm “Throw a tomato,” then throw on the left or right half to support that leader. Each tomato counts as one vote.</div>
    </header>
    <div className="vote-event__arena">
      {data.event.candidates.map((candidate) => {
        const count = data.counts[candidate.id] || 0;
        const percent = data.totalVotes ? Math.round(count / data.totalVotes * 1000) / 10 : 0;
        return <article key={candidate.id} className={`vote-candidate vote-candidate--${candidate.side}`}>
          <div className="vote-candidate__side">{candidate.side.toUpperCase()} SIDE</div>
          <img src={candidate.image} alt={candidate.name} />
          <div className="vote-candidate__body">
            <h2>{candidate.name}</h2>
            <dl><div><dt>Nationality</dt><dd>{candidate.nationality}</dd></div><div><dt>Organization</dt><dd>{candidate.organization}</dd></div></dl>
            <blockquote>“{candidate.slogan}”</blockquote>
            <div className="vote-candidate__score"><strong>{count.toLocaleString()}</strong><span>votes · {percent}%</span></div>
            <button className={`btn ${selected === candidate.id ? 'btn--primary' : ''}`} onClick={() => setSelected(candidate.id)} disabled={!!data.myManualVote}>Choose {candidate.name}</button>
          </div>
        </article>;
      })}
    </div>
    <section className="card card--pad vote-event__ballot">
      <div><div className="eyebrow">MANUAL BALLOT</div><strong>{data.myManualVote ? `Recorded for ${data.event.candidates.find((candidate) => candidate.id === data.myManualVote)?.name}` : 'Select either leader above'}</strong><div className="muted">One manual ballot per account. Tomato votes remain available separately.</div></div>
      {!data.myManualVote && <button className="btn btn--primary" disabled={!user || user.readOnly || !selected || busy} onClick={() => void submit()}>{busy ? 'Submitting…' : user ? 'Submit ballot' : 'Sign in to vote'}</button>}
    </section>
    {!tomato.enabled && <div className="notice-banner">Tomatoes are currently hidden. Turn “Tomatoes on” back on to use tomato voting.</div>}
  </div>;
}
