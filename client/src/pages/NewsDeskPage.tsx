import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, patch, post } from '../lib/api';
import { Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtEasternDate } from '../lib/format';
import { NEWS_TAGS } from '../lib/newsTags';
import { ImageUploadButton } from '../components/ImageUploadButton';

type JournalistOption = { id: string; name: string };
type InlineImage = { src: string; alt: string; caption: string; afterParagraph: number };
const initial = { title: '', summary: '', body: '', section: 'News', dateline: 'Know Morrow News Desk', tags: [] as string[], status: 'published', authorIds: [] as string[], illustratorIds: [] as string[], proofreaderIds: [] as string[], cover: null as string | null, visualCredit: '', media: [] as InlineImage[] };
type NewsRow = typeof initial & { id: string; slug: string; publishedAt: string };

export default function NewsDeskPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<NewsRow[] | null>(null);
  const [journalists, setJournalists] = useState<JournalistOption[]>([]);
  const [form, setForm] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qaDraft, setQaDraft] = useState({ questioner: '', respondent: '', question: '', answer: '' });
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'restored'>('idle');
  const [editorialScope, setEditorialScope] = useState<'news' | 'thegunrat-quotes'>('news');
  const [canTestTheGunRatDesk, setCanTestTheGunRatDesk] = useState(false);
  const restoredDraftKey = useRef('');
  const justRestored = useRef(false);
  const skipNextAutosave = useRef(false);
  const draftKey = user?.id ? `know-morrow:news-draft:${user.id}` : '';
  const scopeQuery = searchParams.get('scope') === 'thegunrat-quotes' ? '?scope=thegunrat-quotes' : '';
  const load = () => get<{ items: NewsRow[]; journalists: JournalistOption[]; editorialScope: 'news' | 'thegunrat-quotes'; canTestTheGunRatDesk: boolean }>(`/editor/news${scopeQuery}`).then((result) => {
    setItems(result.items);
    setJournalists(result.journalists);
    setEditorialScope(result.editorialScope);
    setCanTestTheGunRatDesk(result.canTestTheGunRatDesk);
  });
  useEffect(() => { void load(); }, [scopeQuery]);
  useEffect(() => {
    if (!draftKey || restoredDraftKey.current === draftKey) return;
    restoredDraftKey.current = draftKey;
    try {
      const stored = window.localStorage.getItem(draftKey);
      if (stored) {
        const draft = JSON.parse(stored) as { form?: Partial<typeof initial>; qaDraft?: Partial<typeof qaDraft> };
        if (draft.form) setForm({ ...initial, ...draft.form, tags: Array.isArray(draft.form.tags) ? draft.form.tags : [], authorIds: Array.isArray(draft.form.authorIds) ? draft.form.authorIds : [], illustratorIds: Array.isArray(draft.form.illustratorIds) ? draft.form.illustratorIds : [], proofreaderIds: Array.isArray(draft.form.proofreaderIds) ? draft.form.proofreaderIds : [], media: Array.isArray(draft.form.media) ? draft.form.media : [] });
        if (draft.qaDraft) setQaDraft((current) => ({ ...current, ...draft.qaDraft }));
        justRestored.current = true;
        setAutosaveState('restored');
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);
  useEffect(() => {
    if (!draftKey) return;
    if (justRestored.current) { justRestored.current = false; return; }
    if (skipNextAutosave.current) { skipNextAutosave.current = false; return; }
    setAutosaveState('saving');
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), form, qaDraft }));
      setAutosaveState('saved');
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draftKey, form, qaDraft]);
  const paragraphs = form.body.split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  const addInlineImage = (src: string) => setForm((current) => ({
    ...current,
    media: [...current.media, { src, alt: '', caption: '', afterParagraph: Math.max(0, paragraphs.length - 1) }],
  }));
  const updateInlineImage = (index: number, patch: Partial<InlineImage>) => setForm((current) => ({
    ...current,
    media: current.media.map((image, imageIndex) => imageIndex === index ? { ...image, ...patch } : image),
  }));
  const insertQa = () => {
    if (!qaDraft.question.trim() || !qaDraft.answer.trim()) {
      toast.push('Add both a question and an answer.', 'bad');
      return;
    }
    const nextNumber = (form.body.match(/^Q\d+(?:\s+\[[^\]]+\])?:/gm) || []).length + 1;
    const safeName = (value: string, fallback: string) => value.replace(/[\[\]\r\n:]+/g, ' ').trim().slice(0, 60) || fallback;
    const questioner = safeName(qaDraft.questioner, 'Interviewer');
    const respondent = safeName(qaDraft.respondent, 'Respondent');
    const question = qaDraft.question.replace(/\s+/g, ' ').trim();
    const block = `Q${nextNumber} [${questioner}]: ${question}\n[${respondent}]: ${qaDraft.answer.trim()}`;
    setForm((current) => ({ ...current, body: `${current.body.trim()}${current.body.trim() ? '\n\n' : ''}${block}` }));
    setQaDraft({ questioner, respondent, question: '', answer: '' });
    toast.push(`Q${nextNumber} added to the article.`, 'good');
  };
  const editArticle = (item: NewsRow) => {
    setEditingId(item.id);
    setForm({ ...initial, ...item, tags: item.tags || [], authorIds: item.authorIds || [], illustratorIds: item.illustratorIds || [], proofreaderIds: item.proofreaderIds || [], media: item.media || [] });
    setQaDraft({ questioner: '', respondent: '', question: '', answer: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const stopEditing = () => {
    setEditingId(null);
    setForm(initial);
    setQaDraft({ questioner: '', respondent: '', question: '', answer: '' });
  };
  const submit = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        media: form.media.map((image) => ({ ...image, afterParagraph: Math.min(image.afterParagraph, Math.max(0, paragraphs.length - 1)) })),
      };
      if (editingId) await patch(`/editor/news/${editingId}${scopeQuery}`, payload); else await post(`/editor/news${scopeQuery}`, payload);
      toast.push(editingId ? 'News article updated.' : form.status === 'draft' ? 'News draft saved.' : 'News article published.', 'good');
      skipNextAutosave.current = true;
      if (draftKey) window.localStorage.removeItem(draftKey);
      setForm(initial);
      setEditingId(null);
      setQaDraft({ questioner: '', respondent: '', question: '', answer: '' });
      setAutosaveState('idle');
      await load();
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally {
      setSaving(false);
    }
  };
  if (!items) return <Spinner />;
  const isTheGunRatDesk = editorialScope === 'thegunrat-quotes';
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head"><div><div className="eyebrow">MY DESK · {isTheGunRatDesk ? 'THEGUNRAT QUOTES' : 'NEWS'}</div><h1 className="page-title">{isTheGunRatDesk ? 'TheGunRat Quotes Desk' : 'News Desk'}</h1><div className="page-sub">{isTheGunRatDesk ? 'Articles publish only to TheGunRat Quotes. Column balance is calculated automatically.' : 'Prepare reporting for the public News section.'}</div></div><div className="row">{canTestTheGunRatDesk && <button type="button" className="btn" onClick={() => { stopEditing(); const next = new URLSearchParams(searchParams); if (isTheGunRatDesk) next.delete('scope'); else next.set('scope', 'thegunrat-quotes'); setSearchParams(next); }}>{isTheGunRatDesk ? 'Return to full News Desk' : 'Test TheGunRat Desk'}</button>}<Link className="btn" to="/desk">← All desks</Link></div></div>
      {user?.readOnly ? <div className="notice-banner">Your administrator role is read-only. Existing news is visible, but publishing is disabled.</div> : (
        <section className="card card--pad stack">
          <div className="row row--between"><div><h2>{editingId ? 'Edit news' : 'Write news'}</h2>{editingId && <button type="button" className="btn btn--sm" onClick={stopEditing}>Cancel editing</button>}</div><span className={`editor-autosave editor-autosave--${autosaveState}`}>{autosaveState === 'saving' ? 'Saving locally…' : autosaveState === 'restored' ? 'Draft restored' : autosaveState === 'saved' ? 'All changes saved locally' : 'Autosave ready'}</span></div>
          <label className="field"><span>Headline</span><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label className="field"><span>Summary</span><input className="input" value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
          {isTheGunRatDesk && <div className="notice-banner">Destination locked: <strong>TheGunRat Quotes</strong> · Author locked: <strong>TheGunRat</strong></div>}
          {!isTheGunRatDesk && <>
          <div className="grid grid--2">
            <label className="field"><span>Section</span><input className="input" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} /></label>
            <label className="field"><span>Dateline</span><input className="input" value={form.dateline} onChange={(event) => setForm({ ...form, dateline: event.target.value })} /></label>
          </div>
          <div className="field"><span>News categories</span><div className="row">{NEWS_TAGS.map((tag) => { const active = form.tags.includes(tag); return <button type="button" key={tag} className={`chip ${active ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, tags: active ? form.tags.filter((value) => value !== tag) : [...form.tags, tag] })}>{tag}</button>; })}</div></div>
          </>}
          {user?.siteRole === 'admin' && <div className="field"><span>Contributors</span><div className="row">{journalists.map((journalist) => <button type="button" key={journalist.id} className={`chip ${form.authorIds.includes(journalist.id) ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, authorIds: form.authorIds.includes(journalist.id) ? form.authorIds.filter((id) => id !== journalist.id) : [...form.authorIds, journalist.id] })}>{journalist.name}</button>)}</div></div>}
          <div className="field"><span>Illustrators</span><div className="row">{journalists.map((journalist) => <button type="button" key={journalist.id} className={`chip ${form.illustratorIds.includes(journalist.id) ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, illustratorIds: form.illustratorIds.includes(journalist.id) ? form.illustratorIds.filter((id) => id !== journalist.id) : [...form.illustratorIds, journalist.id] })}>{journalist.name}</button>)}</div></div>
          <div className="field"><span>Proofreaders</span><div className="row">{journalists.map((journalist) => <button type="button" key={journalist.id} className={`chip ${form.proofreaderIds.includes(journalist.id) ? 'chip--on' : ''}`} onClick={() => setForm({ ...form, proofreaderIds: form.proofreaderIds.includes(journalist.id) ? form.proofreaderIds.filter((id) => id !== journalist.id) : [...form.proofreaderIds, journalist.id] })}>{journalist.name}</button>)}</div></div>
          <label className="field"><span>Article body</span><textarea className="textarea" style={{ minHeight: 280 }} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
          <section className="qa-builder">
            <div><strong>Q&amp;A dialogue</strong><div className="muted">Create a dedicated question-and-answer bubble and append it to the article.</div></div>
            <div className="grid grid--2">
              <label className="field"><span>Questioner</span><input className="input" value={qaDraft.questioner} onChange={(event) => setQaDraft({ ...qaDraft, questioner: event.target.value })} placeholder="Interviewer name" /></label>
              <label className="field"><span>Respondent</span><input className="input" value={qaDraft.respondent} onChange={(event) => setQaDraft({ ...qaDraft, respondent: event.target.value })} placeholder="Respondent name" /></label>
            </div>
            <label className="field"><span>Question</span><textarea className="textarea" value={qaDraft.question} onChange={(event) => setQaDraft({ ...qaDraft, question: event.target.value })} /></label>
            <label className="field"><span>Answer</span><textarea className="textarea" value={qaDraft.answer} onChange={(event) => setQaDraft({ ...qaDraft, answer: event.target.value })} /></label>
            <button type="button" className="btn" onClick={insertQa}>＋ Add Q&amp;A dialogue</button>
          </section>
          <div className="field news-image-field">
            <span>Cover image</span>
            <div className="muted">Displayed in the feature-image rail of the standard newspaper article template.</div>
            {form.cover && <img className="news-image-preview news-image-preview--cover" src={form.cover} alt="Cover preview" />}
            <div className="row"><ImageUploadButton label={form.cover ? 'Replace cover' : 'Upload cover'} onUploaded={(url) => setForm((current) => ({ ...current, cover: url }))} />{form.cover && <button type="button" className="btn btn--sm" onClick={() => setForm({ ...form, cover: null })}>Remove</button>}</div>
          </div>
          <label className="field"><span>Visual credit</span><input className="input" value={form.visualCredit} onChange={(event) => setForm({ ...form, visualCredit: event.target.value })} placeholder="Photo or artwork credit shown beneath the cover" /></label>
          <div className="field news-image-field">
            <span>Images in the article</span>
            <div className="muted">Separate paragraphs with a blank line, then choose which paragraph each image follows. Images appear full-width with an optional caption.</div>
            <ImageUploadButton label="Upload article image" onUploaded={addInlineImage} />
            {form.media.map((image, index) => <div className="news-inline-image-editor" key={`${image.src}-${index}`}>
              <img className="news-image-preview" src={image.src} alt="Article image preview" />
              <div className="stack" style={{ gap: 10 }}>
                <label className="field"><span>Place after paragraph</span><select className="select" value={Math.min(image.afterParagraph, Math.max(0, paragraphs.length - 1))} onChange={(event) => updateInlineImage(index, { afterParagraph: Number(event.target.value) })} disabled={!paragraphs.length}>{paragraphs.length ? paragraphs.map((paragraph, paragraphIndex) => <option value={paragraphIndex} key={paragraphIndex}>{paragraphIndex + 1}. {paragraph.slice(0, 72)}{paragraph.length > 72 ? '…' : ''}</option>) : <option value={0}>Write the article body first</option>}</select></label>
                <label className="field"><span>Alt text</span><input className="input" value={image.alt} onChange={(event) => updateInlineImage(index, { alt: event.target.value })} placeholder="Describe the image for readers using screen readers" /></label>
                <label className="field"><span>Caption</span><input className="input" value={image.caption} onChange={(event) => updateInlineImage(index, { caption: event.target.value })} placeholder="Optional caption" /></label>
                <button type="button" className="btn btn--sm" onClick={() => setForm((current) => ({ ...current, media: current.media.filter((_, imageIndex) => imageIndex !== index) }))}>Remove image</button>
              </div>
            </div>)}
          </div>
          <div className="row row--between"><select className="select" style={{ width: 170 }} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="published">Publish now</option><option value="draft">Save as draft</option></select><button className="btn btn--primary" disabled={saving || !form.title.trim() || !form.body.trim()} onClick={submit}>{saving ? 'Saving…' : editingId ? 'Update news' : form.status === 'draft' ? 'Save draft' : 'Publish news'}</button></div>
        </section>
      )}
      <section className="card card--pad stack"><h2>{isTheGunRatDesk ? 'My TheGunRat Quotes articles' : user?.siteRole === 'journalist' ? 'My news' : 'All news'}</h2>{items.length === 0 ? <div className="muted">No news has been created yet.</div> : items.map((item) => <div key={item.id} className="row row--between" style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}><div><Link to={`/news/${item.slug}`} style={{ fontWeight: 700 }}>{item.title}</Link><div className="muted">{item.section} · {item.status}</div></div><div className="row"><span className="muted">{fmtEasternDate(item.publishedAt)} ET</span>{!user?.readOnly && <button type="button" className="btn btn--sm" onClick={() => editArticle(item)}>Edit</button>}</div></div>)}</section>
    </div>
  );
}
