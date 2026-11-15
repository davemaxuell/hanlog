'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LIMITS, type MediaKind } from '@/lib/contracts';
export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'denied' | 'unsupported' | 'error';
export type RecorderResult = { blob: Blob; audioBlob: Blob; kind: MediaKind; mimeType: string; durationMs: number };
export type RecorderDeps = {
  supported: () => boolean;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createRecorder: (stream: MediaStream, options: MediaRecorderOptions) => MediaRecorder;
  audioOnly: (stream: MediaStream) => MediaStream;
  isTypeSupported: (type: string) => boolean;
  createLevelMeter: (stream: MediaStream) => { read(): number; close(): void };
  now: () => number;
};
const MESSAGES = {
  denied: 'Microphone access is off. Allow it in your browser settings, or upload a voice file.',
  unsupported: "This browser can't record here. You can upload a voice file instead.",
  short: 'That was too short. Speak for at least a second.',
  hidden: 'Recording stopped because you left the page.',
  error: "We couldn't start recording. Try again.",
};
export function pickMimeType(kind: MediaKind, supported: (type: string) => boolean): string | undefined {
  const types = kind === 'audio' ? ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'] : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm'];
  return types.find(type => supported(type));
}
const browserDeps: RecorderDeps = {
  supported: () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints),
  createRecorder: (stream, options) => new MediaRecorder(stream, options),
  audioOnly: stream => new MediaStream(stream.getAudioTracks()),
  isTypeSupported: type => MediaRecorder.isTypeSupported(type),
  now: () => performance.now(),
  createLevelMeter(stream) {
    const Context = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return { read: () => 0, close() {} };
    const context = new Context(); const analyser = context.createAnalyser(); analyser.fftSize = 256;
    const source = context.createMediaStreamSource(stream); source.connect(analyser);
    const data = new Float32Array(analyser.fftSize);
    return { read() { analyser.getFloatTimeDomainData(data); return Math.min(1, Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length) * 4); }, close() { source.disconnect(); void context.close().catch(() => {}); } };
  },
};
type Bundle = { recorder: MediaRecorder; finished: Promise<Blob> };
function bundle(recorder: MediaRecorder): Bundle {
  const chunks: Blob[] = [];
  const finished = new Promise<Blob>(resolve => {
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
  return { recorder, finished };
}
export function useRecorder(opts?: { maxSeconds?: number; deps?: Partial<RecorderDeps> }) {
  const [deps] = useState<RecorderDeps>(() => ({ ...browserDeps, ...opts?.deps }));
  const maxSeconds = opts?.maxSeconds ?? LIMITS.recorder.maxSeconds;
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [mode, setModeState] = useState<MediaKind>('audio');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0); const [level, setLevel] = useState(0);
  const [result, setResult] = useState<RecorderResult | null>(null); const [message, setMessage] = useState<string | null>(null);
  const alive = useRef(true); const generation = useRef(0); const active = useRef(false);
  const resources = useRef<{ stream?: MediaStream; full?: Bundle; audio?: Bundle; meter?: ReturnType<RecorderDeps['createLevelMeter']>; timer?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval>; startedAt?: number; kind?: MediaKind }>({});
  const release = useCallback(() => {
    const current = resources.current;
    clearTimeout(current.timer); clearInterval(current.tick);
    current.meter?.close(); current.stream?.getTracks().forEach(track => track.stop());
    current.meter = undefined; current.stream = undefined;
    if (alive.current) { setStream(null); setLevel(0); }
  }, []);
  const cancel = useCallback((note: string | null = null, next: RecorderStatus = 'idle') => {
    generation.current++; active.current = false;
    for (const item of [resources.current.full, resources.current.audio]) if (item?.recorder.state === 'recording') item.recorder.stop();
    release(); resources.current = {};
    if (alive.current) { setResult(null); setElapsedMs(0); setStatus(next); setMessage(note); }
  }, [release]);
  const stop = useCallback(() => {
    const current = resources.current; if (!active.current || !current.full || current.startedAt === undefined) return;
    active.current = false; const token = generation.current;
    const durationMs = Math.min(maxSeconds * 1000, Math.max(0, Math.round(deps.now() - current.startedAt)));
    for (const item of [current.full, current.audio]) if (item?.recorder.state === 'recording') item.recorder.stop();
    release();
    void Promise.all([current.full.finished, current.audio?.finished]).then(([blob, audio]) => {
      if (!alive.current || token !== generation.current) return;
      if (durationMs < LIMITS.recorder.minMs) { setStatus('idle'); setMessage(MESSAGES.short); setResult(null); return; }
      if (!blob.size || (audio && !audio.size)) { setStatus('error'); setMessage(MESSAGES.error); return; }
      setElapsedMs(durationMs); setResult({ blob, audioBlob: audio ?? blob, kind: current.kind!, mimeType: blob.type, durationMs }); setStatus('recorded');
    });
  }, [deps, maxSeconds, release]);
  const start = useCallback(async () => {
    if (active.current) return;
    if (!deps.supported()) { setStatus('unsupported'); setMessage(MESSAGES.unsupported); return; }
    active.current = true; const token = ++generation.current;
    setStatus('requesting'); setMessage(null); setResult(null); setElapsedMs(0);
    try {
      const media = await deps.getUserMedia(mode === 'audio' ? { audio: true } : { audio: true, video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } } });
      if (!alive.current || token !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      resources.current = { stream: media, kind: mode };
      const type = pickMimeType(mode, deps.isTypeSupported);
      const full = bundle(deps.createRecorder(media, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 64_000, ...(mode === 'video' ? { videoBitsPerSecond: 800_000 } : {}) }));
      resources.current.full = full;
      if (mode === 'video') {
        const audioType = pickMimeType('audio', deps.isTypeSupported);
        resources.current.audio = bundle(deps.createRecorder(deps.audioOnly(media), { ...(audioType ? { mimeType: audioType } : {}), audioBitsPerSecond: 64_000 }));
      }
      for (const item of [full, resources.current.audio]) if (item) { item.recorder.onerror = () => cancel(MESSAGES.error, 'error'); item.recorder.start(); }
      resources.current.startedAt = deps.now();
      try { resources.current.meter = deps.createLevelMeter(media); } catch { /* Recording remains usable without a level meter. */ }
      resources.current.tick = setInterval(() => { if (alive.current && active.current) { setElapsedMs(Math.min(maxSeconds * 1000, deps.now() - (resources.current.startedAt ?? deps.now()))); setLevel(resources.current.meter?.read() ?? 0); } }, 100);
      resources.current.timer = setTimeout(stop, maxSeconds * 1000);
      setStream(media); setStatus('recording');
    } catch (error) {
      if (!alive.current || token !== generation.current) return;
      const denied = error instanceof DOMException && ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name);
      cancel(denied ? MESSAGES.denied : MESSAGES.error, denied ? 'denied' : 'error');
    }
  }, [deps, mode, maxSeconds, stop, cancel]);
  useEffect(() => {
    alive.current = true;
    const hidden = () => { if (document.hidden && active.current) cancel(MESSAGES.hidden); };
    document.addEventListener('visibilitychange', hidden);
    return () => { alive.current = false; document.removeEventListener('visibilitychange', hidden); cancel(); };
  }, [cancel]);
  const reset = useCallback(() => cancel(), [cancel]);
  const setMode = useCallback((kind: MediaKind) => { if (!active.current) { cancel(); setModeState(kind); } }, [cancel]);
  return { status, mode, setMode, stream, elapsedMs, level, result, message, start, stop, reset };
}
