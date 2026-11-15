import { vi } from 'vitest';
import type { RecorderDeps } from '@/components/recorder/useRecorder';
Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:preview') });
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
export function fakeStream(): MediaStream & { stopped(): boolean } {
  let stopped = false;
  const track = { stop: () => { stopped = true; } } as MediaStreamTrack;
  return { getTracks: () => [track], getAudioTracks: () => [track], getVideoTracks: () => [track], stopped: () => stopped } as unknown as MediaStream & { stopped(): boolean };
}
export class FakeMediaRecorder {
  state: RecordingState = 'inactive'; mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, options: MediaRecorderOptions) { this.mimeType = options.mimeType ?? 'audio/webm'; }
  start() { this.state = 'recording'; }
  stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: this.mimeType }) } as BlobEvent); this.onstop?.(); }); }
}
export function fakeDeps(over: Partial<RecorderDeps> = {}): RecorderDeps & { clock: { advance(ms: number): void }; streams: Array<ReturnType<typeof fakeStream>> } {
  let now = 0; const streams: Array<ReturnType<typeof fakeStream>> = [];
  return { supported: () => true, getUserMedia: async () => { const stream = fakeStream(); streams.push(stream); return stream; }, createRecorder: (stream, options) => new FakeMediaRecorder(stream, options) as unknown as MediaRecorder, audioOnly: stream => stream, isTypeSupported: () => true, createLevelMeter: () => ({ read: () => .4, close() {} }), now: () => now, clock: { advance(ms) { now += ms; } }, streams, ...over };
}
