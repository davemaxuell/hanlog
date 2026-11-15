'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { MediaKind } from '@/lib/contracts';
import { Button, StatusNote } from '@/components/ui';
import { useRecorder, type RecorderDeps, type RecorderResult } from './useRecorder';
function Preview({ blob, kind }: { blob: Blob; kind: MediaKind }) {
  const media = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob); const element = media.current;
    if (element) element.src = url;
    return () => { element?.removeAttribute('src'); URL.revokeObjectURL(url); };
  }, [blob]);
  return kind === 'video' ? <video ref={element => { media.current = element; }} controls playsInline aria-label="Recording preview" className="hl-media" /> : <audio ref={element => { media.current = element; }} controls aria-label="Recording preview" className="hl-media" />;
}
function LiveVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { const element = ref.current; if (element) element.srcObject = stream; return () => { if (element) element.srcObject = null; }; }, [stream]);
  return <video ref={ref} muted autoPlay playsInline className="hl-media hl-live-video" aria-label="Live camera preview" />;
}
export function Recorder({ modes, submitLabel, onSubmit, onReset, busy = false, busyLabel = 'Listening…', allowUpload = false, deps }: {
  modes: MediaKind[]; submitLabel: string; onSubmit(result: RecorderResult): void | Promise<void>;
  onReset?(): void; busy?: boolean; busyLabel?: string; allowUpload?: boolean; deps?: Partial<RecorderDeps>;
}) {
  const recorder = useRecorder({ deps }); const group = useId();
  const [upload, setUpload] = useState<RecorderResult | null>(null); const [submitted, setSubmitted] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false); const blocked = busy || pending;
  const lock = useRef(false); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const recorded = upload ?? recorder.result; const capturing = recorder.status === 'recording' || recorder.status === 'requesting';
  const reset = () => { recorder.reset(); setUpload(null); lock.current = false; setSubmitted(false); setSubmissionError(null); onReset?.(); };
  const submit = () => {
    if (!recorded || busy || lock.current) return;
    lock.current = true; setSubmitted(true); setSubmissionError(null);
    const failed = () => { if (alive.current) setSubmissionError('We could not complete that. Please try again.'); };
    const unlock = () => { lock.current = false; if (alive.current) { setSubmitted(false); setPending(false); } };
    try {
      const pending = onSubmit(recorded);
      if (pending && typeof pending.then === 'function') { setPending(true); void pending.catch(failed).finally(unlock); }
    } catch { failed(); unlock(); }
  };
  return <div className="hl-recorder hl-stack-sm">
    {submissionError && <StatusNote tone="error">{submissionError}</StatusNote>}
    {modes.length > 1 && <fieldset className="hl-mode-switch"><legend className="hl-caption">Record your answer</legend>{modes.map(kind => <label key={kind} className={recorder.mode === kind ? 'is-selected' : ''}><input type="radio" name={group} checked={recorder.mode === kind} disabled={capturing || blocked} onChange={() => { reset(); recorder.setMode(kind); }} /><span>{kind === 'audio' ? 'Voice' : 'Video'}</span></label>)}</fieldset>}
    {recorder.message && <StatusNote tone={recorder.status === 'idle' ? 'info' : 'error'}>{allowUpload ? recorder.message : recorder.message.replace(' Allow it in your browser settings, or upload a voice file.', ' Allow it in your browser settings.').replace(' You can upload a voice file instead.', ' Try a recent browser with microphone access.')}</StatusNote>}
    {recorder.stream && recorder.mode === 'video' && <LiveVideo stream={recorder.stream} />}
    {recorded && <Preview blob={recorded.blob} kind={recorded.kind} />}
    <div className="hl-capture-panel">
      <div aria-live="polite" className="hl-recording-status">{recorder.status === 'requesting' ? 'Allow microphone access to begin.' : recorder.status === 'recording' ? 'Recording your voice…' : recorded ? 'Ready when you are. Listen back before sending.' : 'Your next conversation starts here.'}</div>
      {recorder.status === 'recording' && <><span className="hl-timer">0:{String(Math.floor(recorder.elapsedMs / 1000)).padStart(2, '0')} / 0:15</span><div className="hl-level" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(recorder.level * 100)}><span style={{ width: `${recorder.level * 100}%` }} /></div></>}
      <div className="hl-actions">
        {recorder.status === 'recording' ? <Button onClick={recorder.stop}><span aria-hidden="true" className="hl-stop-icon" />Stop</Button> : !recorded && <Button busy={recorder.status === 'requesting'} busyLabel="Asking for permission…" disabled={busy} onClick={() => void recorder.start()}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="7" y="2" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v3m-3 0h6" stroke="currentColor" strokeWidth="1.5"/></svg>Record</Button>}
        {recorded && <><Button variant="secondary" disabled={blocked} onClick={reset}>Retake</Button><Button onClick={submit} disabled={submitted} busy={blocked} busyLabel={busyLabel}>{submitLabel}</Button></>}
      </div>
    </div>
    {allowUpload && !capturing && !blocked && <label className="hl-upload">Upload a voice file<input type="file" accept="audio/*,.m4a,.wav,.mp3,.ogg,.webm" onChange={event => { const file = event.target.files?.[0]; if (file) { reset(); setUpload({ blob: file, audioBlob: file, kind: 'audio', mimeType: file.type, durationMs: 0 }); } }} /></label>}
  </div>;
}
