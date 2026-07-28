import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../lib/api';
import type { Article, NewsItem } from '../lib/types';
import { Spinner, TagChip } from '../components/ui';
import { fmtDate } from '../lib/format';

export default function ArticlePage() {
  const { id } = useParams();
  const [data, setData] = useState<{ article: Article; related: NewsItem[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setData(null); void get<{ article: Article; related: NewsItem[] }>(`/news/${id}`).then(setData).catch((reason) => setError(reason.message)); }, [id]);
  if (error) return <div className="empty">{error}</div>;
  if (!data) return <Spinner />;
  const { article, related } = data;
  return <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 280px', gap: 34, alignItems: 'start' }}>
    <article><div className="eyebrow">{article.section}</div><h1 style={{ fontSize: 34, margin: '10px 0 14px' }}>{article.title}</h1><p className="soft" style={{ fontSize: 17 }}>{article.summary}</p>
      <div className="row muted" style={{ gap: 14, paddingBottom: 16, borderBottom: '1px solid var(--line)' }}><span>{article.dateline || 'Know Morrow News'}</span><span>{fmtDate(article.publishedAt)}</span><span>{article.readingMinutes} min read</span><span>{article.views} views</span></div>
      <div className="article-body" style={{ marginTop: 24 }}>{article.body.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      <div className="row" style={{ gap: 6, marginTop: 26 }}>{article.tags.map((value) => <Link key={value} to={`/news?tag=${encodeURIComponent(value)}`}><TagChip label={value} /></Link>)}</div>
    </article>
    <aside className="stack" style={{ position: 'sticky', top: 'calc(var(--header-h) + 20px)' }}>
      <div className="card card--pad stack"><div className="eyebrow">CONTRIBUTORS</div>{article.authorCards.map((author) => <Link key={author.id} to={`/journalists/${author.id}`} className="row" style={{ gap: 11 }}><div className="jnl-portrait" style={{ width: 44, height: 44, fontSize: 17, background: 'linear-gradient(135deg,#2f6bff,#0b2545)' }}>{author.name.slice(0, 1)}</div><div><div style={{ fontWeight: 700, fontSize: 14 }}>{author.name}</div><div className="muted">{author.title}</div></div></Link>)}{article.authorCards.length === 0 && <div className="muted">Know Morrow Editorial Desk</div>}</div>
      {related.length > 0 && <div className="card card--pad stack"><div className="eyebrow">RELATED STORIES</div>{related.map((item) => <Link key={item.id} to={`/news/${item.id}`} className="stack" style={{ gap: 3 }}><div style={{ fontWeight: 650, fontSize: 14 }}>{item.title}</div><div className="muted">{fmtDate(item.publishedAt)}</div></Link>)}</div>}
      <div className="card card--pad"><div className="eyebrow">HAVE A LEAD?</div><p className="muted" style={{ marginTop: 8 }}>Bring it to the Tavern. Confidential submissions can be filed under a mask.</p><Link to="/tavern/compose" className="btn btn--sm btn--primary btn--block">Submit a tip</Link></div>
    </aside>
  </div>;
}
