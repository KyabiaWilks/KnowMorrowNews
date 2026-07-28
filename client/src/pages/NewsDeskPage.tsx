import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../lib/format';

type NewsRow = { id: string; title: string; summary: string; section: string; status: string; publishedAt: string };
type JournalistOption = { id: string; name: string };
const initial = { title: '', summary: '', body: '', section: 'News', dateline: 'Know Morrow News Desk', tags: '', status: 'published', authorIds: [] as string[] };

export default function NewsDeskPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<NewsRow[] | null>(null);
  const [journalists, setJournalists] = useState<JournalistOption[]>([]);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const load = () => get<{ items: NewsRow[]; journalists: JournalistOption[] }>('/editor/news').then((result) => {
    setItems(result.items);
    setJournalists(result.journalists);
  });
  useEffect(() => { void load(); }, []);
  const submit = async () => {
    setSaving(true);
    try {
      await post('/editor/news', { ...form, tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });
      toast.push(form.status === 'draft' ? 'News draft saved.' : 'News article published.', 'good');
      setForm(initial);
      await load();
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  };
  if (!items) return <Spinner />;
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head"><div><div className="eyebrow">MY DESK · NEWS</div><h1 className="page-title">News Desk</h1><div className="page-sub">Prepare reporting for the public News section.</div></div><Link className="btn" to="/desk">← All desks</Link></div>
      {user?.readOnly ? <div className="notice-banner">Your administrator role is read-only. Existing news is visible, but publishing is disabled.</div> : (
        <section className="card card--pad stack">
          <h2>Write news</h2>
          <label className="field"><span>Headline</span><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label className="field"><span>Summary</span><input className="input" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
          <div className="grid grid--2">
            <label className="field"><span>Section</span><input className="input" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} /></label>
            <label className="field"><span>Dateline</span><input className="input" value={form.dateline} onChange={(event) => setForm({ ...form, dateline: event.target.value })} /></label>
          </div>
          <label className="field"><span>Tags (comma-separated)</span><input className="input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} /></label>
          {user?.siteRole === 'admin' && <div className="field"><span>Contributors</span><div className="row">{journalists.map((journalist) => <button type="button" key={journalist.id} className={`chip ${form.authorIds.includes(journalist.id) ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, authorIds: form.authorIds.includes(journalist.id) ? form.authorIds.filter((id) => id !== journalist.id) : [...form.authorIds, journalist.id] })}>{journalist.name}</button>)}</div></div>}
          <label className="field"><span>Article body</span><textarea className="textarea" style={{ minHeight: 280 }} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          <div className="row row--between"><select className="select" style={{ width: 170 }} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="published">Publish now</option><option value="draft">Save as draft</option></select><button className="btn btn--primary" disabled={saving || !form.title.trim() || !form.body.trim()} onClick={submit}>{saving ? 'Saving…' : form.status === 'draft' ? 'Save draft' : 'Publish news'}</button></div>
        </section>
      )}
      <section className="card card--pad stack"><h2>{user?.siteRole === 'journalist' ? 'My news' : 'All news'}</h2>{items.length === 0 ? <div className="muted">No news has been created yet.</div> : items.map((item) => <div key={item.id} className="row row--between" style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}><div><Link to={`/news/${item.id}`} style={{ fontWeight: 700 }}>{item.title}</Link><div className="muted">{item.section} · {item.status}</div></div><span className="muted">{fmtDate(item.publishedAt)}</span></div>)}</section>
    </div>
  );
}
