'use client';
import { useSyncExternalStore } from 'react';

const CHANGED = 'hl_query_changed';
function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange); window.addEventListener(CHANGED, onChange);
  return () => { window.removeEventListener('popstate', onChange); window.removeEventListener(CHANGED, onChange); };
}
export function useUrlQuery() {
  const query = useSyncExternalStore(subscribe, () => window.location.search, () => '');
  const update = (patch: Record<string, string | null>) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(patch)) { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); }
    // Next's native-history integration preserves the current route without a server request.
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    window.dispatchEvent(new Event(CHANGED));
  };
  return { params: new URLSearchParams(query), update };
}
