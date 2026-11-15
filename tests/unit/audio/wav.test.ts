import { expect, it } from 'vitest';
import { WavError, encodeWavPcm16, parseWav, resampleLinear, validateScoringWav, wavRms, wavToFloat32 } from '@/lib/audio/wav';
import { silentWav, toneWav, withListChunk } from '../../helpers/audio';

const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as WavError).code; } return null; };

it('round-trips a tone', () => {
  const wav = toneWav(1500);
  expect(wav.length).toBe(44 + 1500 * 32);
  expect(parseWav(wav)).toMatchObject({ sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 1500, dataOffset: 44 });
  expect(validateScoringWav(wav).durationMs).toBe(1500);
});
it('measures loudness', () => {
  expect(wavRms(toneWav(1000, { amplitude: 0.5 }))).toBeCloseTo(0.5 / Math.SQRT2, 1);
  expect(wavRms(silentWav(1000))).toBe(0);
});
it('rejects what scoring cannot use', () => {
  expect(code(() => validateScoringWav(new Uint8Array([1, 2, 3])))).toBe('not_wav');
  expect(code(() => validateScoringWav(toneWav(300)))).toBe('too_short');
  expect(code(() => validateScoringWav(toneWav(21000)))).toBe('too_long');
  expect(code(() => validateScoringWav(toneWav(22000)))).toBe('too_large');
  expect(code(() => validateScoringWav(toneWav(1000, { sampleRate: 44100 })))).toBe('unsupported');
});
it('parses files with extra chunks before data', () => {
  expect(parseWav(withListChunk(toneWav(1000))).durationMs).toBe(1000);
});
it('trusts the bytes present over the header', () => {
  const wav = toneWav(1000);
  const truncated = wav.slice(0, 44 + 500 * 32); // header still claims 1000 ms
  expect(parseWav(truncated).durationMs).toBe(500);
});
it('refuses ambiguous or truncated containers at the scoring boundary', () => {
  const wav = toneWav(1000);
  const duplicateFormat = new Uint8Array(wav.length + 24);
  duplicateFormat.set(wav); duplicateFormat.set(wav.subarray(12, 36), wav.length);
  new DataView(duplicateFormat.buffer).setUint32(4, duplicateFormat.length - 8, true);
  const duplicateData = new Uint8Array(wav.length + 8);
  duplicateData.set(wav); duplicateData.set([100, 97, 116, 97, 0, 0, 0, 0], wav.length);
  new DataView(duplicateData.buffer).setUint32(4, duplicateData.length - 8, true);
  const badRate = wav.slice(); new DataView(badRate.buffer).setUint32(28, 1, true);
  const truncated = wav.slice(0, 44 + 600 * 32);
  const partialFrame = new Uint8Array(wav.length + 2); partialFrame.set(wav);
  new DataView(partialFrame.buffer).setUint32(4, partialFrame.length - 8, true);
  new DataView(partialFrame.buffer).setUint32(40, wav.length - 44 + 1, true);
  for (const input of [duplicateFormat, duplicateData, badRate, truncated, partialFrame]) {
    expect(() => validateScoringWav(input)).toThrow(WavError);
  }
  expect(validateScoringWav(withListChunk(wav)).durationMs).toBe(1000);
});
it('clips out-of-range samples when encoding', () => {
  const wav = encodeWavPcm16(new Float32Array([2, -2, 0]), 16000);
  const view = new DataView(wav.buffer, 44);
  expect([view.getInt16(0, true), view.getInt16(2, true), view.getInt16(4, true)]).toEqual([32767, -32768, 0]);
});
it('decodes and resamples', () => {
  const { samples, sampleRate } = wavToFloat32(toneWav(1000, { sampleRate: 24000 }));
  expect(sampleRate).toBe(24000);
  expect(samples).toHaveLength(24000);
  const down = resampleLinear(samples, 24000, 16000);
  expect(down).toHaveLength(16000);
  expect(validateScoringWav(encodeWavPcm16(down, 16000)).durationMs).toBe(1000);
  const flat = resampleLinear(new Float32Array(300).fill(0.25), 48000, 16000);
  expect(flat).toHaveLength(100);
  expect([...flat].every((v) => Math.abs(v - 0.25) < 1e-6)).toBe(true);
  expect([...resampleLinear(new Float32Array([0.1, 0.2]), 16000, 16000)]).toEqual([...new Float32Array([0.1, 0.2])]);
});
