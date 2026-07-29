import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../lib/api';
import type { Notification } from '../lib/types';
import { Spinner } from '../components/ui';
import { fmtTime } from '../lib/format';
import { announceNotificationChange } from '../lib/notificationEvents';

export default function NotificationsPage() {
  const [data, setData] = useState<{ items: Notification[]; unread: number } | null>(null);
  const [preferences, setPreferences] = useState<{ purchaseDelivery: string; pendingReportsDelivery: string } | null>(null);
  const load = () => get<{ items: Notification[]; unread: number }>('/notifications').then(setData);
  useEffect(() => { void load(); void get<{ preferences: { purchaseDelivery: string; pendingReportsDelivery: string } }>('/notifications/preferences').then((result) => setPreferences(result.preferences)); }, []);
  if (!data || !preferences) return <Spinner />;

  const savePreference = async (key: 'purchaseDelivery' | 'pendingReportsDelivery', value: string) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    const result = await post<{ preferences: typeof next }>('/notifications/preferences', { [key]: value });
    setPreferences(result.preferences);
  };

  const readAll = async () => {
    await post('/notifications/read-all');
    const next = await get<{ items: Notification[]; unread: number }>('/notifications');
    setData(next);
    announceNotificationChange(next.unread);
  };

  const readOne = (item: Notification) => {
    if (item.readAt) return;
    setData((current) => current ? {
      ...current,
      unread: Math.max(0, current.unread - 1),
      items: current.items.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry),
    } : current);
    announceNotificationChange(Math.max(0, data.unread - 1));
    void post(`/notifications/${item.id}/read`).catch(() => {
      void load().then(() => announceNotificationChange());
    });
  };

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head">
      <div><div className="eyebrow">TAVERN SIGNALS</div><h1 className="page-title">Notifications</h1><div className="page-sub">Replies, transfers and editorial activity addressed to you.</div></div>
      {data.unread > 0 && <button className="btn" onClick={readAll}>Mark all as read</button>}
    </div>
    <section className="card card--pad stack">
      <div><div className="eyebrow">DELIVERY SETTINGS</div><h2>How should Tavern alerts reach you?</h2></div>
      <div className="grid grid--2">
        <label className="field"><span>Seller purchase alerts</span><select className="select" value={preferences.purchaseDelivery} onChange={(event) => void savePreference('purchaseDelivery', event.target.value)}><option value="site_and_discord">Website + Discord DM</option><option value="site">Website only</option><option value="discord">Discord DM only</option><option value="off">Off</option></select><span className="hint">Used for purchase milestones, selected tier alerts, and buyouts. A muted listing sends nothing.</span></label>
        <label className="field"><span>Unprocessed report reminder</span><select className="select" value={preferences.pendingReportsDelivery} onChange={(event) => void savePreference('pendingReportsDelivery', event.target.value)}><option value="site_and_discord">Website + Discord DM</option><option value="site">Website only</option><option value="discord">Discord DM only</option><option value="off">Off</option></select><span className="hint">Sent once daily at 04:00 GMT+8 only when your requests have pending reports.</span></label>
      </div>
      <div className="notice-banner">Discord income alerts are limited to three proactive DMs per account per GMT+8 calendar day. Website records and wallet entries are still retained.</div>
    </section>
    <div className="stack">
      {data.items.map((item) => {
        const content = <><div className="row row--between"><strong>{item.title}</strong><span className="muted mono">{fmtTime(item.createdAt)}</span></div><div className="soft" style={{ marginTop: 5 }}>{item.message}</div></>;
        return item.href
          ? <Link key={item.id} to={item.href} onClick={() => readOne(item)} className={`card card--pad notification-item${item.readAt ? '' : ' notification-item--unread'}`}>{content}</Link>
          : <div key={item.id} className={`card card--pad notification-item${item.readAt ? '' : ' notification-item--unread'}`}>{content}</div>;
      })}
      {data.items.length === 0 && <div className="empty">No notifications yet.</div>}
    </div>
  </div>;
}
