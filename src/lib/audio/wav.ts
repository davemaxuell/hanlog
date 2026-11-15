import { LIMITS } from '../contracts';
export type WavInfo = { sampleRate: number; channels: number; bitsPerSample: number; durationMs: number; dataOffset: number; dataLength: number };
export type WavErrorCode = 'not_wav' | 'unsupported' | 'too_short' | 'too_long' | 'too_large';
export class WavError extends Error {
  readonly code: WavErrorCode;
  constructor(code: WavErrorCode) { super(code); this.name = 'WavError'; this.code = code; }
}
const tag = (bytes: Uint8Array, start: number) => String.fromCharCode(...bytes.subarray(start, start + 4));
export function parseWav(bytes: Uint8Array): WavInfo {
  if (bytes.length < 12 || tag(bytes, 0) !== 'RIFF' || tag(bytes, 8) !== 'WAVE') throw new WavError('not_wav');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let format: { sampleRate: number; channels: number; bitsPerSample: number; blockAlign: number } | undefined;
  let data: { dataOffset: number; dataLength: number } | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = tag(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (name === 'fmt ') {
      if (size < 16 || start + 16 > bytes.length) throw new WavError('not_wav');
      if (view.getUint16(start, true) !== 1) throw new WavError('unsupported');
      format = { channels: view.getUint16(start + 2, true), sampleRate: view.getUint32(start + 4, true), blockAlign: view.getUint16(start + 12, true), bitsPerSample: view.getUint16(start + 14, true) };
      if (!format.channels || !format.sampleRate || !format.bitsPerSample || format.blockAlign !== format.channels * format.bitsPerSample / 8) throw new WavError('unsupported');
    }
    if (name === 'data' && !data) data = { dataOffset: start, dataLength: Math.min(size, bytes.length - start) };
    offset = start + size + size % 2;
  }
  if (!format || !data) throw new WavError('not_wav');
  const dataLength = Math.floor(data.dataLength / format.blockAlign) * format.blockAlign;
  return { sampleRate: format.sampleRate, channels: format.channels, bitsPerSample: format.bitsPerSample, dataOffset: data.dataOffset, dataLength, durationMs: dataLength / format.blockAlign / format.sampleRate * 1000 };
}
export function validateScoringWav(bytes: Uint8Array): WavInfo {
  if (bytes.length > LIMITS.scoringWav.maxBytes) throw new WavError('too_large');
  validateCompletePcmContainer(bytes);
  const info = parseWav(bytes);
  if (info.sampleRate !== LIMITS.scoringWav.sampleRate || info.channels !== 1 || info.bitsPerSample !== 16) throw new WavError('unsupported');
  if (info.durationMs < LIMITS.scoringWav.minMs) throw new WavError('too_short');
  if (info.durationMs > LIMITS.scoringWav.maxMs) throw new WavError('too_long');
  return info;
}
// The local reader can salvage truncated PCM for conversion. The paid scoring
// boundary must describe one complete stream unambiguously to any WAV decoder.
function validateCompletePcmContainer(bytes: Uint8Array): void {
  if (bytes.length < 44 || tag(bytes, 0) !== 'RIFF' || tag(bytes, 8) !== 'WAVE') throw new WavError('not_wav');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== bytes.length - 8) throw new WavError('not_wav');
  let formats = 0, dataChunks = 0, blockAlign = 0;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new WavError('not_wav');
    const name = tag(bytes, offset), size = view.getUint32(offset + 4, true), start = offset + 8;
    const next = start + size + size % 2;
    if (next > bytes.length) throw new WavError('not_wav');
    if (name === 'fmt ') {
      if (++formats !== 1 || dataChunks || size < 16) throw new WavError('not_wav');
      blockAlign = view.getUint16(start + 12, true);
      if (!blockAlign || view.getUint32(start + 8, true) !== view.getUint32(start + 4, true) * blockAlign) throw new WavError('unsupported');
    }
    if (name === 'data' && (formats !== 1 || ++dataChunks !== 1 || size % blockAlign !== 0)) throw new WavError('not_wav');
    offset = next;
  }
  if (formats !== 1 || dataChunks !== 1) throw new WavError('not_wav');
}
export function wavRms(bytes: Uint8Array): number {
  const info = parseWav(bytes);
  if (info.bitsPerSample !== 16) throw new WavError('unsupported');
  const view = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, info.dataLength);
  let sum = 0;
  for (let i = 0; i < info.dataLength; i += 2) sum += (view.getInt16(i, true) / 32768) ** 2;
  return info.dataLength ? Math.sqrt(sum / (info.dataLength / 2)) : 0;
}
export function encodeWavPcm16(samples: Float32Array, sampleRate: number): Uint8Array {
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) throw new WavError('unsupported');
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const writeTag = (offset: number, s: string) => { [...s].forEach((c, i) => { bytes[offset + i] = c.charCodeAt(0); }); };
  writeTag(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); writeTag(8, 'WAVE'); writeTag(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeTag(36, 'data'); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => { const v = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0; view.setInt16(44 + i * 2, Math.round(v * (v < 0 ? 32768 : 32767)), true); });
  return bytes;
}
export function wavToFloat32(bytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const info = parseWav(bytes);
  if (info.bitsPerSample !== 16) throw new WavError('unsupported');
  const samples = new Float32Array(info.dataLength / 2 / info.channels);
  const view = new DataView(bytes.buffer, bytes.byteOffset + info.dataOffset, info.dataLength);
  for (let frame = 0; frame < samples.length; frame++) {
    let sum = 0;
    for (let channel = 0; channel < info.channels; channel++) sum += view.getInt16((frame * info.channels + channel) * 2, true) / 32768;
    samples[frame] = sum / info.channels;
  }
  return { samples, sampleRate: info.sampleRate };
}
export function resampleLinear(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (![fromRate, toRate].every(n => Number.isFinite(n) && n > 0)) throw new WavError('unsupported');
  if (fromRate === toRate) return samples.slice();
  const result = new Float32Array(Math.round(samples.length * toRate / fromRate));
  for (let i = 0; i < result.length; i++) {
    const position = i * fromRate / toRate;
    const left = Math.min(Math.floor(position), samples.length - 1);
    const right = Math.min(left + 1, samples.length - 1);
    result[i] = samples[left] + (samples[right] - samples[left]) * (position - left);
  }
  return result;
}
