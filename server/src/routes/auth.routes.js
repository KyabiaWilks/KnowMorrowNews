import { Router } from 'express';
import crypto from 'node:crypto';
import { db, save } from '../db.js';
import { hashPassword, verifyPassword, issueToken, requireAuth } from '../auth.js';
import { publicUser, record } from '../services.js';
import { bad, now, uid, wrap, HttpError } from '../util.js';
import { config } from '../config.js';

export const authRouter = Router();

const WELCOME_COINS = 120;

authRouter.post('/register', (_req, res) => {
  res.status(403).json({ error: 'Registration is available through Discord only.' });
});

const discordState = () => {
  const expires = Date.now() + 10 * 60 * 1000;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${expires}.${nonce}`;
  const signature = crypto.createHmac('sha256', config.authSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const validDiscordState = (state) => {
  const [expires, nonce, signature] = String(state || '').split('.');
  if (!expires || !nonce || !signature || Number(expires) < Date.now()) return false;
  const payload = `${expires}.${nonce}`;
  const expected = crypto.createHmac('sha256', config.authSecret).update(payload).digest('base64url');
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

authRouter.get('/discord', (_req, res) => {
  if (!config.discordClientId || !config.discordClientSecret) {
    return res.redirect(`${config.clientOrigin}/login?discord_error=Discord%20login%20is%20not%20configured`);
  }
  const query = new URLSearchParams({
    client_id: config.discordClientId,
    redirect_uri: config.discordRedirectUri,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state: discordState(),
    prompt: 'consent',
  });
  res.redirect(`https://discord.com/oauth2/authorize?${query}`);
});

authRouter.get('/discord/callback', wrap(async (req, res) => {
  if (!validDiscordState(req.query.state)) throw new HttpError(400, 'Discord sign-in session expired. Please try again.');
  const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.discordClientId,
      client_secret: config.discordClientSecret,
      grant_type: 'authorization_code',
      code: String(req.query.code || ''),
      redirect_uri: config.discordRedirectUri,
    }),
  });
  if (!tokenResponse.ok) throw new HttpError(502, 'Discord could not complete sign-in.');
  const discordToken = await tokenResponse.json();
  const profileResponse = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${discordToken.access_token}` },
  });
  if (!profileResponse.ok) throw new HttpError(502, 'Discord profile could not be read.');
  const profile = await profileResponse.json();
  const memberResponse = await fetch(`https://discord.com/api/v10/users/@me/guilds/${config.discordGuildId}/member`, {
    headers: { Authorization: `Bearer ${discordToken.access_token}` },
  });
  if (!memberResponse.ok) {
    return res.redirect(`${config.clientOrigin}/login?discord_error=${encodeURIComponent('You must be a member of the Know Morrow Discord server.')}`);
  }
  const member = await memberResponse.json();
  let roleNames = [];
  if (config.discordBotToken) {
    const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${config.discordGuildId}/roles`, {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });
    if (rolesResponse.ok) {
      const guildRoles = await rolesResponse.json();
      roleNames = guildRoles.filter((role) => member.roles.includes(role.id)).map((role) => String(role.name).toLowerCase());
    }
  }
  const siteRole = String(profile.username || '').toLowerCase() === config.supremeDiscordUsername.toLowerCase()
    ? 'superadmin'
    : roleNames.includes('event staff')
        ? 'event_staff'
        : roleNames.includes('tomato')
          ? 'journalist'
          : 'reader';
  let user = db.users.find((item) => item.discordId === profile.id);
  if (!user) {
    const base = String(profile.username || 'reader').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 18) || 'reader';
    let username = `discord_${base}`.slice(0, 24);
    let suffix = 1;
    while (db.users.some((item) => item.username.toLowerCase() === username.toLowerCase())) username = `${base.slice(0, 18)}_${suffix++}`.slice(0, 24);
    user = {
      id: uid('usr'), discordId: profile.id, username,
      displayName: profile.global_name || profile.username || 'Discord Reader',
      password: hashPassword(crypto.randomBytes(32).toString('hex')),
      role: siteRole === 'superadmin' ? 'admin' : 'user', siteRole,
      discordUsername: profile.username, discordRoles: roleNames,
      coins: WELCOME_COINS, escrow: 0, frozenFunds: 0,
      banned: false, banReason: null, noticeAckedAt: null, createdAt: now(),
    };
    db.users.push(user);
    record(user.id, WELCOME_COINS, 'grant', 'Welcome gift for a new Discord reader');
    save();
  }
  user.displayName = member.nick || profile.global_name || profile.username || user.displayName;
  user.discordUsername = profile.username;
  user.discordRoles = roleNames;
  user.siteRole = siteRole;
  user.role = siteRole === 'superadmin' ? 'admin' : 'user';
  save();
  if (user.banned) throw new HttpError(403, 'This account has been suspended.');
  res.redirect(`${config.clientOrigin}/login#discord_token=${encodeURIComponent(issueToken(user))}`);
}));

