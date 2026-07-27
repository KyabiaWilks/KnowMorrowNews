import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, tokenStore } from '../lib/api';
import type { User } from '../lib/types';

type Ctx = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  ackNotice: () => Promise<void>;
  acceptToken: (token: string) => Promise<void>;
};

const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await get<{ user: User }>('/auth/me');
      setUser(user);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await post<{ token: string; user: User }>('/auth/login', { username, password });
    tokenStore.set(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const ackNotice = useCallback(async () => {
    const { user } = await post<{ user: User }>('/auth/ack-notice');
    setUser(user);
  }, []);

  const acceptToken = useCallback(async (token: string) => {
    tokenStore.set(token);
    setLoading(true);
    try {
      const { user } = await get<{ user: User }>('/auth/me');
      setUser(user);
    } catch (error) {
      tokenStore.clear();
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh, ackNotice, acceptToken }),
    [user, loading, login, logout, refresh, ackNotice, acceptToken]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
