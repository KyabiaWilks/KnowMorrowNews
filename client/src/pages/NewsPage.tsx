import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, qs } from '../lib/api';
import type { NewsItem } from '../lib/types';
import { Empty, SearchBox, Spinner, TagChip } from '../components/ui';
import { fmtDate } from '../lib/format';

type Facets = { sections: string[]; tags: { label: string; count: number }[]; total: number };

export default function NewsPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [q, setQ] = useState(params.get('q') || '');
  const section = params.get('section') || 'all';
  const tag = params.get('tag') || '';
  const sort = params.get('sort') || 'new';
  const page = Number(params.get('page') || 1);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      q ? next.set('q', q) : next.delete('q');
      next.delete('page');
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => { void get<Facets>('/news/facets').then(setFacets); }, []);
  const query = useMemo(() => qs({ q: params.get('q') || '', section, tag, sort, page, pageSize: 9 }), [params, section, tag, sort, page]);
  useEffect(() => {
    setItems(null);
    void get<{ items: NewsItem[]; total: number }>(`/news${query}`).then((result) => { setItems(result.items); setTotal(result.total); });
  }, [query]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value && value !== 'all' ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };
  const pages = Math.ceil(total / 9);

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head"><div><div className="eyebrow">THE LATEST</div><h1 className="page-title">News</h1><div className="page-sub">{facets?.total ?? '—'} published articles, fully searchable.</div></div></div>
    <div className="card card--pad stack">
      <div className="row">
        <SearchBox value={q} onChange={setQ} placeholder="Search headlines, summaries, articles and contributors…" />
        <select className="select" style={{ width: 170 }} value={sort} onChange={(event) => setParam('sort', event.target.value)}>
          <option value="new">Newest first</option><option value="tomatoes">Most tomato tips</option><option value="hot">Most read</option><option value="old">Oldest first</option>
        </select>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button className={`chip ${section === 'all' ? 'chip--on' : ''}`} onClick={() => setParam('section', 'all')}>All sections</button>
        {facets?.sections.map((value) => <button key={value} className={`chip ${section === value ? 'chip--on' : ''}`} onClick={() => setParam('section', value)}>{value}</button>)}
      </div>
      <div className="row" style={{ gap: 6 }}>{facets?.tags.slice(0, 14).map((value) => <TagChip key={value.label} label={`${value.label} ${value.count}`} active={tag === value.label} onClick={() => setParam('tag', tag === value.label ? '' : value.label)} />)}</div>
    </div>
    {!items ? <Spinner /> : items.length === 0 ? <Empty title="No news matched your search" hint="Try another phrase or clear the filters." /> : <>
      <div className="muted">{total} {total === 1 ? 'article' : 'articles'} found</div>
      <div className="grid grid--3">{items.map((article) => <Link key={article.id} to={`/news/${article.id}`} className="card card--hover" style={{ overflow: 'hidden' }}>
        <div className="article-card__cover"><span>{article.section}</span></div>
        <div style={{ padding: 18 }} className="stack"><h3 style={{ fontSize: 17.5 }}>{article.title}</h3><p className="muted" style={{ fontSize: 13.5, margin: 0 }}>{article.summary}</p>
          <div className="row" style={{ gap: 6 }}>{article.tags.slice(0, 3).map((value) => <TagChip key={value} label={value} />)}</div>
          <div className="row row--between muted"><span>{article.authors.join(' · ') || 'Know Morrow Editorial Desk'}</span><span>🍅 {article.tomatoTips.toLocaleString('en-US', { maximumFractionDigits: 2 })} · {fmtDate(article.publishedAt)}</span></div>
        </div>
      </Link>)}</div>
      {pages > 1 && <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>{Array.from({ length: pages }, (_, index) => index + 1).map((value) => <button key={value} className={`chip ${value === page ? 'chip--on' : ''}`} onClick={() => setParam('page', String(value))}>{value}</button>)}</div>}
    </>}
  </div>;
}
