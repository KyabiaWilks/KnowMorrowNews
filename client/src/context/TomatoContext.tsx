import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { del, get, post } from '../lib/api';
import type { Tomato } from '../lib/types';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const PREF_KEY = 'jontop.tomato.on';

type Ctx = {
  enabled: boolean;
  toggle: () => void;
  armed: boolean;
  setArmed: (v: boolean) => void;
  note: string;
  setNote: (v: string) => void;
  tomatoes: Tomato[];
  totalTomatoes: number;
  price: number;
  page: string;
  throwAt: (x: number, y: number) => Promise<void>;
  wipe: (id: string) => Promise<void>;
};

const TomatoCtx = createContext<Ctx>(null as unknown as Ctx);
export const useTomato = () => useContext(TomatoCtx);

const isExcluded = (path: string) => path.startsWith('/ghost');

export function TomatoProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, refresh } = useAuth();
  const toast = useToast();

  const [enabled, setEnabled] = useState(() => localStorage.getItem(PREF_KEY) !== '0');
  const [armed, setArmed] = useState(false);
  const [note, setNote] = useState('');
  const [tomatoes, setTomatoes] = useState<Tomato[]>([]);
  const [totalTomatoes, setTotalTomatoes] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(72);
  const [price, setPrice] = useState(1);

  // 番茄按「页面路径」归档；文章详情页各自独立
  const page = isExcluded(location.pathname) ? '' : location.pathname;

  useEffect(() => {
    localStorage.setItem(PREF_KEY, enabled ? '1' : '0');
    if (!enabled) setArmed(false);
  }, [enabled]);

  useEffect(() => {
    setArmed(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled || !page) {
      setTomatoes([]);
      setTotalTomatoes(0);
      return;
    }
    let alive = true;
    get<{ items: Tomato[]; total: number; displayLimit: number; price: number }>(`/tomatoes?page=${encodeURIComponent(page)}`)
      .then((res) => {
        if (!alive) return;
        setTomatoes(res.items);
        setTotalTomatoes(res.total);
        setDisplayLimit(res.displayLimit);
        setPrice(res.price);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, page]);

  const throwAt = useCallback(
    async (x: number, y: number) => {
      if (!user) {
        toast.push('Sign in with Discord before throwing a tomato.', 'bad');
        return;
      }
      try {
        const res = await post<{ tomato: Tomato }>('/tomatoes', { page, x, y, note });
        setTomatoes((xs) => [res.tomato, ...xs].slice(0, displayLimit));
        setTotalTomatoes((count) => count + 1);
        window.dispatchEvent(new CustomEvent('know-morrow:tomato-thrown', { detail: res.tomato }));
        setNote('');
        void refresh();
      } catch (err) {
        toast.push((err as Error).message, 'bad');
      }
    },
    [displayLimit, note, page, refresh, toast, user]
  );

  const wipe = useCallback(
    async (id: string) => {
      try {
        await del(`/tomatoes/${id}`);
        setTomatoes((xs) => xs.filter((t) => t.id !== id));
        setTotalTomatoes((count) => Math.max(0, count - 1));
      } catch (err) {
        toast.push((err as Error).message, 'bad');
      }
    },
    [toast]
  );

  const value = useMemo(
    () => ({
      enabled,
      toggle: () => setEnabled((v) => !v),
      armed: enabled && armed,
      setArmed,
      note,
      setNote,
      tomatoes,
      totalTomatoes,
      price,
      page,
      throwAt,
      wipe,
    }),
    [enabled, armed, note, tomatoes, totalTomatoes, price, page, throwAt, wipe]
  );

  return <TomatoCtx.Provider value={value}>{children}</TomatoCtx.Provider>;
}
