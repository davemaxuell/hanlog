import { LIMITS } from '../contracts';
import { encodeWavPcm16, resampleLinear } from './wav';
export type Decoder = (data: ArrayBuffer) => Promise<{ sampleRate: number; channels: Float32Array[] }>;
export class ConvertError extends Error {
  readonly code: 'undecodable' | 'too_short';
  constructor(code: 'undecodable' | 'too_short') { super(code); this.name = 'ConvertError'; this.code = code; }
}
export function toMono16k(channels: Float32Array[], sampleRate: number, maxMs: number = LIMITS.scoringWav.maxMs): Float32Array {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0 || !channels[0].length) throw new ConvertError('undecodable');
  const length = Math.min(...channels.map(channel => channel.length), Math.ceil(sampleRate * maxMs / 1000));
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) for (const channel of channels) mono[i] += channel[i] / channels.length;
  return resampleLinear(mono, sampleRate, LIMITS.scoringWav.sampleRate).slice(0, Math.floor(LIMITS.scoringWav.sampleRate * maxMs / 1000));
}
const browserDecode: Decoder = async data => {
  const AudioContextClass = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new ConvertError('undecodable');
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(data);
    return { sampleRate: decoded.sampleRate, channels: Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i).slice()) };
  } finally { await context.close(); }
};
async function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(reader.error); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(blob); });
}
export async function blobToScoringWav(blob: Blob, decode: Decoder = browserDecode): Promise<Uint8Array> {
  try {
    const decoded = await decode(await bytesOf(blob));
    const samples = toMono16k(decoded.channels, decoded.sampleRate);
    if (samples.length / LIMITS.scoringWav.sampleRate * 1000 < LIMITS.recorder.minMs) throw new ConvertError('too_short');
    return encodeWavPcm16(samples, LIMITS.scoringWav.sampleRate);
  } catch (error) { throw error instanceof ConvertError ? error : new ConvertError('undecodable'); }
}
