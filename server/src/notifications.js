import { config } from './config.js';
import { db, save } from './db.js';
import { now, uid } from './util.js';

async function sendDiscordDm(discordId, message) {
  if (!config.discordBotToken) {
    console.warn('[discord dm] skipped: DISCORD_BOT_TOKEN is not configured');
    return { ok: false, reason: 'bot_not_configured' };
  }
  if (!discordId) {
    console.warn('[discord dm] skipped: recipient has no Discord ID');
    return { ok: false, reason: 'recipient_id_missing' };
  }
  try {
    const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        Authorization: `Bot ${config.discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: discordId }),
    });
    if (!channelResponse.ok) {
      const detail = await channelResponse.text();
      throw new Error(`open DM failed (${channelResponse.status}): ${detail.slice(0, 300)}`);
    }
    const channel = await channelResponse.json();
    const messageResponse = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${config.discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message.slice(0, 1900) }),
    });
    if (!messageResponse.ok) {
      const detail = await messageResponse.text();
      throw new Error(`send DM failed (${messageResponse.status}): ${detail.slice(0, 300)}`);
    }
    return { ok: true };
  } catch (error) {
    console.error('[discord dm]', error.message);
    return { ok: false, reason: error.message };
  }
}

export const DELIVERY_OPTIONS = ['site_and_discord', 'site', 'discord', 'off'];

export function notificationPreferences(user) {
  return {
    purchaseDelivery: DELIVERY_OPTIONS.includes(user?.notificationPrefs?.purchaseDelivery) ? user.notificationPrefs.purchaseDelivery : 'site_and_discord',
    pendingReportsDelivery: DELIVERY_OPTIONS.includes(user?.notificationPrefs?.pendingReportsDelivery) ? user.notificationPrefs.pendingReportsDelivery : 'site_and_discord',
  };
}

function shanghaiDayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function maySendIncomeDm(user) {
  const day = shanghaiDayKey();
  user.notificationState ||= {};
  if (user.notificationState.incomeDmDay !== day) {
    user.notificationState.incomeDmDay = day;
    user.notificationState.incomeDmCount = 0;
  }
  if ((user.notificationState.incomeDmCount || 0) >= 3) return false;
  user.notificationState.incomeDmCount = (user.notificationState.incomeDmCount || 0) + 1;
  return true;
}

export function notify(userId, { type, title, message, href = null, discordMessage = null, delivery = 'site_and_discord', category = null }) {
  const user = db.users.find((item) => item.id === userId);
  if (!user || delivery === 'off') return null;
  const siteEnabled = delivery === 'site' || delivery === 'site_and_discord';
  const discordEnabled = delivery === 'discord' || delivery === 'site_and_discord';
  const item = siteEnabled
    ? {
        id: uid('ntf'),
        userId,
        type,
        title,
        message,
        href,
        readAt: null,
        createdAt: now(),
      }
    : null;
  if (item) db.notifications.unshift(item);
  let maySendDiscord = discordEnabled && user.discordId && discordMessage !== false;
  if (maySendDiscord && category === 'income') maySendDiscord = maySendIncomeDm(user);
  save();
  if (maySendDiscord) {
    void sendDiscordDm(user.discordId, discordMessage || `**${title}**\n${message}${href ? `\n${config.clientOrigin}${href}` : ''}`)
      .then((delivery) => {
        if (item) {
          item.discordDelivery = delivery.ok ? 'sent' : 'failed';
          item.discordDeliveryError = delivery.ok ? null : delivery.reason;
        }
        save();
      });
  }
  return item;
}

let digestTimer = null;
let digestInterval = null;

function sendPendingReportDigests() {
  const owners = new Map();
  for (const request of db.requests.filter((item) => item.status === 'open')) {
    const pending = db.submissions.filter((item) => item.requestId === request.id && item.status === 'pending');
    if (!pending.length) continue;
    const profile = db.profiles.find((item) => item.id === request.profileId);
    if (!profile) continue;
    const entry = owners.get(profile.userId) || [];
    entry.push({ request, count: pending.length });
    owners.set(profile.userId, entry);
  }
  for (const [userId, requests] of owners) {
    const user = db.users.find((item) => item.id === userId);
    if (!user) continue;
    const count = requests.reduce((sum, item) => sum + item.count, 0);
    const delivery = notificationPreferences(user).pendingReportsDelivery;
    notify(user.id, {
      type: 'pending_report_digest',
      title: 'Reports are waiting for your decision',
      message: `${count} unprocessed report${count === 1 ? '' : 's'} across ${requests.length} reporting request${requests.length === 1 ? '' : 's'} are waiting for manual acceptance or decline.`,
      href: '/tavern/desk?tab=buying',
      delivery,
    });
  }
}

export function startNotificationScheduler() {
  const current = new Date();
  const shanghai = new Date(current.getTime() + 8 * 60 * 60 * 1000);
  let next = Date.UTC(shanghai.getUTCFullYear(), shanghai.getUTCMonth(), shanghai.getUTCDate(), -4, 0, 0, 0);
  if (next <= current.getTime()) next += 24 * 60 * 60 * 1000;
  digestTimer = setTimeout(() => {
    sendPendingReportDigests();
    digestInterval = setInterval(sendPendingReportDigests, 24 * 60 * 60 * 1000);
  }, next - current.getTime());
}

export function stopNotificationScheduler() {
  if (digestTimer) clearTimeout(digestTimer);
  if (digestInterval) clearInterval(digestInterval);
}
