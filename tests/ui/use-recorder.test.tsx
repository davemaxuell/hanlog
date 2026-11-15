import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { pickMimeType, useRecorder } from '@/components/recorder/useRecorder';
import { fakeDeps } from './_fakes';

it('picks the first supported type', () => {
  expect(pickMimeType('audio', (t) => t === 'audio/mp4')).toBe('audio/mp4');
  expect(pickMimeType('video', (t) => t.startsWith('video/webm'))).toBe('video/webm;codecs=vp9,opus');
  expect(pickMimeType('audio', () => false)).toBeUndefined();
});
it('records audio from one tap and releases the microphone', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  expect(result.current.status).toBe('recording');
  act(() => { deps.clock.advance(3200); result.current.stop(); });
  await waitFor(() => expect(result.current.status).toBe('recorded'));
  expect(result.current.result).toMatchObject({ kind: 'audio', mimeType: 'audio/webm;codecs=opus', durationMs: 3200 });
  expect(result.current.result!.audioBlob).toBe(result.current.result!.blob);
  expect(deps.streams[0].stopped()).toBe(true);
});
it('records video plus a separate audio-only track', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  act(() => result.current.setMode('video'));
  await act(() => result.current.start());
  act(() => { deps.clock.advance(2000); result.current.stop(); });
  await waitFor(() => expect(result.current.status).toBe('recorded'));
  expect(result.current.result!.kind).toBe('video');
  expect(result.current.result!.blob.type).toContain('video/');
  expect(result.current.result!.audioBlob.type).toContain('audio/');
});
it('stops by itself at the maximum length', async () => {
  vi.useFakeTimers();
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ maxSeconds: 15, deps }));
  await act(() => result.current.start());
  await act(async () => { deps.clock.advance(15000); await vi.advanceTimersByTimeAsync(15000); });
  expect(result.current.status).toBe('recorded');
  expect(result.current.result!.durationMs).toBe(15000);
  vi.useRealTimers();
});
it('explains a denied permission and an unsupported browser', async () => {
  const denied = fakeDeps({ getUserMedia: async () => { throw new DOMException('no', 'NotAllowedError'); } });
  const a = renderHook(() => useRecorder({ deps: denied }));
  await act(() => a.result.current.start());
  expect(a.result.current.status).toBe('denied');
  expect(a.result.current.message).toBe('Microphone access is off. Allow it in your browser settings, or upload a voice file.');
  const b = renderHook(() => useRecorder({ deps: fakeDeps({ supported: () => false }) }));
  await act(() => b.result.current.start());
  expect(b.result.current.status).toBe('unsupported');
});
it('discards a recording that is too short', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  act(() => { deps.clock.advance(200); result.current.stop(); });
  await waitFor(() => expect(result.current.status).toBe('idle'));
  expect(result.current.result).toBeNull();
  expect(result.current.message).toBe('That was too short. Speak for at least a second.');
});
it('stops and releases when the page is hidden or the component unmounts', async () => {
  const deps = fakeDeps();
  const { result, unmount } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  act(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await waitFor(() => expect(result.current.status).toBe('idle'));
  expect(result.current.message).toBe('Recording stopped because you left the page.');
  expect(deps.streams[0].stopped()).toBe(true);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  await act(() => result.current.start());
  unmount();
  expect(deps.streams[1].stopped()).toBe(true);
});
it('ignores a second start while one is in progress', async () => {
  const deps = fakeDeps();
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(async () => { await Promise.all([result.current.start(), result.current.start()]); });
  expect(deps.streams).toHaveLength(1);
});
it('still releases microphone tracks when a level meter fails during teardown', async () => {
  const close = vi.fn().mockImplementationOnce(() => { throw new Error('audio device gone'); });
  const deps = fakeDeps({ createLevelMeter: () => ({ read: () => 0, close }) });
  const { result } = renderHook(() => useRecorder({ deps }));
  await act(() => result.current.start());
  deps.clock.advance(1500);
  expect(() => act(() => result.current.stop())).not.toThrow();
  expect(deps.streams[0].stopped()).toBe(true);
  await waitFor(() => expect(result.current.status).toBe('recorded'));
});
