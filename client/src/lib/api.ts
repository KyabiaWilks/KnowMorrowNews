const TOKEN_KEY = 'jontop.token';
const GHOST_KEY = 'jontop.ghost';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const ghostStore = {
  get: () => sessionStorage.getItem(GHOST_KEY),
  set: (t: string) => sessionStorage.setItem(GHOST_KEY, t),
  clear: () => sessionStorage.removeItem(GHOST_KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = { method?: string; body?: unknown; ghost?: boolean; raw?: FormData };

export async function api<T = any>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.ghost) {
    const g = ghostStore.get();
    if (g) headers['x-ghost-session'] = g;
  }

  let body: BodyInit | undefined;
  if (opts.raw) {
    body = opts.raw;
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  const res = await fetch(`/api${path}`, { method: opts.method || (body ? 'POST' : 'GET'), headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}

export const get = <T = any,>(p: string, ghost = false) => api<T>(p, { ghost });
export const post = <T = any,>(p: string, body?: unknown, ghost = false) => api<T>(p, { method: 'POST', body, ghost });
export const patch = <T = any,>(p: string, body?: unknown) => api<T>(p, { method: 'PATCH', body });
export const del = <T = any,>(p: string, ghost = false) => api<T>(p, { method: 'DELETE', ghost });

export async function openProtectedFile(url: string, filename: string) {
  const objectUrl = await protectedFileUrl(url);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.target = '_blank';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function protectedFileUrl(url: string) {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    let message = `File request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch {}
    throw new ApiError(response.status, message);
  }
  return URL.createObjectURL(await response.blob());
}

export function qs(params: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') s.set(k, String(v));
  const out = s.toString();
  return out ? `?${out}` : '';
}
