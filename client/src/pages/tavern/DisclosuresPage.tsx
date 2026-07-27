import { useEffect, useState } from 'react';
import { get } from '../../lib/api';
import { Empty, Spinner } from '../../components/ui';
import { fmtTime } from '../../lib/format';
type Disclosure = { id: string; subject: string; aliases: string[]; statement: string; severity: string; publishedAt: string };
export default function DisclosuresPage() {
  const [items, setItems] = useState<Disclosure[] | null>(null);
  useEffect(() => { void get<{ items: Disclosure[] }>('/tavern/disclosures').then((result) => setItems(result.items)); }, []);
  return <div className="tavern stack" style={{ gap: 18, maxWidth: 860, margin: '0 auto' }}>
    <div><div className="eyebrow">PUBLIC NOTICE</div><h1 className="page-title" style={{ color: '#f2f6ff' }}>Public disclosures</h1><div className="page-sub" style={{ color: '#8ba4cf' }}>Only severe cases upheld through arbitration appear here. When disclosure is ordered, every mask attached to the account is listed.</div></div>
    {!items ? <Spinner /> : items.length === 0 ? <Empty icon="🕊️" title="The notice board is empty" hint="No case has met the threshold for public disclosure." /> : items.map((item) => <div key={item.id} className="card card--pad stack" style={{ borderColor: 'rgba(217,74,61,.45)' }}><div className="row row--between"><strong style={{ fontSize: 17 }}>Account {item.subject}</strong><span className="chip chip--danger">{item.severity === 'severe' ? 'Severe' : item.severity === 'major' ? 'Major' : 'Minor'}</span></div><div className="soft">{item.statement}</div><div className="row" style={{ gap: 6 }}><span className="muted">Associated masks:</span>{item.aliases.map((alias) => <span key={alias} className="chip chip--danger">{alias}</span>)}</div><div className="muted">Published {fmtTime(item.publishedAt)}</div></div>)}
  </div>;
}
