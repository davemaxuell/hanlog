import { mkdir, writeFile } from 'node:fs/promises';
import { encodeWavPcm16 } from '../../src/lib/audio/wav';

export default async function setup() {
  await mkdir('tests/e2e/fixtures', { recursive: true });
  const rate = 48_000;
  const samples = Float32Array.from({ length: rate * 6 }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / rate));
  await writeFile('tests/e2e/fixtures/voice.wav', encodeWavPcm16(samples, rate));
}
