'use client';
import { useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '@/lib/api-client';
import type { MediaKind } from '@/lib/contracts';
import { useSessionExpired } from '@/lib/ui/session-context';
import { Button, StatusNote } from '@/components/ui';
export function MediaPlayer({ url, kind, label }: { url: string; kind: MediaKind; label: string }) {
  const [state, setState] = useState<{ source: string; blob?: string; loading?: boolean; failure?: 'expired' | 'temporary' } | null>(null);
  const sessionExpired = useSessionExpired();
  const generation = useRef(0); const currentBlob = useRef<string | null>(null); const lock = useRef(false);
  useEffect(() => () => { generation.current++; lock.current = false; if (currentBlob.current) { URL.revokeObjectURL(currentBlob.current); currentBlob.current = null; } }, [url]);
  const current = state?.source === url ? state : null;
  const play = async () => {
    if (lock.current || current?.blob) return; lock.current = true; const token = generation.current; setState({ source: url, loading: true });
    try {
      const blob = await api.fetchMediaBlobUrl(url);
      if (token !== generation.current) { URL.revokeObjectURL(blob); return; }
      currentBlob.current = blob; setState({ source: url, blob });
    } catch (cause) {
      if (token === generation.current) {
        if (cause instanceof ApiClientError && cause.code === 'unauthenticated') { setState(null); sessionExpired(); }
        else setState({ source: url, failure: cause instanceof ApiClientError && cause.code === 'not_found' ? 'expired' : 'temporary' });
      }
    }
    finally { if (token === generation.current) lock.current = false; }
  };
  const playbackFailed = (blob: string) => {
    if (currentBlob.current !== blob) return;
    URL.revokeObjectURL(blob); currentBlob.current = null; setState({ source: url, failure: 'temporary' });
  };
  return <div className="hl-stack-sm"><p className="hl-caption">{label}</p>{current?.failure === 'expired' ? <StatusNote tone="info">This recording is no longer available.</StatusNote> : current?.blob ? kind === 'video' ? <video src={current.blob} controls autoPlay playsInline aria-label={label} className="hl-media" onError={() => playbackFailed(current.blob!)} /> : <audio src={current.blob} controls autoPlay aria-label={label} className="hl-media" onError={() => playbackFailed(current.blob!)} /> : <>{current?.failure === 'temporary' && <StatusNote tone="error">We couldn&apos;t play that recording. Try again.</StatusNote>}<Button className="hl-fit" variant="secondary" busy={current?.loading} busyLabel="Opening recording…" onClick={() => void play()}>{current?.failure === 'temporary' ? 'Try again' : 'Play'}</Button></>}</div>;
}
