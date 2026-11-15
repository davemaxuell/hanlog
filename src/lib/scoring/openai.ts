import { SYSTEM_PROMPT, buildUserText, SUBMIT_SCORE_TOOL } from './prompt';
import { RawScoreSchema, ScoringFailedError, type RawScore, type ScoringProvider } from './types';

// V2: text output, non-strict function, forced submit_score. See docs/spike/2026-11-scoring-spike.md.
export const SCORING_REQUEST_OPTIONS = {
  modalities: ['text'],
  tool_choice: { type: 'function', function: { name: 'submit_score' } },
  max_completion_tokens: 1000,
  store: false,
} as const;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

function firstJsonObject(content: string): unknown {
  // Track strings and escaped quotes so braces inside feedback do not end the object.
  const start = content.indexOf('{');
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; start !== -1 && i < content.length; i++) {
    const ch = content[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return JSON.parse(content.slice(start, i + 1));
  }
  throw new ScoringFailedError();
}

export function parseOpenAiScore(body: unknown): RawScore {
  try {
    const root = object(body);
    const choice = Array.isArray(root.choices) ? object(root.choices[0]) : {};
    const message = object(choice.message);
    let parsed: unknown;
    if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
      const call = object(message.tool_calls[0]);
      const fn = object(call.function);
      if (call.type !== 'function' || fn.name !== 'submit_score' || typeof fn.arguments !== 'string') throw new ScoringFailedError();
      parsed = JSON.parse(fn.arguments);
    } else if (typeof message.content === 'string') {
      parsed = firstJsonObject(message.content);
    } else throw new ScoringFailedError();
    const raw = { ...object(parsed) };
    for (const key of ['pronunciation', 'accuracy', 'usage']) {
      const value = raw[key];
      if (typeof value === 'string' && value.trim() !== '') raw[key] = Number(value);
    }
    return RawScoreSchema.parse(raw);
  } catch { throw new ScoringFailedError(); }
}

export function scoringUsage(body: unknown): Record<string, number | Record<string, number>> {
  const source = object(object(body).usage);
  const usage: Record<string, number | Record<string, number>> = {};
  for (const key of ['prompt_tokens', 'completion_tokens', 'total_tokens']) {
    if (typeof source[key] === 'number' && Number.isFinite(source[key])) usage[key] = source[key];
  }
  for (const key of ['prompt_tokens_details', 'completion_tokens_details']) {
    const details = object(source[key]);
    const numeric: Record<string, number> = {};
    for (const name of ['audio_tokens', 'text_tokens', 'cached_tokens', 'reasoning_tokens']) {
      if (typeof details[name] === 'number' && Number.isFinite(details[name])) numeric[name] = details[name];
    }
    if (Object.keys(numeric).length) usage[key] = numeric;
  }
  return usage;
}

export function createOpenAiProvider(opts: {
  apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number; retryDelayMs?: number;
  maxRetries?: 0 | 1;
}): ScoringProvider {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  return {
    name: 'openai',
    async score({ wav, mission }) {
      const started = performance.now();
      const body = JSON.stringify({
        model: opts.model,
        ...SCORING_REQUEST_OPTIONS,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: [
            { type: 'text', text: buildUserText(mission) },
            { type: 'input_audio', input_audio: { data: Buffer.from(wav).toString('base64'), format: 'wav' } },
          ] },
        ],
        tools: [SUBMIT_SCORE_TOOL],
      });
      for (let attempt = 0; attempt <= (opts.maxRetries ?? 1); attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
        let retry = false;
        try {
          const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
            method: 'POST', headers: { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' },
            body, signal: controller.signal,
          });
          if (!response.ok) {
            retry = RETRYABLE_STATUS.has(response.status) && attempt < (opts.maxRetries ?? 1);
            // Never include remote error bodies: they can echo credentials or input.
            if (!retry) throw new ScoringFailedError();
            await response.body?.cancel();
          } else {
            const responseBody: unknown = await response.json();
            const score = parseOpenAiScore(responseBody);
            console.info('[scoring]', { model: opts.model, ms: Math.round(performance.now() - started), usage: scoringUsage(responseBody) });
            return score;
          }
        } catch { throw new ScoringFailedError(); }
        finally { clearTimeout(timer); }
        if (retry) await new Promise(resolve => setTimeout(resolve, opts.retryDelayMs ?? 500));
      }
      throw new ScoringFailedError();
    },
  };
}
