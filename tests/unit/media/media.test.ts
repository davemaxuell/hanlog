import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { assertSafeMediaPath, createMemoryMediaStore, validatePeerMedia } from '@/lib/media';
import { createLocalMediaStore } from '@/lib/media/local';
import { sniffMedia } from '@/lib/media/sniff';
import { mediaFile, mp4Bytes, webmBytes } from '../../api/_helpers';
import { toneWav } from '../../helpers/audio';

it('recognizes containers by magic bytes', () => {
  expect(sniffMedia(webmBytes())).toBe('webm');
  expect(sniffMedia(mp4Bytes())).toBe('mp4');
  expect(sniffMedia(toneWav(100))).toBe('wav');
  expect(sniffMedia(new TextEncoder().encode('OggS' + 'x'.repeat(50)))).toBe('ogg');
  expect(sniffMedia(new TextEncoder().encode('<script>alert(1)</script>'))).toBeNull();
  expect(sniffMedia(new Uint8Array(2))).toBeNull();
});
it('accepts consistent uploads, including a codecs suffix', async () => {
  expect(await validatePeerMedia(mediaFile(webmBytes(), 'audio/webm;codecs=opus'), 'audio', '3200')).toMatchObject({ mime: 'audio/webm', ext: 'webm', kind: 'audio', durationMs: 3001 });
  expect(await validatePeerMedia(mediaFile(mp4Bytes(), 'video/mp4'), 'video', 15000)).toMatchObject({ mime: 'video/mp4', ext: 'mp4', kind: 'video' });
});
it('rejects anything inconsistent', async () => {
  const code = (p: Promise<unknown>) => p.then(() => null, (e) => e.code);
  expect(await code(validatePeerMedia(null, 'audio', 1000))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'audio/webm'), 'movie', 1000))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'audio/webm'), 'audio', 'abc'))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'audio/webm'), 'audio', 20001))).toBe('invalid_input');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'video/webm'), 'audio', 1000))).toBe('media_invalid');   // kind does not match type
  expect(await code(validatePeerMedia(mediaFile(mp4Bytes(), 'audio/webm'), 'audio', 1000))).toBe('media_invalid');    // bytes do not match type
  expect(await code(validatePeerMedia(mediaFile(webmBytes(), 'text/html'), 'audio', 1000))).toBe('media_invalid');
  expect(await code(validatePeerMedia(mediaFile(webmBytes(4_000_001), 'audio/webm'), 'audio', 1000))).toBe('audio_too_large');
});
it('stores, reads, and removes in memory and on disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'hanlog-media-'));
  for (const store of [createMemoryMediaStore(), createLocalMediaStore(dir)]) {
    await store.put('responses/a.webm', webmBytes(100), 'audio/webm');
    expect((await store.get('responses/a.webm'))!.length).toBe(webmBytes(100).length);
    expect(await store.get('responses/missing.webm')).toBeNull();
    await store.remove(['responses/a.webm', 'responses/missing.webm']);
    expect(await store.get('responses/a.webm')).toBeNull();
  }
  rmSync(dir, { recursive: true, force: true });
});
it('refuses unsafe paths', () => {
  for (const bad of ['../etc/passwd', '/abs/path', 'responses/../../x', 'responses/a b.webm', ''])
    expect(() => assertSafeMediaPath(bad)).toThrow();
  expect(() => assertSafeMediaPath('references/3f0b1c9e-6a2d-4a57-9d0e-2f6f0c1b7a11.mp4')).not.toThrow();
});
