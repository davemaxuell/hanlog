'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api, ApiClientError } from '@/lib/api-client';
import type { AttemptResult, Mission } from '@/lib/contracts';
import { blobToScoringWav, ConvertError } from '@/lib/audio/to-wav';
import { errorCopy } from '@/lib/ui/error-copy';
import { Button, CornerMark, Ko, MarginRow, StatusNote, Surface } from '@/components/ui';
import { Recorder } from '@/components/recorder/Recorder';
import type { RecorderDeps, RecorderResult } from '@/components/recorder/useRecorder';
import { ScoreCard } from './ScoreCard';
export function MissionFlow({ mission, nextHref, onScored, convert = blobToScoringWav, deps, headingLevel = 1 }: {
  mission: Mission; nextHref?: string; headingLevel?: 1 | 2; onScored?(result: AttemptResult): void;
  convert?: (blob: Blob) => Promise<Uint8Array>; deps?: Partial<RecorderDeps>;
}) {
  const [romanization, setRomanization] = useState(false); const [result, setResult] = useState<AttemptResult | null>(null);
  const [busy, setBusy] = useState(false); const [phase, setPhase] = useState('Listening…'); const [error, setError] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState(false); const audio = useRef<HTMLAudioElement>(null);
  const lock = useRef(false); const alive = useRef(true); const router = useRouter(); const pathname = usePathname();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const submit = async (recording: RecorderResult) => {
    if (lock.current) return; lock.current = true; setBusy(true); setPhase('Preparing recording…'); setError(null);
    try {
      const wav = await convert(recording.audioBlob); if (!alive.current) return;
      setPhase('Listening…'); const scored = await api.submitAttempt(mission.id, wav);
      if (alive.current) { setResult(scored); onScored?.(scored); }
    } catch (cause) {
      if (!alive.current) return;
      if (cause instanceof ApiClientError && cause.code === 'unauthenticated') router.replace(`/app/onboarding?next=${encodeURIComponent(pathname)}`);
      else setError(errorCopy(cause instanceof ConvertError || cause instanceof ApiClientError ? cause.code : 'internal'));
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <div className="hl-stack hl-mission-flow">
    <MarginRow label={<>Level {mission.level}<span className="hl-caption">{mission.basePoints} pt</span></>}><header className="hl-stack-sm"><p className="hl-eyebrow">{mission.mode === 'repeat' ? 'Listen. Speak. Find your rhythm.' : 'Your words, your way.'}</p><Ko as={headingLevel === 1 ? 'h1' : 'h2'} className="hl-mission-expression">{mission.korean}</Ko><Button variant="text" className="hl-romanization-toggle" aria-expanded={romanization} onClick={() => setRomanization(value => !value)}>{romanization ? 'Hide romanization' : 'Show romanization'}</Button>{romanization && <p className="hl-caption">{mission.romanization}</p>}<p className="hl-meaning">{mission.meaningEn}</p></header></MarginRow>
    <CornerMark><Surface tone="apricot"><div className="hl-stack-sm"><h2 className="hl-note-heading">Where to say it</h2><p>{mission.situationEn}</p></div></Surface></CornerMark>
    <p className="hl-instruction">{mission.promptEn}</p>
    {mission.referenceAudio && <div className="hl-stack-sm"><div className="hl-actions"><Button variant="secondary" onClick={() => { setReferenceOpen(true); void audio.current?.play().catch(() => setError('This recording is no longer available.')); }}>Listen</Button><span className="hl-caption">AI voice</span></div><audio ref={audio} src={mission.referenceAudio} preload="none" controls hidden={!referenceOpen} className="hl-media" aria-label="Mission reference" /></div>}
    {error && <StatusNote tone="error">{error}</StatusNote>}
    {result ? <ScoreCard result={result} mission={mission} nextHref={nextHref} onRetry={() => { setResult(null); setError(null); }} /> : <><Recorder modes={['audio', 'video']} allowUpload submitLabel="Get my score" busy={busy} busyLabel={phase} onSubmit={submit} deps={deps} /><p className="hl-caption">Up to 15 seconds. Your solo recording is used for scoring, then discarded.</p></>}
  </div>;
}
