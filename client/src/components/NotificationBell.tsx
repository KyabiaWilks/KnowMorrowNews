import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import type { Notification } from '../lib/types';

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => get<{ items: Notification[]; unread: number }>('/notifications')
      .then((result) => { if (active) setUnread(result.unread); })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  return <Link to="/notifications" className="notification-bell" aria-label={`${unread} unread notifications`}>
    <span aria-hidden="true">🔔</span>
    {unread > 0 && <span className="notification-bell__count">{unread > 99 ? '99+' : unread}</span>}
  </Link>;
}
