import { expect, it, vi } from 'vitest';
import { getMission } from '@/lib/content';
import { createOpenAiProvider, parseOpenAiScore } from '@/lib/scoring/openai';
import { ScoringFailedError } from '@/lib/scoring/types';
import { toneWav } from '../../helpers/audio';

const mission = getMission('cafe-iced-americano')!;
const wav = toneWav(600);
const good = { speechDetected: true, heard: '아이스 아메리카노 한 잔 주세요', pronunciation: 82, accuracy: 95, usage: 80, issues: [{ segment: '잔', problem: 'p', tip: 't' }], praise: 'Nice.', nextTip: 'Again.' };
const toolReply = (args: unknown) => ({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ type: 'function', function: { name: 'submit_score', arguments: typeof args === 'string' ? args : JSON.stringify(args) } }] } }], usage: { prompt_tokens: 300, completion_tokens: 90 } });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const provider = (fetchImpl: typeof fetch, extra = {}) => createOpenAiProvider({ apiKey: 'sk-test', model: 'gpt-audio-1.5', fetchImpl, retryDelayMs: 0, ...extra });

it('sends the documented request and returns the parsed score', async () => {
  const fetchImpl = vi.fn(async () => ok(toolReply(good)));
  expect(await provider(fetchImpl as unknown as typeof fetch).score({ wav, mission })).toEqual(good);
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/chat/completions');
  expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  const body = JSON.parse(init.body as string);
  expect(body.model).toBe('gpt-audio-1.5');
  expect(body.messages[0].role).toBe('system');
  const [text, audio] = body.messages[1].content;
  expect(text.type).toBe('text');
  expect(text.text).toContain('Target sentence (Hangul): 아이스 아메리카노 한 잔 주세요.');
  expect(audio.type).toBe('input_audio');
  expect(audio.input_audio.format).toBe('wav');
  expect(Buffer.from(audio.input_audio.data, 'base64').equals(Buffer.from(wav))).toBe(true);
});
it('accepts a JSON object in plain content when no tool call is present', async () => {
  const fetchImpl = vi.fn(async () => ok({ choices: [{ message: { role: 'assistant', content: '```json\n' + JSON.stringify(good) + '\n```' } }] }));
  expect(await provider(fetchImpl as unknown as typeof fetch).score({ wav, mission })).toEqual(good);
});
it('coerces numeric strings and passes "no speech" through untouched', async () => {
  const stringy = { ...good, pronunciation: '82', accuracy: '95', usage: '80' };
  expect((await provider(vi.fn(async () => ok(toolReply(stringy))) as unknown as typeof fetch).score({ wav, mission })).pronunciation).toBe(82);
  const silent = { ...good, speechDetected: false, heard: '' };
  expect(await provider(vi.fn(async () => ok(toolReply(silent))) as unknown as typeof fetch).score({ wav, mission })).toEqual(silent);
});
it('fails cleanly on malformed output', async () => {
  for (const bad of ['{not json', { heard: 'x' }, { ...good, issues: 'none' }])
    await expect(provider(vi.fn(async () => ok(toolReply(bad))) as unknown as typeof fetch).score({ wav, mission })).rejects.toBeInstanceOf(ScoringFailedError);
  await expect(provider(vi.fn(async () => ok({ choices: [] })) as unknown as typeof fetch).score({ wav, mission })).rejects.toBeInstanceOf(ScoringFailedError);
});
it('rejects incomplete, refused, or ambiguous model output even when a score parses', () => {
  for (const finish_reason of ['length', 'content_filter']) {
    const body = toolReply(good);
    expect(() => parseOpenAiScore({ ...body, choices: [{ ...body.choices[0], finish_reason }] })).toThrow(ScoringFailedError);
  }
  const refused = toolReply(good);
  expect(() => parseOpenAiScore({ ...refused, choices: [{ message: { ...refused.choices[0].message, refusal: 'Unable to assess.' } }] })).toThrow(ScoringFailedError);
  const duplicate = toolReply(good);
  duplicate.choices[0].message.tool_calls.push(duplicate.choices[0].message.tool_calls[0]);
  expect(() => parseOpenAiScore(duplicate)).toThrow(ScoringFailedError);
  const alternatives = toolReply(good);
  alternatives.choices.push(alternatives.choices[0]);
  expect(() => parseOpenAiScore(alternatives)).toThrow(ScoringFailedError);
});
it('retries once on 429 and 5xx, then gives up', async () => {
  const flaky = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 429 })).mockResolvedValueOnce(ok(toolReply(good)));
  expect(await provider(flaky as unknown as typeof fetch).score({ wav, mission })).toEqual(good);
  expect(flaky).toHaveBeenCalledTimes(2);
  const down = vi.fn(async () => new Response('{}', { status: 503 }));
  await expect(provider(down as unknown as typeof fetch).score({ wav, mission })).rejects.toBeInstanceOf(ScoringFailedError);
  expect(down).toHaveBeenCalledTimes(2);
});
it('does not retry client errors or timeouts', async () => {
  const denied = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }));
  await expect(provider(denied as unknown as typeof fetch).score({ wav, mission })).rejects.toBeInstanceOf(ScoringFailedError);
  expect(denied).toHaveBeenCalledTimes(1);
  const hang = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  await expect(provider(hang as unknown as typeof fetch, { timeoutMs: 20 }).score({ wav, mission })).rejects.toBeInstanceOf(ScoringFailedError);
  expect(hang).toHaveBeenCalledTimes(1);
});
it('never logs the key or the audio', async () => {
  const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  await provider(vi.fn(async () => ok(toolReply(good))) as unknown as typeof fetch).score({ wav, mission });
  await provider(vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch).score({ wav, mission }).catch(() => {});
  const logged = JSON.stringify([...spy.mock.calls, ...err.mock.calls]);
  expect(logged).not.toContain('sk-test');
  expect(logged).not.toContain(Buffer.from(wav).toString('base64').slice(0, 40));
  spy.mockRestore(); err.mockRestore();
});
