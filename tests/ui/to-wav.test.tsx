import { expect, it, vi } from 'vitest';
import { ConvertError, blobToScoringWav, toMono16k } from '@/lib/audio/to-wav';
import { validateScoringWav } from '@/lib/audio/wav';

const tone = (seconds: number, rate: number, amp = 0.5) => Float32Array.from({ length: seconds * rate }, (_, i) => amp * Math.sin((2 * Math.PI * 440 * i) / rate));

it('mixes to mono and resamples to 16 kHz', () => {
  const out = toMono16k([new Float32Array(48000).fill(0.2), new Float32Array(48000).fill(0.6)], 48000);
  expect(out).toHaveLength(16000);
  expect(out[8000]).toBeCloseTo(0.4, 5);
});
it('cuts recordings longer than the limit', () => {
  expect(toMono16k([new Float32Array(25 * 16000)], 16000)).toHaveLength(20 * 16000);
});
it('produces a WAV the server will accept', async () => {
  const decode = async () => ({ sampleRate: 44100, channels: [tone(2, 44100)] });
  const info = validateScoringWav(await blobToScoringWav(new Blob([new Uint8Array(10)], { type: 'audio/webm' }), decode));
  expect(info).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 2000 });
});
it('reports undecodable and too-short input', async () => {
  const blob = new Blob([new Uint8Array(10)]);
  await expect(blobToScoringWav(blob, async () => { throw new Error('bad data'); })).rejects.toMatchObject({ code: 'undecodable' });
  await expect(blobToScoringWav(blob, async () => ({ sampleRate: 16000, channels: [new Float32Array(3200)] }))).rejects.toMatchObject({ code: 'too_short' });
  await expect(blobToScoringWav(blob, async () => ({ sampleRate: 16000, channels: [] }))).rejects.toBeInstanceOf(ConvertError);
});
it('rejects oversized input before allocating bytes or decoding', async () => {
  const decode = vi.fn(); const arrayBuffer = vi.fn();
  const blob = { size: 4_000_001, arrayBuffer } as unknown as Blob;
  await expect(blobToScoringWav(blob, decode)).rejects.toMatchObject({ code: 'audio_too_large' });
  expect(arrayBuffer).not.toHaveBeenCalled(); expect(decode).not.toHaveBeenCalled();
});
