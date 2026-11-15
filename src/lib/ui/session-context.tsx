'use client';
import { Fragment, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import type { User } from '@/lib/contracts';
import { Button, StatusNote } from '@/components/ui';
import { errorCopy } from './error-copy';
export const CONSENT_TEXT = 'I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days. I am 14 or older.';
type ExitDestination = '/' | '/app/onboarding?mode=restore';
type SessionState = { user: User | null; balance: number | null; balanceError: string | null; balanceLoading: boolean; setUser(user: User): void; clearSession(): void; endSession(destination: ExitDestination): void; refreshBalance(): Promise<void> };
const Context = createContext<SessionState | null>(null);
const SESSION_EVENT_KEY = 'hl_session_changed';
function announceSessionChange() {
  try { localStorage.setItem(SESSION_EVENT_KEY, crypto.randomUUID()); } catch { /* Focus revalidation also works without storage. */ }
}
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
  const currentUser = useRef<User | null>(null); const sessionPending = useRef(false); const sessionSyncNeeded = useRef(false);
  const [balanceError, setBalanceError] = useState<string | null>(null); const [balanceLoading, setBalanceLoading] = useState(false);
  const balanceRevision = useRef(0); const alive = useRef(true); const latestPath = useRef(pathname);
  const exitDestination = useRef<ExitDestination | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<ApiClientError | null>(null); const [revision, setRevision] = useState(0);
  useEffect(() => { latestPath.current = pathname; if (exitDestination.current?.split('?')[0] === pathname) exitDestination.current = null; }, [pathname]);
  useEffect(() => {
    const sessions = userRevision; const balances = balanceRevision;
    alive.current = true;
    return () => { alive.current = false; sessions.current++; balances.current++; };
  }, []);
  const clearSession = useCallback((announce = true) => {
    userRevision.current++; balanceRevision.current++;
    currentUser.current = null;
    setUserState(null); setBalance(null); setBalanceError(null); setBalanceLoading(false); setLoading(false); setError(null);
    if (announce) announceSessionChange();
  }, []);
  const endSession = useCallback((destination: ExitDestination) => {
    // Clearing authentication and choosing its destination are one transition.
    // The normal expired-session redirect must not replace a deliberate exit.
    exitDestination.current = destination; clearSession(); router.replace(destination);
  }, [clearSession, router]);
  const refreshBalance = useCallback(async () => {
    if (!alive.current) return;
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
  const setUser = useCallback((updated: User) => { if (!alive.current) return; exitDestination.current = null; userRevision.current++; if (currentUser.current?.id !== updated.id) { setBalance(null); setBalanceError(null); } currentUser.current = updated; setUserState(updated); setLoading(false); setError(null); announceSessionChange(); void refreshBalance(); }, [refreshBalance]);
  useEffect(() => {
    let current = true; const version = userRevision.current;
    sessionPending.current = true;
    void api.getSession().then(found => {
      if (!current || version !== userRevision.current) return; currentUser.current = found; setUserState(found); setLoading(false);
      if (found) void refreshBalance();
    }).catch(cause => { if (current && version === userRevision.current) {
      if (cause instanceof ApiClientError && cause.code === 'unauthenticated') clearSession(false);
      else { setError(cause instanceof ApiClientError ? cause : new ApiClientError('internal', 0, '')); setLoading(false); }
    } }).finally(() => { if (current) { sessionPending.current = false; if (sessionSyncNeeded.current) { sessionSyncNeeded.current = false; setRevision(n => n + 1); } } });
    return () => { current = false; sessionPending.current = false; };
  }, [revision, refreshBalance, clearSession]);
  useEffect(() => {
    let disposed = false; let checking = false; let queued = false;
    const revalidate = async (announced = false) => {
      if (disposed || exitDestination.current) return;
      if (announced) {
        userRevision.current++; balanceRevision.current++; currentUser.current = null;
        setUserState(null); setBalance(null); setLoading(true); setError(null);
      }
      if (sessionPending.current) { sessionSyncNeeded.current ||= announced; return; }
      if (checking) { queued ||= announced; return; }
      checking = true; const version = userRevision.current;
      try {
        const found = await api.getSession();
        if (disposed || version !== userRevision.current) return;
        if (!found) { clearSession(false); return; }
        const previous = currentUser.current;
        if (!previous || previous.id !== found.id || previous.role !== found.role || previous.nickname !== found.nickname) {
          if (previous?.id !== found.id) { setBalance(null); setBalanceError(null); }
          userRevision.current++; currentUser.current = found; setUserState(found); setLoading(false); setError(null);
        }
        void refreshBalance();
      } catch (cause) {
        if (!disposed && version === userRevision.current) {
          if (cause instanceof ApiClientError && cause.code === 'unauthenticated') clearSession(false);
          else if (announced) { setError(cause instanceof ApiClientError ? cause : new ApiClientError('internal', 0, '')); setLoading(false); }
        }
      } finally { checking = false; if (queued && !disposed) { queued = false; void revalidate(true); } }
    };
    const resume = () => { if (!document.hidden) void revalidate(); };
    const changed = (event: StorageEvent) => { if (event.key === SESSION_EVENT_KEY) void revalidate(true); };
    window.addEventListener('focus', resume); window.addEventListener('pageshow', resume);
    document.addEventListener('visibilitychange', resume); window.addEventListener('storage', changed);
    return () => { disposed = true; window.removeEventListener('focus', resume); window.removeEventListener('pageshow', resume); document.removeEventListener('visibilitychange', resume); window.removeEventListener('storage', changed); };
  }, [clearSession, refreshBalance]);
  useEffect(() => { if (!exitDestination.current && !loading && !error && !user && pathname !== '/app/onboarding') router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`); }, [loading, error, user, pathname, router]);
  if (error) return <div className="hl-app-main hl-stack"><StatusNote tone="error">{errorCopy(error.code)}</StatusNote><Button onClick={() => { setError(null); setLoading(true); setRevision(n => n + 1); }}>Try again</Button></div>;
  if (pathname !== '/app/onboarding' && (loading || !user)) return <p className="hl-app-main" role="status">Opening your window…</p>;
  return <Context.Provider value={{ user, balance, balanceError, balanceLoading, setUser, clearSession, endSession, refreshBalance }}><Fragment key={user ? `${user.id}:${user.role}` : 'visitor'}>{children}</Fragment></Context.Provider>;
}
// Also works for the public try panel, which deliberately has no session provider.
export function useSessionExpired() {
  const clearSession = useContext(Context)?.clearSession; const router = useRouter(); const pathname = usePathname();
  return useCallback(() => { clearSession?.(); router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`); }, [clearSession, router, pathname]);
}
export function useOptionalSession(): SessionState { const context = useContext(Context); if (!context) throw new Error('SessionProvider is required'); return context; }
export function useSession(): SessionState & { user: User } { const context = useOptionalSession(); if (!context.user) throw new Error('A session is required'); return { ...context, user: context.user }; }