authRouter.post(
  '/register',
  wrap((req, res) => {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const displayName = String(req.body.displayName || '').trim() || username;

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) throw bad('用户名需为 3-24 位字母、数字、_ . -');
    if (password.length < 6) throw bad('密码至少 6 位');
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw bad('该用户名已被占用');

    const user = {
      id: uid('usr'),
      username,
      displayName,
      password: hashPassword(password),
      role: 'user',
      coins: WELCOME_COINS,
      escrow: 0,
      frozenFunds: 0,
      banned: false,
      banReason: null,
      noticeAckedAt: null,
      createdAt: now(),
    };
    db.users.push(user);
    record(user.id, WELCOME_COINS, 'grant', '新读者见面礼');
    save();
    res.json({ token: issueToken(user), user: publicUser(user) });
  })
);

authRouter.post(
  '/login',
  wrap((req, res) => {
    const username = String(req.body.username || '').trim();
    const user = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    if (!user || !verifyPassword(String(req.body.password || ''), user.password)) {
      throw new HttpError(401, '用户名或密码不正确');
    }
    if (user.banned) throw new HttpError(403, `账号已被封禁：${user.banReason || '违反酒馆规约'}`);
    res.json({ token: issueToken(user), user: publicUser(user) });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  wrap((req, res) => res.json({ user: publicUser(req.user) }))
);

/** 首次进入酒馆的规约确认 */
authRouter.post(
  '/ack-notice',
  requireAuth,
  wrap((req, res) => {
    req.user.noticeAckedAt = now();
    save();
    res.json({ user: publicUser(req.user) });
  })
);

authRouter.patch(
  '/me',
  requireAuth,
  wrap((req, res) => {
    if (req.body.displayName !== undefined) {
      const name = String(req.body.displayName).trim();
      if (name.length < 1 || name.length > 32) throw bad('昵称长度需在 1-32 之间');
      req.user.displayName = name;
    }
    if (req.body.newPassword) {
      if (!verifyPassword(String(req.body.currentPassword || ''), req.user.password)) throw bad('当前密码不正确');
      if (String(req.body.newPassword).length < 6) throw bad('新密码至少 6 位');
      req.user.password = hashPassword(String(req.body.newPassword));
    }
    save();
    res.json({ user: publicUser(req.user) });
  })
);

authRouter.use((error, req, res, next) => {
  if (req.path === '/discord/callback' && !res.headersSent) {
    const networkFailure = error?.cause?.code || error?.code;
    const message = networkFailure
      ? `Discord API connection failed (${networkFailure}). Please try again.`
      : error?.message || 'Discord sign-in failed. Please try again.';
    console.error('[discord oauth]', error);
    return res.redirect(`${config.clientOrigin}/login?discord_error=${encodeURIComponent(message)}`);
  }
  next(error);
});
