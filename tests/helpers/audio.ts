import { encodeWavPcm16 } from '@/lib/audio/wav';
export function toneWav(ms: number, opts: { sampleRate?: number; amplitude?: number; hz?: number } = {}): Uint8Array {
  const { sampleRate = 16000, amplitude = 0.5, hz = 440 } = opts;
  return encodeWavPcm16(Float32Array.from({ length: Math.round(ms * sampleRate / 1000) }, (_, i) => amplitude * Math.sin(2 * Math.PI * hz * i / sampleRate)), sampleRate);
}
export const silentWav = (ms: number) => toneWav(ms, { amplitude: 0 });
export function noiseWav(ms: number, amplitude = 0.3): Uint8Array {
  let seed = 42;
  return encodeWavPcm16(Float32Array.from({ length: Math.round(ms * 16) }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return (seed / 0xffffffff * 2 - 1) * amplitude; }), 16000);
}
export function withListChunk(wav: Uint8Array): Uint8Array {
  const result = new Uint8Array(wav.length + 12);
  result.set(wav.subarray(0, 36));
  result.set([76, 73, 83, 84, 4, 0, 0, 0, 73, 78, 70, 79], 36);
  result.set(wav.subarray(36), 48);
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  return result;
}
