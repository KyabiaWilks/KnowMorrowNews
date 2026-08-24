import { useEffect, useState } from 'react';
import { get } from '../lib/api';

export type Advertisement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  href: string | null;
  placement: 'all' | 'home' | 'news';
};

export function AdvertisementSlot({ placement }: { placement: 'home' | 'news' }) {
  const [items, setItems] = useState<Advertisement[]>([]);
  useEffect(() => { void get<{ items: Advertisement[] }>(`/ads?placement=${placement}`).then((result) => setItems(result.items)); }, [placement]);
  if (!items.length) return null;
  return <section className="advertisement-slot" aria-label="Sponsored messages">
    {items.map((item) => {
      const content = <>{item.imageUrl && <img src={item.imageUrl} alt="" />}<div><span className="advertisement-slot__label">ADVERTISEMENT</span><h2>{item.title}</h2>{item.body && <p>{item.body}</p>}</div></>;
      return item.href
        ? <a className="advertisement-slot__item" href={item.href} target="_blank" rel="noopener noreferrer sponsored" key={item.id}>{content}</a>
        : <div className="advertisement-slot__item" key={item.id}>{content}</div>;
    })}
  </section>;
}
