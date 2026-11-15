'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/api-client';
import { errorCopy } from './error-copy';
export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const lock = useRef(false); const alive = useRef(true); const router = useRouter(); const pathname = usePathname();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async <T,>(work: () => Promise<T>): Promise<{ value: T } | undefined> => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(null);
    try { const value = await work(); return alive.current ? { value } : undefined; }
    catch (cause) {
      if (alive.current) {
        if (cause instanceof ApiClientError && cause.code === 'unauthenticated') router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`);
        else setError(errorCopy(cause instanceof ApiClientError ? cause.code : 'internal'));
      }
      return undefined;
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return { busy, error, run };
}
