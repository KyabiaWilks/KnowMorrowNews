import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import type { Notification } from '../lib/types';
import { Spinner } from '../components/ui';
import { fmtTime } from '../lib/format';

export default function NotificationsPage() {
  const [data, setData] = useState<{ items: Notification[]; unread: number } | null>(null);
  const load = () => get<{ items: Notification[]; unread: number }>('/notifications').then(setData);
  useEffect(() => { void load(); }, []);
  if (!data) return <Spinner />;

  const readAll = async () => {
    await post('/notifications/read-all');
    await load();
  };

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head">
      <div><div className="eyebrow">NEWSROOM SIGNALS</div><h1 className="page-title">Notifications</h1><div className="page-sub">Replies, transfers and editorial activity addressed to you.</div></div>
      {data.unread > 0 && <button className="btn" onClick={readAll}>Mark all as read</button>}
    </div>
    <div className="stack">
      {data.items.map((item) => {
        const content = <><div className="row row--between"><strong>{item.title}</strong><span className="muted mono">{fmtTime(item.createdAt)}</span></div><div className="soft" style={{ marginTop: 5 }}>{item.message}</div></>;
        return item.href
          ? <Link key={item.id} to={item.href} className={`card card--pad notification-item${item.readAt ? '' : ' notification-item--unread'}`}>{content}</Link>
          : <div key={item.id} className={`card card--pad notification-item${item.readAt ? '' : ' notification-item--unread'}`}>{content}</div>;
      })}
      {data.items.length === 0 && <div className="empty">No notifications yet.</div>}
    </div>
  </div>;
}
