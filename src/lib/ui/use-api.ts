'use client';
import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { useSessionExpired } from './session-context';
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const sessionExpired = useSessionExpired();
  const [result, setResult] = useState<{ data: T; inputs: unknown[] } | null>(null); const [error, setError] = useState<ApiClientError | null>(null); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  const [inputs, setInputs] = useState(deps);
  const changed = inputs.length !== deps.length || inputs.some((input, index) => !Object.is(input, deps[index]));
  const matches = result?.inputs.length === deps.length && result.inputs.every((input, index) => Object.is(input, deps[index]));
  const data = matches && result ? result.data : null;
  const reload = useCallback(() => { setLoading(true); setRevision(n => n + 1); }, []);
  useEffect(() => {
    let current = true;
    void Promise.resolve().then(() => { if (current) { setInputs(deps); setLoading(true); setError(null); return load(); } }).then(value => { if (current) setResult({ data: value as T, inputs: deps }); }).catch(cause => {
      if (!current) return;
      const error = cause instanceof ApiClientError ? cause : new ApiClientError('internal', 0, '');
      if (error.code === 'unauthenticated') sessionExpired();
      setError(error);
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
    // Callers explicitly name the request inputs; inline loader functions must not retrigger every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);
  return { data, error: changed ? null : error, loading: changed || loading, reload };
}
