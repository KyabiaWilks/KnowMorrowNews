import crypto from 'node:crypto';

export const uid = (prefix = 'id') => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
export const now = () => new Date().toISOString();

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const denied = (msg = 'You do not have permission to perform this action.') => new HttpError(403, msg);
export const missing = (msg = 'The requested resource was not found.') => new HttpError(404, msg);

/** 包装 async 路由，异常统一交给错误中间件 */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export function paginate(items, { page = 1, pageSize = 12 } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 12));
  const start = (p - 1) * size;
  return { items: items.slice(start, start + size), total: items.length, page: p, pageSize: size };
}

export function matchText(needle, ...haystacks) {
  if (!needle) return true;
  const q = String(needle).trim().toLowerCase();
  if (!q) return true;
  return haystacks.filter(Boolean).some((h) => String(h).toLowerCase().includes(q));
}

/** 稳定的匿名指纹：同一马甲在同一话题下颜色/编号一致，但不泄露真实身份 */
export function fingerprint(...parts) {
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8).toUpperCase();
}
