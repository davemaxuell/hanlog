import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { getMission } from '@/lib/content';
import { generateReferenceAudio } from '../../../scripts/gen-reference-audio';

const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'hanlog-reference-'));
  folders.push(dir);
  const mission = getMission('cafe-iced-americano')!;
  const missionsPath = join(dir, 'missions.json');
  await writeFile(missionsPath, JSON.stringify([mission]));
  return { mission, missionsPath, outputDir: join(dir, 'audio') };
}
const clip = () => new Response(new Uint8Array(6_000), { headers: { 'content-type': 'audio/mpeg' } });
const transcript = (text: string) => new Response(JSON.stringify({ text }), { headers: { 'content-type': 'application/json' } });

it('makes no requests and changes no content in the default dry run', async () => {
  const setup = await fixture();
  const fetchImpl = vi.fn();
  const result = await generateReferenceAudio({ ...setup, fetchImpl });
  expect(result).toMatchObject({ planned: 1, generated: 0, failed: [] });
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(JSON.parse(await readFile(setup.missionsPath, 'utf8'))[0].referenceAudio).toBeNull();
});
it('publishes only a verified clip and sends the new plural Korean language hint', async () => {
  const setup = await fixture();
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(clip()).mockResolvedValueOnce(transcript(setup.mission.korean));
  const result = await generateReferenceAudio({ ...setup, live: true, apiKey: 'test-key', fetchImpl });
  expect(result.generated).toBe(1);
  expect(await readFile(join(setup.outputDir, `${setup.mission.id}.mp3`))).toHaveLength(6_000);
  expect(JSON.parse(await readFile(setup.missionsPath, 'utf8'))[0].referenceAudio).toBe(`/audio/missions/${setup.mission.id}.mp3`);
  const form = fetchImpl.mock.calls[1][1]!.body as FormData;
  expect(form.getAll('languages[]')).toEqual(['ko']);
  expect(form.has('language')).toBe(false);
  expect(form.has('prompt')).toBe(false);
});
it('retries a mismatched transcript once with cedar, then leaves no bad clip', async () => {
  const setup = await fixture();
  const fetchImpl = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(clip()).mockResolvedValueOnce(transcript('전혀 다른 말이에요'))
    .mockResolvedValueOnce(clip()).mockResolvedValueOnce(transcript('전혀 다른 말이에요'));
  const result = await generateReferenceAudio({ ...setup, live: true, apiKey: 'test-key', fetchImpl });
  expect(result.failed).toEqual([setup.mission.id]);
  expect(fetchImpl).toHaveBeenCalledTimes(4);
  expect(JSON.parse(fetchImpl.mock.calls[2][1]!.body as string).voice).toBe('cedar');
  await expect(readFile(join(setup.outputDir, `${setup.mission.id}.mp3`))).rejects.toThrow();
  expect(JSON.parse(await readFile(setup.missionsPath, 'utf8'))[0].referenceAudio).toBeNull();
});
it('rejects an unknown id or absent key before sending anything', async () => {
  const setup = await fixture();
  const fetchImpl = vi.fn();
  await expect(generateReferenceAudio({ ...setup, only: 'nope', fetchImpl })).rejects.toThrow(/Unknown mission/);
  await expect(generateReferenceAudio({ ...setup, live: true, fetchImpl })).rejects.toThrow(/OPENAI_API_KEY/);
  expect(fetchImpl).not.toHaveBeenCalled();
});
