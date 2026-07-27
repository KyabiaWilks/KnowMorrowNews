import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, patch } from '../lib/api';
import { Spinner } from '../components/ui';
import { fmtDate } from '../lib/format';
import { useToast } from '../context/ToastContext';

type Award = { name: string; year: number; work?: string };
type Detail = { id: string; name: string; title: string; avatar: string | null; portraitTone: string; tagline: string; bio: string; beats: string[]; contact: string | null; joinedAt: string; awards: Award[] | number; milestones: { year: number; text: string }[]; signatureWorks: { newsId: string; note: string; article: { id: string; title: string } | null }[]; stats: { stories: number; totalViews: number; awards: number }; canEdit: boolean };
type Story = { id: string; title: string; summary: string; publishedAt: string; views: number; section: string };

export default function JournalistPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ journalist: Detail; stories: Story[] } | null>(null);
  const [error, setError] = useState('');
  const [portraitFlipped, setPortraitFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', title: '', tagline: '', bio: '', beats: '', contact: '', avatar: '', portraitTone: '#2f6bff' });
  const toast = useToast();

  useEffect(() => {
    setData(null);
    setError('');
    setPortraitFlipped(false);
    void get<{ journalist: Detail; stories: Story[] }>(`/journalists/${id}`).then(setData).catch((reason) => setError(reason.message));
  }, [id]);

  if (error) return <div className="empty">{error}</div>;
  if (!data) return <Spinner />;

  const contributor = data.journalist;
  const awards: Award[] = Array.isArray(contributor.awards) ? contributor.awards : [];
  const joinedYear = new Date(contributor.joinedAt).getFullYear();
  const beginEdit = () => {
    setDraft({ name: contributor.name, title: contributor.title, tagline: contributor.tagline, bio: contributor.bio, beats: contributor.beats.join(', '), contact: contributor.contact || '', avatar: contributor.avatar || '', portraitTone: contributor.portraitTone });
    setEditing(true);
  };
  const saveProfile = async () => {
    setSaving(true);
    try {
      const result = await patch<{ journalist: Detail }>('/journalists/me/profile', { ...draft, beats: draft.beats.split(',').map((item) => item.trim()).filter(Boolean) });
      setData({ ...data, journalist: { ...contributor, ...result.journalist, canEdit: true } });
      setEditing(false);
      toast.push('Reporter profile updated.', 'good');
    } catch (reason) {
      toast.push((reason as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  };

  return <div className="stack" style={{ gap: 26 }}>
    <div className="card card--pad journalist-hero" style={{ background: `linear-gradient(120deg, ${contributor.portraitTone}14, #fff 55%)` }}>
      <button type="button" className={`portrait-flip${portraitFlipped ? ' portrait-flip--turned' : ''}`} onClick={() => setPortraitFlipped((value) => !value)} aria-label={`${portraitFlipped ? 'Show portrait' : 'Show reporter card'} for ${contributor.name}`} aria-pressed={portraitFlipped}>
        <span className="portrait-flip__inner">
          <span className="portrait-flip__face portrait-flip__front" style={{ background: `linear-gradient(145deg, ${contributor.portraitTone}, #071a35)` }}>
            {contributor.avatar ? <img className="portrait-flip__image" src={contributor.avatar} alt="" /> : <span className="portrait-flip__initial">{contributor.name.slice(0, 1)}</span>}
            <span className="portrait-flip__hint">FLIP</span>
          </span>
          <span className="portrait-flip__face portrait-flip__back">
            <span className="portrait-flip__kicker">PRESS PASS</span>
            <strong>{contributor.name}</strong>
            <span>{contributor.beats.slice(0, 2).join(' · ')}</span>
            <span className="portrait-flip__year">EST. {joinedYear}</span>
          </span>
        </span>
      </button>

      <div className="stack journalist-hero__copy">
        <div><h1 style={{ fontSize: 30 }}>{contributor.name}</h1><div className="soft" style={{ fontWeight: 650 }}>{contributor.title}</div></div>
        <div style={{ fontStyle: 'italic', color: 'var(--ink-soft)' }}>“{contributor.tagline}”</div>
        <div className="row" style={{ gap: 6 }}>{contributor.beats.map((value) => <span key={value} className="chip">{value}</span>)}</div>
        <div className="row muted" style={{ gap: 16 }}><span>Joined {fmtDate(contributor.joinedAt)}</span>{contributor.contact && <span>✉ {contributor.contact}</span>}</div>
        {contributor.canEdit && <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={beginEdit}>Edit reporter profile</button>}
      </div>
      <div className="grid journalist-hero__stats"><div className="card stat"><div className="stat__value">{contributor.stats.stories}</div><div className="stat__label">Stories</div></div><div className="card stat"><div className="stat__value">{contributor.stats.awards}</div><div className="stat__label">Awards</div></div><div className="card stat"><div className="stat__value">{(contributor.stats.totalViews / 1000).toFixed(1)}k</div><div className="stat__label">Views</div></div></div>
    </div>

    {editing && <section className="card card--pad stack reporter-editor">
      <div className="row row--between"><div><div className="eyebrow">PRESS PROFILE</div><h2>Edit your public profile</h2></div><button className="btn btn--sm" onClick={() => setEditing(false)}>Cancel</button></div>
      <div className="grid grid--2">
        <label className="field"><span>Display name</span><input className="input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="field"><span>Title</span><input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label className="field"><span>Beat tags, comma separated</span><input className="input" value={draft.beats} onChange={(event) => setDraft({ ...draft, beats: event.target.value })} /></label>
        <label className="field"><span>Contact</span><input className="input" value={draft.contact} onChange={(event) => setDraft({ ...draft, contact: event.target.value })} /></label>
        <label className="field"><span>Portrait image URL</span><input className="input" value={draft.avatar} onChange={(event) => setDraft({ ...draft, avatar: event.target.value })} /></label>
        <label className="field"><span>Profile color</span><input className="input" type="color" value={draft.portraitTone} onChange={(event) => setDraft({ ...draft, portraitTone: event.target.value })} /></label>
      </div>
      <label className="field"><span>Tagline</span><input className="input" value={draft.tagline} onChange={(event) => setDraft({ ...draft, tagline: event.target.value })} /></label>
      <label className="field"><span>Biography</span><textarea className="textarea" value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} /></label>
      <button className="btn btn--primary" disabled={saving} onClick={saveProfile}>{saving ? 'Saving…' : 'Save public profile'}</button>
    </section>}

    <div className="journalist-layout">
      <div className="stack" style={{ gap: 20 }}>
        <section className="card card--pad"><div className="eyebrow">ABOUT</div><p style={{ marginTop: 10, marginBottom: 0 }}>{contributor.bio}</p></section>
        {contributor.signatureWorks.length > 0 && <section className="card card--pad stack"><div className="eyebrow">SIGNATURE WORK</div>{contributor.signatureWorks.map((work, index) => <div key={index} className="card card--pad" style={{ background: 'var(--blue-50)', borderColor: 'var(--blue-100)' }}>{work.article ? <Link to={`/news/${work.article.id}`} style={{ fontWeight: 720 }}>{work.article.title} →</Link> : <span style={{ fontWeight: 720 }}>This story is no longer available</span>}<div className="muted" style={{ marginTop: 5 }}>{work.note}</div></div>)}</section>}
        <section className="card card--pad stack"><div className="eyebrow">ALL STORIES ({data.stories.length})</div>{data.stories.map((story) => <Link key={story.id} to={`/news/${story.id}`} className="row row--between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}><div style={{ flex: 1, minWidth: 220 }}><div style={{ fontWeight: 650 }}>{story.title}</div><div className="muted">{story.summary}</div></div><div className="muted" style={{ textAlign: 'right' }}><div>{fmtDate(story.publishedAt)}</div><div>{story.views} views</div></div></Link>)}{data.stories.length === 0 && <div className="muted">No published stories yet.</div>}</section>
      </div>
      <aside className="stack">
        <section className="card card--pad"><div className="eyebrow">HONORS</div><div style={{ marginTop: 8 }}>{awards.length === 0 && <div className="muted">No awards on record.</div>}{awards.map((award, index) => <div key={index} className="award"><div style={{ fontSize: 20 }}>🏆</div><div><div style={{ fontWeight: 700, fontSize: 14 }}>{award.name}</div><div className="muted">{award.year}{award.work ? ` · ${award.work}` : ''}</div></div></div>)}</div></section>
        {contributor.milestones.length > 0 && <section className="card card--pad"><div className="eyebrow">CAREER</div><div className="timeline" style={{ marginTop: 12 }}>{contributor.milestones.map((milestone, index) => <div key={index} className="timeline__item"><div className="timeline__year">{milestone.year}</div><div>{milestone.text}</div></div>)}</div></section>}
      </aside>
    </div>
  </div>;
}
