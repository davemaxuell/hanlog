import { z } from 'zod';
import type { Mission, ScoreIssue } from '../contracts';
export type RawScore = { speechDetected: boolean; heard: string; pronunciation: number; accuracy: number; usage: number; issues: ScoreIssue[]; praise: string; nextTip: string };
export const RawScoreSchema = z.object({
  speechDetected: z.boolean(), heard: z.string(), pronunciation: z.number().finite(), accuracy: z.number().finite(), usage: z.number().finite(),
  issues: z.array(z.object({ segment: z.string(), problem: z.string(), tip: z.string() })), praise: z.string(), nextTip: z.string(),
});
export interface ScoringProvider { readonly name: 'mock' | 'openai'; score(input: { wav: Uint8Array; mission: Mission }): Promise<RawScore>; }
export class NoSpeechError extends Error { constructor(message = 'No speech detected') { super(message); this.name = 'NoSpeechError'; } }
export class ScoringFailedError extends Error { constructor(message = 'Scoring failed') { super(message); this.name = 'ScoringFailedError'; } }
