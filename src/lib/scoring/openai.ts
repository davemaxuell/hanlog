import { ScoringFailedError, type ScoringProvider } from './types';
export function createOpenAiProvider(opts: { apiKey: string; model: string; fetchImpl?: typeof fetch; timeoutMs?: number }): ScoringProvider {
  void opts;
  return { name: 'openai', async score() { throw new ScoringFailedError('OpenAI provider is not implemented yet'); } };
}
