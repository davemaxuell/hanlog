'use client';
import { useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { progressApi } from '@/lib/progress-client';
import { useSessionExpired } from '@/lib/ui/session-context';
import { errorCopy } from '@/lib/ui/error-copy';

export function useSavedMissions(initialIds: string[]) {
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null); const [error, setError] = useState('');
  const lock = useRef(false); const alive = useRef(true); const sessionExpired = useSessionExpired();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const saved = new Set(initialIds);
  for (const [id, value] of Object.entries(changes)) { if (value) saved.add(id); else saved.delete(id); }
  async function toggle(id: string, value: boolean) {
    if (lock.current) return;
    lock.current = true; setSavingId(id); setError('');
    try { await progressApi.saveMission(id, value); if (alive.current) setChanges(previous => ({ ...previous, [id]: value })); }
    catch (cause) { if (!alive.current) return; if (cause instanceof ApiClientError && cause.code === 'unauthenticated') sessionExpired(); else setError(cause instanceof ApiClientError && cause.code !== 'internal' ? errorCopy(cause.code) : 'We couldn’t save that expression. Please try again.'); }
    finally { lock.current = false; if (alive.current) setSavingId(null); }
  }
  return { savedMissionIds: [...saved], savingId, error, toggle };
}
