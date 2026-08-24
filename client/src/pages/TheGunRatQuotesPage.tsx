import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import type { NewsItem } from '../lib/types';
import { Empty, Spinner } from '../components/ui';
import { fmtEasternDate } from '../lib/format';
import { TomatoIcon } from '../components/TomatoIcon';

export default function TheGunRatQuotesPage() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  useEffect(() => { void get<{ items: NewsItem[] }>('/news?series=thegunrat-quotes&pageSize=50').then((result) => setItems(result.items)); }, []);

  return <div className="stack thegunrat-quotes-page" style={{ gap: 20 }}>
    <Link to="/news" className="muted">← Back to News</Link>
    <header className="thegunrat-quotes-head">
      <div className="eyebrow">A KNOW MORROW COLUMN</div>
      <h1>TheGunRat Quotes</h1>
      <p>Dispatches, observations, and stories from TheGunRat.</p>
    </header>
    {!items ? <Spinner /> : items.length === 0 ? <Empty title="No quotes have been published yet" /> : <div className="grid grid--3">{items.map((article) => <Link key={article.id} to={`/news/${article.slug}`} className="card card--hover news-card thegunrat-quote-card">
      <div className="article-card__cover"><span>TheGunRat Quotes</span></div>
      <div className="stack" style={{ padding: 18 }}><h3 style={{ fontSize: 18 }}>{article.title}</h3><p className="muted" style={{ margin: 0 }}>{article.summary}</p><div className="row row--between muted"><span>TheGunRat</span><span className="row"><TomatoIcon size={18} /> {article.tomatoTips.toLocaleString('en-US', { maximumFractionDigits: 2 })} · {fmtEasternDate(article.publishedAt)} ET</span></div></div>
    </Link>)}</div>}
  </div>;
}
