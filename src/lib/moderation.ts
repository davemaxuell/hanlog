import { z } from 'zod';
import { hasLink } from './contracts';
import { getConfig } from './config';
import { ApiError } from './errors';
export async function assertTextAllowed(texts: string[], deps: { fetchImpl?: typeof fetch } = {}): Promise<void> {
  if (texts.some(hasLink)) throw new ApiError('content_rejected');
  const input = texts.map(text => text.trim()).filter(Boolean);
  const config = getConfig();
  if (!input.length || config.moderation === 'rules') return;
  try {
    const response = await (deps.fetchImpl ?? fetch)('https://api.openai.com/v1/moderations', {
      method: 'POST', headers: { Authorization: `Bearer ${config.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new ApiError('service_unavailable');
    const body = z.object({ results: z.array(z.object({ flagged: z.boolean() })).length(input.length) }).parse(await response.json());
    if (body.results.some(result => result.flagged)) throw new ApiError('content_rejected');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('service_unavailable');
  }
}
