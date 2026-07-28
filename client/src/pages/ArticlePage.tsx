import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post } from '../lib/api';
import type { Article, NewsItem } from '../lib/types';
import { Spinner, TagChip } from '../components/ui';
import { fmtDate, tmt } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { TomatoIcon } from '../components/TomatoIcon';

export default function ArticlePage() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ article: Article; related: NewsItem[] } | null>(null);
  const [error, setError] = useState('');
  const [tipAmount, setTipAmount] = useState(1);
  const [tipping, setTipping] = useState(false);
  useEffect(() => { setData(null); void get<{ article: Article; related: NewsItem[] }>(`/news/${id}`).then(setData).catch((reason) => setError(reason.message)); }, [id]);
  if (error) return <div className="empty">{error}</div>;
  if (!data) return <Spinner />;
  const { article, related } = data;
  const tipStory = async () => {
    if (!user) {
      toast.push('Sign in before tipping a news article.', 'bad');
      return;
    }
    setTipping(true);
    try {
      const result = await post<{ tomatoTips: number }>(`/news/${article.id}/tip`, { amount: tipAmount });
      setData((current) => current ? { ...current, article: { ...current.article, tomatoTips: result.tomatoTips } } : current);
      await refresh();
      toast.push(`You tipped this news article ${tmt(tipAmount)}.`, 'good');
    } catch (reason) {
      toast.push((reason as Error).message, 'bad');
    } finally {
      setTipping(false);
    }
  };
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 34, alignItems: 'start' }}>
    <article><div className="eyebrow">{article.section}</div><h1 style={{ fontSize: 34, margin: '10px 0 14px' }}>{article.title}</h1><p className="soft" style={{ fontSize: 17 }}>{article.summary}</p>
      <div className="row muted" style={{ gap: 14, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}><span>{article.dateline || 'Know Morrow News'}</span><span>{fmtDate(article.publishedAt)}</span><span>{article.readingMinutes} min read</span><span>{article.views} views</span></div>
      <div className="article-body" style={{ marginTop: 24 }}>{article.body.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      <div className="row" style={{ gap: 6, marginTop: 26 }}>{article.tags.map((value) => <Link key={value} to={`/news?tag=${encodeURIComponent(value)}`}><TagChip label={value} /></Link>)}</div>
    </article>
    <aside className="stack" style={{ position: 'sticky', top: 'calc(var(--header-h) + 20px)' }}>
      <div className="card card--pad stack"><div className="eyebrow">CONTRIBUTORS</div>{article.authorCards.map((author) => <Link key={author.id} to={`/journalists/${author.id}`} className="row" style={{ gap: 11 }}><div className="jnl-portrait" style={{ width: 44, height: 44, fontSize: 17, background: 'linear-gradient(135deg,#2f6bff,#0b2545)' }}>{author.name.slice(0, 1)}</div><div><div style={{ fontWeight: 700, fontSize: 14 }}>{author.name}</div><div className="muted">{author.title}</div></div></Link>)}{article.authorCards.length === 0 && <div className="muted">Know Morrow Editorial Desk</div>}</div>
      <div className="card card--pad stack">
        <div className="tomato-tip-heading"><TomatoIcon variant={4} size={58} /><div><div className="eyebrow">TIP WITH TOMATOES</div><strong style={{ fontSize: 20 }}>{article.tomatoTips.toLocaleString('en-US', { maximumFractionDigits: 2 })} TMT</strong></div></div>
        <div className="muted">Reward reporting with at least 1 TMT.</div>
        <input className="input" type="number" min={1} max={100000} step={1} value={tipAmount} onChange={(event) => setTipAmount(Math.max(1, Number(event.target.value) || 1))} />
        <button className="btn btn--primary btn--block" disabled={tipping || user?.readOnly} onClick={tipStory}>{tipping ? 'Sending…' : user ? 'Tip this news' : 'Sign in to tip'}</button>
      </div>
      {related.length > 0 && <div className="card card--pad stack"><div className="eyebrow">RELATED NEWS</div>{related.map((item) => <Link key={item.id} to={`/news/${item.id}`} className="stack" style={{ gap: 3 }}><div style={{ fontWeight: 650, fontSize: 14 }}>{item.title}</div><div className="muted">{fmtDate(item.publishedAt)}</div></Link>)}</div>}
      <div className="card card--pad"><div className="eyebrow">HAVE A LEAD?</div><p className="muted" style={{ marginTop: 8 }}>Bring it to the Tavern. Confidential submissions can be filed under a mask.</p><Link to="/tavern/compose" className="btn btn--sm btn--primary btn--block">Submit a tip</Link></div>
    </aside>
  </div>;
}
