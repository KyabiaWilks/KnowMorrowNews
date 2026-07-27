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

export function notify(userId, { type, title, message, href = null, discordMessage = null }) {
  const user = db.users.find((item) => item.id === userId);
  if (!user) return null;
  const item = {
    id: uid('ntf'),
    userId,
    type,
    title,
    message,
    href,
    readAt: null,
    createdAt: now(),
  };
  db.notifications.unshift(item);
  save();
  if (user.discordId && discordMessage !== false) {
    void sendDiscordDm(user.discordId, discordMessage || `**${title}**\n${message}${href ? `\n${config.clientOrigin}${href}` : ''}`)
      .then((delivery) => {
        item.discordDelivery = delivery.ok ? 'sent' : 'failed';
        item.discordDeliveryError = delivery.ok ? null : delivery.reason;
        save();
      });
  }
  return item;
}
