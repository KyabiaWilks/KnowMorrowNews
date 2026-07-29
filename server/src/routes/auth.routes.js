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

authRouter.get('/minecraft-avatar/:uuid', wrap(async (req, res) => {
  const uuid = String(req.params.uuid || '').replaceAll('-', '');
  if (!/^[a-f0-9]{32}$/i.test(uuid)) throw bad('Invalid Minecraft UUID.');
  try {
    const image = await fetch(`https://mc-heads.net/avatar/${uuid}/64`, {
      headers: { 'user-agent': 'KnowMorrowNews/1.0' },
    });
    if (!image.ok) throw new Error(`Avatar provider returned ${image.status}`);
    res.set('Content-Type', image.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.send(Buffer.from(await image.arrayBuffer()));
  } catch {
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=300');
    res.send('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#6b8e54"/><rect x="12" y="14" width="40" height="38" rx="4" fill="#c99b73"/><rect x="20" y="26" width="7" height="7" fill="#25211d"/><rect x="37" y="26" width="7" height="7" fill="#25211d"/><rect x="25" y="40" width="14" height="4" fill="#7a4f3d"/></svg>');
  }
}));

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
    ? 'admin'
    : roleNames.some((role) => ['administrator', 'admin', 'admin tomato', 'head editor'].includes(role))
        ? 'admin'
        : roleNames.includes('event staff')
          ? 'read_only_admin'
        : roleNames.includes('tomato')
          ? 'journalist'
          : 'user';
  let user = db.users.find((item) => item.discordId === profile.id);
  if (!user) {
    const username = String(profile.username || profile.id);
    user = {
      id: uid('usr'), discordId: profile.id, username,
      displayName: profile.global_name || profile.username || 'Discord Reader',
      password: hashPassword(crypto.randomBytes(32).toString('hex')),
      role: siteRole === 'admin' ? 'admin' : 'user', siteRole,
      discordUsername: profile.username,
      discordAvatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.webp?size=128` : null,
      discordRoles: roleNames,
      coins: WELCOME_COINS, escrow: 0, frozenFunds: 0,
      banned: false, banReason: null, noticeAckedAt: null, createdAt: now(),
    };
    db.users.push(user);
    record(user.id, WELCOME_COINS, 'grant', 'Welcome gift for a new Discord reader');
    save();
  }
  user.displayName = member.nick || profile.global_name || profile.username || user.displayName;
  user.username = profile.username;
  user.discordUsername = profile.username;
  user.discordAvatar = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.webp?size=128` : null;
  user.discordRoles = roleNames;
  const effectiveSiteRole = user.siteRole === 'read_only_user' ? 'read_only_user' : siteRole;
  user.siteRole = effectiveSiteRole;
  user.role = effectiveSiteRole === 'admin' ? 'admin' : 'user';
  if (siteRole === 'journalist' && !db.journalists.some((item) => item.userId === user.id)) {
    db.journalists.push({
      id: `jnl_${user.id.replace(/^usr_/, '')}`,
      userId: user.id,
      name: user.displayName,
      title: 'Staff Reporter',
      avatar: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.webp?size=512` : null,
      portraitTone: '#2f6bff',
      tagline: 'Every detail has a witness.',
      bio: 'This reporter joined Know Morrow through the Tomato press corps.',
      beats: ['General Assignment'],
      awards: [],
      milestones: [{ year: new Date().getFullYear(), text: 'Joined the Know Morrow press corps' }],
      signatureWorks: [],
      contact: null,
      featured: false,
      hidden: false,
      joinedAt: now(),
    });
  }
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

    if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(username)) throw bad('Username must be 3–24 characters and may contain letters, numbers, underscores, periods and hyphens.');
    if (password.length < 6) throw bad('Password must be at least 6 characters.');
    if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) throw bad('That username is already in use.');

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
    record(user.id, WELCOME_COINS, 'grant', 'New reader welcome grant');
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
      throw new HttpError(401, 'Incorrect username or password.');
    }
    if (user.banned) throw new HttpError(403, `This account has been suspended: ${user.banReason || 'Tavern rules violation'}`);
    res.json({ token: issueToken(user), user: publicUser(user) });
  })
);

authRouter.get(
  '/me',
  requireAuth,
  wrap((req, res) => res.json({ user: publicUser(req.user) }))
);

/** First-visit Tavern rules acknowledgement. */
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
  wrap(async (req, res) => {
    if (req.body.displayName !== undefined) {
      const name = String(req.body.displayName).trim();
      if (name.length < 1 || name.length > 32) throw bad('Display name must be between 1 and 32 characters.');
      req.user.displayName = name;
    }
    if (req.body.newPassword) {
      if (!verifyPassword(String(req.body.currentPassword || ''), req.user.password)) throw bad('The current password is incorrect.');
      if (String(req.body.newPassword).length < 6) throw bad('The new password must be at least 6 characters.');
      req.user.password = hashPassword(String(req.body.newPassword));
    }
    if (req.body.minecraftId !== undefined) {
      const minecraftId = String(req.body.minecraftId || '').trim();
      if (!minecraftId) {
        req.user.minecraftId = null;
        req.user.minecraftUuid = null;
      } else {
        if (!/^[A-Za-z0-9_]{3,16}$/.test(minecraftId)) throw bad('Minecraft ID must be 3–16 letters, numbers or underscores.');
        const lookup = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(minecraftId)}`);
        if (!lookup.ok) throw bad('That Minecraft Java profile could not be verified.');
        const minecraft = await lookup.json();
        req.user.minecraftId = minecraft.name;
        req.user.minecraftUuid = minecraft.id;
      }
    }
    if (req.body.departed === true) {
      if (req.user.departedAt) throw bad('This account is already recorded in the Memorial Hall.');
      if (String(req.body.confirmation || '') !== 'I HAVE DEPARTED') {
        throw bad('Type I HAVE DEPARTED to confirm this permanent action.');
      }
      req.user.departedAt = now();
      req.user.roleBeforeDeparture = req.user.siteRole || 'user';
      req.user.siteRole = 'read_only_user';
      req.user.role = 'user';
      for (const profile of db.profiles.filter((item) => item.userId === req.user.id)) profile.retired = true;
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
