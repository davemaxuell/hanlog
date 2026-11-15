import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validatePeerMedia } from '@/lib/media';
import { toneWav } from '../../helpers/audio';

const fixture = (name: string, mime: string) => new File([readFileSync(`tests/fixtures/media/${name}`)], name, { type: mime });
it('measures captured containers instead of trusting the supplied duration', async () => {
  for (const [name, mime, kind] of [
    ['audio.webm', 'audio/webm', 'audio'], // No duration element: packet timestamps are required.
    ['audio.mp4', 'audio/mp4', 'audio'],   // Fragmented MP4, like streaming capture.
    ['video.mp4', 'video/mp4', 'video'],
    ['audio.ogg', 'audio/ogg', 'audio'],
  ]) {
    const media = await validatePeerMedia(fixture(name, mime), kind, 1000);
    expect(media.durationMs).toBeGreaterThanOrEqual(2900);
    expect(media.durationMs).toBeLessThanOrEqual(3100);
  }
  const wav = new File([new Uint8Array(toneWav(3000))], 'audio.wav', { type: 'audio/wav' });
  expect((await validatePeerMedia(wav, 'audio', 1000)).durationMs).toBe(3000);
});
it('rejects recordings over 20 seconds even when the caller claims one second', async () => {
  await expect(validatePeerMedia(fixture('long.webm', 'audio/webm'), 'audio', 1000)).rejects.toMatchObject({ code: 'invalid_input' });
});
it('allows up to 100ms of container encoding tail and caps the stored duration at 20 seconds', async () => {
  expect((await validatePeerMedia(fixture('boundary.mp4', 'audio/mp4'), 'audio', 1000)).durationMs).toBe(20_000); // Measured 20.021s.
  expect((await validatePeerMedia(fixture('boundary.webm', 'audio/webm'), 'audio', 20_000)).durationMs).toBe(20_000);
  await expect(validatePeerMedia(fixture('over-boundary.webm', 'audio/webm'), 'audio', 1000)).rejects.toMatchObject({ code: 'invalid_input' }); // Measured 20.101s.
});
it('rejects video disguised as audio, audio disguised as video, and magic-only files', async () => {
  await expect(validatePeerMedia(fixture('video.mp4', 'audio/mp4'), 'audio', 3000)).rejects.toMatchObject({ code: 'media_invalid' });
  await expect(validatePeerMedia(fixture('audio.mp4', 'video/mp4'), 'video', 3000)).rejects.toMatchObject({ code: 'media_invalid' });
  const fake = new File([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0])], 'fake.webm', { type: 'audio/webm' });
  await expect(validatePeerMedia(fake, 'audio', 3000)).rejects.toMatchObject({ code: 'media_invalid' });
});
