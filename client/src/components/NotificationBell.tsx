import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import type { Notification } from '../lib/types';
import { NOTIFICATIONS_CHANGED } from '../lib/notificationEvents';

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => get<{ items: Notification[]; unread: number }>('/notifications')
      .then((result) => { if (active) setUnread(result.unread); })
      .catch(() => undefined);
    const handleChange = (event: Event) => {
      const nextUnread = (event as CustomEvent<{ unread?: number } | null>).detail?.unread;
      if (typeof nextUnread === 'number') {
        setUnread(nextUnread);
      } else {
        void load();
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener(NOTIFICATIONS_CHANGED, handleChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED, handleChange);
    };
  }, []);

  return <Link to="/notifications" className="notification-bell" aria-label={`${unread} unread notifications`}>
    <span aria-hidden="true">🔔</span>
    {unread > 0 && <span className="notification-bell__count">{unread > 99 ? '99+' : unread}</span>}
  </Link>;
}
