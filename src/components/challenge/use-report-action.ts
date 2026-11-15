'use client';
import { useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { useAction } from '@/lib/ui/use-action';

export function useReportAction() {
  const action = useAction(); const [limited, setLimited] = useState(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = async (work: () => Promise<void>) => {
    const result = await action.run(async () => {
      setLimited(false);
      try { await work(); return true; }
      catch (cause) {
        if (cause instanceof ApiClientError && cause.code === 'daily_limit') {
          if (alive.current) setLimited(true);
          return false;
        }
        throw cause;
      }
    });
    return result?.value === true;
  };
  return { busy: action.busy, error: limited ? 'You can send up to 10 reports per day. Try again after midnight in Korea.' : action.error, run };
}
