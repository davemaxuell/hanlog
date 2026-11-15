'use client';
import { useState, useSyncExternalStore } from 'react';
import { Button, StatusNote, Surface } from '@/components/ui';
const subscribe = () => () => {};
export function SharePanel({ code, origin }: { code: string; origin?: string }) {
  const browserOrigin = useSyncExternalStore(subscribe, () => window.location.origin, () => '');
  const canShare = useSyncExternalStore(subscribe, () => typeof navigator.share === 'function', () => false);
  const link = `${origin ?? browserOrigin}/c/${code}`; const [copied, setCopied] = useState(false); const [error, setError] = useState<string | null>(null);
  return <Surface tone="apricot"><div className="hl-stack-sm"><p className="hl-eyebrow">An invitation to speak</p><h2>Your challenge is ready.</h2><p>Share this code or send the link to a learner.</p><p className="hl-share-code" data-testid="share-code">{code}</p><a href={link} className="hl-share-link">{link}</a><div className="hl-actions"><Button onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setError(null); } catch { setError('Copy did not work. You can select and copy the link above.'); } }}>{copied ? 'Copied' : 'Copy link'}</Button>{canShare && <Button variant="secondary" onClick={async () => { try { await navigator.share({ title: 'Try my Korean challenge on HanLog', url: link }); } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('Sharing did not open. Try copying the link instead.'); } }}>Share</Button>}</div>{copied && <span className="hl-sr-only" role="status">Link copied.</span>}{error && <StatusNote tone="error">{error}</StatusNote>}</div></Surface>;
}
