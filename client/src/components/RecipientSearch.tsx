import { useEffect, useRef, useState } from 'react';
import { get, qs } from '../lib/api';

export type RecipientMatch = {
  id: string;
  username: string;
  displayName: string;
  minecraftId: string | null;
  minecraftUuid: string | null;
  avatar: string | null;
  matchedBy: string;
  mask: { alias: string; sigil: string } | null;
};

export function RecipientSearch({ value, onChange }: { value: RecipientMatch | null; onChange: (recipient: RecipientMatch | null) => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<RecipientMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
    const sequence = ++requestSequence.current;
    if (value || normalized.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => {
      void get<{ items: RecipientMatch[] }>(`/wallet/recipients${qs({ q: normalized })}`)
        .then((result) => {
          if (sequence === requestSequence.current) setItems(result.items);
        })
        .catch(() => {
          if (sequence === requestSequence.current) setItems([]);
        })
        .finally(() => {
          if (sequence === requestSequence.current) setLoading(false);
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [query, value]);

  if (value) return <div className="recipient-selected">
    <RecipientAvatar recipient={value} />
    <div style={{ flex: 1 }}><strong>{value.displayName}</strong><div className="muted">@{value.username}{value.minecraftId ? ` · MC ${value.minecraftId}` : ''}</div></div>
    <button className="btn btn--sm" onClick={() => { onChange(null); setQuery(''); }}>Change</button>
  </div>;

  return <div className="recipient-search">
    <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nickname, user ID, MC ID or mask…" />
    {query.trim().length >= 1 && <div className="recipient-results">
      {items.map((recipient) => <button type="button" key={recipient.id} className="recipient-result" onClick={() => onChange(recipient)}>
        <RecipientAvatar recipient={recipient} />
        <span style={{ flex: 1 }}><strong>{recipient.displayName}</strong><span className="muted">@{recipient.username}{recipient.minecraftId ? ` · MC ${recipient.minecraftId}` : ''}</span></span>
        <span className="chip">{recipient.matchedBy}</span>
      </button>)}
      {!loading && items.length === 0 && <div className="muted" style={{ padding: 12 }}>No matching recipient.</div>}
      {loading && <div className="muted" style={{ padding: 12 }}>Searching…</div>}
    </div>}
  </div>;
}

function RecipientAvatar({ recipient }: { recipient: RecipientMatch }) {
  return <span className="recipient-avatar">
    {recipient.mask ? <span title={recipient.mask.alias}>{recipient.mask.sigil}</span> : recipient.avatar ? <img src={recipient.avatar} alt="" /> : recipient.displayName.slice(0, 1).toUpperCase()}
  </span>;
}
