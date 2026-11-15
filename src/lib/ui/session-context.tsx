'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import type { User } from '@/lib/contracts';
import { Button, StatusNote } from '@/components/ui';
import { errorCopy } from './error-copy';
export const CONSENT_TEXT = 'I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days. I am 14 or older.';
type SessionState = { user: User | null; balance: number | null; balanceError: string | null; balanceLoading: boolean; setUser(user: User): void; clearSession(): void; refreshBalance(): Promise<void> };
const Context = createContext<SessionState | null>(null);
export function safeNext(next: string | null): string {
  if (!next || /[\\\u0000-\u001f]/.test(next)) return '/app';
  try {
    const decoded = decodeURIComponent(next); if (decoded.includes('\\') || decoded.startsWith('//')) return '/app';
    const url = new URL(next, 'https://hanlog.local');
    if (url.origin !== 'https://hanlog.local' || !(url.pathname === '/app' || url.pathname.startsWith('/app/') || url.pathname.startsWith('/c/'))) return '/app';
    return url.pathname + url.search + url.hash;
  } catch { return '/app'; }
}
export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter(); const pathname = usePathname();
  const [user, setUserState] = useState<User | null>(null); const [balance, setBalance] = useState<number | null>(null); const userRevision = useRef(0);
  const [balanceError, setBalanceError] = useState<string | null>(null); const [balanceLoading, setBalanceLoading] = useState(false);
  const balanceRevision = useRef(0); const alive = useRef(true); const latestPath = useRef(pathname);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<ApiClientError | null>(null); const [revision, setRevision] = useState(0);
  useEffect(() => { latestPath.current = pathname; }, [pathname]);
  useEffect(() => {
    const sessions = userRevision; const balances = balanceRevision;
    alive.current = true;
    return () => { alive.current = false; sessions.current++; balances.current++; };
  }, []);
  const clearSession = useCallback(() => {
    userRevision.current++; balanceRevision.current++;
    setUserState(null); setBalance(null); setBalanceError(null); setBalanceLoading(false); setLoading(false); setError(null);
  }, []);
  const refreshBalance = useCallback(async () => {
    const request = ++balanceRevision.current; const session = userRevision.current;
    const isCurrent = () => alive.current && request === balanceRevision.current && session === userRevision.current;
    setBalanceLoading(true);
    try { const points = await api.getPoints(); if (isCurrent()) { setBalance(points.balance); setBalanceError(null); } }
    catch (cause) {
      if (!isCurrent()) return;
      if (cause instanceof ApiClientError && cause.code === 'unauthenticated') {
        clearSession(); router.replace(`/app/onboarding?next=${encodeURIComponent(latestPath.current)}`);
      } else { setBalance(null); setBalanceError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal')); }
    } finally { if (isCurrent()) setBalanceLoading(false); }
  }, [clearSession, router]);
  const setUser = useCallback((updated: User) => { userRevision.current++; setUserState(updated); setLoading(false); setError(null); void refreshBalance(); }, [refreshBalance]);
  useEffect(() => {
    let current = true; const version = userRevision.current;
    void api.getSession().then(async found => {
      if (!current || version !== userRevision.current) return; setUserState(found); setLoading(false);
      if (found) await refreshBalance();
    }).catch(cause => { if (current && version === userRevision.current) {
      if (cause instanceof ApiClientError && cause.code === 'unauthenticated') clearSession();
      else { setError(cause instanceof ApiClientError ? cause : new ApiClientError('internal', 0, '')); setLoading(false); }
    } });
    return () => { current = false; };
  }, [revision, refreshBalance, clearSession]);
  useEffect(() => { if (!loading && !error && !user && pathname !== '/app/onboarding') router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`); }, [loading, error, user, pathname, router]);
  if (error) return <div className="hl-app-main hl-stack"><StatusNote tone="error">{errorCopy(error.code)}</StatusNote><Button onClick={() => { setError(null); setLoading(true); setRevision(n => n + 1); }}>Try again</Button></div>;
  if (pathname !== '/app/onboarding' && (loading || !user)) return <p className="hl-app-main" role="status">Opening your window…</p>;
  return <Context.Provider value={{ user, balance, balanceError, balanceLoading, setUser, clearSession, refreshBalance }}>{children}</Context.Provider>;
}
// Also works for the public try panel, which deliberately has no session provider.
export function useSessionExpired() {
  const clearSession = useContext(Context)?.clearSession; const router = useRouter(); const pathname = usePathname();
  return useCallback(() => { clearSession?.(); router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`); }, [clearSession, router, pathname]);
}
export function useOptionalSession(): SessionState { const context = useContext(Context); if (!context) throw new Error('SessionProvider is required'); return context; }
export function useSession(): SessionState & { user: User } { const context = useOptionalSession(); if (!context.user) throw new Error('A session is required'); return { ...context, user: context.user }; }
