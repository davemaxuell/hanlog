'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import type { User } from '@/lib/contracts';
import { Button, StatusNote } from '@/components/ui';
import { errorCopy } from './error-copy';
export const CONSENT_TEXT = 'I agree that my voice recordings are sent to OpenAI to be scored, and that recordings I send to other people are stored for up to 14 days. I am 14 or older.';
type SessionState = { user: User | null; balance: number | null; setUser(user: User): void; refreshBalance(): Promise<void> };
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
  const [user, setUser] = useState<User | null>(null); const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<ApiClientError | null>(null); const [revision, setRevision] = useState(0);
  const refreshBalance = useCallback(async () => { try { setBalance((await api.getPoints()).balance); } catch (cause) { if (cause instanceof ApiClientError && cause.code === 'unauthenticated') router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`); } }, [pathname, router]);
  useEffect(() => {
    let current = true;
    void api.getSession().then(async found => {
      if (!current) return; setUser(found); setLoading(false);
      if (found) { try { const points = await api.getPoints(); if (current) setBalance(points.balance); } catch { /* A balance refresh can recover later without discarding the session. */ } }
    }).catch(cause => { if (current) { setError(cause instanceof ApiClientError ? cause : new ApiClientError('internal', 0, '')); setLoading(false); } });
    return () => { current = false; };
  }, [revision]);
  useEffect(() => { if (!loading && !error && !user && pathname !== '/app/onboarding') router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`); }, [loading, error, user, pathname, router]);
  if (error) return <div className="hl-app-main hl-stack"><StatusNote tone="error">{errorCopy(error.code)}</StatusNote><Button onClick={() => { setError(null); setLoading(true); setRevision(n => n + 1); }}>Try again</Button></div>;
  if (pathname !== '/app/onboarding' && (loading || !user)) return <p className="hl-app-main" role="status">Opening your window…</p>;
  return <Context.Provider value={{ user, balance, setUser, refreshBalance }}>{children}</Context.Provider>;
}
export function useOptionalSession(): SessionState { const context = useContext(Context); if (!context) throw new Error('SessionProvider is required'); return context; }
export function useSession(): SessionState & { user: User } { const context = useOptionalSession(); if (!context.user) throw new Error('A session is required'); return { ...context, user: context.user }; }
