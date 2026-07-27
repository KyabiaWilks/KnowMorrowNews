import crypto from 'node:crypto';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError } from './util.js';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sign = (payload) => crypto.createHmac('sha256', config.authSecret).update(payload).digest('base64url');

export function issueToken(user, days = 14) {
  const body = b64({ sub: user.id, role: user.role, exp: Date.now() + days * 864e5 });
  return `${body}.${sign(body)}`;
}

export function readToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.exp && payload.exp >= Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function attachUser(req, _res, next) {
  const raw = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const payload = readToken(raw);
  req.user = payload ? db.users.find((user) => user.id === payload.sub) || null : null;
  next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in with Discord.'));
  if (req.user.banned) return next(new HttpError(403, 'This account has been suspended.'));
  next();
}

export function requireAdmin(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in with Discord.'));
  if (!['admin', 'read_only_admin', 'superadmin', 'event_staff'].includes(req.user.siteRole) && req.user.role !== 'admin') {
    return next(new HttpError(403, 'Administrator access required.'));
  }
  next();
}

export function enforceReadOnly(req, _res, next) {
  const readOnly = ['read_only_admin', 'event_staff'].includes(req.user?.siteRole);
  const officialTransfer = req.method === 'POST' && req.path === '/api/wallet/official-transfer';
  if (readOnly && !officialTransfer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next(new HttpError(403, 'Event Staff access is read-only.'));
  }
  next();
}

const ghostSessions = new Map();
const GHOST_TTL = 45 * 60 * 1000;

export function openGhostSession(key) {
  if (String(key) !== config.ghostKey) return null;
  const sessionKey = crypto.randomBytes(24).toString('base64url');
  ghostSessions.set(sessionKey, Date.now() + GHOST_TTL);
  return { sessionKey, expiresAt: Date.now() + GHOST_TTL };
}

export function closeGhostSession(key) {
  ghostSessions.delete(key);
}

export function requireGhost(req, _res, next) {
  const key = req.headers['x-ghost-session'];
  const exp = key ? ghostSessions.get(key) : null;
  if (!exp || exp < Date.now()) {
    ghostSessions.delete(key);
    return next(new HttpError(404, 'Not Found'));
  }
  ghostSessions.set(key, Date.now() + GHOST_TTL);
  req.ghost = true;
  next();
}
