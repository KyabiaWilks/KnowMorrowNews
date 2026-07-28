export const NOTIFICATIONS_CHANGED = 'know-morrow:notifications-changed';

export function announceNotificationChange(unread?: number) {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED, {
    detail: typeof unread === 'number' ? { unread } : null,
  }));
}
