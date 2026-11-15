'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import type { MediaKind } from '@/lib/contracts';
import { Button, StatusNote } from '@/components/ui';
export function MediaPlayer({ url, kind, label }: { url: string; kind: MediaKind; label: string }) {
  const [state, setState] = useState<{ source: string; blob?: string; loading?: boolean; failed?: boolean } | null>(null);
  const generation = useRef(0); const currentBlob = useRef<string | null>(null); const lock = useRef(false);
  useEffect(() => () => { generation.current++; lock.current = false; if (currentBlob.current) { URL.revokeObjectURL(currentBlob.current); currentBlob.current = null; } }, [url]);
  const current = state?.source === url ? state : null;
  const play = async () => {
    if (lock.current || current?.blob) return; lock.current = true; const token = generation.current; setState({ source: url, loading: true });
    try {
      const blob = await api.fetchMediaBlobUrl(url);
      if (token !== generation.current) { URL.revokeObjectURL(blob); return; }
      currentBlob.current = blob; setState({ source: url, blob });
    } catch { if (token === generation.current) setState({ source: url, failed: true }); }
    finally { if (token === generation.current) lock.current = false; }
  };
  return <div className="hl-stack-sm"><p className="hl-caption">{label}</p>{current?.failed ? <StatusNote tone="info">This recording is no longer available.</StatusNote> : current?.blob ? kind === 'video' ? <video src={current.blob} controls autoPlay playsInline aria-label={label} className="hl-media" onError={() => setState({ source: url, failed: true })} /> : <audio src={current.blob} controls autoPlay aria-label={label} className="hl-media" onError={() => setState({ source: url, failed: true })} /> : <Button className="hl-fit" variant="secondary" busy={current?.loading} busyLabel="Opening recording…" onClick={() => void play()}>Play</Button>}</div>;
}
