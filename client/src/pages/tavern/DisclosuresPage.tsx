import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../../lib/api';
import { Empty, Spinner } from '../../components/ui';
import { fmtTime } from '../../lib/format';

type Disclosure = { id: string; subject: string; aliases: string[]; statement: string; severity: string; publishedAt: string };

export default function DisclosuresPage() {
  const [items, setItems] = useState<Disclosure[] | null>(null);
  useEffect(() => { void get<{ items: Disclosure[] }>('/tavern/disclosures').then((result) => setItems(result.items)); }, []);
  return (
    <div className="tavern">
      <div className="tavern-disclosures stack">
        <header>
          <div className="eyebrow">PUBLIC NOTICE</div>
          <h1 className="page-title">Public disclosures</h1>
          <div className="page-sub">Only severe cases upheld through arbitration appear here. When disclosure is ordered, every mask attached to the account is listed.</div>
        </header>
        {!items ? <Spinner /> : items.length === 0 ? (
          <div className="card card--pad">
            <Empty icon="📜" title="The notice board is empty" hint="No case has met the threshold for public disclosure." />
          </div>
        ) : items.map((item) => (
          <article key={item.id} className="card card--pad stack tavern-disclosure">
            <div className="row row--between"><strong>Account {item.subject}</strong><span className="chip chip--danger">{item.severity === 'severe' ? 'Severe' : item.severity === 'major' ? 'Major' : 'Minor'}</span></div>
            <div className="soft">{item.statement}</div>
            <div className="row tavern-disclosure__aliases"><span className="muted">Associated masks:</span>{item.aliases.map((alias) => <span key={alias} className="chip chip--danger">{alias}</span>)}</div>
            <div className="muted">Published {fmtTime(item.publishedAt)}</div>
          </article>
        ))}
        <div className="tavern-rules__actions"><Link to="/tavern" className="btn btn--primary">Enter the Tavern</Link><Link to="/tavern/rules" className="btn">Read house rules</Link></div>
      </div>
    </div>
  );
}
